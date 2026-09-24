import { cleanPerson } from '../../../lib/people.js';
import { json, readJson, badRequest, notFound, parseId } from '../../../lib/http.js';

// GET /api/people/:id -> person + full notes timeline
export async function onRequestGet({ params, env }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const person = await env.DB.prepare('SELECT * FROM people WHERE id = ?').bind(id).first();
  if (!person) return notFound('Person not found');
  const { results: notes } = await env.DB
    .prepare('SELECT * FROM notes WHERE person_id = ? ORDER BY entry_date DESC, created_at DESC, id DESC')
    .bind(id)
    .all();
  return json({ person, notes });
}

// PUT /api/people/:id -> partial update (only fields sent are changed)
export async function onRequestPut({ params, request, env }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const { values, error } = cleanPerson(await readJson(request), { partial: true });
  if (error) return badRequest(error);
  const cols = Object.keys(values);
  if (!cols.length) return badRequest('No fields to update');
  const person = await env.DB
    .prepare(`UPDATE people SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`)
    .bind(...cols.map((c) => values[c]), id)
    .first();
  return person ? json(person) : notFound('Person not found');
}

// DELETE /api/people/:id -> removes the person and all their notes
export async function onRequestDelete({ params, env }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const [, del] = await env.DB.batch([
    env.DB.prepare('DELETE FROM notes WHERE person_id = ?').bind(id),
    env.DB.prepare('DELETE FROM people WHERE id = ?').bind(id),
  ]);
  return del.meta.changes ? json({ ok: true }) : notFound('Person not found');
}
