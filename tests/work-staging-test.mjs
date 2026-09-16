import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../crm-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const url=process.env.QA_STAGING_SUPABASE_URL,key=process.env.QA_STAGING_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'aqdufiycayedsfldljjq.supabase.co');
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function login(email,password){const c=make();const {data:auth,error}=await c.auth.signInWithPassword({email,password});assert.ifError(error);const {data:p,error:pe}=await c.from('profiles').select('id,clinic_id,role').eq('id',auth.user.id).single();assert.ifError(pe);return {c,p};}
const reception=await login(process.env.QA_RECEPTION_A_EMAIL,process.env.QA_RECEPTION_A_PASSWORD);
const owner=await login(process.env.QA_OWNER_A_EMAIL,process.env.QA_OWNER_A_PASSWORD);
const other=await login(process.env.QA_RECEPTION_B_EMAIL,process.env.QA_RECEPTION_B_PASSWORD);
const args={p_clinic_id:reception.p.clinic_id,p_view:'team',p_limit:25,p_assigned_to:null,p_cursor_group:null,p_cursor_due_at:null,p_cursor_priority:null,p_cursor_key:null};
let result=await reception.c.rpc('list_work_items_v1',args);assert.ok(result.error,'Reception team view must fail');
const started=performance.now();result=await owner.c.rpc('list_work_items_v1',{...args,p_view:'team',p_clinic_id:owner.p.clinic_id});const duration=performance.now()-started;assert.ifError(result.error);
const rows=result.data||[];for(const row of rows){assert.equal(row.clinic_id,owner.p.clinic_id);assert.ok(row.work_key&&row.work_type&&row.source_type);}
const first=await owner.c.rpc('list_work_items_v1',{...args,p_view:'team',p_clinic_id:owner.p.clinic_id,p_limit:1});assert.ifError(first.error);
if(first.data.length>1){const x=first.data[0];const second=await owner.c.rpc('list_work_items_v1',{...args,p_view:'team',p_clinic_id:owner.p.clinic_id,p_limit:1,p_cursor_group:x.sort_group,p_cursor_due_at:x.due_at,p_cursor_priority:x.priority_rank,p_cursor_key:x.work_key});assert.ifError(second.error);assert.notEqual(second.data[0]?.work_key,x.work_key);}
for(const mutation of [{p_view:'invalid'},{p_clinic_id:other.p.clinic_id},{p_assigned_to:other.p.id},{p_limit:101},{p_cursor_group:0,p_cursor_key:null}]){const attempt=await owner.c.rpc('list_work_items_v1',{...args,p_view:'team',p_clinic_id:owner.p.clinic_id,...mutation});assert.ok(attempt.error,`Manipulated input should fail: ${JSON.stringify(mutation)}`);}
const payload=Buffer.byteLength(JSON.stringify(rows));
const plan=await owner.c.rpc('list_work_items_v1',{...args,p_view:'team',p_clinic_id:owner.p.clinic_id}).explain({analyze:true,verbose:true,format:'json'});
console.log(JSON.stringify({status:'PASS',rows:rows.length,payloadBytes:payload,durationMs:Number(duration.toFixed(2)),crossTenantLeaks:0,views:'owner team PASS; reception team blocked',explain:plan.error?`NOT RUN: ${plan.error.message}`:plan.data},null,2));
