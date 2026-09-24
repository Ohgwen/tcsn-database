import { cleanNote } from '../../../lib/people.js';
import { json, readJson, badRequest, notFound, parseId } from '../../../lib/http.js';

// PUT /api/notes/:id -> fix a typo / category / date on a single note
export async function onRequestPut({ params, request, env }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const { values, error } = cleanNote(await readJson(request), { partial: true });
  if (error) return badRequest(error);
  const cols = Object.keys(values);
  if (!cols.length) return badRequest('No fields to update');
  const note = await env.DB
    .prepare(`UPDATE notes SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? RETURNING *`)
    .bind(...Object.values(values), id)
    .first();
  return note ? json(note) : notFound('Note not found');
}

export async function onRequestDelete({ params, env }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const { meta } = await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  return meta.changes ? json({ ok: true }) : notFound('Note not found');
}
