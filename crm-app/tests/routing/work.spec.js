import { test, expect, contactA, leadA } from './fixtures';

test('Work system views persist in URL and use only the bounded RPC', async ({ page, backend }) => {
  await page.goto('/trabajo?view=overdue');
  await expect(page.getByRole('heading',{name:'Trabajo',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Vencidos',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Florencia Prueba',{exact:true})).toBeVisible();
  expect(backend.calls.some((call)=>call.path.endsWith('/rpc/list_work_items_v1'))).toBe(true);
  expect(backend.calls.some((call)=>/\/(leads|tasks|appointments|quotes)$/.test(call.path))).toBe(false);
  await page.getByRole('button',{name:'Hoy',exact:true}).click();
  await expect(page).toHaveURL('/trabajo?view=today');
  await page.reload();
  await expect(page.getByRole('button',{name:'Hoy',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goBack();
  await expect(page.getByRole('button',{name:'Vencidos',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('link',{name:'Florencia Prueba'})).toHaveAttribute('href',`/pacientes/${contactA}`);
  await expect(page.getByRole('link',{name:'Abrir oportunidad'})).toHaveAttribute('href',`/pacientes/${contactA}/oportunidades/${leadA}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Work hides Team from reception and exposes one clear primary action', async ({ page }) => {
  await page.goto('/trabajo?view=team');
  await expect(page).toHaveURL('/trabajo?view=team');
  await expect(page.getByRole('button',{name:'Equipo',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Contactar',exact:true})).toHaveCount(1);
});
