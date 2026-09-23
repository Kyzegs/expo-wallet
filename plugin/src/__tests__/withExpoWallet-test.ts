import type { ExpoConfig } from 'expo/config';

import withExpoWallet, { PASS_TYPE_IDENTIFIERS, setPassTypeIdentifiers } from '..';

// A fresh config per call: `createRunOncePlugin` records itself in the config it receives.
const baseConfig = (): ExpoConfig => ({ name: 'app', slug: 'app' });

/** Runs the entitlements mod the plugin registers, like `expo prebuild` would. */
async function runEntitlementsMod(config: ExpoConfig, entitlements: Record<string, any>) {
  const mod = config.mods?.ios?.entitlements;
  if (mod == null) {
    throw new Error('The plugin did not register an iOS entitlements mod.');
  }
  const result = await mod({
    ...config,
    modResults: entitlements,
    modRequest: {
      platform: 'ios',
      modName: 'entitlements',
      projectRoot: '/app',
      platformProjectRoot: '/app/ios',
      introspect: false,
      ignoreExistingNativeFiles: false,
      nextMod: async (modConfig: any) => modConfig,
    },
  } as any);
  return result.modResults;
}

describe(setPassTypeIdentifiers, () => {
  it('adds the team prefix to plain identifiers', () => {
    expect(setPassTypeIdentifiers({}, ['pass.com.example.ticket', '*'])).toEqual({
      [PASS_TYPE_IDENTIFIERS]: [
        '$(TeamIdentifierPrefix)pass.com.example.ticket',
        '$(TeamIdentifierPrefix)*',
      ],
    });
  });

  it('keeps identifiers that already have a team prefix', () => {
    expect(
      setPassTypeIdentifiers({}, ['ABCDE12345.pass.com.example', '$(AppIdentifierPrefix)pass.x'])
    ).toEqual({
      [PASS_TYPE_IDENTIFIERS]: ['ABCDE12345.pass.com.example', '$(AppIdentifierPrefix)pass.x'],
    });
  });

  it('merges with existing identifiers without duplicates and keeps other entitlements', () => {
    const entitlements = {
      'aps-environment': 'development',
      [PASS_TYPE_IDENTIFIERS]: ['$(TeamIdentifierPrefix)pass.com.example.ticket'],
    };
    expect(
      setPassTypeIdentifiers(entitlements, ['pass.com.example.ticket', 'pass.com.example.coupon'])
    ).toEqual({
      'aps-environment': 'development',
      [PASS_TYPE_IDENTIFIERS]: [
        '$(TeamIdentifierPrefix)pass.com.example.ticket',
        '$(TeamIdentifierPrefix)pass.com.example.coupon',
      ],
    });
  });
});

describe('withExpoWallet', () => {
  it('does nothing without pass type identifiers', () => {
    expect(withExpoWallet(baseConfig()).mods).toBeUndefined();
    expect(withExpoWallet(baseConfig(), { passTypeIdentifiers: [] }).mods).toBeUndefined();
  });

  it('writes the entitlement during prebuild', async () => {
    const config = withExpoWallet(baseConfig(), {
      passTypeIdentifiers: [' pass.com.example.ticket '],
    });
    await expect(runEntitlementsMod(config, { 'aps-environment': 'production' })).resolves.toEqual({
      'aps-environment': 'production',
      [PASS_TYPE_IDENTIFIERS]: ['$(TeamIdentifierPrefix)pass.com.example.ticket'],
    });
  });

  it('rejects invalid options with a helpful message', () => {
    expect(() =>
      withExpoWallet(baseConfig(), { passTypeIdentifiers: 'pass.com.example' as any })
    ).toThrow(/must be an array of pass type IDs/);
    expect(() => withExpoWallet(baseConfig(), { passTypeIdentifiers: [''] })).toThrow(
      /must be an array/
    );
  });

  it('only applies once when added twice', () => {
    const config = withExpoWallet(
      withExpoWallet(baseConfig(), { passTypeIdentifiers: ['pass.a'] }),
      {
        passTypeIdentifiers: ['pass.b'],
      }
    );
    expect(config._internal?.pluginHistory?.['@kyzegs/expo-wallet']).toBeDefined();
  });
});
