# Prezzo: working notes for Claude

Read `AGENTS.md` for product/deck conventions. This file is Windows operational
knowledge for running the dev server.

## Running the dev server on Windows: use `scripts/dev.ps1`

`npm run dev` works on Windows. Prefer the helper anyway for agent-driven or
remote-presenting sessions — it launches the server detached so it survives the
shell that started it, prints the LAN control URL, tracks the PID for a clean
stop, and flags a missing firewall rule:

```powershell
powershell -NoProfile -File scripts/dev.ps1 start      # detached, LAN-accessible
powershell -NoProfile -File scripts/dev.ps1 stop
powershell -NoProfile -File scripts/dev.ps1 restart
powershell -NoProfile -File scripts/dev.ps1 status
powershell -NoProfile -File scripts/dev.ps1 start -Deck prezzo-demo
```

Then open the deck: `Start-Process chrome "http://127.0.0.1:5173/<slug>/"`.

## Why the helper exists (and what it avoids)

- **Detached + hidden.** Agent `run_in_background` servers get reaped at turn
  boundaries (shows up as exit 127 after it briefly served). The helper uses
  `Start-Process -WindowStyle Hidden` so the server survives the session, and
  records the PID to `%TEMP%\prezzo-dev.pid` for a clean `stop`.
- **Never pass `--host 127.0.0.1`.** `vite.config.ts` already binds `0.0.0.0`
  (port 5173, strictPort). Overriding to loopback silently breaks phone remote
  control, so the helper passes no `--host` and lets the config default stand.
- **`npm run dev` itself is fine now.** It previously failed on Windows with
  `spawn vite ENOENT` (bare `vite` spawn, no shell); `scripts/prezzo.mjs` now
  prepends `node_modules/.bin` to PATH and spawns through a shell, so the npm
  scripts resolve `vite`/`remotion` on Windows too.

## Remote control / firewall

Phone control URL: `http://<LAN-IP>:5173/<slug>/control`. The PIN prints on
server start (re-show with the in-deck terminal command `pin`). On a Private
network Windows Firewall blocks inbound 5173 unless an allow rule exists. Create
it once (self-elevates via UAC):

```powershell
powershell -NoProfile -File scripts/open-firewall.ps1
```

Remove it with `scripts/close-firewall.ps1`. Both scripts and
`scripts/dev.ps1 status` use the same rule name (`Prezzo dev 5173`), so the
status check correctly detects the rule the open script creates.
