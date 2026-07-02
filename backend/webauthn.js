// WebAuthn / FIDO2 passkeys for privileged accounts (Admin/Doctor) — a phishing-resistant
// step-up factor. Thin wrapper around @simplewebauthn/server (v13) that keeps all the
// security-critical parameters (expectedChallenge / expectedOrigin / expectedRPID) explicit
// so the library does the cryptographic verification correctly.
//
// `rp` everywhere is { rpID, rpName, origin } sourced from config (WEBAUTHN_RP_ID /
// WEBAUTHN_RP_NAME / WEBAUTHN_ORIGIN).

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

function csvToTransports(csv) {
  return csv ? String(csv).split(',').filter(Boolean) : undefined;
}

// Registration ceremony: options the browser passes to navigator.credentials.create().
export function registrationOptions(rp, user, existingCredentials = []) {
  return generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userName: user.email,
    userDisplayName: user.name || user.email,
    // v13 wants an opaque byte handle for the user id.
    userID: new TextEncoder().encode(user.user_id),
    attestationType: 'none',
    // Don't let the same authenticator enroll twice.
    excludeCredentials: existingCredentials.map((c) => ({ id: c.credential_id, transports: csvToTransports(c.transports) })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
}

// Verify the attestation and return a persistable credential, or null if verification failed.
export async function verifyRegistration(rp, response, expectedChallenge) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) return null;
  const { credential } = verification.registrationInfo;
  return {
    credentialId: credential.id,                                  // base64url string
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: (credential.transports || []).join(','),
  };
}

// Authentication ceremony: options the browser passes to navigator.credentials.get().
export function authenticationOptions(rp, credentials = []) {
  return generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: credentials.map((c) => ({ id: c.credential_id, transports: csvToTransports(c.transports) })),
    userVerification: 'preferred',
  });
}

// Verify the assertion against a stored credential. Returns the library's verification
// result: { verified, authenticationInfo: { newCounter, ... } }.
export function verifyAuthentication(rp, response, expectedChallenge, storedCredential) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
    credential: {
      id: storedCredential.credential_id,
      publicKey: new Uint8Array(Buffer.from(storedCredential.public_key, 'base64url')),
      counter: Number(storedCredential.counter),
      transports: csvToTransports(storedCredential.transports),
    },
  });
}
