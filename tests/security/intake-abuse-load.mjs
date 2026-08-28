import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const endpoint = String(process.env.ABUSE_EDGE_URL || '').trim();
const supabaseUrl = String(process.env.ABUSE_SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.ABUSE_SERVICE_ROLE_KEY || '').trim();
const origin = String(process.env.ABUSE_ORIGIN || '').trim();
const allowedHost = String(process.env.ABUSE_ALLOWED_HOST || '').trim();
const target = String(process.env.ABUSE_TARGET || '').trim().toLowerCase();
const confirmation = String(process.env.ABUSE_CONFIRM_NON_PRODUCTION || '').trim();

assert.ok(endpoint && supabaseUrl && serviceRoleKey && origin && allowedHost, 'Missing ABUSE_* staging/local configuration');
assert.ok(['local', 'staging'].includes(target), 'ABUSE_TARGET must be local or staging');

const endpointUrl = new URL(endpoint);
assert.equal(endpointUrl.pathname, '/functions/v1/lead-intake');
assert.equal(endpointUrl.origin, new URL(supabaseUrl).origin);
assert.equal(endpointUrl.host, allowedHost, 'ABUSE_ALLOWED_HOST must exactly match the endpoint host');

if (!['localhost', '127.0.0.1'].includes(endpointUrl.hostname)) {
  assert.equal(target, 'staging');
  assert.equal(confirmation, 'I_ACKNOWLEDGE_STAGING');
}

const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
const internalErrorPattern = /postgres|sqlstate|stack|relation|service[_-]?role|jwt|database password/i;
const results = [];

function fixture(index) {
  return {
    slug: `load-qa-${String(index).padStart(3, '0')}`,
    token: `lf_load_${createHash('md5').update(`dental-crm-load-form-${index}`).digest('hex')}`,
  };
}

function uniquePhone(label) {
  const suffix = createHash('sha256').update(`${runId}:${label}`).digest().readUInt32BE(0) % 1_000_000;
  return `0981${String(suffix).padStart(6, '0')}`;
}

function baseBody(formIndex, label) {
  const form = fixture(formIndex);
  return {
    clinic_slug: form.slug,
    landing_token: form.token,
    nombre: `Abuse QA ${label}`,
    telefono: uniquePhone(label),
    tratamiento: 'Consulta general',
    urgencia: 'Esta semana',
    situacion: 'Quiero agendar',
    consultation_reason: 'Security test on non-production',
    origen: `abuse:${runId}:${label}`.slice(0, 120),
    pagina: 'tests/security/intake-abuse-load.mjs',
    consentimiento_contacto: true,
    website: '',
  };
}

async function request(label, body, options = {}) {
  const started = performance.now();
  const headers = { 'content-type': options.contentType || 'application/json' };
  if (options.origin !== null) headers.Origin = options.origin || origin;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  assert.equal(internalErrorPattern.test(text), false, `${label} exposed an internal error detail`);
  const result = {
    label,
    status: response.status,
    success: response.ok,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
  };
  results.push(result);
  return result;
}

async function expectStatus(label, body, expected, options) {
  const result = await request(label, body, options);
  assert.equal(result.status, expected, `${label}: expected ${expected}, got ${result.status}`);
  return result;
}

const formA = fixture(1);
const formB = fixture(2);

await expectStatus('missing-token', { ...baseBody(1, 'missing-token'), landing_token: 'lf_invalid_0123456789abcdef0123456789' }, 403);
await expectStatus('other-clinic-token', { ...baseBody(1, 'other-token'), landing_token: formB.token }, 403);
await expectStatus('wrong-origin', baseBody(1, 'wrong-origin'), 403, { origin: 'https://invalid-origin.example' });
await expectStatus('missing-origin', baseBody(1, 'missing-origin'), 403, { origin: null });
await expectStatus('empty-object', {}, 400);
await expectStatus('null-body', null, 400);
await expectStatus('malformed-json', null, 400, { rawBody: '{"clinic_slug":' });
await expectStatus('wrong-content-type', baseBody(1, 'content-type'), 415, { contentType: 'text/plain' });
await expectStatus('oversized-body', null, 400, { rawBody: JSON.stringify({ ...baseBody(1, 'oversized'), notes: 'x'.repeat(17_000) }) });
await expectStatus('long-name', { ...baseBody(1, 'long-name'), nombre: 'x'.repeat(2_000) }, 400);
await expectStatus('invalid-phone', { ...baseBody(1, 'invalid-phone'), telefono: '123' }, 400);
await expectStatus('array-name', { ...baseBody(1, 'array-name'), nombre: ['Ana'] }, 400);
await expectStatus('null-name', { ...baseBody(1, 'null-name'), nombre: null }, 400);
await expectStatus('script-name', { ...baseBody(1, 'script-name'), nombre: '<script>alert(1)</script>' }, 400);

