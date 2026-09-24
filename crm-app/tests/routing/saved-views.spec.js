import { test, expect, userId } from './fixtures';

async function mockViews(page, initial = []) {
  let rows = initial;
  const writes = [];
  await page.route('**/rest/v1/rpc/*saved_view*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    const args = route.request().postDataJSON();
    if (name === 'list_saved_views_v1') return route.fulfill({ json: rows.filter((r) => r.entity === args.p_entity) });
    writes.push({ name, args });
    if (name === 'delete_saved_view_v1') { rows = rows.filter((r) => r.id !== args.p_id); return route.fulfill({ json: args.p_id }); }
    const row = { id: args.p_id || 'saved-view-test', user_id: userId, entity: args.p_entity || rows.find((r) => r.id === args.p_id).entity,
      name: args.p_name, visibility: args.p_visibility, filters: args.p_filters, sorts: args.p_sorts };
    rows = [...rows.filter((r) => r.id !== row.id), row];
    return route.fulfill({ json: row });
  });
  return writes;
}

test('save, apply, history, rename and delete a private patient view', async ({ page }) => {
  const writes = await mockViews(page);
  await page.goto('/pacientes?view=active');
  await page.getByRole('button', { name: 'Guardar vista', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Compartir con equipo' })).toHaveCount(0);
  await page.getByLabel('Nombre de la vista').fill('Mis activos');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mis activos Privada', exact: true })).toBeVisible();
  expect(writes[0].args.p_filters).toEqual({ view: 'active' });
  await page.getByLabel('Filtrar pacientes').selectOption('unassigned');
  await page.getByRole('button', { name: 'Mis activos Privada', exact: true }).click();
  await expect(page).toHaveURL(/view=active$/);
  await page.goBack();
  await expect(page.getByLabel('Filtrar pacientes')).toHaveValue('unassigned');
  await page.goForward();
  await expect(page.getByLabel('Filtrar pacientes')).toHaveValue('active');
  await page.getByRole('button', { name: 'Renombrar Mis activos' }).click();
  await page.getByLabel('Nombre de la vista').fill('Activos QA');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activos QA Privada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar Activos QA', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar vista', exact: true }).click();
  await expect(page.getByText('Vista eliminada.', { exact: true })).toBeVisible();
  expect(writes.at(-1).name).toBe('delete_saved_view_v1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('reception uses team work filters without edit controls', async ({ page, backend }) => {
  await mockViews(page, [{ id: 'team', entity: 'work', user_id: 'another-user', name: 'Seguimientos del equipo', visibility: 'team', filters: { view: 'followups' }, sorts: [] }]);
  await page.goto('/trabajo');
  await page.getByRole('button', { name: 'Seguimientos del equipo Equipo', exact: true }).click();
  await expect(page).toHaveURL(/view=followups$/);
  await expect(page.getByRole('button', { name: 'Renombrar Seguimientos del equipo' })).toHaveCount(0);
  await expect.poll(() => backend.calls.filter((c) => c.path.endsWith('list_work_items_v1')).at(-1)?.body.p_view).toBe('followups');
});

test.describe('owner views', () => {
  test.use({ role: 'owner' });
  test('opportunity sort and filters restore into URL; sharing is explicit', async ({ page }) => {
    const writes = await mockViews(page);
    await page.goto('/oportunidades?status=Nuevo&sort=oldest');
    await page.getByRole('button', { name: 'Guardar vista', exact: true }).click();
    await page.getByLabel('Nombre de la vista').fill('Nuevas por antigüedad');
    await page.getByRole('checkbox', { name: 'Compartir con equipo' }).check();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nuevas por antigüedad Equipo', exact: true })).toBeVisible();
    expect(writes[0].args.p_sorts).toEqual([{ field: 'created_at', direction: 'asc' }]);
    await page.goto('/oportunidades');
    await page.getByRole('button', { name: 'Nuevas por antigüedad Equipo', exact: true }).click();
    await expect(page).toHaveURL(/status=Nuevo&sort=oldest$/);
    await page.reload();
    await expect(page.getByText('Nuevo', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  });
});

test('errors retain the draft and keyboard escape restores focus', async ({ page }) => {
  await mockViews(page);
  await page.route('**/rest/v1/rpc/create_saved_view_v1', (route) => route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate' } }));
  await page.goto('/trabajo?view=today');
  const opener = page.getByRole('button', { name: 'Guardar vista', exact: true });
  await opener.click();
  await page.getByLabel('Nombre de la vista').fill('Duplicada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ya existe una vista');
  await expect(page.getByLabel('Nombre de la vista')).toHaveValue('Duplicada');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});
