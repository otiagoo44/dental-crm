import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const require=createRequire(new URL('../crm-app/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const {createClient}=require('@supabase/supabase-js');
const base=process.env.QA_FRONTEND_URL;
assert.match(new URL(base).hostname,/^crm-odontologia-staging-[a-z0-9]+-ortegatiago733-2656s-projects\.vercel\.app$/);
const url=process.env.QA_STAGING_SUPABASE_URL;
assert.equal(new URL(url).hostname,'aqdufiycayedsfldljjq.supabase.co');
const client=createClient(url,process.env.QA_STAGING_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const writer=createClient(url,process.env.QA_STAGING_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error}=await client.auth.signInWithPassword({email:process.env.QA_RECEPTION_A_EMAIL,password:process.env.QA_RECEPTION_A_PASSWORD});
assert.ifError(error);
const {error:writerError}=await writer.auth.signInWithPassword({email:process.env.QA_OWNER_A_EMAIL,password:process.env.QA_OWNER_A_PASSWORD});assert.ifError(writerError);
const bypass=JSON.parse((await readFile(join(tmpdir(),'dentflow-stage-bypass.json'),'utf8')).replace(/^\uFEFF/,''));
const secret=Object.keys(bypass || {})[0];
assert.ok(secret,'Existing staging protection bypass required');
const browser=await chromium.launch();
const artifacts=join(tmpdir(),'dentflow-v2-smoke');await mkdir(artifacts,{recursive:true});
const report={deployment:base,results:[],errors:[]};
let restore;
try {
 for(const width of [375,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',timezoneId:'America/Asuncion'});
  // Only attach Vercel's bypass to this deployment, never to Supabase or third parties.
  await context.route(`${base}/**`,(route)=>route.continue({headers:{...route.request().headers(),'x-vercel-protection-bypass':secret}}));
  await context.addInitScript(({session,origin})=>{if(location.origin===origin&&!localStorage.getItem('sb-aqdufiycayedsfldljjq-auth-token'))localStorage.setItem('sb-aqdufiycayedsfldljjq-auth-token',JSON.stringify(session));},{session:auth.session,origin:base});
  const page=await context.newPage();
  page.on('pageerror',(e)=>report.errors.push(e.message));
  const requests=[];
  page.on('request',(request)=>{const u=new URL(request.url());if(u.hostname.endsWith('.supabase.co')){assert.equal(u.hostname,'aqdufiycayedsfldljjq.supabase.co');if(u.pathname.startsWith('/rest/'))requests.push(u);}});
  const started=Date.now();
  await page.goto(`${base}/pacientes`);
  await expect(page.locator('main a[href^="/pacientes/"]').first()).toBeVisible({timeout:30_000});
  const readyMs=Date.now()-started;
  assert.ok(!requests.some((u)=>/\/(leads|appointments|tasks|quotes|lead_events)$/.test(u.pathname)),'Contact list fetched legacy workspace');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.getByLabel('Buscar pacientes').focus();await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Buscar',exact:true})).toBeFocused();
  const href=await page.locator('main a[href^="/pacientes/"]').first().getAttribute('href');
  await page.screenshot({path:join(artifacts,`patients-${width}.png`),fullPage:true,animations:'disabled'});
  await page.screenshot({path:join(artifacts,`patients-viewport-${width}.png`),animations:'disabled'});
  await page.locator(`main a[href="${href}"]`).click();
  await expect(page.getByRole('heading',{name:/Oportunidades \(/})).toBeVisible({timeout:20_000});
  await page.reload();
  await expect(page.getByRole('heading',{name:/Oportunidades \(/})).toBeVisible({timeout:20_000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const opportunityHref=await page.locator(`main a[href^="${href}/oportunidades/"]`).first().getAttribute('href');
  await page.locator(`main a[href="${opportunityHref}"]`).last().click();
  await expect(page.getByText('Oportunidad',{exact:true})).toBeVisible({timeout:20_000});
  await expect(page.locator('summary').filter({hasText:'Resumen'})).toBeVisible();
  await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:join(artifacts,`opportunity-${width}.png`),fullPage:true,animations:'disabled'});
  await page.goBack();
  await expect(page.getByRole('heading',{name:/Oportunidades \(/})).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Actividad',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Actividad',exact:true})).toBeVisible();
  await expect(page.getByText('Cargando…',{exact:true})).toHaveCount(0,{timeout:15_000});
  for(const label of ['Citas','Trabajo','Presupuestos','Notas']){
   const target=page.getByRole('button',{name:label,exact:true});
   if(!await target.isVisible())await page.getByText('Más',{exact:true}).click();
   await target.click();
   await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
   await expect(page.getByText('Cargando…',{exact:true})).toHaveCount(0,{timeout:15_000});
   await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Resumen',exact:true}).click();
  await page.screenshot({path:join(artifacts,`contact-${width}.png`),fullPage:true,animations:'disabled'});
  await page.getByRole('link',{name:'Volver a pacientes',exact:true}).click();
  await expect(page.locator(`main a[href="${href}"]`)).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:/Oportunidades \(/})).toBeVisible();
  await page.goForward();await expect(page.locator('main').getByRole('heading',{name:'Pacientes',exact:true})).toBeVisible();
  if(width===1440){
   const contactId=href.split('/').at(-1);
   const {data:lead,error}=await client.from('leads').select('id,clinic_id,name,next_action').eq('contact_id',contactId).limit(1).single();assert.ifError(error);
   assert.match(lead.name,/QA/i,'Only mutate a synthetic QA patient');
   restore=async()=>{const {error}=await writer.from('leads').update({name:lead.name,next_action:lead.next_action}).eq('clinic_id',lead.clinic_id).eq('id',lead.id);assert.ifError(error);};
   requests.length=0;
   const changed=`${lead.name} realtime QA`;
   const {error:changeError}=await writer.from('leads').update({name:changed}).eq('clinic_id',lead.clinic_id).eq('id',lead.id);assert.ifError(changeError);
   await expect(page.locator(`main a[href="${href}"]`)).toContainText(changed,{timeout:15_000});
   const action='Verificar actualización en vivo QA';
   const {error:actionError}=await writer.from('leads').update({next_action:action}).eq('clinic_id',lead.clinic_id).eq('id',lead.id);assert.ifError(actionError);
   await expect(page.locator(`main a[href="${href}"]`)).toContainText(action,{timeout:15_000});
   assert.ok(!requests.some((u)=>/\/(leads|appointments|tasks|quotes|lead_events)$/.test(u.pathname)));
   await restore();restore=null;
   report.realtime='PASS contact + opportunity update, no workspace fetch';
   await page.locator(`main a[href="${href}"]`).click();
   await expect(page.getByRole('heading',{name:/Oportunidades \(/})).toBeVisible({timeout:20_000});
   await page.getByRole('button',{name:'Registrar interacción',exact:true}).click();
   await page.getByLabel('Tipo').selectOption('note');
   const interactionNote=`Nota browser QA ${Date.now()}`;
   await page.getByLabel('Nota breve (opcional)').fill(interactionNote);
   await page.getByRole('button',{name:'Guardar interacción',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Actividad',exact:true})).toBeVisible({timeout:15_000});
   await expect(page.getByText(interactionNote,{exact:true})).toBeVisible({timeout:15_000});
   report.interaction='PASS immutable administrative note through UI';
  }
  await page.goto(`${base}/pacientes`);
  await page.getByRole('button',{name:'Nueva consulta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nueva consulta',exact:true})).toBeVisible({timeout:20_000});
  for(const path of ['/agenda?date=2026-10-01','/pendientes']){
   await page.goto(`${base}${path}`);
   await expect(page.locator('main').getByRole('heading').first()).toBeVisible({timeout:30_000});
   await expect(page.getByRole('alert')).toHaveCount(0);
  }
  report.results.push({width,readyMs,contacts:'PASS',contact360:'PASS',opportunity:'PASS',secondaryTabs:'PASS',history:'PASS',agenda:'PASS',pending:'PASS',keyboard:'PASS',overflow:false});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
 await writeFile(new URL('../docs/DENTFLOW_V2_STAGING_SMOKE.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log('PASS real staging browser at 375/768/1440, realtime, scoped network, lazy tabs, history and legacy routes');
 console.log(`Screenshots: ${artifacts}`);
}finally{if(restore)await restore();await browser.close();await client.auth.signOut();await writer.auth.signOut();}
