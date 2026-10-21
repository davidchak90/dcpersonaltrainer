import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT, ALLOWED, validateRepository, preparePages } from './validate.mjs';
import { encryptSnapshot, decryptSnapshot, validateEnvelope, ITERATIONS } from '../site/crypto.mjs';

// These fixtures contain invented strings only; no local fitness source is read.
const passphrase = 'synthetic-test-passphrase-only';
const fixtureHtml = '<!doctype html><html><head><title>Synthetic</title></head><body>INVENTED-PRIVATE-CONTENT</body></html>';
const localFixtureRoot = process.env.PC2_TEST_ROOT || os.tmpdir();
function fixture() {
  const root = fs.mkdtempSync(path.join(localFixtureRoot, 'pc2-publication-test-'));
  for (const file of ALLOWED) {
    const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(ROOT, file), target);
  }
  fs.writeFileSync(path.join(root, 'site/snapshot.json'), JSON.stringify({ schemaVersion: 1, status: 'not-prepared' }));
  return root;
}
test('encryption round trip uses authenticated ciphertext, not a disguised plaintext export', async () => {
  const encrypted = await encryptSnapshot(fixtureHtml, passphrase);
  assert.equal(validateEnvelope(encrypted).ready, true);
  assert.equal(encrypted.kdf.iterations, ITERATIONS);
  assert.ok(!JSON.stringify(encrypted).includes('INVENTED-PRIVATE-CONTENT'));
  assert.equal(await decryptSnapshot(encrypted, passphrase), fixtureHtml);
});
test('wrong passphrase and modified ciphertext fail authentication', async () => {
  const value = await encryptSnapshot(fixtureHtml, passphrase);
  await assert.rejects(decryptSnapshot(value, 'wrong-test-passphrase'));
  const tampered = structuredClone(value); tampered.ciphertext = (value.ciphertext[0] === 'A' ? 'B' : 'A') + value.ciphertext.slice(1);
  await assert.rejects(decryptSnapshot(tampered, passphrase));
});
test('each encryption uses fresh salt and nonce', async () => {
  const a = await encryptSnapshot(fixtureHtml, passphrase), b = await encryptSnapshot(fixtureHtml, passphrase);
  assert.notEqual(a.kdf.salt, b.kdf.salt); assert.notEqual(a.cipher.iv, b.cipher.iv); assert.notEqual(a.ciphertext, b.ciphertext);
});
test('weak passphrases, downgraded parameters and plaintext envelope fields are refused', async () => {
  await assert.rejects(encryptSnapshot(fixtureHtml, 'short'));
  const e = await encryptSnapshot(fixtureHtml, passphrase);
  assert.throws(() => validateEnvelope({ ...e, plaintext: fixtureHtml }));
  assert.throws(() => validateEnvelope({ ...e, kdf: { ...e.kdf, iterations: 1 } }));
  assert.throws(() => validateEnvelope({ ...e, cipher: { ...e.cipher, iv: 'invalid' } }));
  assert.throws(() => validateEnvelope({ schemaVersion: 1, status: 'not-prepared', notes: 'private' }));
});
test('publication refuses extra private files and copies only allowed static assets', () => {
  const root = fixture(); assert.equal(validateRepository(root).ready, false);
  const result = preparePages(root); assert.equal(result.valid, true);
  assert.ok(!fs.existsSync(path.join(root, '_site/README.md')));
  assert.ok(fs.existsSync(path.join(root, '_site/publication.json')));
  fs.writeFileSync(path.join(root, 'site/private-health.json'), '{}');
  assert.throws(() => validateRepository(root), /Unexpected file/);
});
test('plaintext snapshots and linked publication files are refused', () => {
  const root = fixture(); fs.writeFileSync(path.join(root, 'site/snapshot.json'), JSON.stringify({ html: fixtureHtml }));
  assert.throws(() => validateRepository(root));
  const linked = fixture(); fs.renameSync(path.join(linked, 'site'), path.join(linked, '_saved-site'));
  fs.symlinkSync(path.join(linked, '_saved-site'), path.join(linked, 'site'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => validateRepository(linked), /Linked/);
});
test('unexpected existing output cannot silently enter a deployment', () => {
  const root = fixture(); preparePages(root); fs.writeFileSync(path.join(root, '_site/extra.txt'), 'not allowed');
  assert.throws(() => preparePages(root), /Unexpected Pages output/);
});
