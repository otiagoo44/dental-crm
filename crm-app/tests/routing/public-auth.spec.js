import { test, expect, accessToken, login, expectWorkspace } from './fixtures';

test.describe('I: recovery and login', () => {
  test.use({ authenticated: false });
  test('valid recovery hash updates password, signs out, then permits normal login', async ({ page, backend }) => {
    await page.goto(`/reset-password#access_token=${accessToken}&refresh_token=routing-test-refresh&token_type=bearer&expires_in=3600&type=recovery`);
    await expect(page.getByRole('heading', { name: 'Elegí una nueva contraseña' })).toBeVisible();
    await expect(page.locator('nav')).toHaveCount(0);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('Routing-new-password-1!');
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Routing-new-password-1!');
    await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4175/');
    await expect(page.getByRole('heading', { name: 'Acceso a la clínica' })).toBeVisible();
    expect(backend.calls.some((call) => call.path === '/auth/v1/user' && call.method === 'PUT')).toBe(true);
    expect(backend.calls.some((call) => call.path === '/auth/v1/logout')).toBe(true);
    await login(page);
    await expect(page).toHaveURL(/\/resumen$/);
    await expectWorkspace(page);
  });
  test('expired or missing recovery token never opens the workspace', async ({ page }) => {
    await page.goto('/reset-password#error_code=otp_expired&error_description=expired');
    await expect(page.getByRole('alert')).toContainText('venció o ya fue utilizado');
    await expect(page.locator('nav')).toHaveCount(0);
    await page.goto('/reset-password');
    await expect(page.getByRole('alert')).toContainText('no es válido o ya venció');
  });
  test('recovery request keeps the existing reset-password redirect', async ({ page, backend }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await page.getByLabel('Email', { exact: true }).fill('routing@example.test');
    await page.getByRole('button', { name: 'Recuperar contraseña', exact: true }).click();
    await expect(page.getByText(/Si existe una cuenta con ese correo/)).toBeVisible();
    const call = backend.calls.find((item) => item.path === '/auth/v1/recover');
    expect(new URLSearchParams(call.search).get('redirect_to')).toBe('http://127.0.0.1:4175/reset-password');
  });
});

for (const authenticated of [false, true]) {
  test.describe(`J: public form, session=${authenticated}`, () => {
    test.use({ authenticated });
    test('existing form URL and token alias bypass auth and preserve intake contract', async ({ page, backend }) => {
      for (const parameter of ['landing_token', 'token']) {
        await page.goto(`/form/clinica-prueba?${parameter}=routing-form-token&utm_source=test`);
        await expect(page.getByRole('heading', { name: 'Solicitar consulta' })).toBeVisible();
        await expect(page.locator('nav')).toHaveCount(0);
        await page.reload();
        await page.getByLabel('Nombre', { exact: true }).fill('Consulta de prueba');
        await page.getByLabel('WhatsApp', { exact: true }).fill('0981111111');
        await page.getByLabel('Tratamiento', { exact: true }).fill('Implantes');
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Enviar consulta' }).click();
        await expect(page.getByText('Datos enviados correctamente.')).toBeVisible();
      }
      const submitted = backend.calls.filter((call) => call.path === '/functions/v1/lead-intake');
      expect(submitted).toHaveLength(2);
      expect(submitted[0].body).toMatchObject({ clinic_slug: 'clinica-prueba', landing_token: 'routing-form-token', nombre: 'Consulta de prueba', tratamiento: 'Implantes', consentimiento_contacto: true });
      expect(backend.calls.some((call) => call.path.startsWith('/rest/v1/'))).toBe(false);
    });
  });
}
