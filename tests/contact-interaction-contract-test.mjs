import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContactQueries } from '../crm-app/src/services/contactQueries.js';

const migration = await readFile(new URL('../supabase/migrations/20260916225713_contact_interaction_timeline.sql', import.meta.url), 'utf8');
for (const functionName of ['get_contact_operating_summary_v1', 'list_contact_timeline_v1', 'register_contact_interaction_v1']) {
  assert.match(migration, new RegExp(`create function public\\.${functionName}`));
  assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}`));
}
assert.match(migration, /security invoker/g);
assert.doesNotMatch(migration, /select\s+\*/i);
assert.match(migration, /limit p_limit \+ 1/);
assert.match(migration, /\(e\.created_at, e\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
assert.match(migration, /current_profile\.clinic_id <> p_clinic_id/);
assert.match(migration, /normalized_channel not in \('whatsapp', 'call', 'email', 'in_person', 'note'\)/);
assert.match(migration, /e\.created_at >= now\(\) - interval '10 seconds'/);

const clinicId = '77777777-7777-4777-8777-777777777777';
const contactId = '11111111-1111-4111-8111-111111111111';
const opportunityId = '22222222-2222-4222-8222-222222222222';
const calls = [];
let data = [];
const chain = new Proxy({}, { get: (_, name) => name === 'then'
  ? (resolve) => resolve({ data, error: null })
  : (...args) => { calls.push([name, ...args]); return chain; } });
const queries = createContactQueries(chain, clinicId);

data = [{ id: contactId, name: 'QA', active_opportunity_count: 1 }];
await queries.getContact360(contactId);
assert.ok(calls.some(([name, rpc, args]) => name === 'rpc' && rpc === 'get_contact_operating_summary_v1' && args.p_clinic_id === clinicId));

calls.length = 0;
data = Array.from({ length: 26 }, (_, index) => ({ id: `e4000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, occurred_at: '2026-09-16T12:00:00+00:00' }));
const timeline = await queries.listTimeline({ contactId });
assert.equal(timeline.rows.length, 25);
assert.ok(timeline.nextCursor);
assert.ok(calls.some(([name, rpc, args]) => name === 'rpc' && rpc === 'list_contact_timeline_v1' && args.p_limit === 25));

calls.length = 0;
data = opportunityId;
await queries.registerInteraction({ contactId, opportunityId, channel: 'whatsapp', outcome: 'sent', note: 'QA' });
assert.ok(calls.some(([name, rpc, args]) => name === 'rpc' && rpc === 'register_contact_interaction_v1' && args.p_contact_id === contactId));
await assert.rejects(queries.registerInteraction({ contactId, opportunityId, channel: 'sql', outcome: 'sent' }));
await assert.rejects(queries.registerInteraction({ contactId, opportunityId, channel: 'note', outcome: 'note', note: 'x'.repeat(2001) }));

console.log('PASS Contact 360 interaction contracts: server projection, keyset timeline, allowlists and bounded inputs');
