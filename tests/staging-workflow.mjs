import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildNextActionQueue } from '../crm-app/src/lib/nextActions.js';
import { findTreatmentPrice } from '../crm-app/src/lib/quoteDefaults.js';

const required = [
  'QA_STAGING_PROJECT_REF',
  'QA_STAGING_SUPABASE_URL',
  'QA_STAGING_SUPABASE_ANON_KEY',
  'QA_STAGING_EDGE_URL',
  'QA_STAGING_ALLOWED_ORIGIN',
  'QA_STAGING_CLINIC_SLUG',
  'QA_STAGING_FORM_TOKEN',
  'QA_OWNER_A_EMAIL',
  'QA_OWNER_A_PASSWORD',
  'QA_RECEPTION_A_EMAIL',
  'QA_RECEPTION_A_PASSWORD',
  'QA_STAGING_SERVICE_ROLE_KEY',
];
const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length) throw new Error(`Missing staging workflow variables: ${missing.join(', ')}`);

const env = Object.fromEntries(required.map((name) => [name, String(process.env[name]).trim()]));
assert.equal(env.QA_STAGING_PROJECT_REF, 'aqdufiycayedsfldljjq');
assert.equal(new URL(env.QA_STAGING_SUPABASE_URL).hostname.split('.')[0], env.QA_STAGING_PROJECT_REF);
assert.equal(new URL(env.QA_STAGING_EDGE_URL).origin, new URL(env.QA_STAGING_SUPABASE_URL).origin);

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
function client(key = env.QA_STAGING_SUPABASE_ANON_KEY) {
  return createClient(env.QA_STAGING_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error || new Error('Sign-in returned no user');
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id,clinic_id,role,active').eq('id', data.user.id).single();
  if (profileError) throw profileError;
  return { supabase, user: data.user, profile };
}

const [owner, reception] = await Promise.all([
  signIn(env.QA_OWNER_A_EMAIL, env.QA_OWNER_A_PASSWORD),
  signIn(env.QA_RECEPTION_A_EMAIL, env.QA_RECEPTION_A_PASSWORD),
]);
assert.equal(owner.profile.clinic_id, reception.profile.clinic_id);
assert.equal(reception.profile.role, 'receptionist');
const admin = client(env.QA_STAGING_SERVICE_ROLE_KEY);
const clinicId = reception.profile.clinic_id;
const startedAt = new Date().toISOString();
const openStatuses = new Set(['pendiente', 'vencido', 'vencida']);
const snapshots = [];

function scoreClassification(score) {
  if (score >= 80) return 'Lead Caliente';
  if (score >= 50) return 'Lead Medio';
  return 'Lead Frío';
}

async function snapshot(label, leadId, expectedStatus, expectedTaskTypes = null) {
  const [leadResult, taskResult, appointmentResult, quoteResult, eventResult, auditResult] = await Promise.all([
    reception.supabase.from('leads').select('*').eq('id', leadId).single(),
    reception.supabase.from('tasks').select('*').eq('lead_id', leadId).order('created_at'),
    reception.supabase.from('appointments').select('*').eq('lead_id', leadId).order('created_at'),
    reception.supabase.from('quotes').select('*').eq('lead_id', leadId).order('created_at'),
    reception.supabase.from('lead_events').select('id,event_type,created_at').eq('lead_id', leadId).order('created_at'),
    owner.supabase.from('audit_logs').select('id,action,row_id,created_at').eq('clinic_id', clinicId).gte('created_at', startedAt).order('created_at'),
  ]);
  for (const result of [leadResult, taskResult, appointmentResult, quoteResult, eventResult, auditResult]) {
    if (result.error) throw result.error;
  }
  const lead = leadResult.data;
  const tasks = taskResult.data;
  const appointments = appointmentResult.data;
  const quotes = quoteResult.data;
  const events = eventResult.data;
  const audits = auditResult.data;
  const openTasks = tasks.filter((task) => openStatuses.has(String(task.status).toLowerCase()));
  const queue = buildNextActionQueue({ leads: [lead], tasks, appointments, quotes });

  assert.equal(lead.clinic_id, clinicId, `${label}: wrong clinic`);
  assert.equal(lead.assigned_to, reception.user.id, `${label}: wrong assignee`);
  assert.equal(lead.status, expectedStatus, `${label}: wrong status`);
  assert.equal(lead.classification, scoreClassification(Number(lead.score)), `${label}: score/classification contradiction`);
  assert.ok(Array.isArray(lead.score_breakdown) && lead.score_breakdown.length > 0, `${label}: score explanation missing`);
  assert.ok(events.length > 0, `${label}: lead events missing`);
  assert.ok(audits.length > 0, `${label}: audit logs missing`);
  if (expectedTaskTypes) {
    assert.deepEqual(openTasks.map((task) => task.type).sort(), [...expectedTaskTypes].sort(), `${label}: open task set mismatch`);
  }
  if (expectedStatus === 'Tratamiento Iniciado') {
    assert.equal(lead.next_action, null);
    assert.equal(lead.next_followup_at, null);
    assert.equal(openTasks.length, 0);
    assert.equal(queue.length, 0, `${label}: terminal lead remains in Pending queue`);
  } else {
    assert.equal(queue.length, 1, `${label}: lead must appear once in Pending queue`);
    assert.ok(queue[0].action, `${label}: effective next action missing`);
  }

  const row = {
    label,
    status: lead.status,
    score: lead.score,
    classification: lead.classification,
    nextAction: lead.next_action,
    effectiveNextAction: queue[0]?.action?.actionType || null,
    openTasks: openTasks.map((task) => task.type),
    appointmentStatuses: appointments.map((appointment) => appointment.status),
    quoteStatuses: quotes.map((quote) => `${quote.treatment}:${quote.status}`),
    leadEvents: events.length,
    auditLogs: audits.length,
    inPending: queue.length === 1,
  };
  snapshots.push(row);
  return { lead, tasks, appointments, quotes, events, audits, openTasks, queue };
}

let phoneCounter = Number(String(Date.now()).slice(-6));
function nextPhone() {
  phoneCounter = (phoneCounter + 1) % 1_000_000;
  return `0981${String(phoneCounter).padStart(6, '0')}`;
}
function plus(phone) {
  return `+595${phone.slice(1)}`;
}

const workflowPhone = nextPhone();
const intakeResponse = await fetch(env.QA_STAGING_EDGE_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json', Origin: env.QA_STAGING_ALLOWED_ORIGIN },
  body: JSON.stringify({
    clinic_slug: env.QA_STAGING_CLINIC_SLUG,
    landing_token: env.QA_STAGING_FORM_TOKEN,
    nombre: `QA Workflow ${Date.now()}`,
    telefono: workflowPhone,
    tratamiento: 'Implante',
    urgencia: 'Hoy',
    situacion: 'Quiere agendar una cita',
    evaluacion_previa: 'Tiene radiografía',
    consultation_reason: 'First clinic release workflow',
    origen: 'QA staging workflow',
    pagina: 'tests/staging-workflow.mjs',
    consentimiento_contacto: true,
    website: '',
  }),
});
const intakeBody = await intakeResponse.json().catch(() => null);
assert.equal(intakeResponse.status, 200);
assert.ok(intakeBody?.lead_id);
const leadId = intakeBody.lead_id;
await snapshot('Nueva consulta', leadId, 'Nuevo', ['contact']);

