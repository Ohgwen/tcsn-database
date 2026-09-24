import { api, esc, $, badge, readBadgeClass, isActive, isYes, logout, toast } from './common.js';

let people = [];
const sort = { key: 'name', dir: 1 };
const FILTER_IDS = { track: 'f-track', year: 'f-year', status: 'f-status', car: 'f-car', interviewed: 'f-interviewed' };

// "On-Air, Production" -> ["On-Air", "Production"]
const splitTracks = (t) => String(t || '').split(/\s*(?:,|\/(?!Content)|&|\+|;|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);

const YEAR_ORDER = ['freshman', 'sophomore', 'junior', 'senior', 'graduate', 'alumni'];
const yearRank = (y) => { const i = YEAR_ORDER.indexOf(String(y || '').toLowerCase()); return i === -1 ? 99 : i; };

function fillSelect(el, values) {
  for (const v of values) el.add(new Option(v, v));
}

function readState() {
  const q = new URLSearchParams(location.search);
  $('#search').value = q.get('q') || '';
  for (const [k, id] of Object.entries(FILTER_IDS)) {
    if (q.has(k)) $('#' + id).value = q.get(k);
  }
}

function writeState() {
  const q = new URLSearchParams();
  if ($('#search').value) q.set('q', $('#search').value);
  for (const [k, id] of Object.entries(FILTER_IDS)) {
    const v = $('#' + id).value;
    if (k === 'status' ? v !== 'Active' : v) q.set(k, v);
  }
  history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
}

function matches(p) {
  const q = $('#search').value.trim().toLowerCase();
  if (q && !String(p.name || '').toLowerCase().includes(q)) return false;
  const track = $('#f-track').value;
  if (track && !splitTracks(p.track).some((t) => t.toLowerCase() === track.toLowerCase())) return false;
  const year = $('#f-year').value;
  if (year && String(p.year || '') !== year) return false;
  const status = $('#f-status').value;
  if (status === 'Active' && !isActive(p)) return false;
  if (status === 'Inactive' && isActive(p)) return false;
  const car = $('#f-car').value;
  if (car && isYes(p.has_car) !== (car === 'yes')) return false;
  const iv = $('#f-interviewed').value;
  if (iv && !!p.interviewed !== (iv === 'yes')) return false;
  return true;
}

function compare(a, b) {
  const k = sort.key;
  let av = a[k], bv = b[k];
  if (k === 'year') { av = yearRank(av); bv = yearRank(bv); }
  if (k === 'note_count') { av = Number(av) || 0; bv = Number(bv) || 0; }
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir || String(a.name).localeCompare(b.name);
  av = String(av ?? ''); bv = String(bv ?? '');
  if (!av && bv) return 1; // blanks last
  if (av && !bv) return -1;
  return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * sort.dir || String(a.name).localeCompare(b.name);
}

function render() {
  writeState();
  const list = people.filter(matches).sort(compare);
  $('#count').textContent = `Showing ${list.length} of ${people.length}`;
  document.querySelectorAll('.roster th').forEach((th) => {
    th.setAttribute('aria-sort', th.dataset.sort === sort.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
  });
  if (!list.length) {
    $('#rows').innerHTML = `<tr><td colspan="7" class="empty-state">${people.length ? 'No one matches these filters.' : 'No people yet — add someone or import a CSV.'}</td></tr>`;
    return;
  }
  $('#rows').innerHTML = list.map((p) => {
    const active = isActive(p);
    const problems = p.problem_count ? ` ${badge(`⚠ ${p.problem_count}`, 'badge-problem')}` : '';
    const meta = [p.track, p.year, isYes(p.has_car) ? '🚗 Car' : '', active ? '' : 'Inactive'].filter(Boolean).map(esc).join(' · ');
    return `<tr data-id="${p.id}" class="${active ? '' : 'inactive'}">
      <td class="name"><a href="/person?id=${p.id}">${esc(p.name)}</a>${problems}</td>
      <td class="desktop">${esc(p.track)}</td>
      <td class="desktop">${esc(p.year)}</td>
      <td class="desktop">${esc(p.has_car)}</td>
      <td class="desktop">${badge(active ? 'Active' : 'Inactive', active ? 'badge-active' : 'badge-inactive')}</td>
      <td class="read">${badge(p.immediate_read, readBadgeClass(p.immediate_read))}</td>
      <td class="desktop notes-col muted">${p.note_count || ''}</td>
      <td class="meta">${meta}${p.note_count ? ` · ${p.note_count} note${p.note_count > 1 ? 's' : ''}` : ''}</td>
    </tr>`;
  }).join('');
}

async function load() {
  try {
    people = await api('/api/people');
  } catch (err) {
    $('#count').textContent = '';
    toast(err.message, true);
    return;
  }
  const tracks = new Map();
  people.forEach((p) => splitTracks(p.track).forEach((t) => tracks.set(t.toLowerCase(), t)));
  fillSelect($('#f-track'), [...tracks.values()].sort());
  fillSelect($('#f-year'), [...new Set(people.map((p) => p.year).filter(Boolean))].sort((a, b) => yearRank(a) - yearRank(b) || a.localeCompare(b)));
  readState();
  render();
}

$('#search').addEventListener('input', render);
Object.values(FILTER_IDS).forEach((id) => $('#' + id).addEventListener('change', render));
$('#clear').addEventListener('click', () => {
  $('#search').value = '';
  Object.values(FILTER_IDS).forEach((id) => ($('#' + id).value = ''));
  $('#f-status').value = 'Active';
  render();
});
document.querySelectorAll('.roster th').forEach((th) => th.addEventListener('click', () => {
  sort.dir = sort.key === th.dataset.sort ? -sort.dir : (th.dataset.sort === 'note_count' ? -1 : 1);
  sort.key = th.dataset.sort;
  render();
}));
$('#rows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr && !e.target.closest('a')) location.href = `/person?id=${tr.dataset.id}`;
});
$('#logout').addEventListener('click', logout);

load();
