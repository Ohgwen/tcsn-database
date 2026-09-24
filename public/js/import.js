import { api, esc, $, toast } from './common.js';

$('#file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $('#csv').value = await file.text();
  preview();
});
$('#csv').addEventListener('input', () => ($('#run').disabled = true));

function show(r) {
  const box = $('#result');
  box.classList.remove('hidden');
  box.innerHTML = `
    <h2>${r.dryRun ? 'Preview (nothing saved yet)' : 'Import complete ✓'}</h2>
    <p>${r.rows} rows · <strong>${r.inserted}</strong> ${r.dryRun ? 'will be added' : 'added'} ·
       <strong>${r.updated}</strong> ${r.dryRun ? 'will be updated' : 'updated'} · ${r.errors.length} skipped</p>
    <p class="small"><strong>Columns used:</strong> ${r.columns.map(esc).join(', ') || '—'}</p>
    ${r.ignored.length ? `<p class="small"><strong>Ignored (unrecognized):</strong> ${r.ignored.map(esc).join(', ')}</p>` : ''}
    ${r.errors.length ? `<pre class="errors">${r.errors.map((e) => `Line ${e.line}: ${esc(e.error)}`).join('\n')}</pre>` : ''}
    ${r.dryRun ? '' : '<p><a class="btn btn-primary" href="/">Back to roster</a></p>'}`;
}

async function send(dryRun) {
  const csv = $('#csv').value;
  if (!csv.trim()) return toast('Choose a file or paste CSV first', true);
  const r = await api('/api/import', { method: 'POST', body: { csv, dryRun } });
  show(r);
  return r;
}

async function preview() {
  try {
    const r = await send(true);
    $('#run').disabled = !r || r.inserted + r.updated === 0;
  } catch (err) { toast(err.message, true); }
}

$('#preview').addEventListener('click', preview);
$('#run').addEventListener('click', async () => {
  $('#run').disabled = true;
  try { await send(false); } catch (err) { toast(err.message, true); $('#run').disabled = false; }
});
