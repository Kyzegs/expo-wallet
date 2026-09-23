import type { CodedError } from 'expo-modules-core';
import type { ViewProps } from 'react-native';

// MARK: - Apple Wallet (iOS)

/**
 * An Apple Wallet pass (`.pkpass`). Used on iOS.
 *
 * - `string`: shorthand for `{ uri }`.
 * - `{ uri, headers? }`: an `https://` URL (downloaded natively, no `expo-file-system` needed),
 *   a `file://` URI, or a `data:` URI. Same shape as React Native's `<Image source>`.
 * - `{ base64 }`: the `.pkpass` bytes, base64 encoded.
 * - `{ data }`: the `.pkpass` bytes, e.g. from `await (await fetch(url)).arrayBuffer()`.
 *   Transferred to native without base64 encoding.
 */
export type ApplePass =
  | string
  | {
      uri: string;
      /** HTTP headers used when `uri` is remote, e.g. `{ Authorization: 'Bearer …' }`. */
      headers?: Record<string, string>;
    }
  | { base64: string }
  | { data: Uint8Array | ArrayBuffer };

/**
 * How Apple Wallet asks the user to add the passes.
 *
 * - `'sheet'`: the full-screen sheet previewing each pass (`PKAddPassesViewController`).
 * - `'alert'`: a compact alert with **Add All** and **Review** buttons (`PKPassLibrary.addPasses`).
 *   Apple suggests it for passes the user just created, such as a ticket they bought
 *   or several boarding passes. **Review** falls back to the sheet.
 */
export type ApplePresentation = 'sheet' | 'alert';

/** Identifies a pass in the user's Apple Wallet. Any {@link Pass} can be passed where this is expected. */
export interface PassIdentifier {
  /** The pass type identifier from `pass.json`, e.g. `pass.com.example.ticket`. */
  passTypeIdentifier: string;
  /** The serial number from `pass.json`. */
  serialNumber: string;
}

/** A pass in the user's Apple Wallet (a `PKPass`). */
export interface Pass extends PassIdentifier {
  organizationName: string;
  localizedName: string;
  localizedDescription: string;
  /** Name of the device the pass is on, such as "iPhone" or "Apple Watch". */
  deviceName: string;
  /** `true` if the pass is on a paired device (e.g. Apple Watch) rather than this one. */
  isRemotePass: boolean;
  /** URL that opens the pass in Wallet. {@link openPass} uses it for you. */
  passURL?: string;
  webServiceURL?: string;
  authenticationToken?: string;
  /** The `userInfo` dictionary from `pass.json`. */
  userInfo?: Record<string, unknown>;
}

/** Sent to {@link addPassLibraryListener} when passes your app can access change. */
export interface PassLibraryChangeEvent {
  added: Pass[];
  replaced: Pass[];
  removed: PassIdentifier[];
}

// MARK: - Google Wallet (Android)

/**
 * A Google Wallet pass. Used on Android.
 *
 * - `string`: a signed JWT, or a `https://pay.google.com/gp/v/save/…` link (the JWT is extracted).
 * - `{ jwt }`: a signed JWT from your issuer backend. It can hold several passes.
 * - `{ json }`: an **unsigned** save request (`savePasses`). Google authenticates your app
 *   by its signing certificate, so no backend is needed. Your Android app must be linked to
 *   your issuer account in the Google Pay & Wallet Console.
 */
export type GooglePass = string | { jwt: string } | { json: string | object };

// MARK: - Adding passes

/**
 * One request for every platform. Only the entry for the current platform is used,
 * so you can pass both and skip the `Platform.OS` checks.
 *
 * @example
 * await addPass({ apple: 'https://api.example.com/passes/123.pkpass', google: jwt });
 */
export interface AddPassRequest {
  /** One or more Apple Wallet passes. Used on iOS. */
  apple?: ApplePass | ApplePass[];
  /** A Google Wallet save request. One JWT can hold several passes. Used on Android. */
  google?: GooglePass;
  /** How Apple Wallet asks the user. Defaults to `'sheet'`. iOS only. */
  applePresentation?: ApplePresentation;
}

/**
 * - `'added'`: the passes are in the wallet now. On iOS this includes passes that were
 *   already there.
 * - `'cancelled'`: the user closed the wallet UI without adding the passes.
 */
export type AddPassResult = 'added' | 'cancelled';

// MARK: - Errors

/**
 * `code` of errors thrown by this package. Check it with {@link isWalletError}.
 *
 * - `ERR_WALLET_UNAVAILABLE`: this device has no usable wallet (or the platform has none).
 * - `ERR_WALLET_MISSING_PASS`: the request has no pass for the current platform.
 * - `ERR_WALLET_INVALID_PASS`: the pass data can't be parsed (bad `.pkpass`, base64 or input).
 * - `ERR_WALLET_LOAD_FAILED`: the `.pkpass` couldn't be downloaded or read (iOS).
 * - `ERR_WALLET_BUSY`: another add-pass flow is already on screen.
 * - `ERR_WALLET_PRESENTATION_FAILED`: there's no screen to show the wallet UI on.
 * - `ERR_WALLET_SAVE_FAILED`: Google Wallet rejected the save request. The message has Google's reason.
 * - `ERR_WALLET_PASS_NOT_FOUND`: the pass isn't in the library, or your app lacks the entitlement to see it (iOS).
 * - `ERR_WALLET_INTERNAL`: the wallet reported an unexpected error. Try again later.
 * - `ERR_UNAVAILABLE`: the function isn't available on this platform.
 */
export type WalletErrorCode =
  | 'ERR_WALLET_UNAVAILABLE'
  | 'ERR_WALLET_MISSING_PASS'
  | 'ERR_WALLET_INVALID_PASS'
  | 'ERR_WALLET_LOAD_FAILED'
  | 'ERR_WALLET_BUSY'
  | 'ERR_WALLET_PRESENTATION_FAILED'
  | 'ERR_WALLET_SAVE_FAILED'
  | 'ERR_WALLET_PASS_NOT_FOUND'
  | 'ERR_WALLET_INTERNAL'
  | 'ERR_UNAVAILABLE';

export type WalletError = CodedError & { code: WalletErrorCode };

// MARK: - Components

export interface AppleWalletButtonProps extends ViewProps {
  /** Called when the user taps the button. Call {@link addPass} from here. */
  onPress?: () => void;
  /**
   * `'black'` (default) for light backgrounds, `'blackOutline'` for dark backgrounds.
   */
  buttonStyle?: 'black' | 'blackOutline';
  disabled?: boolean;
}
