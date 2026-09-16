import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.QA_STAGING_SUPABASE_URL;
const key = process.env.QA_STAGING_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'aqdufiycayedsfldljjq.supabase.co');
const make = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email, password) {
  const client = make();
  const { data: auth, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  const { data: profile, error: profileError } = await client.from('profiles').select('id,clinic_id,role').eq('id', auth.user.id).single();
  assert.ifError(profileError);
  return { client, profile };
}

const owner = await login(process.env.QA_OWNER_A_EMAIL, process.env.QA_OWNER_A_PASSWORD);
const other = await login(process.env.QA_RECEPTION_B_EMAIL, process.env.QA_RECEPTION_B_PASSWORD);
const stamp = Date.now();
const name = `QA INTERACTION ${stamp}`;
const phone = `+59597${String(stamp).slice(-7)}`;
const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
const rpc = async (client, name, args) => {
  const result = await client.rpc(name, args);
  assert.ifError(result.error);
  return result.data;
};

try {
  const created = await rpc(owner.client, 'create_manual_lead_v2', {
    p_name: name,
    p_phone: phone,
    p_phone_plus: phone,
    p_treatment: 'Implantes QA Interaction',
    p_urgency: 'Esta semana',
    p_consultation_reason: 'QA Contact 360 interactions',
    p_source: 'Otro',
    p_consent_contact: true,
    p_notes: 'Dato sintético QA Contact 360',
    p_next_action: 'Contactar QA',
    p_next_followup_at: tomorrow,
    p_assigned_to: owner.profile.id,
    p_situation: 'Quiere agendar una consulta',
    p_evaluation_previous: 'No',
    p_estimated_value: 1000000,
  });
  const lead = Array.isArray(created) ? created[0] : created;
  assert.ok(lead?.id && lead?.contact_id);
  const base = {
    p_clinic_id: owner.profile.clinic_id,
    p_contact_id: lead.contact_id,
    p_opportunity_id: lead.id,
    p_next_action: null,
    p_next_followup_at: null,
    p_assigned_to: null,
  };

  await rpc(owner.client, 'register_contact_interaction_v1', { ...base, p_channel: 'note', p_outcome: 'note', p_note: 'Nota administrativa QA idempotente' });
  await rpc(owner.client, 'register_contact_interaction_v1', { ...base, p_channel: 'note', p_outcome: 'note', p_note: 'Nota administrativa QA idempotente' });
  await rpc(owner.client, 'register_contact_interaction_v1', { ...base, p_channel: 'whatsapp', p_outcome: 'sent', p_note: 'WhatsApp enviado QA' });
  await rpc(owner.client, 'register_contact_interaction_v1', { ...base, p_channel: 'whatsapp', p_outcome: 'responded', p_note: 'Paciente respondió QA', p_next_action: 'Agendar evaluación QA', p_next_followup_at: tomorrow });
  for (let index = 0; index < 6; index += 1) {
    await rpc(owner.client, 'register_contact_interaction_v1', { ...base, p_channel: 'note', p_outcome: 'note', p_note: `Nota paginación QA ${stamp} ${index}` });
  }

  const summary = await rpc(owner.client, 'get_contact_operating_summary_v1', { p_clinic_id: owner.profile.clinic_id, p_contact_id: lead.contact_id });
  assert.equal(summary.length, 1);
  assert.equal(summary[0].id, lead.contact_id);
  assert.ok(summary[0].last_interaction_at);
  assert.equal(summary[0].next_action, 'Agendar evaluación QA');

  const first = await rpc(owner.client, 'list_contact_timeline_v1', { p_clinic_id: owner.profile.clinic_id, p_contact_id: lead.contact_id, p_limit: 5, p_cursor_created_at: null, p_cursor_id: null });
  assert.equal(first.length, 6, 'Timeline should return the sentinel row');
  const visible = first.slice(0, 5);
  const last = visible.at(-1);
  const second = await rpc(owner.client, 'list_contact_timeline_v1', { p_clinic_id: owner.profile.clinic_id, p_contact_id: lead.contact_id, p_limit: 5, p_cursor_created_at: last.occurred_at, p_cursor_id: last.id });
  assert.ok(!second.some((event) => visible.some((previous) => previous.id === event.id)), 'Timeline pages duplicated rows');
  assert.equal([...visible, ...second].filter((event) => event.event_type === 'administrative_note' && event.description === 'Nota administrativa QA idempotente').length, 1);
  assert.ok(visible.every((event) => event.clinic_id === owner.profile.clinic_id && event.contact_id === lead.contact_id));

  const crossTenant = await owner.client.rpc('get_contact_operating_summary_v1', { p_clinic_id: other.profile.clinic_id, p_contact_id: lead.contact_id });
  assert.ok(crossTenant.error, 'Cross-tenant clinic was accepted');
  const badOpportunity = await owner.client.rpc('register_contact_interaction_v1', { ...base, p_opportunity_id: '00000000-0000-4000-8000-000000000001', p_channel: 'note', p_outcome: 'note', p_note: 'Invalid opportunity' });
  assert.ok(badOpportunity.error, 'Manipulated opportunity was accepted');
  const badAssignee = await owner.client.rpc('register_contact_interaction_v1', { ...base, p_channel: 'note', p_outcome: 'note', p_note: 'Invalid assignee', p_assigned_to: other.profile.id });
  assert.ok(badAssignee.error, 'Cross-tenant assignee was accepted');

  console.log(JSON.stringify({ status: 'PASS', dataset: name, contactId: lead.contact_id, opportunityId: lead.id, summary: 'PASS', timelinePagination: 'PASS', idempotency: 'PASS', crossTenantLeaks: 0 }, null, 2));
} finally {
  await owner.client.auth.signOut();
  await other.client.auth.signOut();
}
