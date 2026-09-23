# expo-wallet

Add passes to **Apple Wallet** (iOS, PassKit) and **Google Wallet** (Android, Google Pay API) from one API, built with the Expo Modules API.

```tsx
import { AppleWalletButton, addPass } from '@kyzegs/expo-wallet';

<AppleWalletButton
  onPress={() =>
    addPass({
      apple: { uri: `${API}/passes/${id}.pkpass`, headers: { Authorization: `Bearer ${token}` } },
      google: googleJwt,
    })
  }
/>;
```

- **One call for both platforms.** Pass the Apple and Google versions together; each platform uses its own.
- **No extra dependencies.** Remote `.pkpass` files are downloaded natively, so you don't need `expo-file-system`. Binary data from `fetch` goes straight to native, with no base64 step.
- **The native features, typed:** the official Add to Apple Wallet button, the add-pass sheet or alert, pass library lookup, open/remove/replace, library change events, Google's JWT and unsigned JSON save APIs, and typed error codes.
- **Config plugin** for the iOS pass-type entitlement.

## Installation

```bash
npx expo install @kyzegs/expo-wallet
```

This package has native code, so it doesn't run in Expo Go. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:ios` / `npx expo run:android`). It requires iOS 16.4+.

### Config plugin (optional)

Adding passes, and checking one with `hasPass(pass)`, needs no setup. To **list, look up by ID, open, replace or remove** passes on iOS, your app needs the `com.apple.developer.pass-type-identifiers` entitlement for those pass types:

```json
{
  "expo": {
    "plugins": [["@kyzegs/expo-wallet", { "passTypeIdentifiers": ["pass.com.example.ticket"] }]]
  }
}
```

Identifiers get your team prefix automatically. `["*"]` allows every pass type of your team. Enable the Wallet capability for your App ID in the Apple Developer portal too.

## What's supported

| Feature | iOS (Apple Wallet) | Android (Google Wallet) | Web |
| --- | --- | --- | --- |
| `canAddPasses()` | ✅ | ✅ | `false` |
| `addPass()` | ✅ `.pkpass` from URL, file, base64 or bytes; sheet or alert | ✅ signed JWT or unsigned JSON | Use `getGoogleWalletSaveUrl()` |
| `<AppleWalletButton>` | ✅ `PKAddPassButton` | Renders nothing | Renders nothing |
| `hasPass()` | ✅ | ❌ No on-device API. Use the Google Wallet REST API | ❌ |
| `getPasses()`, `getPass()` | ✅ | ❌ | ❌ |
| `openPass()`, `removePass()`, `replacePass()` | ✅ | ❌ | ❌ |
| `addPassLibraryListener()` | ✅ | Never fires | Never fires |
| `getGoogleWalletSaveUrl()` | ✅ (any platform) | ✅ | ✅ |

## Usage

### Show a button when the wallet is available

```tsx
import { AppleWalletButton, addPass, canAddPasses } from '@kyzegs/expo-wallet';

const [available, setAvailable] = useState(false);
useEffect(() => {
  canAddPasses().then(setAvailable);
}, []);

if (!available) return null;

return Platform.OS === 'ios' ? (
  <AppleWalletButton onPress={onAdd} />
) : (
  <AddToGoogleWalletButton onPress={onAdd} /> // your button made from Google's assets
);
```

`AppleWalletButton` renders Apple's own `PKAddPassButton`, which the system localizes and draws to match Apple's guidelines. It defaults to 48pt high; set `style` for another size. Use `buttonStyle="blackOutline"` on dark backgrounds.

Google doesn't ship a native button. Use their [Add to Google Wallet button assets](https://developers.google.com/wallet/generic/resources/brand-guidelines) in a `Pressable`.

### Add passes

```ts
const result = await addPass({
  apple: 'https://api.example.com/passes/123.pkpass',
  google: jwt,
});
if (result === 'added') {
  // The pass is in the wallet.
}
```

