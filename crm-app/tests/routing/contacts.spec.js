import { test, expect, contactA, leadA, patientURL } from './fixtures';

test('Contacts search/filter lives in the URL and requests stay scoped; secondary tabs are lazy', async ({ page, backend }) => {
  await page.goto('/pacientes');
  await expect(page.locator(`a[href="${patientURL}"]`)).toBeVisible();
  expect(backend.calls.filter((c) => /leads|appointments|tasks|quotes|lead_events/.test(c.path))).toHaveLength(0);
  await page.getByLabel('Buscar pacientes').fill('Florencia');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page).toHaveURL(/q=Florencia/);
  await expect(page.getByRole('heading',{name:'Pedro Prueba'})).toHaveCount(0);
  await page.getByLabel('Filtrar pacientes').selectOption('unassigned');
  await expect(page.getByText('No hay pacientes para esta búsqueda.')).toBeVisible();
  await page.goBack();
  await expect(page.locator(`a[href="${patientURL}"]`)).toBeVisible();
  await page.locator(`a[href="${patientURL}"]`).click();
  await expect(page.getByRole('heading',{name:'Oportunidades (2)'})).toBeVisible();
  expect(backend.calls.filter((c)=>/appointments|tasks|quotes|lead_events/.test(c.path))).toHaveLength(0);
  await page.getByRole('button',{name:'Timeline',exact:true}).click();
  await expect(page.getByText('No hay registros en esta sección.')).toBeVisible();
  const timeline=backend.calls.find((c)=>c.path.endsWith('/lead_events'));
  expect(timeline.search).toContain('leads.contact_id=eq.');
  expect(timeline.search).toContain('limit=26');
});

test('Contacts pagination, stable ties, no duplicates and invalid cursors', async ({page}) => {
  const rows=Array.from({length:61},(_,n)=>({id:`e4000000-0000-0000-0000-${String(99-n).padStart(12,'0')}`,name:`Page Patient ${n}`,created_at:'2026-01-01T00:00:00Z',active_opportunity_count:0}));
  await page.route('**/rest/v1/rpc/list_contacts_page',async(route)=>{
    const args=route.request().postDataJSON();
    const filtered=rows.filter((r)=>!args.p_cursor_id||r.id<args.p_cursor_id);
    await route.fulfill({json:filtered.slice(0,args.p_limit+1)});
  });
  await page.goto('/pacientes');
  const seen=[];
  for(let n=0;n<3;n++){
    await expect(page.getByRole('heading',{name:`Page Patient ${n*25}`,exact:true})).toBeVisible();
    const ids=await page.locator('main a[href^="/pacientes/"]').evaluateAll((links)=>links.map((l)=>l.getAttribute('href')));
    expect(ids.some((id)=>seen.includes(id))).toBe(false);seen.push(...ids);
    if(n<2) await page.getByRole('button',{name:'Siguiente página',exact:true}).click();
  }
  expect(seen.length).toBe(61);
  await expect(page.getByRole('button',{name:'Siguiente página',exact:true})).toBeDisabled();
  await page.goto('/pacientes?cursor=invalid');
  await expect(page.getByRole('alert')).toContainText('Enlace de página inválido');
  await page.getByRole('button',{name:'Primera página',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Page Patient 0',exact:true})).toBeVisible();
});

test.describe('Targeted realtime',()=>{
  test.use({realtime:true});
  test('opportunity moved away refreshes the old contact even without an old contact_id',async({page,backend})=>{
    let moved=false;
    await page.route('**/rest/v1/rpc/list_contacts_page',async(route)=>route.fulfill({json:[{id:contactA,name:'Move QA',opportunity_count:moved?0:2,active_opportunity_count:moved?0:2}]}));
    await page.goto(patientURL);
    await expect(page.getByRole('heading',{name:'Oportunidades (2)',exact:true})).toBeVisible();
    await expect.poll(()=>backend.subscriptions.length).toBeGreaterThan(0);
    await page.waitForTimeout(350);
    moved=true;
    backend.emit('leads',{id:leadA,contact_id:'22222222-2222-4222-8222-222222222222'});
    await expect(page.getByRole('heading',{name:'Oportunidades (0)',exact:true})).toBeVisible();
    expect(backend.calls.filter((c)=>c.path.endsWith('/leads')).every((c)=>c.search.includes('contact_id=eq.'))).toBe(true);
  });
  test('contact/opportunity duplicates invalidate only the contact slice and stale responses cannot win',async({page,backend})=>{
    let name='Initial patient';let requests=0;let held;let hold=false;
    await page.route('**/rest/v1/rpc/list_contacts_page',async(route)=>{
      requests++;
      const snapshot=[{id:contactA,name,created_at:'2026-01-01T00:00:00Z',active_opportunity_count:2}];
      if(hold){hold=false;held=()=>route.fulfill({json:snapshot}).catch(()=>{});return;}
      await route.fulfill({json:snapshot});
    });
    await page.goto('/pacientes');
    await expect(page.getByRole('heading',{name:'Initial patient',exact:true})).toBeVisible();
    await expect.poll(()=>backend.subscriptions.length).toBeGreaterThan(0);
    await page.waitForTimeout(350);
    hold=true;backend.emit('contacts',{id:contactA});
    await expect.poll(()=>Boolean(held)).toBe(true);
    name='Updated patient';
    const before=requests;
    backend.emit('leads',{id:leadA,contact_id:contactA});backend.emit('leads',{id:leadA,contact_id:contactA});
    await expect(page.getByRole('heading',{name:'Updated patient',exact:true})).toBeVisible();
    await held();
    await expect(page.getByRole('heading',{name:'Initial patient',exact:true})).toHaveCount(0);
    expect(requests-before).toBe(1);
    expect(backend.calls.filter((c)=>/leads|appointments|tasks|quotes|lead_events/.test(c.path))).toHaveLength(0);
  });
});
