# expo-wallet

Unified React Native API for **Apple Wallet** (iOS / PassKit) and **Google Wallet** (Android / Google Pay Wallet API), built with the **Expo Modules API** (Swift + Kotlin).

Networking stays in JavaScript: download `.pkpass` files with [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/) (or your HTTP client), then pass `file://` URIs or base64 to iOS. On Android, pass the **JWT** string from your issuer backend (one JWT can encode multiple passes).

## Installation

In an app that uses Expo dev/build clients:

```bash
npx expo install expo-wallet
```

For **Android**, add Google Play Services Pay to the library (already declared in this package’s `android/build.gradle`):

```groovy
implementation("com.google.android.gms:play-services-pay:16.5.0")
```

(Rebuild the native app after installing the module.)

## API

```ts
import {
  canAddPass,
  addPass,
  hasPass,
  downloadAndAddPass,
} from 'expo-wallet';
```

- **`canAddPass()`** — Whether the device can show the native add-pass flow (`PKAddPassesViewController` / Pay API availability).
- **`addPass(options)`** — Platform-specific options:
  - **iOS:** `options.ios.pass` and/or `options.ios.passes` with `localUri` (`file://...`) and/or `base64` (raw `.pkpass` bytes, base64-encoded).
  - **Android:** `options.android.jwt` — signed JWT from your Google Wallet issuer backend (supports one or many passes in a single token).
- **`hasPass(options)`** — **iOS:** checks the pass library via PassKit when you provide `passTypeIdentifier` + `serialNumber`. **Android:** not supported on-device; logs a **warning** and returns `false` (use the **Google Wallet REST API** from your backend).
- **`downloadAndAddPass(url, androidJwt?)`** — Optional helper: downloads a remote `.pkpass` with `expo-file-system`, then calls `addPass`. Requires `expo-file-system` in your app.

### iOS: `hasPass` and entitlements

`hasPass` uses `PKPassLibrary`. To query passes your app did not issue, Apple expects the **`com.apple.developer.pass-type-identifiers`** entitlement (and correct setup in the developer portal). Without it, behavior may be limited.

### Android: checking if a pass exists

There is **no** supported client-side check in the Pay / Wallet SDK comparable to `PKPassLibrary`. You must use the **Google Wallet REST API** (from a secure backend) to inspect object state.

## Example app (`example/`)

The example app is configured with TypeScript path aliases to `../src` and **`expo-file-system`** for download demos.

1. From the repo root:

   ```bash
   cd example
   npm install
   ```

2. **iOS:** set a real HTTPS `.pkpass` URL (or use your own `addPass` call with a local `file://` URI).

3. **Android:** paste a real issuer **JWT** from your backend (the placeholder string will fail until replaced).

4. Run:

   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```

### Multiple passes

- **iOS:** pass several entries via `options.ios.passes`, or combine `pass` + `passes` (they are merged into one native batch).
- **Android:** encode multiple pass objects in **one JWT**; the native module still calls `savePassesJwt` once.

## Development

```bash
npm install
npm run build
```

## License

MIT
