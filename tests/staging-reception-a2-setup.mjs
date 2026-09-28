// Creates ONLY the missing synthetic Reception A2; never resets existing passwords.
// node --env-file=.env.qa-staging.local tests/staging-reception-a2-setup.mjs
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const project = 'aqdufiycayedsfldljjq';
const url = process.env.QA_STAGING_SUPABASE_URL;
const email = 'qa.reception.a2@dental-crm.invalid';
const envPath = fileURLToPath(new URL('../.env.qa-staging.local', import.meta.url));
const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
};
const check = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.code || 'request failed'}`);
  return result.data;
};
async function login(mail, password) {
  const client = createClient(url, process.env.QA_STAGING_SUPABASE_ANON_KEY, options);
  const data = check(await client.auth.signInWithPassword({ email: mail, password }), 'QA login');
  return { client, id: data.user.id };
}
try {
  assert.equal(new URL(url).origin, `https://${project}.supabase.co`);
  assert.equal(process.env.QA_STAGING_PROJECT_REF, project);
  assert.equal(spawnSync('git', ['check-ignore', '--quiet', envPath], { cwd: root }).status, 0, 'Credential file must be gitignored');
  const owner = await login(process.env.QA_OWNER_A_EMAIL, process.env.QA_OWNER_A_PASSWORD);
  const ownerProfile = check(await owner.client.from('profiles').select('clinic_id,role,active').eq('id', owner.id).single(), 'Owner profile');
  assert.equal(ownerProfile.role, 'owner');
  assert.equal(ownerProfile.active, true);
  let password = process.env.QA_RECEPTION_A2_PASSWORD;
  let created = false;
  if (process.env.QA_RECEPTION_A2_EMAIL || password) {
    assert.equal(process.env.QA_RECEPTION_A2_EMAIL, email, 'Unexpected QA account');
    assert.ok(password, 'Existing QA account requires its own credentials');
  } else {
    const keyResult = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c',
      `npx.cmd supabase projects api-keys --project-ref ${project} --output json`],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(keyResult.status, 0, 'Staging admin key unavailable');
    const key = JSON.parse(keyResult.stdout).find((entry) => entry.id === 'service_role')?.api_key;
    assert.ok(key, 'Staging admin key unavailable');
    const admin = createClient(url, key, options);
    for (let page = 1; ; page++) {
      const data = check(await admin.auth.admin.listUsers({ page, perPage: 100 }), 'QA account lookup');
      assert.ok(!data.users.some((user) => user.email?.toLowerCase() === email), 'QA A2 already exists: supply its credentials; no password reset performed');
      if (data.users.length < 100) break;
    }
    password = `${randomBytes(32).toString('base64url')}Aa1!`;
    // Persist first so a network failure cannot lose the only copy of the credential.
    appendFileSync(envPath, `\nQA_RECEPTION_A2_EMAIL=${email}\nQA_RECEPTION_A2_PASSWORD=${password}\n`, { mode: 0o600 });
    const data = check(await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { full_name: 'QA Reception A2', qa_fixture: true } }), 'Create QA A2');
    check(await admin.from('profiles').insert({ id: data.user.id, clinic_id: ownerProfile.clinic_id,
      full_name: 'QA Reception A2', email, role: 'receptionist', active: true }), 'Create QA A2 profile');
    created = true;
  }
  const reception = await login(email, password);
  const profile = check(await reception.client.from('profiles').select('id,clinic_id,role,active').eq('id', reception.id).single(), 'QA A2 profile');
  assert.equal(profile.clinic_id, ownerProfile.clinic_id);
  assert.equal(profile.role, 'receptionist');
  assert.equal(profile.active, true);
  const first = await login(process.env.QA_RECEPTION_A_EMAIL, process.env.QA_RECEPTION_A_PASSWORD);
  assert.notEqual(first.id, reception.id);
  console.log(JSON.stringify({ project, created, sameClinic: true, distinctReception: true, active: true, credentials: 'gitignored local environment only' }));
} catch (error) {
  // SDK errors are reduced above; never print request bodies, tokens or CLI stdout.
  console.error(error.message);
  process.exitCode = 1;
}
