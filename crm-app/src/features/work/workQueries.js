export const WORK_PAGE_SIZE = 25;

export const WORK_VIEWS = [
  ['my-work', 'Mi trabajo'], ['overdue', 'Vencidos'], ['today', 'Hoy'], ['upcoming', 'Próximos'],
  ['initial-contact', 'Primer contacto'], ['followups', 'Seguimientos'], ['confirmations', 'Confirmaciones'],
  ['no-show', 'No-show'], ['quotes', 'Presupuestos'], ['reactivations', 'Reactivaciones'],
  ['unassigned', 'Sin responsable'], ['team', 'Equipo'],
];

const VIEW_KEYS = new Set(WORK_VIEWS.map(([key]) => key));

export function normalizeWorkView(value, canAdmin = false) {
  const view = VIEW_KEYS.has(value) ? value : 'my-work';
  return view === 'team' && !canAdmin ? 'my-work' : view;
}

export function encodeWorkCursor(item) {
  if (!item) return null;
  return btoa(JSON.stringify({ group: item.sort_group, dueAt: item.due_at, priority: item.priority_rank, key: item.work_key }));
}

export function decodeWorkCursor(value) {
  if (!value) return null;
  try {
    const result = JSON.parse(atob(value));
    if (!Number.isInteger(result.group) || !Number.isInteger(result.priority) || typeof result.key !== 'string') throw new Error();
    return result;
  } catch { throw new Error('Cursor de trabajo inválido.'); }
}

export async function listWorkItems(client, clinicId, { view = 'my-work', limit = WORK_PAGE_SIZE, cursor = null, assignedTo = null, signal } = {}) {
  if (!clinicId) throw new Error('Clínica requerida.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Límite de trabajo inválido.');
  const decoded = decodeWorkCursor(cursor);
  const { data, error } = await client.rpc('list_work_items_v1', {
    p_clinic_id: clinicId, p_view: normalizeWorkView(view).replaceAll('-', '_'), p_limit: limit,
    p_assigned_to: assignedTo || null, p_cursor_group: decoded?.group ?? null, p_cursor_due_at: decoded?.dueAt ?? null,
    p_cursor_priority: decoded?.priority ?? null, p_cursor_key: decoded?.key ?? null,
  }).abortSignal(signal);
  if (error) throw error;
  const rows = data || [];
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? encodeWorkCursor(rows[limit - 1]) : null };
}
