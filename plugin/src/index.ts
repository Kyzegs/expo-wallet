import { type ConfigPlugin, createRunOncePlugin, withEntitlementsPlist } from 'expo/config-plugins';

const pkg: { name: string; version: string } = require('../../package.json');

export const PASS_TYPE_IDENTIFIERS = 'com.apple.developer.pass-type-identifiers';

export interface ExpoWalletPluginProps {
  /**
   * Apple Wallet pass types your app can read, open, update and remove, such as
   * `['pass.com.example.ticket']`. Use `['*']` for every pass type of your team.
   * Sets the `com.apple.developer.pass-type-identifiers` entitlement. Adding passes doesn't need it.
   */
  passTypeIdentifiers?: string[];
}

/** `pass.com.example` → `$(TeamIdentifierPrefix)pass.com.example`. Prefixed values are kept. */
function withTeamPrefix(identifier: string): string {
  return identifier.startsWith('$(') || /^[A-Z0-9]{10}\./.test(identifier)
    ? identifier
    : `$(TeamIdentifierPrefix)${identifier}`;
}

/** Adds the pass type identifiers to the entitlements, keeping existing values and other keys. */
export function setPassTypeIdentifiers(
  entitlements: Record<string, any>,
  identifiers: string[]
): Record<string, any> {
  const existing = entitlements[PASS_TYPE_IDENTIFIERS];
  const current = Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    ...entitlements,
    [PASS_TYPE_IDENTIFIERS]: [...new Set([...current, ...identifiers.map(withTeamPrefix)])],
  };
}

function validateProps(props: ExpoWalletPluginProps | void): string[] {
  const identifiers = props?.passTypeIdentifiers;
  if (identifiers == null) {
    return [];
  }
  if (
    !Array.isArray(identifiers) ||
    identifiers.some((id) => typeof id !== 'string' || id.trim().length === 0)
  ) {
    throw new Error(
      `${pkg.name}: "passTypeIdentifiers" must be an array of pass type IDs, such as ["pass.com.example.ticket"].`
    );
  }
  return identifiers.map((id) => id.trim());
}

const withExpoWallet: ConfigPlugin<ExpoWalletPluginProps | void> = (config, props) => {
  const identifiers = validateProps(props);
  if (identifiers.length === 0) {
    return config;
  }
  return withEntitlementsPlist(config, (config) => {
    config.modResults = setPassTypeIdentifiers(config.modResults, identifiers);
    return config;
  });
};

export default createRunOncePlugin(withExpoWallet, pkg.name, pkg.version);
