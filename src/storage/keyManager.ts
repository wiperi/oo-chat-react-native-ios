/* eslint-disable no-bitwise */
import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';
import nacl from 'tweetnacl';
import type { SignedMessage, StoredIdentity } from '../types';

const SERVICE = 'connectonion.mobile.identity.ed25519';

interface KeychainIdentity extends StoredIdentity {
  secretKeyHex: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomSeed(): Uint8Array {
  const bytes = new Uint8Array(32);
  (globalThis as unknown as {
    crypto: { getRandomValues<T extends Uint8Array>(array: T): T };
  }).crypto.getRandomValues(bytes);
  return bytes;
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    return Object.keys(input).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize(input[key]);
      return result;
    }, {});
  }
  return value;
}

function publicIdentity(identity: KeychainIdentity): StoredIdentity {
  return {
    address: identity.address,
    publicKeyHex: identity.publicKeyHex,
    createdAt: identity.createdAt,
  };
}

async function loadRawIdentity(): Promise<KeychainIdentity | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credentials) {
    return null;
  }
  return JSON.parse(credentials.password) as KeychainIdentity;
}

async function createRawIdentity(): Promise<KeychainIdentity> {
  const keyPair = nacl.sign.keyPair.fromSeed(randomSeed());
  const publicKeyHex = toHex(keyPair.publicKey);
  const identity: KeychainIdentity = {
    address: `0x${publicKeyHex}`,
    publicKeyHex,
    secretKeyHex: toHex(keyPair.secretKey),
    createdAt: Date.now(),
  };

  await Keychain.setGenericPassword(identity.address, JSON.stringify(identity), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  return identity;
}

async function loadOrCreateRawIdentity(): Promise<KeychainIdentity> {
  const existing = await loadRawIdentity();
  if (existing) {
    return existing;
  }

  return createRawIdentity();
}

export async function loadOrCreateIdentity(): Promise<StoredIdentity> {
  return publicIdentity(await loadOrCreateRawIdentity());
}

export async function signPayload(type: string, payload: Record<string, unknown>): Promise<SignedMessage> {
  const identity = await loadOrCreateRawIdentity();

  const canonicalPayload = canonicalize(payload) as Record<string, unknown>;
  const message = JSON.stringify(canonicalPayload);
  const signature = nacl.sign.detached(utf8Bytes(message), fromHex(identity.secretKeyHex));

  return {
    type,
    payload: canonicalPayload,
    from: identity.address,
    signature: toHex(signature),
    timestamp: canonicalPayload.timestamp,
  };
}
