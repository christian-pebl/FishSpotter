/**
 * VAPID keypair generator (Sprint 6 T-16, Web Push).
 *
 * RFC 8292: VAPID uses ECDSA on P-256 with public + private keys
 * encoded as raw bytes, base64url. We generate via Node's WebCrypto
 * so there's no extra dependency.
 *
 * Output shape matches what `web-push` library expects:
 *   { publicKey, privateKey }  — both base64url strings
 */

import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

function toBase64Url(bytes: Uint8Array): string {
  // Use base64 then strip padding + URL-safe substitutions.
  // Node Buffer is the most reliable cross-version path here.
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

export async function generateVapidKeys(): Promise<VapidKeyPair> {
  const pair = (await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  // Public key as raw (65-byte uncompressed point: 0x04 || X || Y).
  const rawPub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));

  // Private key as the 32-byte D scalar. exportKey("jwk") gives us
  // the base64url-encoded D directly.
  const jwk = (await subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey & {
    d?: string;
  };
  if (!jwk.d) {
    throw new Error("VAPID key generation produced no private scalar");
  }

  return {
    publicKey: toBase64Url(rawPub),
    privateKey: jwk.d, // already base64url-encoded by WebCrypto
  };
}

// Exported for vitest visibility.
export const __test__ = { toBase64Url };
