import assert from 'node:assert/strict';
import { createContactQueries, decodeCursor } from '../crm-app/src/services/contactQueries.js';
const clinic = '77777777-7777-4777-8777-777777777777';
const contact = '11111111-1111-4111-8111-111111111111';
const calls = [];
let data = [];
const chain = new Proxy({}, { get: (_, name) => name === 'then' ? (resolve) => resolve({ data, error: null })
  : (...args) => { calls.push([name, ...args]); return chain; } });
const query = createContactQueries(chain, clinic);
data = Array.from({ length: 26 }, (_, n) => ({ id: `e4000000-0000-0000-0000-${String(99-n).padStart(12,'0')}`, created_at: '2026-01-01T00:00:00+00:00' }));
const page = await query.listContacts({ search: 'Ana', filter: 'active' });
assert.equal(page.rows.length,25);
assert.equal(decodeCursor(page.nextCursor).id, data[24].id);
assert.equal(calls[0][2].p_clinic_id, clinic);
assert.equal(calls[0][2].p_search,'Ana');
assert.equal(calls[0][2].p_filter,'active');
for (const cursor of ['x','{}',JSON.stringify({id:contact,created_at:'2026-01-01T00:00:00Z),id.neq.null'})]) assert.throws(()=>decodeCursor(cursor));
await assert.rejects(query.listContacts({filter:'all);drop table contacts'}));
await assert.rejects(query.listContacts({limit:101}));
await assert.rejects(query.listContacts({search:'a'.repeat(161)}));
calls.length=0;
await query.listOpportunities({contactId:contact,cursor:page.nextCursor});
assert.ok(calls.some(([name,...args])=>name==='eq' && args[0]==='clinic_id' && args[1]===clinic));
assert.ok(calls.some(([name,...args])=>name==='eq' && args[0]==='contact_id' && args[1]===contact));
assert.ok(calls.some(([name,n])=>name==='limit' && n===26));
assert.ok(!calls.some(([name,fields])=>name==='select' && fields.includes('*')));
data=[]; calls.length=0;
assert.equal(await query.getContact360(contact),null);
assert.ok(!calls.some(([name])=>name==='from'), 'missing contact must not fetch opportunities');
for (const section of ['timeline','appointments','tasks','quotes','notes']) {
  calls.length=0;
  await query.listRelated({contactId:contact,section});
  assert.ok(calls.some(([name,column,id])=>name==='eq' && column==='clinic_id' && id===clinic));
  assert.ok(calls.some(([name,column,id])=>name==='eq' && column.endsWith('contact_id') && id===contact));
  assert.ok(calls.some(([name,n])=>name==='limit' && n===26));
}
console.log('PASS contact query contracts: tenant scope, bounds, explicit fields, cursor and filter validation');
