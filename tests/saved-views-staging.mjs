// Staging-only RPC evidence. This is NOT browser evidence or a complete Gate A.
// Run from repository root:
// node --env-file=.env.qa-staging.local tests/saved-views-staging.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.QA_STAGING_SUPABASE_URL;
assert.equal(new URL(url).origin, 'https://aqdufiycayedsfldljjq.supabase.co');
const stamp = `Gate A ${randomUUID()}`;
const created = [];
const results = [];
const pass = (name) => results.push({ name, status: 'PASS' });
const unwrap = (data) => Array.isArray(data) ? data[0] : data;

async function login(label, role) {
  const client = createClient(url, process.env.QA_STAGING_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env[`QA_${label}_EMAIL`], password: process.env[`QA_${label}_PASSWORD`],
  });
  assert.equal(error?.code, undefined, `${label}: login failed`);
  const profile = await client.from('profiles').select('id,clinic_id,role,active').eq('id', data.user.id).single();
  assert.equal(profile.error?.code, undefined, `${label}: profile failed`);
  assert.equal(profile.data.active, true);
  assert.equal(profile.data.role, role);
  return { client, profile: profile.data };
}
async function rpc(actor, name, args) {
  const { data, error } = await actor.client.rpc(name, args);
  assert.equal(error?.code, undefined, `${name}: ${error?.code}`);
  return data;
}
async function denied(actor, name, args, code) {
  const { error } = await actor.client.rpc(name, args);
  assert.equal(error?.code, code, `${name}: expected ${code}`);
}
const list = (actor, entity) => rpc(actor, 'list_saved_views_v1', { p_entity: entity });
async function create(actor, entity, visibility) {
  const args = { p_entity: entity, p_name: `${stamp} ${visibility}`, p_visibility: visibility, p_filters: {}, p_sorts: [] };
  const view = unwrap(await rpc(actor, 'create_saved_view_v1', args));
  assert.ok(view?.id);
  created.push({ actor, id: view.id, entity });
  assert.equal(view.clinic_id, actor.profile.clinic_id);
  assert.equal(view.user_id, actor.profile.id);
  return view;
}
const updateArgs = (view, name) => ({ p_id: view.id, p_name: name, p_visibility: view.visibility, p_filters: view.filters, p_sorts: view.sorts });

