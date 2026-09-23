// Type-checked inside a fresh app for every supported Expo SDK. Uses the whole public API so
// type errors against that SDK's React, React Native and Expo types show up in CI.
import {
  addPass,
  addPassLibraryListener,
  AppleWalletButton,
  canAddPasses,
  getGoogleWalletSaveUrl,
  getPass,
  getPasses,
  hasPass,
  isWalletError,
  openPass,
  removePass,
  replacePass,
  type AddPassResult,
  type Pass,
  type WalletErrorCode,
} from '@kyzegs/expo-wallet';

export async function exercise(bytes: ArrayBuffer, jwt: string): Promise<AddPassResult | null> {
  if (!(await canAddPasses())) {
    return null;
  }
  const subscription = addPassLibraryListener(({ added, replaced, removed }) => {
    console.log(added.length, replaced.length, removed.length);
  });
  try {
    const passes: Pass[] = await getPasses();
    const first = passes[0];
    if (first != null && (await hasPass(first))) {
      await openPass(first);
      await removePass(first);
    }
    await getPass({ passTypeIdentifier: 'pass.dev.expowallet', serialNumber: '1' });
    await hasPass('https://example.com/pass.pkpass');
    await replacePass({ data: bytes });
    return await addPass({
      apple: [
        'https://example.com/a.pkpass',
        { uri: 'https://example.com/b.pkpass', headers: { Authorization: 'Bearer x' } },
        { base64: 'UEsDBA==' },
        { data: new Uint8Array(bytes) },
      ],
      google: { json: { genericObjects: [] } },
      applePresentation: 'alert',
    });
  } catch (error) {
    const code: WalletErrorCode | undefined = isWalletError(error) ? error.code : undefined;
    console.log(code, getGoogleWalletSaveUrl(jwt));
    return null;
  } finally {
    subscription.remove();
  }
}

export function AddToWallet({ onPress }: { onPress: () => void }) {
  return (
    <AppleWalletButton
      onPress={onPress}
      buttonStyle="blackOutline"
      disabled={false}
      style={{ width: 240 }}
    />
  );
}
