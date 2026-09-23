import { type ConfigPlugin, createRunOncePlugin, withEntitlementsPlist } from 'expo/config-plugins';

const pkg: { name: string; version: string } = require('../../package.json');

const PASS_TYPE_IDENTIFIERS = 'com.apple.developer.pass-type-identifiers';

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

const withExpoWallet: ConfigPlugin<ExpoWalletPluginProps | void> = (config, props) => {
  const identifiers = props?.passTypeIdentifiers ?? [];
  if (identifiers.length === 0) {
    return config;
  }
  return withEntitlementsPlist(config, (config) => {
    const existing = config.modResults[PASS_TYPE_IDENTIFIERS];
    const current = Array.isArray(existing)
      ? existing.filter((value): value is string => typeof value === 'string')
      : [];
    config.modResults[PASS_TYPE_IDENTIFIERS] = [
      ...new Set([...current, ...identifiers.map(withTeamPrefix)]),
    ];
    return config;
  });
};

export default createRunOncePlugin(withExpoWallet, pkg.name, pkg.version);
