import { test, expect, contactA, contactB, leadA, leadA2, leadB, patientURL, opportunityURL, login, expectWorkspace } from './fixtures';

test('B–F: patient, opportunity, refresh and browser history', async ({ page, context }) => {
  await page.goto('/pacientes');
  const personLink = page.locator(`a[href="${patientURL}"]`);
  await expect(personLink).toContainText('Florencia Prueba');
  await personLink.click();
  await expect(page).toHaveURL(new RegExp(`${patientURL}$`));
  await expect(page.getByRole('heading', { name: 'Oportunidades (2)', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Oportunidades (2)', exact: true })).toBeVisible();
  await page.locator(`a[href="${opportunityURL}"]`).click();
  await expect(page.getByRole('heading', { name: 'Florencia Prueba · Implantes', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Florencia Prueba · Implantes', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${patientURL}$`));
  await expect(page.getByRole('heading', { name: 'Oportunidades (2)', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${opportunityURL}$`));
  await expect(page.getByRole('heading', { name: 'Florencia Prueba · Implantes', exact: true })).toBeVisible();
  // Exercise the anchor's native new-tab behavior, not a navigation callback.
  const link = page.getByRole('link', { name: 'Volver al paciente', exact: true });
  await link.evaluate((element) => element.setAttribute('target', '_blank'));
  const popupPromise = context.waitForEvent('page');
  await link.click();
  const popup = await popupPromise;
  await expect(popup.getByRole('heading', { name: 'Oportunidades (2)', exact: true })).toBeVisible();
});

test('G: a lead cannot be opened under another contact; absent IDs are internal 404s', async ({ page }) => {
  for (const path of [`/pacientes/${contactB}/oportunidades/${leadA}`, `/pacientes/${contactA}/oportunidades/missing`, '/pacientes/missing', '/unknown']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: /404 ·/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Florencia Prueba · Implantes', exact: true })).toHaveCount(0);
  }
  await page.goto(`/pacientes/${contactA}/oportunidades/${leadA2}`);
  await expect(page.getByRole('heading', { name: 'Florencia Prueba · Ortodoncia', exact: true })).toBeVisible();
});

test('H: receptionist cannot render admin routes, including pasted URLs and refresh', async ({ page }) => {
  for (const path of ['/analisis', '/configuracion']) {
    await page.goto(path);
    await expectWorkspace(page);
    await expect(page).toHaveURL(/\/resumen$/);
    await page.reload();
    await expect(page.locator('nav a[href="/analisis"], nav a[href="/configuracion"]')).toHaveCount(0);
  }
});

test('deep links from Resumen, Pendientes and Agenda', async ({ page }) => {
  for (const path of ['/resumen', '/pendientes', '/agenda']) {
    await page.goto(path);
    await expectWorkspace(page);
    const target = path === '/agenda' ? `/pacientes/${contactB}/oportunidades/${leadB}` : opportunityURL;
    await page.locator(`main a[href="${target}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.getByRole('heading', { name: path === '/agenda' ? 'Pedro Prueba · Carillas' : 'Florencia Prueba · Implantes', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test.describe('unauthenticated entry', () => {
  test.use({ authenticated: false });
  test('A: login at root lands on resumen; logout/login is clean', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await expect(page).toHaveURL(/\/resumen$/);
    await expectWorkspace(page);
    await page.locator('button[aria-label="Cerrar sesión"]:visible').click();
    await expect(page.getByRole('heading', { name: 'Acceso a la clínica' })).toBeVisible();
    await login(page);
    await expect(page).toHaveURL(/\/resumen$/);
    await expectWorkspace(page);
  });
  test('login keeps an intended opportunity URL', async ({ page }) => {
    await page.goto(opportunityURL);
    await login(page);
    await expect(page).toHaveURL(new RegExp(`${opportunityURL}$`));
    await expect(page.getByRole('heading', { name: 'Florencia Prueba · Implantes', exact: true })).toBeVisible();
  });
});

test.describe('admin pages and responsive shell', () => {
  test.use({ role: 'owner' });
  test('all target routes render without overflow or runtime errors at this viewport', async ({ page }) => {
    for (const path of ['/resumen', '/pacientes', patientURL, opportunityURL, '/pendientes', '/agenda', '/analisis', '/configuracion']) {
      await page.goto(path);
      await expectWorkspace(page);
      await expect(page.locator('main').getByRole('heading').first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `Horizontal overflow at ${path}`).toBe(false);
    }
  });
});
