import { api, esc, $, FIELD_GROUPS, toast, armConfirm } from './common.js';

const id = new URLSearchParams(location.search).get('id');
const fieldDefs = FIELD_GROUPS.flatMap((g) => g.fields);

function inputHtml(f, value) {
  const name = `name="${f.key}" id="f-${f.key}"`;
  if (f.type === 'bool') {
    return `<label class="check"><input type="checkbox" ${name} ${value ? 'checked' : ''}> ${esc(f.label)}</label>`;
  }
  let control;
  if (f.type === 'textarea') {
    control = `<textarea ${name}>${esc(value)}</textarea>`;
  } else if (f.type === 'select') {
    const opts = [...f.options];
    if (value && !opts.includes(value)) opts.push(value);
    control = `<select ${name}>${opts.map((o) => `<option value="${esc(o)}" ${o === (value ?? '') ? 'selected' : ''}>${esc(o || '—')}</option>`).join('')}</select>`;
  } else {
    const list = f.list ? `list="dl-${f.key}"` : '';
    control = `<input type="${f.type || 'text'}" ${name} ${list} value="${esc(value)}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>` +
      (f.list ? `<datalist id="dl-${f.key}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
  }
  return `<label for="f-${f.key}">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}`;
}

function render(p = {}) {
  $('#groups').innerHTML = FIELD_GROUPS.map((g) => `
    <div class="field-group">
      <h3>${esc(g.title)}</h3>
      <div class="form-grid">${g.fields.map((f) => `<div class="${f.wide ? 'wide' : ''}">${inputHtml(f, p[f.key] ?? (f.key === 'status_active' ? 'Active' : ''))}</div>`).join('')}</div>
    </div>`).join('');
}

function collect() {
  const body = {};
  for (const f of fieldDefs) {
    const el = document.getElementById(`f-${f.key}`);
    body[f.key] = f.type === 'bool' ? el.checked : el.value;
  }
  return body;
}

async function save(e) {
  e.preventDefault();
  const body = collect();
  if (!body.name.trim()) {
    $('#form-error').textContent = 'Name is required.';
    $('#form-error').classList.remove('hidden');
    $('#f-name').focus();
    return;
  }
  $('#save').disabled = true;
  try {
    const person = id
      ? await api(`/api/people/${id}`, { method: 'PUT', body })
      : await api('/api/people', { method: 'POST', body });
    location.href = `/person?id=${person.id}`;
  } catch (err) {
    $('#form-error').textContent = err.message;
    $('#form-error').classList.remove('hidden');
    $('#save').disabled = false;
  }
}

async function init() {
  if (id) {
    document.title = 'Edit Person · TCSN Roster';
    $('#form-title').textContent = 'Edit Person';
    $('#cancel').href = `/person?id=${id}`;
    $('#delete').classList.remove('hidden');
    $('#delete-hint').classList.remove('hidden');
    try {
      const { person } = await api(`/api/people/${encodeURIComponent(id)}`);
      $('#form-title').textContent = `Edit ${person.name}`;
      render(person);
    } catch (err) {
      $('#form-title').textContent = err.message;
    }
  } else {
    render();
    $('#f-name').focus();
  }
}

$('#person-form').addEventListener('submit', save);
$('#delete').addEventListener('click', (e) => armConfirm(e.currentTarget, 'Tap again to delete permanently', async () => {
  try {
    await api(`/api/people/${id}`, { method: 'DELETE' });
    location.href = '/';
  } catch (err) { toast(err.message, true); }
}));

init();
