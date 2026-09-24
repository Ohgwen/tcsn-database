// Shared definitions for the `people` and `notes` tables.
// Used by the Pages Functions API and by scripts/csv-to-sql.mjs.

export const PERSON_FIELDS = [
  'name', 'email', 'phone', 'net_id', 'year', 'major', 'track',
  'first_choice', 'second_choice', 'third_choice', 'preferred_roles_production',
  'has_car', 'can_transport_equipment', 'weekend_availability', 'availability_notes',
  'interest_form_submitted', 'production_form_submitted', 'availability_form_status',
  'interviewed', 'interview_date', 'best_fit', 'experience_level', 'immediate_read',
  'skills_experience_summary', 'status_active',
];

export const BOOL_FIELDS = new Set(['interest_form_submitted', 'production_form_submitted', 'interviewed']);
const YES_NO_FIELDS = new Set(['has_car', 'can_transport_equipment']);

export const NOTE_CATEGORIES = [
  'Performance', 'Reliability/Problem', 'Training/Shadow', 'Game Worked', 'Contribution', 'General',
];

const MAX_TEXT = 10000;

// Alternate CSV header spellings -> column names.
const HEADER_ALIASES = {
  full_name: 'name', person: 'name', member: 'name',
  netid: 'net_id', net_id_: 'net_id',
  email_address: 'email', phone_number: 'phone', cell: 'phone',
  status: 'status_active', active: 'status_active',
  class_year: 'year', class: 'year',
};

export function normalizeHeader(h) {
  const key = String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return HEADER_ALIASES[key] ?? key;
}

export function toBool(v) {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0 || v == null) return 0;
  return ['yes', 'y', 'true', '1', 'x', 'done', 'submitted', 'complete', 'completed'].includes(String(v).trim().toLowerCase()) ? 1 : 0;
}

function normalizeYesNo(s) {
  const l = s.toLowerCase();
  if (['y', 'yes', 'true', '1'].includes(l)) return 'Yes';
  if (['n', 'no', 'false', '0'].includes(l)) return 'No';
  return s;
}

/**
 * Validate/normalize a person payload.
 * partial=true: only fields present in `input` are returned (for updates).
 * skipBlank=true: blank values are dropped instead of stored as NULL (CSV refresh).
 */
export function cleanPerson(input, { partial = false, skipBlank = false } = {}) {
  const values = {};
  for (const f of PERSON_FIELDS) {
    if (!(f in input)) continue;
    let v = input[f];
    if (BOOL_FIELDS.has(f)) {
      if (skipBlank && (v == null || String(v).trim() === '')) continue;
      values[f] = toBool(v);
      continue;
    }
    v = v == null ? '' : String(v).trim().slice(0, MAX_TEXT);
    if (v === '') {
      if (skipBlank) continue;
      values[f] = null;
      continue;
    }
    if (YES_NO_FIELDS.has(f)) v = normalizeYesNo(v);
    if (f === 'status_active') {
      const l = v.toLowerCase();
      if (['active', 'yes', 'y'].includes(l)) v = 'Active';
      else if (['inactive', 'no', 'n'].includes(l)) v = 'Inactive';
    }
    values[f] = v;
  }
  if (!partial && !values.name) return { error: 'Name is required' };
  if (partial && 'name' in values && !values.name) return { error: 'Name cannot be blank' };
  // Let the DB default ('Active') apply rather than storing NULL.
  if ('status_active' in values && values.status_active == null) {
    if (partial) values.status_active = 'Active';
    else delete values.status_active;
  }
  return { values };
}

export function cleanNote(input, { partial = false } = {}) {
  const values = {};
  if (!partial || 'category' in input) {
    const c = input.category || 'General';
    if (!NOTE_CATEGORIES.includes(c)) return { error: `Unknown category: ${c}` };
    values.category = c;
  }
  if (!partial || 'note' in input) {
    const n = String(input.note ?? '').trim();
    if (!n) return { error: 'Note text is required' };
    values.note = n.slice(0, MAX_TEXT);
  }
  if ('entry_date' in input && input.entry_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entry_date)) return { error: 'entry_date must be YYYY-MM-DD' };
    values.entry_date = input.entry_date;
  }
  if ('author' in input) {
    const a = String(input.author ?? '').trim().slice(0, 200);
    values.author = a || null;
  }
  return { values };
}
