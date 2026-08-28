import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(url);
  }
  return files;
}

const root = new URL('../crm-app/src/', import.meta.url);
const files = await sourceFiles(root);
const violations = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const pattern of [
    /dangerouslySetInnerHTML/,
    /\.innerHTML\s*=/,
    /\.outerHTML\s*=/,
    /insertAdjacentHTML\s*\(/,
    /document\.write\s*\(/,
    /\beval\s*\(/,
    /new Function\s*\(/,
  ]) {
    if (pattern.test(source)) violations.push(`${file.pathname}: ${pattern}`);
  }
}

assert.deepEqual(violations, [], `Unsafe HTML/JS sinks found:\n${violations.join('\n')}`);

const publicForm = await readFile(new URL('../crm-app/src/features/public-form/PublicEmbedLeadForm.jsx', import.meta.url), 'utf8');
assert.match(publicForm, /maxLength=\{120\}/);
assert.match(publicForm, /maxLength=\{300\}/);
assert.match(publicForm, /name="website"/);
assert.match(publicForm, /No pudimos enviar tus datos\. Intentá nuevamente\./);

console.log('PASS React stored-XSS sinks, public limits, honeypot and generic error contract');
