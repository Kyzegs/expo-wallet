import { CodedError } from 'expo-modules-core';
import { Platform } from 'react-native';

import {
  addPass,
  addPassLibraryListener,
  canAddPasses,
  hasPass,
  isWalletError,
  replacePass,
} from '..';
import ExpoWallet from '../ExpoWalletModule';

jest.mock('../ExpoWalletModule', () => ({
  __esModule: true,
  default: {
    canAddPasses: jest.fn(async () => true),
    addPasses: jest.fn(async () => 'added'),
    replacePass: jest.fn(async () => true),
    getPass: jest.fn(async () => null),
    containsPass: jest.fn(async () => true),
    savePassesJwt: jest.fn(async () => 'added'),
    savePasses: jest.fn(async () => 'cancelled'),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const mockNative = jest.mocked(ExpoWallet!);

const request = {
  apple: { uri: 'https://example.com/a.pkpass', headers: { Authorization: 'Bearer t' } },
  google: 'eyJ.abc.def',
};

beforeEach(() => jest.clearAllMocks());

if (Platform.OS === 'ios') {
  describe('iOS', () => {
    it('adds Apple passes with the sheet by default', async () => {
      await expect(addPass(request)).resolves.toBe('added');
      expect(mockNative.addPasses).toHaveBeenCalledWith(
        [{ uri: 'https://example.com/a.pkpass', headers: { Authorization: 'Bearer t' } }],
        [],
        'sheet'
      );
      expect(mockNative.savePassesJwt).not.toHaveBeenCalled();
    });

    it('passes the presentation through', async () => {
      await addPass({ apple: ['a', 'b'], applePresentation: 'alert' });
      expect(mockNative.addPasses).toHaveBeenCalledWith([{ uri: 'a' }, { uri: 'b' }], [], 'alert');
    });

    it('requires an Apple pass', async () => {
      await expect(addPass({ google: 'eyJ' })).rejects.toMatchObject({
        code: 'ERR_WALLET_MISSING_PASS',
      });
    });

    it('checks the library for hasPass', async () => {
      mockNative.getPass.mockResolvedValueOnce({
        passTypeIdentifier: 'p',
        serialNumber: 's',
      } as never);
      await expect(hasPass({ passTypeIdentifier: 'p', serialNumber: 's' })).resolves.toBe(true);
      await expect(hasPass({ passTypeIdentifier: 'p', serialNumber: 's' })).resolves.toBe(false);
      expect(mockNative.getPass).toHaveBeenCalledWith('p', 's');
    });

    it('checks the pass itself without the entitlement', async () => {
      await expect(hasPass('https://example.com/a.pkpass')).resolves.toBe(true);
      expect(mockNative.containsPass).toHaveBeenCalledWith(
        { uri: 'https://example.com/a.pkpass' },
        []
      );
      expect(mockNative.getPass).not.toHaveBeenCalled();
    });

    it('replaces a single pass', async () => {
      const data = new Uint8Array([1]);
      await replacePass({ data });
      expect(mockNative.replacePass).toHaveBeenCalledWith({ dataIndex: 0 }, [data]);
    });

    it('subscribes to library changes', () => {
      const listener = jest.fn();
      addPassLibraryListener(listener);
      expect(mockNative.addListener).toHaveBeenCalledWith('onPassLibraryChange', listener);
    });
  });
} else if (Platform.OS === 'android') {
  describe('Android', () => {
    it('adds Google passes with a JWT', async () => {
      await expect(addPass(request)).resolves.toBe('added');
      expect(mockNative.savePassesJwt).toHaveBeenCalledWith('eyJ.abc.def');
      expect(mockNative.addPasses).not.toHaveBeenCalled();
    });

    it('adds Google passes with JSON', async () => {
      await expect(addPass({ google: { json: { genericObjects: [] } } })).resolves.toBe(
        'cancelled'
      );
      expect(mockNative.savePasses).toHaveBeenCalledWith('{"genericObjects":[]}');
    });

    it('requires a Google pass', async () => {
      await expect(addPass({ apple: 'https://a' })).rejects.toMatchObject({
        code: 'ERR_WALLET_MISSING_PASS',
      });
    });

    it('does not support Apple Wallet library functions', async () => {
      await expect(hasPass({ passTypeIdentifier: 'p', serialNumber: 's' })).rejects.toMatchObject({
        code: 'ERR_UNAVAILABLE',
      });
      expect(mockNative.getPass).not.toHaveBeenCalled();
    });

    it('returns an inert listener subscription', () => {
      expect(() => addPassLibraryListener(jest.fn()).remove()).not.toThrow();
      expect(mockNative.addListener).not.toHaveBeenCalled();
    });
  });
} else {
  describe(Platform.OS, () => {
    it('has no wallet to add passes to', async () => {
      await expect(addPass(request)).rejects.toMatchObject({ code: 'ERR_WALLET_UNAVAILABLE' });
    });
  });
}

it('forwards canAddPasses to native', async () => {
  await expect(canAddPasses()).resolves.toBe(true);
});

describe(isWalletError, () => {
  it('recognizes wallet error codes', () => {
    const error = new CodedError('ERR_WALLET_BUSY', 'busy');
    expect(isWalletError(error)).toBe(true);
    expect(isWalletError(error, 'ERR_WALLET_BUSY')).toBe(true);
    expect(isWalletError(error, 'ERR_WALLET_INTERNAL')).toBe(false);
    expect(isWalletError(new CodedError('ERR_SOMETHING_ELSE', 'x'))).toBe(false);
    expect(isWalletError(new Error('x'))).toBe(false);
    expect(isWalletError({ code: 'ERR_WALLET_BUSY' })).toBe(false);
  });
});
