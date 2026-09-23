import { Platform } from 'react-native';

import { addPass, canAddPasses, getPasses, hasPass } from '..';
import * as mock from '../../mocks/ExpoWallet';
import type { ExpoWalletModule } from '../ExpoWalletModule';

// No jest.mock() here: this is what an app's tests see with the jest-expo preset.

type NativeFunctions = Pick<
  ExpoWalletModule,
  | 'canAddPasses'
  | 'addPasses'
  | 'replacePass'
  | 'containsPass'
  | 'getPasses'
  | 'getPass'
  | 'removePass'
  | 'openPass'
  | 'savePassesJwt'
  | 'savePasses'
>;

it('implements every native function with the right signature', () => {
  const typed: NativeFunctions = mock;
  expect(Object.keys(typed).sort()).toEqual(
    [
      'addPasses',
      'canAddPasses',
      'containsPass',
      'getPass',
      'getPasses',
      'openPass',
      'removePass',
      'replacePass',
      'savePasses',
      'savePassesJwt',
    ].sort()
  );
});

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  it('is loaded automatically by jest-expo', async () => {
    await expect(canAddPasses()).resolves.toBe(true);
    await expect(addPass({ apple: 'https://example.com/a.pkpass', google: 'eyJ' })).resolves.toBe(
      'added'
    );
  });
}

if (Platform.OS === 'ios') {
  it('returns empty library results', async () => {
    await expect(getPasses()).resolves.toEqual([]);
    await expect(hasPass({ passTypeIdentifier: 'pass.a', serialNumber: '1' })).resolves.toBe(false);
  });
}
