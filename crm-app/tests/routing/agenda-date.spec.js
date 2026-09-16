import { test, expect, expectWorkspace } from './fixtures';
test('Agenda date survives refresh and browser history', async ({page})=>{
  await page.goto('/agenda?date=2026-10-01');
  await expectWorkspace(page);
  await expect(page.locator('input[type="date"]')).toHaveValue('2026-10-01');
  const mobile = await page.locator('input[type="date"]').isVisible();
  if (mobile) await page.locator('input[type="date"]').fill('2026-10-02');
  else await page.getByRole('button',{name:'Hoy',exact:true}).click();
  const selected = new URL(page.url()).searchParams.get('date');
  expect(selected).not.toBe('2026-10-01');
  await page.reload();
  await expect(page.locator('input[type="date"]')).toHaveValue(selected);
  await page.goBack();
  await expect(page.locator('input[type="date"]')).toHaveValue('2026-10-01');
});
