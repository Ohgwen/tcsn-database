import { cleanPerson } from '../../../lib/people.js';
import { json, readJson, badRequest } from '../../../lib/http.js';

// GET /api/people -> every person plus note stats (roster is small; filtering happens client-side)
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM notes n WHERE n.person_id = p.id) AS note_count,
      (SELECT COUNT(*) FROM notes n WHERE n.person_id = p.id AND n.category = 'Reliability/Problem') AS problem_count,
      (SELECT MAX(entry_date) FROM notes n WHERE n.person_id = p.id) AS last_note_date
    FROM people p
    ORDER BY p.name COLLATE NOCASE`).all();
  return json(results);
}

// POST /api/people -> create
export async function onRequestPost({ request, env }) {
  const { values, error } = cleanPerson(await readJson(request));
  if (error) return badRequest(error);
  const cols = Object.keys(values);
  const person = await env.DB
    .prepare(`INSERT INTO people (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`)
    .bind(...cols.map((c) => values[c]))
    .first();
  return json(person, 201);
}
