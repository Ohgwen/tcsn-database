import { cleanNote } from '../../../../lib/people.js';
import { json, readJson, badRequest, notFound, parseId } from '../../../../lib/http.js';

// POST /api/people/:id/notes -> append a note (never overwrites existing notes)
export async function onRequestPost({ params, request, env }) {
  const personId = parseId(params.id);
  if (!personId) return notFound();
  const { values, error } = cleanNote(await readJson(request));
  if (error) return badRequest(error);
  const exists = await env.DB.prepare('SELECT 1 FROM people WHERE id = ?').bind(personId).first();
  if (!exists) return notFound('Person not found');
  const cols = ['person_id', ...Object.keys(values)];
  const note = await env.DB
    .prepare(`INSERT INTO notes (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`)
    .bind(personId, ...Object.values(values))
    .first();
  return json(note, 201);
}
