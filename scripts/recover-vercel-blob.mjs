import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import dotenv from "dotenv";
import { list } from "@vercel/blob";

const [envFile, destination] = process.argv.slice(2);

if (!envFile || !destination) {
  throw new Error("Usage: node scripts/recover-vercel-blob.mjs <env-file> <destination>");
}

dotenv.config({ path: envFile, quiet: true });

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  throw new Error("BLOB_READ_WRITE_TOKEN is missing from the supplied env file");
}

const objectsDirectory = path.join(destination, "objects");
fs.mkdirSync(objectsDirectory, { recursive: true });

function safeSegment(segment) {
  const sanitized = decodeURIComponent(segment)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "_");
  return sanitized === "." || sanitized === ".." || sanitized === "" ? "_" : sanitized;
}

function destinationFor(pathname) {
  const segments = pathname.split("/").filter(Boolean).map(safeSegment);
  return path.join(objectsDirectory, ...(segments.length ? segments : ["unnamed-blob"]));
}

async function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function downloadBlob(blob, index) {
  const filePath = destinationFor(blob.pathname);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (fs.existsSync(filePath) && fs.statSync(filePath).size === blob.size) {
    return {
      index,
      pathname: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl ?? blob.url,
      uploadedAt: blob.uploadedAt,
      expectedBytes: blob.size,
      localFile: path.relative(destination, filePath).replaceAll("\\", "/"),
      status: "already-present",
      bytes: blob.size,
      sha256: await sha256(filePath),
      error: "",
    };
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(blob.downloadUrl ?? blob.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const temporaryPath = `${filePath}.partial`;
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath));
      fs.renameSync(temporaryPath, filePath);
      const bytes = fs.statSync(filePath).size;

      if (typeof blob.size === "number" && bytes !== blob.size) {
        throw new Error(`size mismatch: expected ${blob.size}, received ${bytes}`);
      }

      return {
        index,
        pathname: blob.pathname,
        url: blob.url,
        downloadUrl: blob.downloadUrl ?? blob.url,
        uploadedAt: blob.uploadedAt,
        expectedBytes: blob.size,
        localFile: path.relative(destination, filePath).replaceAll("\\", "/"),
        status: "downloaded",
        bytes,
        sha256: await sha256(filePath),
        error: "",
      };
    } catch (error) {
      lastError = error;
      const partialPath = `${filePath}.partial`;
      if (fs.existsSync(partialPath)) fs.rmSync(partialPath);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  return {
    index,
    pathname: blob.pathname,
    url: blob.url,
    downloadUrl: blob.downloadUrl ?? blob.url,
    uploadedAt: blob.uploadedAt,
    expectedBytes: blob.size,
    localFile: path.relative(destination, filePath).replaceAll("\\", "/"),
    status: "failed",
    bytes: 0,
    sha256: "",
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

const blobs = [];
let cursor;

do {
  const page = await list({ token, cursor, limit: 1000 });
  blobs.push(...page.blobs);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

blobs.sort((left, right) => left.pathname.localeCompare(right.pathname));
fs.writeFileSync(
  path.join(destination, "blob-inventory.json"),
  `${JSON.stringify(blobs, null, 2)}\n`,
  "utf8",
);

const manifest = new Array(blobs.length);
let nextIndex = 0;
const concurrency = Math.min(8, Math.max(1, blobs.length));

async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= blobs.length) return;
    manifest[index] = await downloadBlob(blobs[index], index + 1);
    if ((index + 1) % 50 === 0 || index + 1 === blobs.length) {
      console.log(`Blob progress: ${index + 1}/${blobs.length}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

fs.writeFileSync(
  path.join(destination, "blob-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const csvColumns = [
  "index",
  "pathname",
  "url",
  "downloadUrl",
  "uploadedAt",
  "expectedBytes",
  "localFile",
  "status",
  "bytes",
  "sha256",
  "error",
];
const csv = [
  csvColumns.map(csvCell).join(","),
  ...manifest.map((row) => csvColumns.map((column) => csvCell(row[column])).join(",")),
].join("\r\n");
fs.writeFileSync(path.join(destination, "blob-manifest.csv"), `${csv}\r\n`, "utf8");

const failed = manifest.filter((item) => item.status === "failed");
const summary = {
  recoveredAtUtc: new Date().toISOString(),
  objects: blobs.length,
  expectedBytes: blobs.reduce((total, blob) => total + (blob.size ?? 0), 0),
  savedBytes: manifest.reduce((total, item) => total + item.bytes, 0),
  downloaded: manifest.filter((item) => item.status === "downloaded").length,
  alreadyPresent: manifest.filter((item) => item.status === "already-present").length,
  failed: failed.length,
};
fs.writeFileSync(path.join(destination, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));

if (failed.length) process.exitCode = 1;
