import {
  api, esc, $, badge, readBadgeClass, isActive, todayLocal, CATEGORIES, categoryInfo,
  formatDate, formatTimestamp, toast, storageGet, storageSet, armConfirm, FIELD_GROUPS,
} from './common.js';

const id = new URLSearchParams(location.search).get('id');
let person = null;
let notes = [];
let filter = '';
let editingId = null;

// ---------- header + details ----------

function renderPerson() {
  const p = person;
  document.title = `${p.name} · TCSN Roster`;
  $('#p-name').textContent = p.name;
  $('#edit-link').href = `/edit?id=${p.id}`;
  const active = isActive(p);
  $('#p-badges').innerHTML = [
    badge(active ? 'Active' : 'Inactive', active ? 'badge-active' : 'badge-inactive'),
    p.immediate_read ? badge(p.immediate_read, readBadgeClass(p.immediate_read)) : '',
    badge(p.track), badge(p.year),
    p.has_car === 'Yes' ? badge('🚗 Has car') : '',
  ].join(' ');
  const phoneDigits = String(p.phone || '').replace(/[^\d+]/g, '');
  $('#p-contact').innerHTML = [
    p.phone ? `<a class="btn btn-small" href="tel:${esc(phoneDigits)}">📞 ${esc(p.phone)}</a>` : '',
    p.phone ? `<a class="btn btn-small" href="sms:${esc(phoneDigits)}">💬 Text</a>` : '',
    p.email ? `<a class="btn btn-small" href="mailto:${esc(p.email)}">✉ ${esc(p.email)}</a>` : '',
    p.net_id ? `<span class="small muted" style="align-self:center">NetID: ${esc(p.net_id)}</span>` : '',
  ].join('');

  $('#p-fields').innerHTML = FIELD_GROUPS.map((g) => `
    <div class="field-group">
      <h3>${esc(g.title)}</h3>
      <dl class="kv">${g.fields.map((f) => {
        let v = p[f.key];
        if (f.type === 'bool') v = v ? 'Yes' : 'No';
        const empty = v == null || v === '';
        return `<div class="${f.wide ? 'wide' : ''}"><dt>${esc(f.label)}</dt><dd class="${empty ? 'empty' : ''}">${empty ? '—' : esc(v)}</dd></div>`;
      }).join('')}</dl>
    </div>`).join('');
  $('#p-stamps').textContent = `Added ${formatTimestamp(p.created_at)} · Last updated ${formatTimestamp(p.updated_at)}`;
}

// ---------- notes ----------

function categoryChips(container, name, selected, { withAll = false, counts = null } = {}) {
  const items = withAll ? [{ name: '', short: 'All', cls: '' }, ...CATEGORIES] : CATEGORIES;
  container.innerHTML = items.map((c, i) => {
    const count = counts ? ` (${c.name ? counts[c.name] || 0 : notes.length})` : '';
    return `<input type="radio" name="${name}" id="${name}-${i}" value="${esc(c.name)}" ${c.name === selected ? 'checked' : ''}>` +
      `<label class="chip ${c.cls}" for="${name}-${i}">${esc(c.short)}${count}</label>`;
  }).join('');
}

function renderNotes() {
  $('#note-count').textContent = notes.length ? `(${notes.length})` : '';
  const counts = {};
  notes.forEach((n) => (counts[n.category] = (counts[n.category] || 0) + 1));
  categoryChips($('#filter-chips'), 'filter', filter, { withAll: true, counts });

  const list = filter ? notes.filter((n) => n.category === filter) : notes;
  if (!list.length) {
    $('#timeline').innerHTML = `<li class="empty-state">${notes.length ? 'No notes in this category.' : 'No notes yet. Add the first one above.'}</li>`;
    return;
  }
  $('#timeline').innerHTML = list.map((n) => (n.id === editingId ? editTemplate(n) : entryTemplate(n))).join('');
}

