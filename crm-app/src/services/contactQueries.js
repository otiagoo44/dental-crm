// Query contracts are independent of React and accept an authenticated client.
export const CONTACT_PAGE_SIZE = 25;
export const CONTACT_FILTERS = ['all', 'active', 'unassigned'];
export const INTERACTION_CHANNELS = ['whatsapp', 'call', 'email', 'in_person', 'note'];
export const INTERACTION_OUTCOMES = ['sent', 'completed', 'responded', 'no_response', 'note'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validId = (value) => typeof value === 'string' && UUID.test(value);
const OPPORTUNITY_FIELDS = 'id,clinic_id,contact_id,name,phone,phone_plus,treatment,status,is_archived,created_at,updated_at,last_contact_at,next_action,next_followup_at,assigned_to';

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(cursor);
    if (!validId(value.id) || typeof value.created_at !== 'string'
      || !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(value.created_at)
      || !Number.isFinite(Date.parse(value.created_at))) throw new Error();
    return { id: value.id, created_at: value.created_at };
  } catch { throw new Error('Enlace de página inválido. Volvé a la primera página.'); }
}
function limitValue(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Tamaño de página inválido.');
  return limit;
}
function scope(clinicId) {
  if (!validId(clinicId)) throw new Error('No hay una clínica autorizada.');
}
function resultPage(data, limit) {
  const rows = (data || []).slice(0, limit);
  const last = rows.at(-1);
  return { rows, nextCursor: data?.length > limit ? JSON.stringify({ created_at: last.created_at, id: last.id }) : null };
}
function timelinePage(data, limit) {
  const rows = (data || []).slice(0, limit);
  const last = rows.at(-1);
  return { rows, nextCursor: data?.length > limit ? JSON.stringify({ created_at: last.occurred_at, id: last.id }) : null };
}
async function checked(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export function createContactQueries(client, clinicId) {
  scope(clinicId);
  async function listContacts({ cursor = null, limit = CONTACT_PAGE_SIZE, search = '', filter = 'all', contactId = null, signal } = {}) {
    limitValue(limit);
    if (!CONTACT_FILTERS.includes(filter) || typeof search !== 'string' || search.length > 160) throw new Error('Filtro inválido.');
    if (contactId && !validId(contactId)) return { rows: [], nextCursor: null };
    const after = decodeCursor(cursor);
    const data = await checked(client.rpc('list_contacts_page', {
      p_clinic_id: clinicId, p_limit: limit, p_search: search.trim(), p_filter: filter,
      p_cursor_created_at: after?.created_at || null, p_cursor_id: after?.id || null,
      p_contact_id: contactId,
    }).abortSignal(signal));
    return resultPage(data, limit);
  }
  async function listOpportunities({ contactId, cursor = null, limit = CONTACT_PAGE_SIZE, signal } = {}) {
    if (!validId(contactId)) return { rows: [], nextCursor: null };
    let query = client.from('leads').select(OPPORTUNITY_FIELDS).eq('clinic_id', clinicId).eq('contact_id', contactId);
    const after = decodeCursor(cursor);
    if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`);
    return resultPage(await checked(query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(limitValue(limit) + 1).abortSignal(signal)), limit);
  }
  async function getContact360(contactId, { signal } = {}) {
    if (!validId(contactId)) return null;
    const summary = await checked(client.rpc('get_contact_operating_summary_v1', {
      p_clinic_id: clinicId,
      p_contact_id: contactId,
    }).abortSignal(signal));
    const contact = summary?.[0];
    if (!contact) return null;
    const opportunities = await listOpportunities({ contactId, signal });
    return { contact, opportunities };
  }
  async function listTimeline({ contactId, cursor = null, limit = CONTACT_PAGE_SIZE, signal } = {}) {
    if (!validId(contactId)) return { rows: [], nextCursor: null };
    const after = decodeCursor(cursor);
    const data = await checked(client.rpc('list_contact_timeline_v1', {
      p_clinic_id: clinicId,
      p_contact_id: contactId,
      p_limit: limitValue(limit),
      p_cursor_created_at: after?.created_at || null,
      p_cursor_id: after?.id || null,
    }).abortSignal(signal));
    return timelinePage(data, limit);
  }
  async function listRelated({ contactId, section, cursor = null, limit = CONTACT_PAGE_SIZE, signal }) {
    if (!validId(contactId)) return { rows: [], nextCursor: null };
    if (section === 'timeline') return listTimeline({ contactId, cursor, limit, signal });
    const sections = {
      appointments: ['appointments', 'id,clinic_id,lead_id,appointment_date,appointment_time,status,doctor_assigned,treatment_scheduled,created_at'],
      tasks: ['tasks', 'id,clinic_id,lead_id,title,status,due_at,priority,assigned_to,created_at'],
      quotes: ['quotes', 'id,clinic_id,lead_id,treatment,amount,currency,status,issued_at,created_at'],
      notes: ['leads', 'id,clinic_id,contact_id,treatment,notes,created_at'],
    };
    if (!sections[section]) throw new Error('Sección inválida.');
    const [table, fields] = sections[section];
    const relation = table === 'quotes' ? 'leads!quotes_clinic_lead_fk!inner' : 'leads!inner';
    let query = client.from(table).select(fields + (table === 'leads' ? '' : `,${relation}(contact_id,clinic_id)`)).eq('clinic_id', clinicId);
    query = table === 'leads' ? query.eq('contact_id', contactId)
      : query.eq('leads.contact_id', contactId).eq('leads.clinic_id', clinicId);
    const after = decodeCursor(cursor);
    if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`);
    return resultPage(await checked(query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(limitValue(limit) + 1).abortSignal(signal)), limit);
  }
  async function listAssignees({ signal } = {}) {
    return checked(client.from('profiles')
      .select('id,clinic_id,full_name,role')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'receptionist'])
      .order('full_name')
      .limit(100)
      .abortSignal(signal));
  }
  async function registerInteraction({ contactId, opportunityId, channel, outcome, note = '', nextAction = '', nextFollowupAt = null, assignedTo = null }) {
    if (!validId(contactId) || !validId(opportunityId)
      || !INTERACTION_CHANNELS.includes(channel) || !INTERACTION_OUTCOMES.includes(outcome)
      || (assignedTo && !validId(assignedTo)) || String(note).length > 2000 || String(nextAction).length > 160) {
      throw new Error('Datos de interacción inválidos.');
    }
    return checked(client.rpc('register_contact_interaction_v1', {
      p_clinic_id: clinicId,
      p_contact_id: contactId,
      p_opportunity_id: opportunityId,
      p_channel: channel,
      p_outcome: outcome,
      p_note: String(note).trim() || null,
      p_next_action: String(nextAction).trim() || null,
      p_next_followup_at: nextFollowupAt || null,
      p_assigned_to: assignedTo || null,
    }));
  }
  return { listContacts, getContact360, listOpportunities, listRelated, listTimeline, listAssignees, registerInteraction };
}
