import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const requireFromCrm = createRequire(new URL('../../crm-app/package.json', import.meta.url));
const { createClient } = requireFromCrm('@supabase/supabase-js');

const supabaseUrl = String(process.env.REALTIME_SUPABASE_URL || '').trim();
const anonKey = String(process.env.REALTIME_ANON_KEY || '').trim();
const email = String(process.env.REALTIME_USER_EMAIL || '').trim();
const password = String(process.env.REALTIME_USER_PASSWORD || '').trim();
const edgeUrl = String(process.env.REALTIME_EDGE_URL || '').trim();
const origin = String(process.env.REALTIME_ORIGIN || '').trim();
const clinicSlug = String(process.env.REALTIME_CLINIC_SLUG || '').trim();
const formToken = String(process.env.REALTIME_FORM_TOKEN || '').trim();
const otherOrigin = String(process.env.REALTIME_OTHER_ORIGIN || '').trim();
const otherClinicId = String(process.env.REALTIME_OTHER_CLINIC_ID || '').trim();
const otherClinicSlug = String(process.env.REALTIME_OTHER_CLINIC_SLUG || '').trim();
const otherFormToken = String(process.env.REALTIME_OTHER_FORM_TOKEN || '').trim();
const allowedHost = String(process.env.REALTIME_ALLOWED_HOST || '').trim();
const target = String(process.env.REALTIME_TARGET || '').trim().toLowerCase();
const confirmation = String(process.env.REALTIME_CONFIRM_NON_PRODUCTION || '').trim();
const scenarioText = String(process.env.REALTIME_SCENARIOS || '10,25,50,100');

for (const [name, value] of Object.entries({
  REALTIME_SUPABASE_URL: supabaseUrl,
  REALTIME_ANON_KEY: anonKey,
  REALTIME_USER_EMAIL: email,
  REALTIME_USER_PASSWORD: password,
  REALTIME_EDGE_URL: edgeUrl,
  REALTIME_ORIGIN: origin,
  REALTIME_CLINIC_SLUG: clinicSlug,
  REALTIME_FORM_TOKEN: formToken,
  REALTIME_OTHER_ORIGIN: otherOrigin,
  REALTIME_OTHER_CLINIC_ID: otherClinicId,
  REALTIME_OTHER_CLINIC_SLUG: otherClinicSlug,
  REALTIME_OTHER_FORM_TOKEN: otherFormToken,
  REALTIME_ALLOWED_HOST: allowedHost,
})) assert.ok(value, `${name} is required`);

assert.ok(['local', 'staging'].includes(target), 'REALTIME_TARGET must be local or staging');
const apiUrl = new URL(supabaseUrl);
const intakeUrl = new URL(edgeUrl);
assert.equal(apiUrl.origin, intakeUrl.origin);
assert.equal(intakeUrl.host, allowedHost);
if (!['localhost', '127.0.0.1'].includes(apiUrl.hostname)) {
  assert.equal(target, 'staging');
  assert.equal(confirmation, 'I_ACKNOWLEDGE_STAGING');
}

const scenarios = scenarioText.split(',').map((value) => Number(value.trim()));
assert.ok(scenarios.every((value) => [10, 25, 50, 100].includes(value)));

const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
assert.ifError(signInError);
assert.ok(signIn.session?.access_token && signIn.session?.refresh_token, 'Staging login did not return a session');

const { data: profile, error: profileError } = await authClient
  .from('profiles')
  .select('clinic_id')
  .eq('id', signIn.user.id)
  .single();
assert.ifError(profileError);
const clinicId = profile.clinic_id;

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? null;
}

function qaPhone(label) {
  let value = 0;
  for (const char of label) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return `0981${String(value % 1_000_000).padStart(6, '0')}`;
}

async function submitLead(slug, token, requestOrigin, label) {
  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify({
      clinic_slug: slug,
      landing_token: token,
      nombre: `Realtime QA ${label}`,
      telefono: qaPhone(label),
      tratamiento: 'Consulta general',
      consentimiento_contacto: true,
      origen: `realtime:${label}`,
      website: '',
    }),
  });
  const data = await response.json().catch(() => null);
  assert.equal(response.status, 200, `Realtime trigger intake failed with HTTP ${response.status}`);
  assert.ok(data?.lead_id);
  return data.lead_id;
}

async function waitFor(check, timeoutMs, message) {
  const started = performance.now();
  while (!check()) {
    if (performance.now() - started > timeoutMs) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return performance.now() - started;
}

const rows = [];
for (const sessionCount of scenarios) {
  const runId = `${sessionCount}-${randomUUID().slice(0, 8)}`;
  const clients = [];
  const channels = [];
  const subscribedAt = [];
  const eventAt = [];
  let subscribed = 0;
  let matchingEvents = 0;
  const connectStarted = performance.now();

  for (let index = 0; index < sessionCount; index += 1) {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    const { error: sessionError } = await client.auth.setSession({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    });
    assert.ifError(sessionError);

    const channel = client
      .channel(`capacity:${runId}:${index}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `clinic_id=eq.${clinicId}` }, (payload) => {
        if (payload.new?.id) {
          matchingEvents += 1;
          eventAt.push(performance.now());
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinicId}` }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `clinic_id=eq.${clinicId}` }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `clinic_id=eq.${clinicId}` }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed += 1;
          subscribedAt.push(performance.now());
        }
      });
    clients.push(client);
    channels.push(channel);
  }

  await waitFor(() => subscribed === sessionCount, 30_000, `Only ${subscribed}/${sessionCount} sessions subscribed`);
  const eventStarted = performance.now();
  await submitLead(clinicSlug, formToken, origin, `capacity-${runId}`);
  await waitFor(() => matchingEvents === sessionCount, 20_000, `Only ${matchingEvents}/${sessionCount} sessions received the event`);

  const connectionLatencies = subscribedAt.map((timestamp) => timestamp - connectStarted);
  const deliveryLatencies = eventAt.map((timestamp) => timestamp - eventStarted);
  rows.push({
    sessions: sessionCount,
    subscribed,
    events: matchingEvents,
    connectP95Ms: Math.round(percentile(connectionLatencies, 0.95)),
    deliveryP50Ms: Math.round(percentile(deliveryLatencies, 0.5)),
    deliveryP95Ms: Math.round(percentile(deliveryLatencies, 0.95)),
  });

  await Promise.all(channels.map((channel, index) => clients[index].removeChannel(channel)));
}

// A user from Clinic A may request a filter for Clinic B, but RLS must prevent
// delivery. This uses a fresh connection so no prior channel can mask a leak.
const isolationClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
await isolationClient.auth.setSession({ access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token });
let foreignEvents = 0;
let isolationSubscribed = false;
const isolationChannel = isolationClient
  .channel(`cross-tenant:${randomUUID()}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `clinic_id=eq.${otherClinicId}` }, () => {
    foreignEvents += 1;
  })
  .subscribe((status) => { if (status === 'SUBSCRIBED') isolationSubscribed = true; });
await waitFor(() => isolationSubscribed, 15_000, 'Cross-tenant probe did not subscribe');
await submitLead(otherClinicSlug, otherFormToken, otherOrigin, `foreign-${randomUUID().slice(0, 8)}`);
await new Promise((resolve) => setTimeout(resolve, 3_000));
assert.equal(foreignEvents, 0, 'Clinic A received a Realtime event from another clinic');
await isolationClient.removeChannel(isolationChannel);

await authClient.auth.signOut();
console.table(rows);
console.log(JSON.stringify({ target, scenarios: rows, crossTenantRealtimeEvents: foreignEvents }, null, 2));
