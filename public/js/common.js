// Shared helpers for all pages.

export async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} };
  if (body !== undefined || method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body ?? {});
  }
  const res = await fetch(path, opts);
  if (res.status === 401 && path !== '/api/login') {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CATEGORIES = [
  { name: 'Performance', cls: 'cat-perf', short: 'Performance' },
  { name: 'Reliability/Problem', cls: 'cat-problem', short: 'Reliability' },
  { name: 'Training/Shadow', cls: 'cat-training', short: 'Training' },
  { name: 'Game Worked', cls: 'cat-game', short: 'Game' },
  { name: 'Contribution', cls: 'cat-contrib', short: 'Contribution' },
  { name: 'General', cls: 'cat-general', short: 'General' },
];
export const categoryInfo = (name) => CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];

// Immediate Read -> badge color
export function readBadgeClass(value) {
  const v = String(value || '').toLowerCase();
  if (!v) return '';
  if (/standout|strong|excellent|high|top|great/.test(v)) return 'badge-gold';
  if (/concern|red flag|weak|poor|no\b|pass/.test(v)) return 'badge-red';
  if (/develop|raw|low|beginner|project/.test(v)) return 'badge-gray';
  if (/solid|good|capable|average|mid|medium/.test(v)) return 'badge-green';
  return 'badge-neutral';
}

export function badge(text, cls = 'badge-neutral') {
  return text ? `<span class="badge ${cls}">${esc(text)}</span>` : '';
}

export const isActive = (p) => (p.status_active || 'Active').toLowerCase() !== 'inactive';
export const isYes = (v) => /^(y|yes|true|1)$/i.test(String(v ?? '').trim());

export function formatDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// D1 CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS"
export function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return isNaN(d) ? ts : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

let toastTimer;
export function toast(message, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.className = isError ? 'show error' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), isError ? 5000 : 2200);
}

export function storageGet(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export async function logout() {
  await api('/api/login', { method: 'DELETE' }).catch(() => {});
  location.href = '/login';
}

// Two-tap confirm for destructive buttons (no browser confirm() dialogs).
export function armConfirm(button, label, onConfirm) {
  if (button.dataset.armed) {
    delete button.dataset.armed;
    return onConfirm();
  }
  const original = button.textContent;
  button.dataset.armed = '1';
  button.textContent = label;
  button.classList.add('armed');
  setTimeout(() => {
    if (!button.isConnected) return;
    delete button.dataset.armed;
    button.textContent = original;
    button.classList.remove('armed');
  }, 3500);
}

// Field layout used by the profile page and the add/edit form.
export const FIELD_GROUPS = [
  { title: 'Basics', fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'net_id', label: 'NetID' },
    { key: 'year', label: 'Year', list: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Alumni'] },
    { key: 'major', label: 'Major' },
    { key: 'status_active', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  ] },
  { title: 'Track & Interests', fields: [
    { key: 'track', label: 'Track', list: ['On-Air', 'Production', 'Social/Content', 'On-Air, Production', 'Production, Social/Content'] },
    { key: 'first_choice', label: '1st Choice' },
    { key: 'second_choice', label: '2nd Choice' },
    { key: 'third_choice', label: '3rd Choice' },
    { key: 'preferred_roles_production', label: 'Preferred Production Roles', wide: true },
  ] },
  { title: 'Logistics', fields: [
    { key: 'has_car', label: 'Has Car', type: 'select', options: ['', 'Yes', 'No'] },
    { key: 'can_transport_equipment', label: 'Can Transport Equipment', list: ['Yes', 'No', 'Maybe'] },
    { key: 'weekend_availability', label: 'Weekend Availability' },
    { key: 'availability_notes', label: 'Availability Notes', type: 'textarea', wide: true },
  ] },
  { title: 'Forms & Interview', fields: [
    { key: 'interest_form_submitted', label: 'Interest Form Submitted', type: 'bool' },
    { key: 'production_form_submitted', label: 'Production Form Submitted', type: 'bool' },
    { key: 'availability_form_status', label: 'Availability Form Status', list: ['Submitted', 'Pending', 'Not Sent'] },
    { key: 'interviewed', label: 'Interviewed', type: 'bool' },
    { key: 'interview_date', label: 'Interview Date', placeholder: 'YYYY-MM-DD' },
  ] },
  { title: 'Evaluation', fields: [
    { key: 'best_fit', label: 'Best Fit' },
    { key: 'experience_level', label: 'Experience Level', list: ['None', 'Some', 'Experienced'] },
    { key: 'immediate_read', label: 'Immediate Read', list: ['Standout', 'Strong', 'Solid', 'Developmental', 'Concern'] },
    { key: 'skills_experience_summary', label: 'Skills / Experience Summary', type: 'textarea', wide: true },
  ] },
];
