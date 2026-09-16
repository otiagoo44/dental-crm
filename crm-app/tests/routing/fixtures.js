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
  realtime: [false, { option: true }],
  backend: [async ({ context, role, authenticated, realtime }, use) => {
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
    const subscriptions = [];
    await context.routeWebSocket(/supabase\.co/, (socket) => {
      if (!realtime) return socket.close();
      socket.onMessage((raw) => {
        const rawMessage = JSON.parse(String(raw));
        const message = Array.isArray(rawMessage) ? { join_ref: rawMessage[0], ref: rawMessage[1], topic: rawMessage[2], event: rawMessage[3], payload: rawMessage[4] } : rawMessage;
        const send = (event, payload) => socket.send(JSON.stringify([message.join_ref, message.ref, message.topic, event, payload]));
        if (message.event === 'phx_join') {
          const bindings = (message.payload.config.postgres_changes || []).map((binding, id) => ({ ...binding, id }));
          subscriptions.push({ socket, topic: message.topic, joinRef: message.join_ref, bindings });
          send('phx_reply', { status: 'ok', response: { postgres_changes: bindings } });
        } else if (message.event === 'phx_leave' || message.event === 'heartbeat') {
          if (message.event === 'phx_leave') subscriptions.splice(subscriptions.findIndex((s) => s.topic === message.topic), 1);
          send('phx_reply', { status: 'ok', response: {} });
        }
      });
    });
    const emit = (table, record) => {
      for (const {socket,topic,joinRef,bindings} of subscriptions) {
        const ids = bindings.filter((b) => b.table === table && b.event === 'UPDATE').map((b) => b.id);
        if (ids.length) socket.send(JSON.stringify([joinRef, null, topic, 'postgres_changes', { ids, data: {
          schema: 'public', table, type: 'UPDATE', commit_timestamp: new Date().toISOString(), errors: null,
          columns: Object.keys(record).map((name) => ({ name, type: 'text' })), record, old_record: {},
        } }]));
      }
    };
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
      if (table === 'list_contacts_page') {
        const args = request.postDataJSON();
        let contacts = [contactA, contactB].map((id) => {
          const related = leads.filter((lead) => lead.contact_id === id);
          return { ...related[0], id, opportunity_count: related.length, active_opportunity_count: related.length, responsible_name: profile.full_name };
        });
        if (args.p_contact_id) contacts = contacts.filter((c) => c.id === args.p_contact_id);
        if (args.p_search) contacts = contacts.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(args.p_search.toLowerCase()));
        if (args.p_filter === 'unassigned') contacts = [];
        return respond(contacts.slice(0, args.p_limit + 1));
      }
      if (table === 'get_contact_operating_summary_v1') {
        const args = request.postDataJSON();
        const related = leads.filter((lead) => lead.contact_id === args.p_contact_id);
        if (!related.length) return respond([]);
        return respond([{ ...related[0], id: args.p_contact_id, opportunity_count: related.length, active_opportunity_count: related.length,
          responsible_id: profile.id, responsible_name: profile.full_name, last_interaction_at: related[0].created_at,
          last_interaction_title: 'Nueva consulta', next_appointment_at: null }]);
      }
      if (table === 'list_contact_timeline_v1') return respond([]);
      if (table === 'register_contact_interaction_v1') return respond(request.postDataJSON().p_opportunity_id);
      if (table === 'search_dentflow_v1') {
        const args = request.postDataJSON();
        const needle = String(args.p_query || '').toLowerCase();
        const results = [
          { result_type:'contact',result_id:contactA,contact_id:contactA,opportunity_id:null,title:'Florencia Prueba',subtitle:'2 oportunidades',phone:'+595981111111',match_rank:1,updated_at:now.toISOString() },
          { result_type:'opportunity',result_id:leadA,contact_id:contactA,opportunity_id:leadA,title:'Implantes',subtitle:'Florencia Prueba · Nuevo',phone:'+595981111111',match_rank:1,updated_at:now.toISOString() },
        ].filter((result) => (result.result_type === 'contact' ? `${result.title} ${result.phone}` : result.title).toLowerCase().includes(needle));
        return respond(results.slice(0, args.p_limit));
      }
      if (table === 'list_work_items_v1') return respond([{
        work_key:'task:work-test',clinic_id:clinicId,contact_id:contactA,opportunity_id:leadA,
        work_type:'initial_contact',patient_name:'Florencia Prueba',patient_phone:'+595981000001',treatment:'Implantes',
        title:'Contactar nueva consulta',reason:'Consulta recibida recientemente',due_at:new Date(Date.now()-600000).toISOString(),
        priority_group:'urgent',priority_rank:0,assigned_to:user.id,assigned_name:profile.full_name,
        source_type:'task',source_id:'f5000000-0000-4000-8000-000000000001',status:'pendiente',available_actions:['contact'],updated_at:new Date().toISOString(),sort_group:0,
      }]);
      if (table === 'leads') return respond(url.searchParams.has('contact_id') ? leads.filter((lead) => `eq.${lead.contact_id}` === url.searchParams.get('contact_id')) : leads);
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
    await use({ calls, errors, emit, subscriptions });
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
  await expect(page.locator('nav:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Cargando clínica...', { exact: true })).toHaveCount(0);
}