let result = await reception.supabase.rpc('register_lead_outcome', {
  p_lead_id: leadId,
  p_outcome: 'responded',
  p_note: 'Respondió en workflow QA',
  p_followup_at: new Date(Date.now() + 86_400_000).toISOString(),
});
if (result.error) throw result.error;
await snapshot('Respondió', leadId, 'Contactado', ['followup']);

const appointmentDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
result = await reception.supabase.rpc('schedule_lead_appointment', {
  p_lead_id: leadId,
  p_appointment_date: appointmentDate,
  p_appointment_time: '15:00',
  p_doctor_assigned: 'Dra. Workflow QA',
  p_treatment_scheduled: 'Implante',
  p_notes: 'Workflow QA',
  p_appointment_id: null,
});
if (result.error) throw result.error;
const scheduled = Array.isArray(result.data) ? result.data[0] : result.data;
assert.ok(scheduled?.id);
await snapshot('Agendó', leadId, 'Consulta Agendada', ['confirm']);

result = await reception.supabase.rpc('update_appointment_outcome', {
  p_appointment_id: scheduled.id,
  p_outcome: 'Confirmado',
});
if (result.error) throw result.error;
await snapshot('Confirmó', leadId, 'Confirmado', ['attendance']);

result = await admin.from('appointments')
  .update({ appointment_date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) })
  .eq('id', scheduled.id)
  .select('id');
if (result.error) throw result.error;
assert.equal(result.data.length, 1, 'QA clock adjustment failed');
result = await reception.supabase.rpc('update_appointment_outcome', {
  p_appointment_id: scheduled.id,
  p_outcome: 'Asistió',
});
if (result.error) throw result.error;
await snapshot('Asistió', leadId, 'Asistió', ['quote_registration']);

const { data: prices, error: priceError } = await reception.supabase
  .from('treatment_prices').select('id,treatment,estimated_price').eq('clinic_id', clinicId);
