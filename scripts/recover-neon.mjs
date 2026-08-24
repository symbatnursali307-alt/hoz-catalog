import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const [envFile, destination] = process.argv.slice(2);

if (!envFile || !destination) {
  throw new Error("Usage: node scripts/recover-neon.mjs <env-file> <destination>");
}

dotenv.config({ path: envFile, quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from the supplied env file");
}

fs.mkdirSync(destination, { recursive: true });
const tablesDirectory = path.join(destination, "tables");
fs.mkdirSync(tablesDirectory, { recursive: true });

const prisma = new PrismaClient({ log: ["error"] });

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return { type: "Buffer", hex: value.toString("hex") };
  if (value?.constructor?.name === "Decimal") return value.toString();
  return value;
}

function writeJson(filename, value) {
  fs.writeFileSync(filename, `${JSON.stringify(value, jsonReplacer, 2)}\n`, "utf8");
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function quoteString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlLiteral(value, column) {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `decode('${value.toString("hex")}', 'hex')`;
  if (value instanceof Date) return `${quoteString(value.toISOString())}::timestamptz`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  if (value?.constructor?.name === "Decimal") return value.toString();
  if (column?.data_type === "json" || column?.data_type === "jsonb") {
    return `${quoteString(JSON.stringify(value, jsonReplacer))}::${column.data_type}`;
  }
  return quoteString(value);
}

function tableOrder(tableNames, foreignKeys) {
  const remaining = new Set(tableNames);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) => {
      const parents = foreignKeys
        .filter((key) => key.child_table === table)
        .map((key) => key.parent_table)
        .filter((parent) => remaining.has(parent) && parent !== table);
      return parents.length === 0;
    });
    if (!ready.length) {
      ordered.push(...[...remaining].sort());
      break;
    }
    for (const table of ready.sort()) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

try {
  const database = await prisma.$queryRawUnsafe(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_schema() AS current_schema,
      version() AS postgres_version,
      NOW() AS captured_at
  `);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const columns = await prisma.$queryRawUnsafe(`
    SELECT
      table_name,
      column_name,
      ordinal_position,
      column_default,
      is_nullable,
      data_type,
      udt_name,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      cls.relname AS table_name,
      pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
    ORDER BY cls.relname, con.conname
  `);

  const foreignKeys = await prisma.$queryRawUnsafe(`
    SELECT
      child.relname AS child_table,
      parent.relname AS parent_table,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = child.relnamespace
    WHERE nsp.nspname = 'public' AND con.contype = 'f'
    ORDER BY child.relname, con.conname
  `);

  const indexes = await prisma.$queryRawUnsafe(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const sequences = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM pg_sequences
    WHERE schemaname = 'public'
    ORDER BY sequencename
  `);

  const views = await prisma.$queryRawUnsafe(`
    SELECT schemaname, viewname, definition
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname
  `);

  const triggers = await prisma.$queryRawUnsafe(`
    SELECT event_object_table, trigger_name, event_manipulation, action_timing, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name, event_manipulation
  `);

  const functions = await prisma.$queryRawUnsafe(`
    SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname, arguments
  `);

  const policies = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  const tableNames = tables.map((row) => row.table_name);
  const orderedTables = tableOrder(tableNames, foreignKeys);
  const tableData = new Map();
  const counts = {};

  for (const tableName of orderedTables) {
    const escapedTable = quoteIdentifier(tableName);
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${escapedTable}`);
    tableData.set(tableName, rows);
    counts[tableName] = rows.length;
    writeJson(path.join(tablesDirectory, `${tableName}.json`), rows);
    console.log(`Neon table: ${tableName} (${rows.length})`);
  }

  writeJson(path.join(destination, "database.json"), database[0] ?? {});
  writeJson(path.join(destination, "schema-metadata.json"), {
    tables,
    columns,
    constraints,
    foreignKeys,
    indexes,
    sequences,
    views,
    triggers,
    functions,
    policies,
  });

  const columnMap = new Map();
  for (const column of columns) {
    columnMap.set(`${column.table_name}.${column.column_name}`, column);
  }

  const sql = [
    "-- Recovery data export generated from Neon.",
    "-- Apply the Prisma schema first, then run this file against an empty database.",
    "BEGIN;",
  ];

  for (const tableName of orderedTables) {
    const rows = tableData.get(tableName);
    for (const row of rows) {
      const columnNames = Object.keys(row);
      const identifiers = columnNames.map(quoteIdentifier).join(", ");
      const values = columnNames
        .map((columnName) => sqlLiteral(row[columnName], columnMap.get(`${tableName}.${columnName}`)))
        .join(", ");
      sql.push(`INSERT INTO ${quoteIdentifier(tableName)} (${identifiers}) VALUES (${values});`);
    }
  }
  sql.push("COMMIT;", "");
  fs.writeFileSync(path.join(destination, "data.sql"), sql.join("\n"), "utf8");

  const summary = {
    recoveredAtUtc: new Date().toISOString(),
    database: database[0]?.database_name,
    tables: tableNames.length,
    rows: Object.values(counts).reduce((sum, count) => sum + count, 0),
    tableOrder: orderedTables,
    counts,
  };
  writeJson(path.join(destination, "summary.json"), summary);
  console.log(JSON.stringify(summary));
} finally {
  await prisma.$disconnect();
}