let failure;
try {
  const owner = await login('OWNER_A', 'owner');
  const reception = await login('RECEPTION_A', 'receptionist');
  const other = await login('RECEPTION_B', 'receptionist');
  assert.equal(owner.profile.clinic_id, reception.profile.clinic_id);
  assert.notEqual(other.profile.clinic_id, reception.profile.clinic_id);
  let secondReception;
  if (process.env.QA_RECEPTION_A2_EMAIL && process.env.QA_RECEPTION_A2_PASSWORD) {
    secondReception = await login('RECEPTION_A2', 'receptionist');
    assert.equal(secondReception.profile.clinic_id, reception.profile.clinic_id);
    assert.notEqual(secondReception.profile.id, reception.profile.id);
  }

  for (const entity of ['work', 'patients', 'opportunities']) {
    const view = await create(reception, entity, 'private');
    assert.ok((await list(reception, entity)).some((v) => v.id === view.id));
    for (const [label, actor] of [['Owner', owner], ['Clinic B', other], ...(secondReception ? [['Reception A2', secondReception]] : [])]) {
      assert.ok(!(await list(actor, entity)).some((v) => v.id === view.id));
      const direct = await actor.client.from('saved_views').select('id').eq('id', view.id);
      assert.equal(direct.error?.code, undefined);
      assert.deepEqual(direct.data, []);
      await denied(actor, 'update_saved_view_v1', updateArgs(view, 'Forbidden'), '42501');
      await denied(actor, 'delete_saved_view_v1', { p_id: view.id }, '42501');
      pass(`${entity}: private hidden and immutable to ${label}`);
    }
    const renamed = `${stamp} renamed`;
    await rpc(reception, 'update_saved_view_v1', updateArgs(view, renamed));
    assert.equal((await list(reception, entity)).find((v) => v.id === view.id)?.name, renamed);
    // A second independent HTTP request proves persistence, not browser refresh.
    assert.equal((await list(reception, entity)).find((v) => v.id === view.id)?.name, renamed);
    pass(`${entity}: Reception private create/read/rename/persist`);
  }

  const team = await create(owner, 'work', 'team');
  for (const actor of [reception, ...(secondReception ? [secondReception] : [])]) {
    assert.ok((await list(actor, 'work')).some((v) => v.id === team.id));
  }
  assert.ok(!(await list(other, 'work')).some((v) => v.id === team.id));
  for (const actor of [reception, ...(secondReception ? [secondReception] : []), other]) {
    await denied(actor, 'update_saved_view_v1', updateArgs(team, 'Forbidden'), '42501');
    await denied(actor, 'delete_saved_view_v1', { p_id: team.id }, '42501');
  }
  await denied(reception, 'create_saved_view_v1', { p_entity: 'work', p_name: `${stamp} forbidden`, p_visibility: 'team', p_filters: {}, p_sorts: [] }, '42501');
  const changed = { ...updateArgs(team, `${stamp} updated`), p_filters: { view: 'followups' } };
  await rpc(owner, 'update_saved_view_v1', changed);
  for (const actor of [reception, ...(secondReception ? [secondReception] : [])]) {
    const received = (await list(actor, 'work')).find((v) => v.id === team.id);
    assert.equal(received?.name, changed.p_name);
    assert.deepEqual(received.filters, changed.p_filters);
  }
  pass('team: owner create/update observed by Reception; Reception and foreign clinic mutations denied');

  const args = { p_entity: 'work', p_name: `${stamp} invalid`, p_visibility: 'private', p_filters: {}, p_sorts: [] };
  await denied(reception, 'create_saved_view_v1', { ...args, p_clinic_id: other.profile.clinic_id }, 'PGRST202');
  await denied(reception, 'create_saved_view_v1', { ...args, p_user_id: owner.profile.id }, 'PGRST202');
  await denied(reception, 'create_saved_view_v1', { ...args, p_filters: { assignedTo: other.profile.id } }, '22023');
  await denied(reception, 'delete_saved_view_v1', { p_id: 'malformed-uuid' }, '22P02');
  await denied(reception, 'update_saved_view_v1', { ...updateArgs(team, 'Invalid'), p_id: 'malformed-uuid' }, '22P02');
  pass('RPC: injected clinic/user parameters, foreign assignee and malformed UUID rejected');
  if (!secondReception) results.push({ name: 'Private isolation: second Reception in same clinic', status: 'NOT RUN', reason: 'QA_RECEPTION_A2 credentials unavailable; QA_RECEPTION_B belongs to Clinic B' });
} catch (error) {
  failure = error;
} finally {
  for (const { actor, id, entity } of created.reverse()) {
    try {
      assert.equal(await rpc(actor, 'delete_saved_view_v1', { p_id: id }), id);
      assert.ok(!(await list(actor, entity)).some((view) => view.id === id));
    } catch {
      results.push({ name: 'Cleanup', status: 'FAIL', viewId: id });
      failure ||= new Error('Fixture cleanup failed');
    }
  }
  if (!results.some((r) => r.name === 'Cleanup')) pass(`cleanup: ${created.length} synthetic views deleted and absence verified`);
  // Do not sign out globally: these QA users may also have real browser sessions.
}
console.log(JSON.stringify({ timestamp: new Date().toISOString(), project: 'aqdufiycayedsfldljjq', transport: 'authenticated HTTP RPC; no service role', status: failure ? 'FAIL' : 'PARTIAL GATE EVIDENCE', results }, null, 2));
if (failure) { console.error(failure.message); process.exitCode = 1; }
