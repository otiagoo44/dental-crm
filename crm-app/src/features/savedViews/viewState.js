import { WORK_VIEWS } from '../work/workQueries.js';
import { LEAD_STATUSES, CLASSIFICATIONS } from '../../lib/constants.js';

const KEYS = {
  work: ['view', 'assignedTo'], patients: ['q', 'view'],
  opportunities: ['q', 'status', 'treatment', 'classification', 'priority', 'assigned', 'source', 'date', 'showArchived'],
};
const SORTS = {
  recent: { field: 'created_at', direction: 'desc' }, oldest: { field: 'created_at', direction: 'asc' },
  name: { field: 'name', direction: 'asc' }, score: { field: 'score', direction: 'desc' },
};
export const EMPTY_OPPORTUNITY_FILTERS = { status: '', treatment: '', classification: '', priority: '', assigned: '', source: '', date: '', showArchived: false, sort: 'recent' };
const invalid = () => { throw new Error('La vista contiene filtros u orden no compatibles. Revisá los filtros actuales.'); };

function validate(entity, filters, sorts) {
  if (!KEYS[entity] || !filters || Array.isArray(filters) || !Array.isArray(sorts)) invalid();
  for (const [key, value] of Object.entries(filters)) {
    if (!KEYS[entity].includes(key)) invalid();
    if (key === 'showArchived') { if (typeof value !== 'boolean') invalid(); continue; }
    if (typeof value !== 'string' || value.length > (key === 'q' ? 160 : 80) || /[\u0000-\u001f\u007f]/.test(value)) invalid();
    const allowed = key === 'view' ? (entity === 'work' ? WORK_VIEWS.map(([k]) => k) : ['all', 'active', 'unassigned'])
      : ({ status: LEAD_STATUSES, classification: CLASSIFICATIONS, priority: ['now', 'today', 'later'], date: ['today', '7d', '30d'] })[key];
    if (allowed && !allowed.includes(value)) invalid();
    if (['assigned', 'assignedTo'].includes(key) && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) invalid();
    if (['source', 'treatment'].includes(key) && !value.trim()) invalid();
  }
  if (sorts.length > (entity === 'opportunities' ? 1 : 0)) invalid();
  if (sorts.length && !Object.values(SORTS).some((s) => sorts[0] && Object.keys(sorts[0]).length === 2 && s.field === sorts[0].field && s.direction === sorts[0].direction)) invalid();
  if (new TextEncoder().encode(JSON.stringify(filters)).length > 2048) invalid();
}

export function snapshotView(entity, params) {
  if (!KEYS[entity]) invalid();
  const filters = {};
  for (const key of KEYS[entity]) {
    const value = params.get(key);
    if (value === null || value === '') continue;
    if (key === 'showArchived') { if (!['true', 'false'].includes(value)) invalid(); filters[key] = value === 'true'; }
    else filters[key] = value;
  }
  const sort = params.get('sort') || 'recent';
  if (entity === 'opportunities' && !SORTS[sort]) invalid();
  const sorts = entity === 'opportunities' ? [SORTS[sort]] : [];
  validate(entity, filters, sorts);
  return { filters, sorts };
}

export function viewSearchParams(entity, { filters, sorts }) {
  validate(entity, filters, sorts);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) params.set(key, String(value));
  if (sorts.length) params.set('sort', Object.keys(SORTS).find((key) => SORTS[key].field === sorts[0].field && SORTS[key].direction === sorts[0].direction));
  return params;
}

export function parseOpportunityParams(params) {
  const filters = { ...EMPTY_OPPORTUNITY_FILTERS };
  for (const key of Object.keys(filters)) if (params.has(key)) filters[key] = key === 'showArchived' ? params.get(key) === 'true' : params.get(key);
  return filters;
}

export function opportunityParams(filters, query = '') {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
  if (query) params.set('q', query);
  return params;
}
