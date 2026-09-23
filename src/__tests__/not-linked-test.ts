import { addPass, addPassLibraryListener, canAddPasses } from '..';

// Simulates Expo Go or a build made before the package was installed.
jest.mock('../ExpoWalletModule', () => ({ __esModule: true, default: null }));

it('reports no wallet instead of crashing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(canAddPasses()).resolves.toBe(false);
  await expect(canAddPasses()).resolves.toBe(false);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Expo Go/));
  warn.mockRestore();
});

it('explains why adding a pass fails', async () => {
  await expect(addPass({ apple: 'https://a', google: 'eyJ' })).rejects.toMatchObject({
    code: expect.stringMatching(/^ERR_(UNAVAILABLE|WALLET_UNAVAILABLE)$/),
  });
});

it('returns an inert listener subscription', () => {
  expect(() => addPassLibraryListener(jest.fn()).remove()).not.toThrow();
});