for (const forbidden of ['clinic_id', 'lead_id', 'appointment_id', 'appointment', 'quote_id', 'quote', 'assigned_to']) {
  await expectStatus(`forbidden-${forbidden}`, { ...baseBody(1, `forbidden-${forbidden}`), [forbidden]: randomUUID() }, 400);
}

await expectStatus('extra-field', { ...baseBody(3, 'extra-field'), unexpected_field: 'ignored' }, 200);
await expectStatus('unicode', { ...baseBody(4, 'unicode'), nombre: 'Zoë Ñandutí 🦷' }, 200);
await expectStatus('html-text', { ...baseBody(5, 'html-text'), nombre: '<b>Ana Segura</b>' }, 200);
await expectStatus('sql-like-text', { ...baseBody(6, 'sql-like'), nombre: "Robert'); DROP TABLE leads;--" }, 200);
await expectStatus('malicious-url-as-text', { ...baseBody(7, 'malicious-url'), notes: 'javascript:alert(1)' }, 200);
await expectStatus('quoted-text', { ...baseBody(8, 'quotes'), nombre: 'Ana "O\'Connor"' }, 200);

const replayBody = { ...baseBody(10, 'replay'), telefono: uniquePhone('replay-shared') };
const replayResults = await Promise.all(
  Array.from({ length: 10 }, (_, index) => request(`replay-${index + 1}`, replayBody)),
);
const replayAccepted = replayResults.filter((item) => item.status === 200).length;
const replayRejected = replayResults.filter((item) => item.status === 429).length;
assert.equal(replayAccepted, 3, 'Phone limiter must atomically accept only the first three concurrent attempts');
assert.equal(replayRejected, 7, 'Phone limiter must reject the remaining concurrent attempts');

const burstRows = [];
for (const [size, formIndex] of [[10, 20], [50, 30], [100, 40], [500, 50]]) {
  const burst = await Promise.all(
    Array.from({ length: size }, (_, index) => request(
      `burst-${size}-${index + 1}`,
      baseBody(formIndex, `burst-${size}-${index + 1}`),
    )),
  );
  const accepted = burst.filter((item) => item.status === 200).length;
  const rejected = burst.filter((item) => item.status === 429).length;
  const otherErrors = burst.length - accepted - rejected;
  burstRows.push({ size, accepted, rejected, otherErrors });
  assert.equal(accepted, Math.min(size, 20), `Burst ${size} crossed the per-form/IP limit`);
  assert.equal(rejected, Math.max(0, size - 20), `Burst ${size} did not return the expected 429 responses`);
  assert.equal(otherErrors, 0, `Burst ${size} had unexpected errors`);
}

const query = new URL('/rest/v1/leads', supabaseUrl);
query.searchParams.set('select', 'id,clinic_id,name,phone_plus,source,notes');
query.searchParams.set('source', `like.abuse:${runId}:*`);
query.searchParams.set('limit', '1000');
const verificationResponse = await fetch(query, {
  headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
});
assert.equal(verificationResponse.ok, true, `DB verification failed with HTTP ${verificationResponse.status}`);
const leads = await verificationResponse.json();

const replayPhonePlus = `+595${uniquePhone('replay-shared').slice(1)}`;
assert.equal(leads.filter((lead) => lead.phone_plus === replayPhonePlus).length, 1, 'Concurrent replay created duplicate open opportunities');
assert.equal(leads.some((lead) => /<script/i.test(`${lead.name || ''}${lead.notes || ''}`)), false, 'Stored script markup reached leads');

const invalidLabels = [
  'missing-token', 'other-token', 'wrong-origin', 'missing-origin', 'long-name',
  'invalid-phone', 'array-name', 'null-name', 'script-name',
];
for (const label of invalidLabels) {
  assert.equal(leads.some((lead) => lead.source === `abuse:${runId}:${label}`), false, `${label} created DB garbage`);
}

console.table(burstRows);
console.log(JSON.stringify({
  target,
  endpointHost: endpointUrl.host,
  replay: { total: 10, accepted: replayAccepted, rejected: replayRejected, openLeads: 1 },
  bursts: burstRows,
  storedLeadsChecked: leads.length,
}, null, 2));
