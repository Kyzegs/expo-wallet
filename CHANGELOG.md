# Changelog

## Unreleased

A redesigned API. See [Migrating from 0.2](README.md#migrating-from-02).

### Breaking changes

- `addPass()` takes `{ apple, google }` instead of `{ ios: { pass, passes }, android: { jwt } }` and resolves `'added' | 'cancelled'` instead of a boolean.
- `canAddPass()` is renamed to `canAddPasses()`.
- `hasPass()` takes `{ passTypeIdentifier, serialNumber }` and throws `ERR_UNAVAILABLE` on Android instead of returning `false`.
- `downloadAndAddPass()` is removed. Pass an `https://` URL to `addPass()` instead; it's downloaded natively. `expo-file-system` is no longer a peer dependency.
- `ExpoWalletNative` is no longer exported.
- iOS rejects the whole request if any pass is invalid, instead of silently skipping it.
- The podspec no longer claims tvOS support. PassKit's add-pass UI doesn't exist there.

### New

- `<AppleWalletButton>`: Apple's native, localized `PKAddPassButton`.
- Apple pass inputs: `https://` URLs with optional `headers`, `file://` and `data:` URIs, base64, and `Uint8Array`/`ArrayBuffer` bytes. Several passes load in parallel.
- `applePresentation: 'alert'` for Apple's compact "Add All / Review" prompt (`PKPassLibrary.addPasses`).
- Google Wallet: unsigned `{ json }` save requests (`savePasses`), save links accepted as input, and `getGoogleWalletSaveUrl()` for web and fallback flows.
- `hasPass()` also takes the pass itself (URL, base64 or bytes), which works without the pass-type-identifiers entitlement.
- iOS pass library: `getPasses()`, `getPass()`, `openPass()`, `removePass()`, `replacePass()` and `addPassLibraryListener()`.
- Typed error codes (`WalletErrorCode`) and `isWalletError()`.
- Config plugin that sets the `com.apple.developer.pass-type-identifiers` entitlement.
- Works without a crash in apps built without the native module (e.g. Expo Go): `canAddPasses()` resolves `false`.
- Supports Expo SDK 53–57. SDK 53–55 apps need iOS 16.4 as their deployment target.
- Jest mock (`mocks/ExpoWallet.ts`) that jest-expo loads automatically in apps' tests.

### Fixes

- Android `canAddPasses()` checks availability for JWT saves (`SAVE_PASSES_JWT`), which is what `addPass()` uses.
- Android save flows launch on the main thread and use a 16-bit request code.
- iOS no longer hangs when the add-pass sheet is swiped away, and rejects a second `addPass()` while one is on screen.
- iOS uses each `PKPassLibrary` on a single thread, as PassKit requires.
