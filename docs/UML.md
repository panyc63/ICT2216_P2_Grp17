# MediFlow — UML / Architecture Diagrams (Report II)

Mermaid diagrams (render natively on GitHub). They document code structure and the key
secure flows. Each maps to handlers in `backend/server.js` and primitives in
`backend/security.js`.

## 1. Component / package diagram

```mermaid
flowchart TB
  subgraph Client["Browser (Vue 3 SPA)"]
    UI["Views: login, patient/*, doc/*, nurse/*, pharmacist/*, admin"]
    API["services/api.js<br/>(apiFetch + CSRF + session cookie)"]
    UI --> API
  end
  subgraph Edge["Edge (prod)"]
    CADDY["Caddy — TLS 1.3, auto-HTTPS"]
  end
  subgraph Backend["Express API (backend/server.js)"]
    MW["Middleware: applySecurityHeaders, applyCors,<br/>csrfGuard, rateLimit, authenticate, requireRole, requireRecentReauth"]
    H["Route handlers: auth, account, consultations,<br/>triage, payments, prescriptions/pharmacy, MC, chat"]
    SEC["security.js — crypto/JWT/CSRF/validation/audit primitives"]
    MW --> H --> SEC
  end
  DB[("MySQL<br/>users, consultations, triage_submissions,<br/>payment_events, prescriptions, medication_inventory,<br/>medical_certificates, chat_messages, security_audit_logs")]
  STRIPE["Stripe (webhook, test mode)"]
  MAIL["Email (Resend SMTP)"]

  API -->|HTTPS /api| CADDY --> MW
  H --> DB
  STRIPE -->|signed webhook| H
  H --> MAIL
```

## 2. Domain / data model (class-style)

```mermaid
classDiagram
  class User {
    user_id PK
    email UNIQUE
    password_hash  // scrypt
    role  // Patient|Nurse|Doctor|Admin|Pharmacist
    status  // PendingVerification|Active|Deactivated
    token_version  // session revocation
    phone, address_encrypted, nric_encrypted
    reset_token_hash, reset_expires_at
    mc_public_key, mc_private_key_encrypted  // Ed25519
  }
  class Consultation { consultation_id PK; patient_id FK; doctor_id FK; session_status }
  class TriageSubmission { triage_id PK; patient_id FK; answers_encrypted; priority_score }
  class PaymentEvent { payment_id PK; patient_id FK; checkout_reference; stripe_event_id; status }
  class Prescription { prescription_id PK; consultation_id FK; medication_id FK; status; fulfilled_by }
  class MedicationInventory { medication_id PK; name; stock_quantity }
  class MedicalCertificate { mc_id PK; doctor_id FK; patient_id FK; qr_token_hash; is_revoked }
  class ChatMessage { message_id PK; consultation_id FK; sender_id FK; message_body_encrypted }
  class SecurityAuditLog { log_id PK; actor_id; action_performed; outcome; previous_hash; entry_hash }

  User "1" --> "*" Consultation : patient/doctor
  Consultation "1" --> "*" Prescription
  Consultation "1" --> "*" MedicalCertificate
  Consultation "1" --> "*" ChatMessage
  Prescription "*" --> "1" MedicationInventory
  User "1" --> "*" PaymentEvent
```

## 3. Sequence — Login with MFA

```mermaid
sequenceDiagram
  actor U as User
  participant FE as SPA (api.js)
  participant BE as API (login/completeLoginMfa)
  participant DB as MySQL
  U->>FE: email + password
  FE->>BE: GET /api/csrf
  FE->>BE: POST /api/login (CSRF, creds)
  BE->>DB: verifyPassword(scrypt)
  alt staff role (MFA required)
    BE->>U: email OTP (createMfaChallenge)
    BE-->>FE: 202 requiresMfa + challengeId
    U->>FE: OTP
    FE->>BE: POST /api/login/mfa
    BE->>DB: verify OTP (hashed, 5-min expiry)
  end
  BE-->>FE: 200 + Set-Cookie mf_session (HttpOnly, 15-min JWT)
  BE->>DB: writeAudit(LOGIN, SUCCESS)
```

## 4. Sequence — Consultation booking lifecycle (Phase 2)

```mermaid
sequenceDiagram
  actor P as Patient
  actor D as Doctor
  participant BE as API (/api/consultations)
  P->>BE: POST /consultations  => Pending
  D->>BE: GET /consultations (assigned + pending pool)
  D->>BE: PATCH :id {claim}  => doctor_id set
  D->>BE: PATCH :id {start}  => Active
  D->>BE: PATCH :id {complete} => Completed
  Note over BE: requireRole(Doctor) + object-level<br/>(doctor owns consultation) + state machine + audit
```

## 5. Sequence — MC issuance + public verification (Ed25519, Phase 6)

```mermaid
sequenceDiagram
  actor D as Doctor
  participant BE as API
  participant DB as MySQL
  actor V as Verifier (public)
  D->>BE: POST /medical-certificates (re-auth)
  BE->>DB: check assigned doctor + Paid payment
  BE->>BE: ensure doctor Ed25519 keypair (private key encrypted)
  BE->>BE: signMcTokenAsym(payload, doctorPrivateKey)
  BE->>DB: store mc (qr_token_hash, signature_hash)
  BE-->>D: verificationToken (QR)
  V->>BE: GET /api/verify/mc/:token
  BE->>DB: find MC by token hash -> doctor public key
  BE->>BE: verifyMcTokenAsym(token, doctorPublicKey)
  BE-->>V: { valid, issueDate, validUntil, revoked }  // minimal, no PHI
```

## 6. Sequence — Pharmacy fulfilment (transactional, Phase 3)

```mermaid
sequenceDiagram
  actor Ph as Pharmacist
  participant BE as API (/prescriptions/:id/fulfil)
  participant DB as MySQL
  Ph->>BE: POST fulfil (re-auth)
  BE->>DB: BEGIN; SELECT prescription FOR UPDATE
  BE->>DB: UPDATE inventory SET stock=stock-1 WHERE stock>0
  alt affectedRows = 0
    BE->>DB: ROLLBACK
    BE-->>Ph: 409 out of stock (oversell prevented)
  else
    BE->>DB: UPDATE prescription status=Fulfilled; COMMIT
    BE-->>Ph: 200 fulfilled
  end
```

## 7. Sequence — Secure Stripe payment webhook

```mermaid
sequenceDiagram
  participant S as Stripe
  participant BE as API (/payments/webhook)
  participant DB as MySQL
  S->>BE: POST webhook (stripe-signature, raw body)
  BE->>BE: verifyStripeSignature(HMAC) — reject if invalid (400)
  BE->>DB: idempotency check (stripe_event_id UNIQUE)
  BE->>DB: mark payment Paid (server-side only)
  BE->>DB: writeAudit(PAYMENT_WEBHOOK_PAID)
```
