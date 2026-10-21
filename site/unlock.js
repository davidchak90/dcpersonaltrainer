import { decryptSnapshot, validateEnvelope } from './crypto.mjs';
const $ = id => document.getElementById(id);
let snapshot, blobUrl;
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
function lock() {
  $('dashboardFrame').removeAttribute('src');
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = undefined; $('unlocked').hidden = true; $('locked').hidden = false; $('passphrase').value = '';
}
$('lockButton').addEventListener('click', () => { lock(); message('Dashboard locked. Enter your passphrase to reopen it.'); $('passphrase').focus(); });
window.addEventListener('pagehide', lock);
$('unlockForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!snapshot || !validateEnvelope(snapshot).ready) { message('No snapshot is available yet. Prepare and publish one from your PC2 folder.'); return; }
  if (!window.isSecureContext || !crypto.subtle) { message('Open this dashboard over HTTPS in a current browser.', true); return; }
  $('unlockButton').disabled = true; message('Unlocking in this browser…');
  let passphrase = $('passphrase').value;
  try {
    let html = await decryptSnapshot(snapshot, passphrase); passphrase = ''; $('passphrase').value = '';
    if (!/<head\b[^>]*>/i.test(html)) throw new Error('Invalid dashboard');
    // The unlocked document cannot make network requests or navigate the parent.
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'">`;
    html = html.replace(/<head\b[^>]*>/i, match => match + policy);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' })); html = '';
    $('dashboardFrame').src = blobUrl; $('locked').hidden = true; $('unlocked').hidden = false;
  } catch { passphrase = ''; $('passphrase').value = ''; message('Could not unlock. Check your passphrase, or refresh if the snapshot changed.', true); }
  finally { $('unlockButton').disabled = false; }
});
try {
  const response = await fetch('./snapshot.json', { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('Snapshot download failed');
  snapshot = await response.json();
  if (validateEnvelope(snapshot).ready) message('Snapshot ready. Enter the passphrase you chose on your computer.');
  else { message('No snapshot has been prepared yet. Your existing fitness system has not been published.'); $('unlockButton').disabled = true; }
} catch { message('Snapshot unavailable. Refresh the page or publish a new snapshot.', true); $('unlockButton').disabled = true; }
try {
  const response = await fetch('./publication.json', { cache: 'no-store', credentials: 'omit' });
  if (response.ok) { const value = await response.json(); if (typeof value.preparedAt === 'string') $('publication').textContent = 'Publication package · ' + new Date(value.preparedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' MYT'; }
} catch { /* Publication metadata is optional in local source previews. */ }
