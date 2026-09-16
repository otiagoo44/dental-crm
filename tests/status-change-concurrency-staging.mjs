import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../crm-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
assert.equal(new URL(process.env.QA_STAGING_SUPABASE_URL).hostname,'aqdufiycayedsfldljjq.supabase.co');
const client=createClient(process.env.QA_STAGING_SUPABASE_URL,process.env.QA_STAGING_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error}=await client.auth.signInWithPassword({email:process.env.QA_RECEPTION_A_EMAIL,password:process.env.QA_RECEPTION_A_PASSWORD});assert.ifError(error);
try {
 const suffix=String(Date.now()).slice(-6);
 const {data,error}=await client.rpc('create_manual_lead_v2',{
  p_name:`QA DF009 concurrent ${Date.now()}`,p_phone:`0981${suffix}`,p_phone_plus:`+595981${suffix}`,
  p_treatment:'Implante dental',p_urgency:'Hoy',p_consultation_reason:'Synthetic concurrency test',p_source:'WhatsApp directo',p_consent_contact:true,
  p_notes:'QA synthetic DF009 fixture',p_next_action:'Contactar',p_next_followup_at:new Date(Date.now()+86400000).toISOString(),p_assigned_to:auth.user.id,
  p_situation:'Quiere agendar una consulta',p_evaluation_previous:'No',p_estimated_value:null,
 });assert.ifError(error);
 const lead=Array.isArray(data)?data[0]:data;
 let attempts=lead.contact_attempts||0;
 for(const status of ['Contactado','Respondió','No Respondió']){
  const args={p_lead_id:lead.id,p_status:status,p_next_action:'Seguimiento QA',p_next_followup_at:new Date(Date.now()+86400000).toISOString()};
  const responses=await Promise.all([client.rpc('save_lead_followup',args),client.rpc('save_lead_followup',args)]);
  for(const response of responses)assert.ifError(response.error);
  const {data:row,error}=await client.from('leads').select('status,contact_attempts,last_contact_at').eq('id',lead.id).single();assert.ifError(error);
  attempts++;assert.equal(row.contact_attempts,attempts);assert.equal(row.status,status);assert.ok(row.last_contact_at);
 }
 console.log('PASS staging concurrent duplicate status transitions: attempts increment once for Contactado/Respondió/No Respondió');
 console.log('Synthetic QA DF009 opportunity retained in staging; no production data touched.');
}finally{await client.auth.signOut();}
