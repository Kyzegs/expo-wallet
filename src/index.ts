import { Platform } from 'react-native';

import ExpoWalletNative from './ExpoWalletModule';
import type { AddPassOptions, HasPassOptions, PassSource } from './ExpoWallet.types';

export { default as ExpoWalletNative } from './ExpoWalletModule';
export type * from './ExpoWallet.types';

function passSourcesToNativePayload(sources: PassSource[]): Array<Record<string, string>> {
  return sources.map((source) => {
    const row: Record<string, string> = {};
    if (source.localUri != null) {
      row.localUri = source.localUri;
    }
    if (source.base64 != null) {
      row.base64 = source.base64;
    }
    return row;
  });
}

function collectIosPassSources(options: AddPassOptions): PassSource[] {
  const { ios } = options;
  if (!ios) {
    return [];
  }
  const list: PassSource[] = [];
  if (ios.pass) {
    list.push(ios.pass);
  }
  if (ios.passes?.length) {
    list.push(...ios.passes);
  }
  return list;
}

/**
 * Whether the device can present the native “add pass” UI (Wallet / Google Wallet).
 */
export async function canAddPass(): Promise<boolean> {
  return ExpoWalletNative.canAddPass();
}

/**
 * Presents the platform wallet UI to add one or more passes.
 *
 * - **iOS:** supply `options.ios.pass` and/or `options.ios.passes` with local `file://` URIs or base64 `.pkpass` data.
 * - **Android:** supply `options.android.jwt` (JWT may encode one or many passes).
 */
export async function addPass(options: AddPassOptions): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const sources = collectIosPassSources(options);
    if (sources.length === 0) {
      throw new Error(
        'expo-wallet: addPass on iOS requires `options.ios.pass` and/or `options.ios.passes`.'
      );
    }
    for (const s of sources) {
      if (!s.localUri && !s.base64) {
        throw new Error(
          'expo-wallet: each PassSource must include `localUri` and/or `base64`.'
        );
      }
    }
    return ExpoWalletNative.addPass(passSourcesToNativePayload(sources));
  }

  if (Platform.OS === 'android') {
    const jwt = options.android?.jwt;
    if (jwt == null || jwt.length === 0) {
      throw new Error('expo-wallet: addPass on Android requires `options.android.jwt`.');
    }
    return ExpoWalletNative.addPass(jwt);
  }

  throw new Error(`expo-wallet: addPass is not supported on ${Platform.OS}.`);
}

/**
 * Returns whether a pass is already in the user’s library.
 *
 * - **iOS:** Uses PassKit (`PKPassLibrary`). Requires the pass-type-identifiers entitlement for reliable results.
 * - **Android:** Not supported on-device; logs a warning and returns `false`. Use your backend + Google Wallet REST API.
 */
export async function hasPass(options: HasPassOptions): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const id = options.ios?.passTypeIdentifier;
    const serial = options.ios?.serialNumber;
    if (!id || !serial) {
      throw new Error(
        'expo-wallet: hasPass on iOS requires `options.ios.passTypeIdentifier` and `options.ios.serialNumber`.'
      );
    }
    return ExpoWalletNative.hasPass(id, serial);
  }

  if (Platform.OS === 'android') {
    // eslint-disable-next-line no-console
    console.warn(
      '[expo-wallet] hasPass: Google Wallet does not expose a client-side API to check if a pass is saved. ' +
        'Query the Google Wallet REST API from your backend (e.g. using the pass object ID). ' +
        'Returning false.'
    );
    return false;
  }

  return false;
}

/**
 * Downloads a remote `.pkpass` with `expo-file-system` and calls {@link addPass} with the cached `file://` URI.
 *
 * Install `expo-file-system` in your app when using this helper.
 *
 * @param remotePkpassUrl HTTPS URL to a `.pkpass` file.
 * @param androidJwt Optional Google Wallet JWT used when running on Android (iOS only uses the downloaded pkpass).
 */
export async function downloadAndAddPass(
  remotePkpassUrl: string,
  androidJwt?: string
): Promise<boolean> {
  const nameFromUrl = remotePkpassUrl.split('/').pop()?.split('?')[0] || 'pass.pkpass';
  const safeName = nameFromUrl.endsWith('.pkpass') ? nameFromUrl : `${nameFromUrl}.pkpass`;

  let fsMain: typeof import('expo-file-system');
  try {
    fsMain = await import('expo-file-system');
  } catch {
    throw new Error(
      'expo-wallet: downloadAndAddPass requires the `expo-file-system` package. Run `npx expo install expo-file-system`.'
    );
  }

  // Expo SDK 54+ modern API (`File`, `Paths`)
  if (typeof fsMain.File?.downloadFileAsync === 'function' && fsMain.Paths != null) {
    const { File: FSFile, Paths } = fsMain;
    const destination = new FSFile(Paths.cache, safeName);
    const downloaded = await FSFile.downloadFileAsync(remotePkpassUrl, destination, {
      idempotent: true,
    });
    return addPass({
      ios: { pass: { localUri: downloaded.uri } },
      android: androidJwt ? { jwt: androidJwt } : undefined,
    });
  }

  // Older `expo-file-system/legacy` API (`downloadAsync`, `cacheDirectory`)
  let legacy: typeof import('expo-file-system/legacy');
  try {
    legacy = await import('expo-file-system/legacy');
  } catch {
    throw new Error(
      'expo-wallet: Could not load expo-file-system legacy API. Install a compatible `expo-file-system` version.'
    );
  }

  const baseDir = legacy.cacheDirectory ?? legacy.documentDirectory;
  if (!baseDir) {
    throw new Error('expo-wallet: No writable cache or document directory available.');
  }

  const localUri = `${baseDir}${safeName}`;
  const result = await legacy.downloadAsync(remotePkpassUrl, localUri);

  if (result.status !== 200) {
    throw new Error(
      `expo-wallet: download failed with HTTP status ${result.status} for ${remotePkpassUrl}`
    );
  }

  return addPass({
    ios: { pass: { localUri: result.uri } },
    android: androidJwt ? { jwt: androidJwt } : undefined,
  });
}
