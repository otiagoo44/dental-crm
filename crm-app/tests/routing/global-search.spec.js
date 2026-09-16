import { test, expect, opportunityURL } from './fixtures';

test('global search is bounded, debounced and keyboard navigable', async ({ page, backend }) => {
  await page.goto('/trabajo');
  const input = page.getByRole('combobox', { name: 'Búsqueda global' });
  await expect(input).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await input.fill('I');
  await page.waitForTimeout(300);
  expect(backend.calls.filter((call) => call.path.endsWith('/search_dentflow_v1'))).toHaveLength(0);

  await input.fill('Impl');
  const result = page.getByRole('option', { name: /Implantes/ });
  await expect(result).toBeVisible();
  const searches = backend.calls.filter((call) => call.path.endsWith('/search_dentflow_v1'));
  expect(searches).toHaveLength(1);
  expect(searches[0].body).toEqual({
    p_clinic_id: '77777777-7777-4777-8777-777777777777',
    p_query: 'Impl',
    p_limit: 12,
  });
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${opportunityURL}$`));
  await expect(page.getByRole('heading', { name: 'Implantes', exact: true })).toBeVisible();
});

test('global search finds a patient by phone from any screen', async ({ page }) => {
  await page.goto('/agenda');
  const input = page.getByRole('combobox', { name: 'Búsqueda global' });
  await input.fill('981111');
  const result = page.getByRole('option', { name: /Florencia Prueba/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/pacientes\/11111111-1111-4111-8111-111111111111$/);
  await expect(page.getByRole('heading', { name: 'Oportunidades (2)', exact: true })).toBeVisible();
});
