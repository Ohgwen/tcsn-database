import { normalizeHeader } from './people.js';

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes).
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// Returns { columns: normalized header names, records: [{column: value}] }
export function csvToRecords(text) {
  const [header = [], ...rows] = parseCSV(text);
  const columns = header.map(normalizeHeader);
  const records = rows.map((r) => {
    const obj = {};
    columns.forEach((col, i) => { if (col) obj[col] = r[i] ?? ''; });
    return obj;
  });
  return { columns, records };
}
