#!/usr/bin/env node
// Convert a roster CSV into INSERT statements for D1.
//   node scripts/csv-to-sql.mjs roster.csv > roster.seed.sql
//   npx wrangler d1 execute tcsn-db --remote --file roster.seed.sql
// For re-imports into a database that already has people, use the in-app Import page
// instead (it matches existing people and updates them rather than duplicating).
import { readFileSync } from 'node:fs';
import { csvToRecords } from '../lib/csv.js';
import { PERSON_FIELDS, cleanPerson } from '../lib/people.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/csv-to-sql.mjs <roster.csv> > roster.seed.sql');
  process.exit(1);
}

const { columns, records } = csvToRecords(readFileSync(file, 'utf8'));
const ignored = columns.filter((c) => c && !PERSON_FIELDS.includes(c));
if (!columns.includes('name')) {
  console.error('CSV must have a "name" column. Found:', columns.join(', '));
  process.exit(1);
}
if (ignored.length) console.error(`Ignoring unrecognized columns: ${ignored.join(', ')}`);

const sqlValue = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

let count = 0;
records.forEach((rec, i) => {
  const { values, error } = cleanPerson(rec, { skipBlank: true });
  if (error) {
    console.error(`Line ${i + 2}: skipped (${error})`);
    return;
  }
  const cols = Object.keys(values);
  console.log(`INSERT INTO people (${cols.join(', ')}) VALUES (${cols.map((c) => sqlValue(values[c])).join(', ')});`);
  count++;
});
console.error(`Wrote ${count} INSERT statements.`);