function entryTemplate(n) {
  const c = categoryInfo(n.category);
  return `<li class="entry ${c.cls}" data-id="${n.id}">
    <div class="entry-head">
      <span class="entry-date">${esc(formatDate(n.entry_date))}</span>
      <span class="entry-tag">${n.category === 'Reliability/Problem' ? '⚠ ' : ''}${esc(n.category)}</span>
    </div>
    <p class="entry-text">${esc(n.note)}</p>
    <div class="entry-foot">
      <span>${n.author ? `${esc(n.author)} · ` : ''}entered ${esc(formatTimestamp(n.created_at))}</span>
      <span class="actions">
        <button type="button" class="btn-small btn-ghost" data-action="edit">Edit</button>
        <button type="button" class="btn-small btn-ghost btn-danger" data-action="delete">Delete</button>
      </span>
    </div>
  </li>`;
}

function editTemplate(n) {
  const c = categoryInfo(n.category);
  return `<li class="entry ${c.cls}" data-id="${n.id}">
    <form class="note-form" data-edit-form>
      <select name="category" aria-label="Category">${CATEGORIES.map((x) => `<option ${x.name === n.category ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <textarea name="note" required aria-label="Note">${esc(n.note)}</textarea>
      <div class="row">
        <div><label>Date</label><input type="date" name="entry_date" value="${esc(n.entry_date)}" required></div>
        <div><label>Author</label><input type="text" name="author" value="${esc(n.author)}" maxlength="100"></div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary btn-small">Save</button>
        <button type="button" class="btn-small" data-action="cancel">Cancel</button>
      </div>
    </form>
  </li>`;
}

async function addNote(e) {
  e.preventDefault();
  const text = $('#note-text').value.trim();
  if (!text) return $('#note-text').focus();
  const category = $('input[name="newcat"]:checked')?.value || 'General';
  const author = $('#note-author').value.trim();
  const btn = $('#note-submit');
  btn.disabled = true;
  try {
    const note = await api(`/api/people/${id}/notes`, {
      method: 'POST',
      body: { category, note: text, entry_date: $('#note-date').value || todayLocal(), author },
    });
    notes.unshift(note);
    notes.sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at) || b.id - a.id);
    storageSet('tcsn-author', author);
    $('#note-text').value = '';
    if (filter && filter !== category) filter = '';
    renderNotes();
    toast('Note added');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function onTimelineClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const li = btn.closest('li[data-id]');
  const noteId = Number(li.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit') {
    editingId = noteId;
    renderNotes();
    $(`li[data-id="${noteId}"] textarea`)?.focus();
  } else if (action === 'cancel') {
    editingId = null;
    renderNotes();
  } else if (action === 'delete') {
    armConfirm(btn, 'Tap to confirm', async () => {
      try {
        await api(`/api/notes/${noteId}`, { method: 'DELETE' });
        notes = notes.filter((n) => n.id !== noteId);
        renderNotes();
        toast('Note deleted');
      } catch (err) { toast(err.message, true); }
    });
  }
}

async function onTimelineSubmit(e) {
  if (!e.target.matches('[data-edit-form]')) return;
  e.preventDefault();
  const noteId = Number(e.target.closest('li').dataset.id);
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const updated = await api(`/api/notes/${noteId}`, { method: 'PUT', body });
    notes = notes.map((n) => (n.id === noteId ? updated : n))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at) || b.id - a.id);
    editingId = null;
    renderNotes();
    toast('Note updated');
  } catch (err) { toast(err.message, true); }
}

// ---------- init ----------

async function load() {
  if (!id) { location.href = '/'; return; }
  try {
    ({ person, notes } = await api(`/api/people/${encodeURIComponent(id)}`));
  } catch (err) {
    $('#p-name').textContent = err.message;
    return;
  }
  renderPerson();
  renderNotes();
}

categoryChips($('#cat-chips'), 'newcat', storageGet('tcsn-last-cat', 'Game Worked'));
$('#cat-chips').addEventListener('change', (e) => storageSet('tcsn-last-cat', e.target.value));
$('#note-date').value = todayLocal();
$('#note-author').value = storageGet('tcsn-author');
$('#note-form').addEventListener('submit', addNote);
$('#note-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#note-form').requestSubmit();
});
$('#filter-chips').addEventListener('change', (e) => { filter = e.target.value; renderNotes(); });
$('#timeline').addEventListener('click', onTimelineClick);
$('#timeline').addEventListener('submit', onTimelineSubmit);
// On phones, collapse the long details block so notes are one scroll away.
if (window.matchMedia('(max-width: 720px)').matches) $('#fields').open = false;

load();
