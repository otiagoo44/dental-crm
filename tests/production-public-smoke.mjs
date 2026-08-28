import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const entry = process.env.PUPPETEER_ENTRY;
const executablePath = process.env.CHROME_EXECUTABLE;
const baseUrl = String(process.env.PRODUCTION_CRM_URL || '').replace(/\/$/, '');

assert.ok(entry, 'Falta PUPPETEER_ENTRY');
assert.ok(executablePath, 'Falta CHROME_EXECUTABLE');
assert.match(baseUrl, /^https:\/\//, 'Falta PRODUCTION_CRM_URL HTTPS');

const { default: puppeteer } = await import(pathToFileURL(entry).href);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--no-first-run', '--disable-extensions'],
});

try {
  for (const width of [320, 375, 768, 1440]) {
    const page = await browser.newPage();
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    const response = await page.goto(`${baseUrl}/pendientes`, { waitUntil: 'networkidle0' });
    assert.ok([200, 304].includes(response.status()), `Produccion devolvio ${response.status()}`);

    const audit = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector('h1')?.textContent?.trim(),
      emailType: document.querySelector('input[type="email"]')?.getAttribute('type'),
      passwordType: document.querySelector('input[type="password"]')?.getAttribute('type'),
      submitDisabled: document.querySelector('button[type="submit"]')?.disabled,
      submitHeight: Math.round(document.querySelector('button[type="submit"]')?.getBoundingClientRect().height || 0),
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      configError: document.body.textContent.includes('configuración de la CRM no es válida'),
    }));

    assert.equal(runtimeErrors.length, 0, `Errores de runtime en ${width}px: ${runtimeErrors.join(' | ')}`);
    assert.equal(audit.title, 'CRM Dental');
    assert.match(audit.heading || '', /Acceso a la clínica/i);
    assert.equal(audit.emailType, 'email');
    assert.equal(audit.passwordType, 'password');
    assert.equal(audit.submitDisabled, false, 'El login esta deshabilitado por configuracion faltante');
    assert.ok(audit.submitHeight >= 44, `El boton de login mide ${audit.submitHeight}px`);
    assert.ok(audit.documentWidth <= audit.viewport + 1, `Overflow horizontal en ${width}px`);
    assert.equal(audit.configError, false, 'La configuracion publica no fue cargada');
    await page.close();
  }

  const page = await browser.newPage();
  let authStatus = null;
  page.on('response', (response) => {
    if (response.url().includes('/auth/v1/token')) authStatus = response.status();
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'qa-login-invalid@example.test');
  await page.type('input[type="password"]', 'Invalid-only-qa-2026!');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.includes('No pudimos iniciar sesión'));
  assert.equal(authStatus, 400, 'Supabase Auth no respondio como se esperaba a credenciales invalidas');
  assert.match(await page.$eval('form', (form) => form.textContent), /Revisá el email y la contraseña/i);
  await page.close();

  console.log('PASS production CRM shell, responsive login, SPA fallback and Supabase Auth reachability');
} finally {
  await browser.close();
}