if (priceError) throw priceError;
const implantPrice = findTreatmentPrice('Implante', prices);
assert.equal(implantPrice, 8_500_000, 'Implant reference price is not Gs. 8,500,000');
const quoteDueAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
result = await reception.supabase.rpc('create_treatment_quote', {
  p_lead_id: leadId,
  p_appointment_id: scheduled.id,
  p_treatment: 'Implante',
  p_amount: implantPrice,
  p_currency: 'PYG',
  p_professional_name: 'Dra. Workflow QA',
  p_next_action_at: quoteDueAt,
  p_notes: 'Default reference price QA',
});
if (result.error) throw result.error;
let quoteA = Array.isArray(result.data) ? result.data[0] : result.data;
assert.equal(Number(quoteA.amount), 8_500_000);
result = await reception.supabase.rpc('update_treatment_quote', {
  p_quote_id: quoteA.id,
  p_treatment: 'Implante',
  p_amount: 9_000_000,
  p_currency: 'PYG',
  p_professional_name: 'Dra. Workflow QA',
  p_next_action_at: quoteDueAt,
  p_notes: 'Individual price QA',
});
if (result.error) throw result.error;
quoteA = Array.isArray(result.data) ? result.data[0] : result.data;
assert.equal(Number(quoteA.amount), 9_000_000);
await snapshot('Presupuesto pending', leadId, 'Presupuesto Enviado', ['quote_followup']);

result = await reception.supabase.rpc('create_treatment_quote', {
  p_lead_id: leadId,
  p_appointment_id: scheduled.id,
  p_treatment: 'Blanqueamiento',
  p_amount: 1_200_000,
  p_currency: 'PYG',
  p_professional_name: 'Dra. Workflow QA',
  p_next_action_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  p_notes: 'Independent quote B QA',
});
if (result.error) throw result.error;
const quoteB = Array.isArray(result.data) ? result.data[0] : result.data;
assert.notEqual(quoteA.id, quoteB.id);

result = await reception.supabase.rpc('set_treatment_quote_status', {
  p_quote_id: quoteA.id,
  p_status: 'accepted',
  p_rejection_reason: null,
  p_notes: 'Accepted quote A QA',
});
if (result.error) throw result.error;
let acceptedSnapshot = await snapshot('Presupuesto accepted', leadId, 'Presupuesto Enviado', ['quote_followup', 'treatment_start']);
assert.equal(acceptedSnapshot.quotes.find((quote) => quote.id === quoteA.id)?.status, 'accepted');
assert.equal(acceptedSnapshot.quotes.find((quote) => quote.id === quoteB.id)?.status, 'pending');

const implantRow = prices.find((price) => String(price.treatment).toLowerCase() === 'implante');
assert.ok(implantRow?.id);
result = await owner.supabase.from('treatment_prices').update({ estimated_price: 8_800_000 }).eq('id', implantRow.id).select('id,estimated_price');
if (result.error) throw result.error;
assert.equal(Number(result.data[0]?.estimated_price), 8_800_000);
result = await reception.supabase.from('quotes').select('amount').eq('id', quoteA.id).single();
if (result.error) throw result.error;
assert.equal(Number(result.data.amount), 9_000_000, 'Historical quote changed with the reference price');
result = await owner.supabase.from('treatment_prices').update({ estimated_price: 8_500_000 }).eq('id', implantRow.id);
if (result.error) throw result.error;

result = await reception.supabase.rpc('register_lead_outcome', {
  p_lead_id: leadId,
  p_outcome: 'treatment_started',
  p_note: 'Treatment started in workflow QA',
  p_followup_at: null,
});
if (result.error) throw result.error;
const finalSnapshot = await snapshot('Iniciar tratamiento', leadId, 'Tratamiento Iniciado', []);
assert.equal(finalSnapshot.openTasks.length, 0);

async function createPriorityLead({ name, treatment, urgency, situation, evaluation, followupAt }) {
  const phone = nextPhone();
  const { data, error } = await reception.supabase.rpc('create_manual_lead_v2', {
    p_name: name,
    p_phone: phone,
    p_phone_plus: plus(phone),
    p_treatment: treatment,
    p_urgency: urgency,
    p_consultation_reason: 'Score/priority staging QA',
    p_source: 'WhatsApp directo',
    p_consent_contact: true,
    p_notes: 'QA synthetic data',
    p_next_action: 'Seguimiento QA',
    p_next_followup_at: followupAt,
    p_assigned_to: reception.user.id,
    p_situation: situation,
    p_evaluation_previous: evaluation,
    p_estimated_value: null,
  });
  if (error) throw error;
  const lead = Array.isArray(data) ? data[0] : data;
  const responded = await reception.supabase.rpc('register_lead_outcome', {
    p_lead_id: lead.id,
    p_outcome: 'responded',
    p_note: 'Priority runtime QA',
    p_followup_at: followupAt,
  });
  if (responded.error) throw responded.error;
  return lead.id;
}

