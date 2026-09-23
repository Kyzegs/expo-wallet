import { CodedError, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

import type {
  AddPassRequest,
  AddPassResult,
  ApplePass,
  Pass,
  PassIdentifier,
  PassLibraryChangeEvent,
  WalletError,
  WalletErrorCode,
} from './ExpoWallet.types';
import ExpoWalletModule, { type ExpoWalletNativeModule } from './ExpoWalletModule';
import { normalizeApplePasses, normalizeGooglePass } from './normalize';

export type * from './ExpoWallet.types';
export { default as AppleWalletButton } from './AppleWalletButton';
export { getGoogleWalletSaveUrl } from './normalize';

function iosOnly(name: string, alternative = ''): CodedError {
  return new CodedError(
    'ERR_UNAVAILABLE',
    `expo-wallet: ${name}() is only available on iOS (Apple Wallet).${alternative}`
  );
}

const GOOGLE_LOOKUP_HINT =
  ' Google Wallet has no on-device lookup; check the pass object with the Google Wallet REST API from your backend.';

const NOT_LINKED =
  "expo-wallet's native module isn't in this build. Rebuild the app (npx expo run:ios / run:android); Expo Go doesn't include it.";

function native(name: string): ExpoWalletNativeModule {
  if (ExpoWalletModule == null) {
    throw new CodedError('ERR_UNAVAILABLE', `expo-wallet: ${name}() failed. ${NOT_LINKED}`);
  }
  return ExpoWalletModule;
}

let warnedNotLinked = false;

// MARK: - Cross-platform

/**
 * Whether this device can add passes to its wallet: Apple Wallet on iOS, Google Wallet on
 * Android. Use it to decide whether to show an "Add to Wallet" button. Always `false` on the web.
 */
export async function canAddPasses(): Promise<boolean> {
  if (ExpoWalletModule == null) {
    if (__DEV__ && !warnedNotLinked) {
      warnedNotLinked = true;
      console.warn(`${NOT_LINKED} canAddPasses() returns false.`);
    }
    return false;
  }
  return ExpoWalletModule.canAddPasses();
}

/**
 * Shows the platform's wallet UI so the user can add one or more passes.
 * Pass the Apple and the Google version together; only the one for the current platform is used.
 *
 * @example
 * const result = await addPass({
 *   apple: { uri: `${API}/passes/${id}.pkpass`, headers: { Authorization: `Bearer ${token}` } },
 *   google: googleJwt,
 * });
 * if (result === 'added') showConfirmation();
 */
export async function addPass(request: AddPassRequest): Promise<AddPassResult> {
  if (Platform.OS === 'ios') {
    if (request.apple == null) {
      throw new CodedError(
        'ERR_WALLET_MISSING_PASS',
        'expo-wallet: addPass() on iOS needs `apple` (a .pkpass URI, base64 or data).'
      );
    }
    const { sources, blobs } = normalizeApplePasses(request.apple);
    return native('addPass').addPasses(sources, blobs, request.applePresentation ?? 'sheet');
  }

  if (Platform.OS === 'android') {
    if (request.google == null) {
      throw new CodedError(
        'ERR_WALLET_MISSING_PASS',
        'expo-wallet: addPass() on Android needs `google` (a JWT, or { json }).'
      );
    }
    const { kind, value } = normalizeGooglePass(request.google);
    const wallet = native('addPass');
    return kind === 'jwt' ? wallet.savePassesJwt(value) : wallet.savePasses(value);
  }

  throw new CodedError(
    'ERR_WALLET_UNAVAILABLE',
    `expo-wallet: there is no wallet on ${Platform.OS}. For Google Wallet on the web, link to getGoogleWalletSaveUrl(jwt).`
  );
}

/**
 * Whether `error` came from this package, optionally with a specific `code`.
 *
 * @example
 * try {
 *   await addPass(request);
 * } catch (error) {
 *   if (isWalletError(error, 'ERR_WALLET_UNAVAILABLE')) showFallback();
 *   else throw error;
 * }
 */
export function isWalletError(error: unknown, code?: WalletErrorCode): error is WalletError {
  const errorCode = error instanceof Error ? (error as Partial<WalletError>).code : undefined;
  if (typeof errorCode !== 'string') {
    return false;
  }
  if (code != null) {
    return errorCode === code;
  }
  return errorCode.startsWith('ERR_WALLET_') || errorCode === 'ERR_UNAVAILABLE';
}

// MARK: - Apple Wallet pass library (iOS)
//
// Apple only lets apps read passes whose type identifiers are in the app's
// `com.apple.developer.pass-type-identifiers` entitlement. Set them with the config plugin.

/**
 * Returns the passes in Apple Wallet that your app can access.
 *
 * @platform ios
 */
export async function getPasses(): Promise<Pass[]> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('getPasses');
  }
  return native('getPasses').getPasses();
}

