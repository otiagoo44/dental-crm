import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.QA_STAGING_SUPABASE_URL;
const key = process.env.QA_STAGING_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'aqdufiycayedsfldljjq.supabase.co');
const client = (email, password) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  const { data: profile, error: profileError } = await c.from('profiles').select('id,clinic_id').eq('id', data.user.id).single();
  assert.ifError(profileError);
  return { c, profile };
}

const owner = await signIn(process.env.QA_OWNER_A_EMAIL, process.env.QA_OWNER_A_PASSWORD);
const other = await signIn(process.env.QA_RECEPTION_B_EMAIL, process.env.QA_RECEPTION_B_PASSWORD);
try {
  const ownContact = await owner.c.rpc('search_dentflow_v1', { p_clinic_id: owner.profile.clinic_id, p_query: 'QA INTERACTION', p_limit: 12 });
  assert.ifError(ownContact.error);
  assert.ok(ownContact.data.some((row) => row.result_type === 'contact' && row.title.startsWith('QA INTERACTION')));

  const ownOpportunity = await owner.c.rpc('search_dentflow_v1', { p_clinic_id: owner.profile.clinic_id, p_query: 'Implantes QA Interaction', p_limit: 12 });
  assert.ifError(ownOpportunity.error);
  assert.ok(ownOpportunity.data.some((row) => row.result_type === 'opportunity'));

  const cross = await owner.c.rpc('search_dentflow_v1', { p_clinic_id: other.profile.clinic_id, p_query: 'QA INTERACTION', p_limit: 12 });
  assert.ok(cross.error, 'Cross-tenant clinic was accepted');
  const invalid = await owner.c.rpc('search_dentflow_v1', { p_clinic_id: owner.profile.clinic_id, p_query: 'x', p_limit: 12 });
  assert.ok(invalid.error, 'Invalid short query was accepted');
  const tooLarge = await owner.c.rpc('search_dentflow_v1', { p_clinic_id: owner.profile.clinic_id, p_query: 'QA INTERACTION', p_limit: 21 });
  assert.ok(tooLarge.error, 'Unbounded limit was accepted');
  console.log(JSON.stringify({ status: 'PASS', contact: 'PASS', opportunity: 'PASS', crossTenantLeaks: 0, bounds: 'PASS' }, null, 2));
} finally {
  await owner.c.auth.signOut();
  await other.c.auth.signOut();
}
