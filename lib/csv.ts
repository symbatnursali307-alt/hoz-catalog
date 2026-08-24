export function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvDocument(rows: unknown[][], separator = ';') {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(separator)).join('\r\n')}\r\n`;
}

export function xmlCell(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] as string);
}
