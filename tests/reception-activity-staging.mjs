// Real Reception HTTP evidence; does not replace the browser/permission gate.
// Leaves one immutable administrative QA note on an existing synthetic contact.
// node --env-file=.env.qa-staging.local tests/reception-activity-staging.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.QA_STAGING_SUPABASE_URL;
assert.equal(new URL(url).origin, 'https://aqdufiycayedsfldljjq.supabase.co');
async function login(label) {
  const client = createClient(url, process.env.QA_STAGING_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: process.env[`QA_${label}_EMAIL`], password: process.env[`QA_${label}_PASSWORD`] });
  assert.equal(error?.code, undefined, `${label}: authentication failed`);
  const profile = await client.from('profiles').select('id,clinic_id,role,active').eq('id', data.user.id).single();
  assert.equal(profile.error?.code, undefined);
  assert.equal(profile.data.role, 'receptionist');
  assert.equal(profile.data.active, true);
  return { client, profile: profile.data };
}
async function call(actor, name, args) {
  const result = await actor.client.rpc(name, args);
  assert.equal(result.error?.code, undefined, `${name}: ${result.error?.code}`);
  return result.data;
}
const reception = await login('RECEPTION_A');
const other = await login('RECEPTION_B');
assert.notEqual(reception.profile.clinic_id, other.profile.clinic_id);
const fixture = await reception.client.from('leads').select('id,contact_id,name')
  .eq('clinic_id', reception.profile.clinic_id).ilike('name', 'QA INTERACTION %')
  .order('created_at', { ascending: false }).order('id').limit(1).maybeSingle();
assert.equal(fixture.error?.code, undefined);
assert.ok(fixture.data?.contact_id, 'Existing QA INTERACTION fixture required; no real patient will be modified');
assert.match(fixture.data.name, /^QA INTERACTION /i);
const contactId = fixture.data.contact_id;
const timelineArgs = { p_clinic_id: reception.profile.clinic_id, p_contact_id: contactId, p_limit: 25, p_cursor_created_at: null, p_cursor_id: null };
const note = `Gate A Reception API QA ${randomUUID()}`;
const interaction = { p_clinic_id: reception.profile.clinic_id, p_contact_id: contactId, p_opportunity_id: fixture.data.id, p_channel: 'note', p_outcome: 'note', p_note: note, p_next_action: null, p_next_followup_at: null, p_assigned_to: null };
await call(reception, 'register_contact_interaction_v1', interaction);
// An actual retry must not create a second immutable event.
await call(reception, 'register_contact_interaction_v1', interaction);
const expectedKeys = ['id', 'clinic_id', 'contact_id', 'opportunity_id', 'opportunity_label', 'event_type', 'title', 'description', 'channel', 'outcome', 'actor_id', 'actor_name', 'occurred_at'].sort();
for (let attempt = 0; attempt < 2; attempt += 1) {
  const timeline = await call(reception, 'list_contact_timeline_v1', timelineArgs);
  assert.ok(timeline.length <= 26);
  const recorded = timeline.filter((event) => event.description === note);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].actor_id, reception.profile.id);
  assert.equal(recorded[0].event_type, 'administrative_note');
  for (const event of timeline) {
    assert.deepEqual(Object.keys(event).sort(), expectedKeys);
    assert.equal(event.clinic_id, reception.profile.clinic_id);
    assert.equal(event.contact_id, contactId);
  }
}
for (const args of [timelineArgs, { ...timelineArgs, p_clinic_id: other.profile.clinic_id }]) {
  const result = await other.client.rpc('list_contact_timeline_v1', args);
  assert.ok(['42501', 'P0002'].includes(result.error?.code), 'Foreign contact must not be readable');
}
console.log(JSON.stringify({ timestamp: new Date().toISOString(), project: 'aqdufiycayedsfldljjq', transport: 'real Reception authenticated HTTP; no service role', status: 'PARTIAL GATE EVIDENCE', receptionCreateReadRetryPersist: 'PASS', boundedProjectionWithoutRawMetadata: 'PASS', foreignClinicAndContact: 'PASS', browserRefresh: 'NOT RUN', restrictedEventContentPermissionMatrix: 'NOT PROVEN', retainedFixture: { contactId, opportunityId: fixture.data.id, note } }, null, 2));
// No global sign-out, Auth changes, schema changes or existing event deletion.