const hotDue = new Date(Date.now() + 3 * 86_400_000).toISOString();
const mediumDue = new Date(Date.now() - 3_600_000).toISOString();
const hotId = await createPriorityLead({
  name: 'QA Hot future followup', treatment: 'Implante', urgency: 'Hoy',
  situation: 'Quiere agendar una cita', evaluation: 'Tiene radiografía', followupAt: hotDue,
});
const mediumId = await createPriorityLead({
  name: 'QA Medium overdue followup', treatment: 'Blanqueamiento', urgency: 'Esta semana',
  situation: 'Consulta de precio', evaluation: 'No', followupAt: new Date(Date.now() + 3_600_000).toISOString(),
});
result = await admin.from('tasks').update({ due_at: mediumDue, status: 'vencido' }).eq('lead_id', mediumId).in('status', ['pendiente', 'vencido', 'Vencida']).select('id');
if (result.error) throw result.error;
assert.ok(result.data.length >= 1, 'Could not move the Medium QA action into the overdue window');
const [{ data: priorityLeads, error: priorityLeadError }, { data: priorityTasks, error: priorityTaskError }] = await Promise.all([
  reception.supabase.from('leads').select('*').in('id', [hotId, mediumId]),
  reception.supabase.from('tasks').select('*').in('lead_id', [hotId, mediumId]),
]);
if (priorityLeadError || priorityTaskError) throw priorityLeadError || priorityTaskError;
const hot = priorityLeads.find((lead) => lead.id === hotId);
const medium = priorityLeads.find((lead) => lead.id === mediumId);
assert.equal(hot.classification, 'Lead Caliente');
assert.equal(medium.classification, 'Lead Medio');
let priorityQueue = buildNextActionQueue({ leads: priorityLeads, tasks: priorityTasks, now: new Date() });
assert.equal(priorityQueue.length, 2);
assert.equal(new Set(priorityQueue.map((item) => item.lead.id)).size, 2, 'A person appears more than once in Pending');
assert.equal(priorityQueue[0].lead.id, mediumId, 'Overdue Medium must rank before future Hot');
assert.equal(priorityQueue[0].action.priorityGroup, 'now');
assert.equal(priorityQueue.find((item) => item.lead.id === hotId).action.priorityGroup, 'later');

result = await reception.supabase.rpc('register_lead_outcome', {
  p_lead_id: mediumId,
  p_outcome: 'treatment_started',
  p_note: 'Resolve priority QA lead',
  p_followup_at: null,
});
if (result.error) throw result.error;
const [{ data: resolvedLeads }, { data: resolvedTasks }] = await Promise.all([
  reception.supabase.from('leads').select('*').in('id', [hotId, mediumId]),
  reception.supabase.from('tasks').select('*').in('lead_id', [hotId, mediumId]),
]);
priorityQueue = buildNextActionQueue({ leads: resolvedLeads, tasks: resolvedTasks, now: new Date() });
assert.equal(priorityQueue.some((item) => item.lead.id === mediumId), false, 'Resolved lead remains in Pending');
assert.equal(priorityQueue.length, 1);
const futureQueue = buildNextActionQueue({ leads: resolvedLeads, tasks: resolvedTasks, now: new Date(Date.now() + 4 * 86_400_000) });
assert.equal(futureQueue[0].lead.id, hotId);
assert.equal(futureQueue[0].action.priorityGroup, 'now', 'Future action did not become due automatically');

for (const session of [owner, reception]) {
  await session.supabase.removeAllChannels();
  session.supabase.realtime.disconnect();
  await session.supabase.auth.signOut();
}
admin.realtime.disconnect();

console.table(snapshots);
console.log(JSON.stringify({
  projectRef: env.QA_STAGING_PROJECT_REF,
  workflowLeadId: leadId,
  steps: snapshots.length,
  openCommercialTasksFinal: finalSnapshot.openTasks.length,
  quotePricing: { referenceDefault: 8_500_000, individual: 9_000_000, historicalAfterGlobalChange: 9_000_000 },
  multiQuote: { acceptedQuote: 'accepted', independentQuote: 'pending' },
  priority: {
    hot: { score: hot.score, classification: hot.classification, due: 'future' },
    medium: { score: medium.score, classification: medium.classification, due: 'overdue' },
    first: 'medium-overdue',
    uniquePeople: true,
    resolvedDisappears: true,
    futureBecomesDue: true,
  },
}, null, 2));
