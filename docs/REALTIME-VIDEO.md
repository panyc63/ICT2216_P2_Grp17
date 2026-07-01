# Realtime chat, secure uploads & WebRTC video — setup (Phases 4 & 5)

These features are **feature-flagged**: the app runs without them (endpoints return `503`
until configured, uploads fall back to an EICAR stub scanner). Configure the env vars below
to activate. The backend code is in `backend/server.js` / `backend/security.js`; rules and
configs are in `firebase/` and `deploy/coturn/`.

## A. Secure file uploads + malware scanning (Phase 4) — works out of the box
- `POST /api/consultations/:id/attachments/upload` (multipart `file`): validates type/size/name
  (`scanAttachmentMetadata`), **scans the bytes for malware** (`scanBufferForMalware`), stores the
  file under a server-generated name outside the web root, and records `message_attachments`.
- `GET /api/attachments/:id`: streams the file to consultation **participants only** (object-level
  authz), with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- **Malware engine:** if `CLAMD_HOST`/`CLAMD_PORT` point at a ClamAV daemon, files are streamed to
  it (INSTREAM). Otherwise a stub detects the EICAR test signature so the pipeline is testable.
  Production: run `clamav/clamav` as a sidecar and set `CLAMD_HOST=clamav CLAMD_PORT=3310`.

## B. Firebase realtime chat / queue / signaling (Phase 4)
1. Create a Firebase project + Realtime Database.
2. Create a **service account**; set backend env:
   ```
   FIREBASE_CLIENT_EMAIL=...@...iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
3. Deploy the security rules: `firebase deploy --only database` (uses `firebase/database.rules.json`).
4. Frontend obtains a **Firebase custom token** from `POST /api/realtime/token` (carries `uid` +
   `role` claims), then `signInWithCustomToken` and reads/writes `/live_chats/$cid`, `/active_queues`.
   Add the Firebase web SDK (`npm i firebase`) and the web config via `VITE_FIREBASE_*` env.
- **PHI note:** chat bodies are persisted **encrypted** in MySQL (system of record) via the existing
  `/messages` endpoints; if mirroring messages into Firebase, encrypt the body before writing and
  keep Firebase retention short — Firebase holds transient realtime state, not the PHI record.

## C. WebRTC video + coturn TURN (Phase 5)
1. Run **coturn** (e.g. as a compose service using `deploy/coturn/turnserver.conf`); set
   `static-auth-secret` = `TURN_SECRET` and `external-ip` to the host's public IP. Open UDP/TCP
   `3478` and the relay range `49160-49200` in the security group.
2. Backend env: `TURN_SECRET=<same secret>` and `TURN_URLS=turn:your-host:3478`.
3. Client flow:
   - `GET /api/consultations/:id/rtc-credentials` → short-lived HMAC TURN creds (participant-only).
   - Exchange SDP **offer/answer + ICE** over the Firebase `/signaling/$cid` node (rules restrict to
     consultation members).
   - Media is **peer-to-peer, encrypted with DTLS-SRTP automatically** by the browser → satisfies the
     "SRTP media / E2E" requirement.
4. **Recording:** `POST /api/consultations/:id/recording` (doctor-gated) records **consent + session
   metadata** in `recording_sessions` (no media is stored) — the "audit-ready recording tokens".

## C2. Managed TURN — no ports to open (recommended for the current EC2)
STUN alone (the default) only works when at least one peer has an open path; **two users on different
home/campus networks behind symmetric NAT will sit at "Connecting…" forever** without a TURN relay.
When you can't open inbound ports on the VM, use a **managed TURN provider** — the browser connects
*outbound* to the provider, so nothing needs to be opened on the EC2.

1. Create a free/low-cost TURN app with a provider (e.g. **Metered `openrelay`**, **Cloudflare
   Realtime TURN**, or **Twilio NTS**). They give you a relay URL, a username, and a credential.
2. Put them in `.env.production` (these three keys are already in `.env.production.example`):
   ```
   TURN_URLS=turns:relay.example.com:443?transport=tcp,turn:relay.example.com:3478
   TURN_USERNAME=<provider username>
   TURN_CREDENTIAL=<provider credential>
   ```
   `buildIceServers` (`backend/security.js`) automatically adds these to the ICE server list; no
   backend change is needed. Prefer a `turns:…:443` URL — it tunnels over TLS/443 and traverses the
   strictest firewalls.
3. Redeploy: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`.
4. Verify: two users on different networks join a call and the status reaches **"Connected"**. If TURN
   is missing/misconfigured, the client now shows a clear "needs a TURN relay" message after ~20s
   instead of spinning forever.

## Environment summary
```
# Uploads / malware scan
CLAMD_HOST=            # e.g. clamav (empty => EICAR stub)
CLAMD_PORT=3310
UPLOAD_DIR=uploads
# Firebase realtime
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
# WebRTC TURN — either self-hosted coturn (HMAC) ...
TURN_SECRET=
TURN_URLS=turn:your-host:3478
# ... OR a managed provider (static creds, no inbound ports needed)
TURN_USERNAME=
TURN_CREDENTIAL=
```
