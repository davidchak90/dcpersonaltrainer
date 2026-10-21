import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateEnvelope } from '../site/crypto.mjs';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SITE_FILES = ['index.html', 'lock.css', 'unlock.js', 'crypto.mjs', 'snapshot.json'];
export const ALLOWED = ['.gitignore', 'README.md', 'package.json', '.github/workflows/pages.yml', 'scripts/validate.mjs', 'scripts/validate.test.mjs', ...SITE_FILES.map(n => 'site/' + n)];
function checked(root, relative) {
  if (path.isAbsolute(relative) || relative.split('/').some(x => !x || x === '.' || x === '..') || relative.includes('\\') || relative.includes(':')) throw new Error('Unsafe publication path');
  let cursor = fs.realpathSync(root);
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Linked publication path refused');
  }
  return cursor;
}
export function validateRepository(root = ROOT) {
  for (const relative of ALLOWED) {
    const p = checked(root, relative);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new Error('Missing publication file: ' + relative);
  }
  function walk(relative = '') {
    for (const entry of fs.readdirSync(relative ? checked(root, relative) : root, { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (name === '.git' || name === '_site') continue;
      if (entry.isSymbolicLink()) throw new Error('Linked publication entry refused');
      if (entry.isDirectory()) walk(name);
      else if (!ALLOWED.includes(name)) throw new Error('Unexpected file in publication repository: ' + name);
    }
  }
  walk();
  if (fs.existsSync(path.join(root, '.git'))) {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    if (tracked.some(n => !ALLOWED.includes(n))) throw new Error('Git tracks a file outside the publication allowlist');
  }
  const snapshot = JSON.parse(fs.readFileSync(checked(root, 'site/snapshot.json'), 'utf8'));
  const envelope = validateEnvelope(snapshot);
  const index = fs.readFileSync(checked(root, 'site/index.html'), 'utf8');
  if (/const\s+DATA\s*=|CURRENT_CONTEXT|workout_sessions\.csv|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(index)) throw new Error('Private content found in public lock page');
  if (/(?:src|href)\s*=\s*["'](?:https?:|file:|\/\/)/i.test(index)) throw new Error('External assets are not allowed in the lock page');
  if (!index.includes('type="password"') || !index.includes('sandbox="allow-scripts allow-modals"')) throw new Error('Lock page contract missing');
  return { valid: true, ready: envelope.ready, files: ALLOWED.length, encryptedAt: envelope.ready ? snapshot.encryptedAt : null };
}
export function preparePages(root = ROOT) {
  const result = validateRepository(root);
  const output = checked(root, '_site');
  if (fs.existsSync(output)) {
    if (!fs.statSync(output).isDirectory()) throw new Error('Invalid Pages output');
    const allowedOutput = [...SITE_FILES, '.nojekyll', 'publication.json'];
    for (const name of fs.readdirSync(output)) if (!allowedOutput.includes(name) || fs.lstatSync(path.join(output, name)).isSymbolicLink() || !fs.statSync(path.join(output, name)).isFile()) throw new Error('Unexpected Pages output; inspect before replacing');
  } else fs.mkdirSync(output);
  for (const name of SITE_FILES) fs.copyFileSync(checked(root, 'site/' + name), checked(root, '_site/' + name));
  fs.writeFileSync(checked(root, '_site/.nojekyll'), '');
  const sha = process.env.GITHUB_SHA;
  if (sha && !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid GitHub revision');
  fs.writeFileSync(checked(root, '_site/publication.json'), JSON.stringify({ preparedAt: new Date().toISOString(), commit: sha || null, ready: result.ready }, null, 2));
  return { ...result, output };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(x => x !== '--prepare')) throw new Error('Usage: node scripts/validate.mjs [--prepare]');
    console.log(JSON.stringify(process.argv.includes('--prepare') ? preparePages() : validateRepository()));
  } catch (e) { console.error('Publication refused: ' + e.message); process.exitCode = 1; }
}
