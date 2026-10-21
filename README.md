# Personal Coach 2.0 — encrypted AIO publication

This repository publishes a static, read-only dashboard through GitHub Pages. It contains a public lock page and an encrypted HTML snapshot. It does not contain the fitness project, original trackers, diet workbook, shared memory, medical files or the dashboard passphrase.

The owner has selected a public publication repository. GitHub Pages is configured to use GitHub Actions, and PC2_PAGES_ENABLED is enabled. The initial deployment contains the empty snapshot placeholder only. No health snapshot is included until it is encrypted locally with the owner's passphrase.

Pushes to main run validation/tests. Once Pages is available and configured, set the repository Actions variable PC2_PAGES_ENABLED to true to enable automatic packaging and deployment. Before that, deployment jobs are skipped and checks still run. Pull requests run checks without deployment. In repository Settings → Pages, select GitHub Actions as the source. The Actions deployment result supplies the actual site URL; do not assume a deployment succeeded merely because a commit was pushed.

## First publication

The initial snapshot is an empty placeholder. It displays “No snapshot has been prepared yet” and contains no health data. From the local PC2 workspace, use Prepare GitHub Snapshot.bat to rebuild the isolated AIO, choose a long unique passphrase in a hidden local prompt, and write ciphertext into site/snapshot.json. Then push the reviewed publication files. Do not put a passphrase in chat, a GitHub secret, workflow input, source file or command argument.

The browser derives an AES-256-GCM key with PBKDF2-SHA256 (600,000 iterations), using a fresh random salt and IV per snapshot. The passphrase is entered only in the browser when viewing. No password or decrypted dashboard is sent to GitHub by this code. The unlocked dashboard runs in a sandboxed local document with network requests blocked. Locking or reloading removes the active decrypted view; this code does not save the key in browser storage.

## Boundaries

GitHub Pages commonly serves a public website even for a private source repository. Here, visitors can download the encrypted snapshot and attempt offline guessing, so a strong unique passphrase matters. This is client-side snapshot encryption, not per-user account authentication. The hosting account and lock-page code remain trusted: a malicious future loader could capture an entered passphrase. Restrict repository write access and review changes. This implementation has automated and browser tests, not an independent security audit.

Old ciphertext remains in Git history. Changing today's passphrase does not revoke copies encrypted with an older passphrase. Original health sources stay local, and no plaintext snapshot is committed to this repository. Do not replace the encrypted snapshot with an unprotected export or upload the PC2 parent directory.

The page shows the last published snapshot; it does not synchronize new phone entries, run an AI coach or read files from a sleeping computer. Either authorized AI may update the local source and prepare a new snapshot later; publishing is a separate verified step.

## Checks

Run node --test scripts/validate.test.mjs, then node scripts/validate.mjs. Run node scripts/validate.mjs --prepare to assemble _site. These commands require only Node 22+ and standard libraries, with no package installation. Tests use invented content and temporary directories; the local PC2 launcher keeps its fixture output under PC2 runtime.

References: [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Web Crypto deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey).
