import { csvToRecords } from '../../lib/csv.js';
import { PERSON_FIELDS, cleanPerson } from '../../lib/people.js';
import { json, readJson, badRequest } from '../../lib/http.js';

/**
 * POST /api/import  { csv: "<text>", dryRun: true|false }
 * Upserts people. A row matches an existing person by net_id, then email, then exact name
 * (case-insensitive). Matched rows only overwrite columns that are non-blank in the CSV.
 */
export async function onRequestPost({ request, env }) {
  const { csv, dryRun = true } = await readJson(request);
  if (!csv || typeof csv !== 'string') return badRequest('Missing csv text');

  const { columns, records } = csvToRecords(csv);
  if (!columns.includes('name')) return badRequest('CSV must have a "name" column');
  const known = columns.filter((c) => PERSON_FIELDS.includes(c));
  const ignored = columns.filter((c) => c && !PERSON_FIELDS.includes(c));

  const { results: existing } = await env.DB.prepare('SELECT id, name, email, net_id FROM people').all();
  const byNetId = new Map(), byEmail = new Map(), byName = new Map();
  const key = (v) => (v ? String(v).trim().toLowerCase() : '');
  for (const p of existing) {
    if (key(p.net_id)) byNetId.set(key(p.net_id), p.id);
    if (key(p.email)) byEmail.set(key(p.email), p.id);
    if (key(p.name)) byName.set(key(p.name), p.id);
  }

  const statements = [];
  const errors = [];
  const seen = new Set();
  let inserted = 0, updated = 0;

  records.forEach((rec, i) => {
    const line = i + 2; // header is line 1
    const { values, error } = cleanPerson(rec, { partial: true, skipBlank: true });
    if (error || !values.name) return errors.push({ line, error: error || 'Missing name' });

    const k = key(values.net_id) || key(values.email) || key(values.name);
    if (seen.has(k)) return errors.push({ line, error: `Duplicate of an earlier row (${values.name})` });
    seen.add(k);

    const matchId = byNetId.get(key(values.net_id)) ?? byEmail.get(key(values.email)) ?? byName.get(key(values.name));
    const cols = Object.keys(values);
    if (matchId) {
      updated++;
      statements.push(env.DB
        .prepare(`UPDATE people SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(...cols.map((c) => values[c]), matchId));
    } else {
      inserted++;
      statements.push(env.DB
        .prepare(`INSERT INTO people (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .bind(...cols.map((c) => values[c])));
    }
  });

  if (!dryRun) {
    for (let i = 0; i < statements.length; i += 50) await env.DB.batch(statements.slice(i, i + 50));
  }
  return json({ dryRun: !!dryRun, rows: records.length, inserted, updated, errors, columns: known, ignored });
}
