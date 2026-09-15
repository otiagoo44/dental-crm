import { test as base, expect } from '@playwright/test';

export const contactA = '11111111-1111-4111-8111-111111111111';
export const contactB = '22222222-2222-4222-8222-222222222222';
export const leadA = '33333333-3333-4333-8333-333333333333';
export const leadA2 = '44444444-4444-4444-8444-444444444444';
export const leadB = '55555555-5555-4555-8555-555555555555';
export const userId = '66666666-6666-4666-8666-666666666666';
const clinicId = '77777777-7777-4777-8777-777777777777';
export const patientURL = `/pacientes/${contactA}`;
export const opportunityURL = `${patientURL}/oportunidades/${leadA}`;
const now = new Date();
const baseLead = {
  clinic_id: clinicId, phone: '0981111111', phone_plus: '+595981111111',
  status: 'Nuevo', score: 88, classification: 'Lead Caliente', assigned_to: userId,
  created_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
  next_followup_at: new Date(now.getTime() - 30 * 60_000).toISOString(),
  next_action: 'Responder nueva consulta', source_normalized: 'Instagram',
};
export const leads = [
  { ...baseLead, id: leadA, contact_id: contactA, name: 'Florencia Prueba', treatment: 'Implantes' },
  { ...baseLead, id: leadA2, contact_id: contactA, name: 'Florencia Prueba', treatment: 'Ortodoncia' },
  { ...baseLead, id: leadB, contact_id: contactB, name: 'Pedro Prueba', treatment: 'Carillas', status: 'Confirmado' },
];
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'routing@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: now.toISOString() };
export const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'routing-test-signature',
].join('.');
export const session = { access_token: accessToken, refresh_token: 'routing-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };

export const test = base.extend({
  role: ['receptionist', { option: true }],
  authenticated: [true, { option: true }],
  backend: [async ({ context, role, authenticated }, use) => {
    const calls = [];
    const errors = [];
    const profile = { id: userId, clinic_id: clinicId, role, active: true, full_name: 'Usuario Prueba', email: user.email };
    if (authenticated) await context.addInitScript((storedSession) => {
      if (location.origin !== 'http://127.0.0.1:4175') return;
      // Only seed a fresh browser; refresh and logout must use real SDK persistence.
      if (!sessionStorage.getItem('routing-seeded')) {
        localStorage.setItem('sb-routing-test-auth-token', JSON.stringify(storedSession));
        sessionStorage.setItem('routing-seeded', 'true');
      }
    }, session);
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    await context.routeWebSocket(/supabase\.co/, (socket) => socket.close());
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === 'http://127.0.0.1:4175') return route.continue();
      // No fallback to a real project, even if someone changes frontend env locally.
      if (url.hostname !== 'routing-test.supabase.co') {
        errors.push(`Unexpected external host: ${url.hostname}`);
        return route.abort();
      }
      calls.push({ path: url.pathname, search: url.search, method: request.method(), body: request.postDataJSON() });
      const respond = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', json });
      if (url.pathname === '/auth/v1/token') return respond(session);
      if (url.pathname === '/auth/v1/user') return respond(user);
      if (url.pathname === '/auth/v1/logout' || url.pathname === '/auth/v1/recover') return respond({});
      if (url.pathname === '/functions/v1/lead-intake') return respond({ success: true });
      const table = url.pathname.split('/').at(-1);
      if (table === 'profiles') return respond(url.searchParams.has('id') ? profile : [profile]);
      if (table === 'clinics') return respond({ id: clinicId, name: 'Clínica Routing QA', doctor_name: 'Dra. Prueba' });
      if (table === 'leads') return respond(leads);
      if (table === 'appointments') return respond([{
        id: 'appointment-test', clinic_id: clinicId, lead_id: leadB, leads: leads[2],
        appointment_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(now),
        appointment_time: '16:00', status: 'Confirmado', treatment_scheduled: 'Carillas', doctor_assigned: 'Dra. Prueba',
      }]);
      if (table === 'clinic_settings' || table === 'clinic_public_forms') return respond(null);
      if (['tasks', 'quotes', 'lead_events', 'treatment_prices', 'message_templates'].includes(table)) return respond([]);
      errors.push(`Unexpected mocked endpoint: ${url.pathname}`);
      return respond({ message: 'Unmocked endpoint' }, 500);
    });
    await use({ calls, errors });
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function login(page) {
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Routing-test-password-1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

export async function expectWorkspace(page) {
  await expect(page.locator('nav:visible').first()).toBeVisible();
  await expect(page.getByText('Cargando clínica...', { exact: true })).toHaveCount(0);
}
