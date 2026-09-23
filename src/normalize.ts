import { CodedError } from 'expo-modules-core';

import type { ApplePass, GooglePass } from './ExpoWallet.types';
import type { NativeApplePassSource } from './ExpoWalletModule';

const GOOGLE_SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';

function invalidPass(message: string): CodedError {
  return new CodedError('ERR_WALLET_INVALID_PASS', `expo-wallet: ${message}`);
}

/** Returns the base64 payload of a `data:…;base64,` URI, or `null` for anything else. */
function base64FromDataUri(uri: string): string | null {
  if (!uri.startsWith('data:')) {
    return null;
  }
  const comma = uri.indexOf(',');
  if (comma === -1 || !uri.slice(0, comma).endsWith(';base64')) {
    throw invalidPass(
      'data: URIs must be base64 encoded (`data:application/vnd.apple.pkpass;base64,…`).'
    );
  }
  return uri.slice(comma + 1);
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function toUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array {
  // Native only accepts exactly `Uint8Array`, so rewrap other views without copying.
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data) && data.constructor !== Uint8Array) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return data;
}

/**
 * Turns the public `ApplePass` inputs into native sources. Binary data is sent separately in
 * `blobs` because native records can't hold typed arrays.
 */
export function normalizeApplePasses(input: ApplePass | ApplePass[]): {
  sources: NativeApplePassSource[];
  blobs: Uint8Array[];
} {
  const list = Array.isArray(input) ? input : [input];
  const blobs: Uint8Array[] = [];
  const sources = list.map((pass, index): NativeApplePassSource => {
    const at = list.length > 1 ? ` (apple[${index}])` : '';

    if (typeof pass === 'string' || (isObject(pass) && 'uri' in pass)) {
      const uri = typeof pass === 'string' ? pass : pass.uri;
      if (typeof uri !== 'string' || uri.length === 0) {
        throw invalidPass(`Apple pass uri is empty${at}.`);
      }
      const base64 = base64FromDataUri(uri);
      if (base64 != null) {
        return { base64 };
      }
      return typeof pass === 'string' || pass.headers == null
        ? { uri }
        : { uri, headers: pass.headers };
    }
    if (
      isObject(pass) &&
      'base64' in pass &&
      typeof pass.base64 === 'string' &&
      pass.base64.length > 0
    ) {
      return { base64: base64FromDataUri(pass.base64) ?? pass.base64 };
    }
    if (
      isObject(pass) &&
      'data' in pass &&
      (pass.data instanceof ArrayBuffer || ArrayBuffer.isView(pass.data))
    ) {
      blobs.push(toUint8Array(pass.data));
      return { dataIndex: blobs.length - 1 };
    }
    throw invalidPass(
      `Apple pass must be a URI string, { uri }, { base64 } or { data: Uint8Array | ArrayBuffer }${at}.`
    );
  });

  if (sources.length === 0) {
    throw new CodedError('ERR_WALLET_MISSING_PASS', 'expo-wallet: `apple` is an empty array.');
  }
  return { sources, blobs };
}

/** Turns the public `GooglePass` input into the argument for `savePassesJwt` or `savePasses`. */
export function normalizeGooglePass(input: GooglePass): { kind: 'jwt' | 'json'; value: string } {
  if (typeof input === 'string') {
    const value = input.trim();
    if (value.startsWith('{')) {
      return { kind: 'json', value };
    }
    const jwt = value.startsWith(GOOGLE_SAVE_URL_PREFIX)
      ? value.slice(GOOGLE_SAVE_URL_PREFIX.length).split(/[?#]/)[0]
      : value;
    if (jwt.length === 0) {
      throw invalidPass('Google pass JWT is empty.');
    }
    return { kind: 'jwt', value: jwt };
  }
  if (
    isObject(input) &&
    'jwt' in input &&
    typeof input.jwt === 'string' &&
    input.jwt.trim().length > 0
  ) {
    return { kind: 'jwt', value: input.jwt.trim() };
  }
  if (isObject(input) && 'json' in input && input.json != null) {
    return {
      kind: 'json',
      value: typeof input.json === 'string' ? input.json : JSON.stringify(input.json),
    };
  }
  throw invalidPass('Google pass must be a JWT string, { jwt } or { json }.');
}

/**
 * Returns the Google Wallet "save" link for a JWT. Opening it adds the pass through the browser,
 * so it works on the web, in emails, and on Android devices where `canAddPasses()` is `false`.
 *
 * Keep the JWT under ~1800 characters for links: create the pass class and object on your
 * backend first and put only their IDs in the JWT.
 */
export function getGoogleWalletSaveUrl(jwt: string): string {
  return GOOGLE_SAVE_URL_PREFIX + jwt;
}
