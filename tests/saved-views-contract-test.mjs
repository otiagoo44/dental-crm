import assert from 'node:assert/strict';
import { snapshotView, viewSearchParams, parseOpportunityParams } from '../crm-app/src/features/savedViews/viewState.js';
import { listWorkItems } from '../crm-app/src/features/work/workQueries.js';
const work=snapshotView('work',new URLSearchParams('view=overdue&cursor=old&new=1'));
assert.deepEqual(work,{filters:{view:'overdue'},sorts:[]});
assert.equal(viewSearchParams('work',work).toString(),'view=overdue');
const patients=snapshotView('patients',new URLSearchParams('q=Ana&view=active&cursor=stale'));
assert.deepEqual(patients,{filters:{q:'Ana',view:'active'},sorts:[]});
for(const sort of ['recent','oldest','name','score']) {
 const params=new URLSearchParams({status:'Nuevo',sort,showArchived:'true'});
 const snapshot=snapshotView('opportunities',params);
 assert.equal(parseOpportunityParams(viewSearchParams('opportunities',snapshot)).sort,sort);
 assert.equal(snapshot.filters.showArchived,true);
}
assert.throws(()=>snapshotView('patients',new URLSearchParams('view=invalid')));
assert.throws(()=>snapshotView('work',new URLSearchParams('assignedTo=invalid')));
assert.throws(()=>snapshotView('opportunities',new URLSearchParams('status=invalid')));
assert.throws(()=>snapshotView('opportunities',new URLSearchParams('sort=sql')));
assert.throws(()=>snapshotView('opportunities',new URLSearchParams('showArchived=garbage')));
assert.throws(()=>viewSearchParams('patients',{filters:{sql:'select 1'},sorts:[]}));
assert.throws(()=>viewSearchParams('opportunities',{filters:{},sorts:[{field:'password',direction:'asc'}]}));
assert.throws(()=>viewSearchParams('patients',{filters:{view:null},sorts:[]}));
assert.throws(()=>snapshotView('patients',new URLSearchParams({q:'x'.repeat(161)})));
let workArgs;
await listWorkItems({rpc:(_name,args)=>{workArgs=args;return{abortSignal:async()=>({data:[],error:null})};}},'clinic-test',{view:'team'});
assert.equal(workArgs.p_view,'team','backend, not silent normalization, authorizes Team');
console.log('PASS saved views: supported URL round trips, cursor removal, sorts and invalid payloads');
