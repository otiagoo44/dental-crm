import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../crm-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
assert.equal(new URL(process.env.QA_STAGING_SUPABASE_URL).hostname,'aqdufiycayedsfldljjq.supabase.co');
const client=createClient(process.env.QA_STAGING_SUPABASE_URL,process.env.QA_STAGING_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {error:authError}=await client.auth.signInWithPassword({email:process.env.QA_OWNER_A_EMAIL,password:process.env.QA_OWNER_A_PASSWORD});assert.ifError(authError);
let original;
try {
 const {data:lead,error}=await client.from('leads').select('id,clinic_id,contact_id,name').ilike('name','QA DF009 concurrent%').order('created_at',{ascending:false}).limit(1).single();assert.ifError(error);
 original=lead;
 const changed=`${lead.name} edit permission QA`;
 const {data:updated,error:updateError}=await client.from('leads').update({name:changed}).eq('clinic_id',lead.clinic_id).eq('id',lead.id).select('name').single();assert.ifError(updateError);assert.equal(updated.name,changed);
 const {data:contact,error:contactError}=await client.from('contacts').select('name').eq('clinic_id',lead.clinic_id).eq('id',lead.contact_id).single();assert.ifError(contactError);assert.equal(contact.name,changed);
 console.log('PASS authenticated same-clinic lead edit can evaluate expression index and sync Contact');
}finally{
 if(original){const {error}=await client.from('leads').update({name:original.name}).eq('clinic_id',original.clinic_id).eq('id',original.id);assert.ifError(error);}
 await client.auth.signOut();
}