`addPass` resolves `'added'` or `'cancelled'`. On iOS, `'added'` also covers passes that were already in Wallet. Failures reject with a [wallet error](#errors).

**Apple passes** (`apple`, one or an array):

| Input | Use it for |
| --- | --- |
| `'https://…'` or `{ uri, headers? }` | A pass your server generates. Downloaded natively, with `headers` for auth. |
| `'file://…'` | A pass already on disk |
| `'data:application/vnd.apple.pkpass;base64,…'` or `{ base64 }` | A pass your API returns as base64 |
| `{ data: Uint8Array \| ArrayBuffer }` | Bytes you fetched yourself: `{ data: await res.arrayBuffer() }` |

Several Apple passes are loaded in parallel and shown together. Set `applePresentation: 'alert'` to use Apple's compact **Add All / Review** alert instead of the full sheet. Apple suggests the alert for passes the user just created, such as a ticket they bought or several boarding passes.

**Google passes** (`google`):

| Input | Use it for |
| --- | --- |
| `'eyJ…'` or `{ jwt }` | A JWT signed by your backend. One JWT can hold several passes. A `https://pay.google.com/gp/v/save/…` link works too. |
| `{ json }` | An unsigned save request (object or string) for apps without a backend. Google checks your app's signing certificate, so link your Android app to your issuer account in the Google Pay & Wallet Console first. |

### Web and Android fallback

On the web, or on Android devices without Google Wallet, link to Google's save page:

```ts
import { getGoogleWalletSaveUrl } from '@kyzegs/expo-wallet';

Linking.openURL(getGoogleWalletSaveUrl(jwt));
```

Keep JWTs under ~1800 characters for links. To stay under that, create the pass class and object on your backend first and put only their IDs in the JWT.

### Apple Wallet pass library (iOS)

Check whether a pass is in Wallet by passing the pass itself (any `apple` input). This needs no entitlement:

```ts
const inWallet = await hasPass('https://api.example.com/passes/123.pkpass');
```

Everything else needs the [entitlement](#config-plugin-optional) and only sees passes whose type identifiers are in it:

```ts
import {
  addPassLibraryListener,
  getPasses,
  hasPass,
  openPass,
  removePass,
  replacePass,
} from '@kyzegs/expo-wallet';

const ticket = { passTypeIdentifier: 'pass.com.example.ticket', serialNumber: '123' };

if (await hasPass(ticket)) {
  await openPass(ticket); // "View in Wallet"
}

const passes = await getPasses(); // Pass[]: names, organization, userInfo, …
await removePass(passes[0]); // any Pass works as an identifier
await replacePass('https://api.example.com/passes/123.pkpass'); // silent update, same serial number

useEffect(() => {
  const subscription = addPassLibraryListener(({ added, replaced, removed }) => refresh());
  return () => subscription.remove();
}, []);
```

These functions throw `ERR_UNAVAILABLE` on other platforms. Google Wallet has no on-device lookup, so check pass state with the [Google Wallet REST API](https://developers.google.com/wallet/reference/rest) from your backend.

### Errors

Errors are `CodedError`s with a `code`. Check them with `isWalletError`:

```ts
import { isWalletError } from '@kyzegs/expo-wallet';

try {
  await addPass(request);
} catch (error) {
  if (isWalletError(error, 'ERR_WALLET_UNAVAILABLE')) {
    // offer the web save link, hide the button, …
  } else {
    throw error;
  }
}
```

| Code | Meaning |
| --- | --- |
| `ERR_WALLET_UNAVAILABLE` | This device or platform has no usable wallet |
| `ERR_WALLET_MISSING_PASS` | The request has no pass for the current platform |
| `ERR_WALLET_INVALID_PASS` | The pass data can't be parsed (bad `.pkpass`, base64 or input) |
| `ERR_WALLET_LOAD_FAILED` | The `.pkpass` couldn't be downloaded (network error or non-2xx HTTP status) or read from disk |
| `ERR_WALLET_BUSY` | Another add-pass flow is already on screen |
| `ERR_WALLET_PRESENTATION_FAILED` | There's no screen to show the wallet UI on |
| `ERR_WALLET_SAVE_FAILED` | Google Wallet rejected the request. The message has Google's reason. |
| `ERR_WALLET_PASS_NOT_FOUND` | The pass isn't in Wallet, or the app lacks the entitlement |
| `ERR_WALLET_INTERNAL` | The wallet reported an unexpected error |
| `ERR_UNAVAILABLE` | The function doesn't exist on this platform |

## Migrating from 0.2

| 0.2 | Now |
| --- | --- |
| `canAddPass()` | `canAddPasses()` |
| `addPass({ ios: { pass: { localUri } }, android: { jwt } })` | `addPass({ apple: localUri, google: jwt })` |
| `addPass({ ios: { passes: [...] } })` | `addPass({ apple: [...] })` |
| `{ localUri }` | `{ uri }` or a plain string |
| `downloadAndAddPass(url, jwt)` | `addPass({ apple: url, google: jwt })`. Downloads natively, and you can remove `expo-file-system`. |
| `hasPass({ ios: { passTypeIdentifier, serialNumber } })` | `hasPass({ passTypeIdentifier, serialNumber })`, or `hasPass(pkpass)` without an entitlement. Throws `ERR_UNAVAILABLE` on Android instead of returning `false`. |
| `addPass()` resolves `boolean` | Resolves `'added' \| 'cancelled'` |
| `ExpoWalletNative` | Removed. Use the exported functions. |

## Example app

`example/` imports the library from `../src`.

```bash
cd example
npm install
npx expo run:ios # or run:android
```

Put a real `.pkpass` URL and Google Wallet JWT in `example/App.tsx`.

## Development

```bash
npm install
npm run build        # TypeScript → build/
npm run build plugin # config plugin → plugin/build/
npm run lint
npm test             # Jest on iOS, Android, web and Node
```

## License

MIT