/**
 * Returns the pass with the given identifier, or `null` if it isn't in Apple Wallet
 * or your app can't access it.
 *
 * @platform ios
 */
export async function getPass(pass: PassIdentifier): Promise<Pass | null> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('getPass', GOOGLE_LOOKUP_HINT);
  }
  return native('getPass').getPass(pass.passTypeIdentifier, pass.serialNumber);
}

/**
 * Whether the pass is in Apple Wallet. Use it to show "View in Wallet" instead of "Add to Wallet".
 *
 * - Pass the pass itself (the same inputs as `addPass`'s `apple`) to check it without any
 *   entitlement.
 * - Pass `{ passTypeIdentifier, serialNumber }` to look it up by ID. That needs the
 *   pass-type-identifiers entitlement; without it the result is always `false`.
 *
 * @example
 * await hasPass('https://api.example.com/passes/123.pkpass');
 * await hasPass({ passTypeIdentifier: 'pass.com.example.ticket', serialNumber: '123' });
 * @platform ios
 */
export async function hasPass(pass: PassIdentifier | ApplePass): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('hasPass', GOOGLE_LOOKUP_HINT);
  }
  if (isPassIdentifier(pass)) {
    return (await native('hasPass').getPass(pass.passTypeIdentifier, pass.serialNumber)) != null;
  }
  const { sources, blobs } = normalizeApplePasses(pass);
  return native('hasPass').containsPass(sources[0], blobs);
}

function isPassIdentifier(pass: PassIdentifier | ApplePass): pass is PassIdentifier {
  return typeof pass === 'object' && pass != null && 'passTypeIdentifier' in pass;
}

/**
 * Opens the pass in the Wallet app.
 *
 * @throws `ERR_WALLET_PASS_NOT_FOUND` if the pass isn't in Wallet or your app can't access it.
 * @platform ios
 */
export async function openPass(pass: PassIdentifier): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('openPass');
  }
  return native('openPass').openPass(pass.passTypeIdentifier, pass.serialNumber);
}

/**
 * Removes the pass from Apple Wallet without asking the user.
 *
 * @throws `ERR_WALLET_PASS_NOT_FOUND` if the pass isn't in Wallet or your app can't access it.
 * @platform ios
 */
export async function removePass(pass: PassIdentifier): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('removePass');
  }
  return native('removePass').removePass(pass.passTypeIdentifier, pass.serialNumber);
}

/**
 * Replaces a pass that's already in Apple Wallet with a new version, without asking the user.
 * The new pass must have the same `passTypeIdentifier` and `serialNumber`.
 *
 * @returns `false` if the pass isn't in Wallet or your app can't access it.
 * @platform ios
 */
export async function replacePass(pass: ApplePass): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    throw iosOnly('replacePass');
  }
  const { sources, blobs } = normalizeApplePasses(pass);
  if (sources.length !== 1) {
    throw new CodedError('ERR_WALLET_INVALID_PASS', 'expo-wallet: replacePass() takes one pass.');
  }
  return native('replacePass').replacePass(sources[0], blobs);
}

/**
 * Calls `listener` when passes your app can access are added, replaced or removed, including
 * changes made in the Wallet app. On other platforms the listener is never called.
 *
 * @example
 * useEffect(() => {
 *   const subscription = addPassLibraryListener(() => refresh());
 *   return () => subscription.remove();
 * }, []);
 * @platform ios
 */
export function addPassLibraryListener(
  listener: (event: PassLibraryChangeEvent) => void
): EventSubscription {
  if (Platform.OS !== 'ios' || ExpoWalletModule == null) {
    return { remove() {} };
  }
  return ExpoWalletModule.addListener('onPassLibraryChange', listener);
}
