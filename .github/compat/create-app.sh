#!/usr/bin/env bash
# Creates a fresh app from Expo's blank-typescript template for one SDK, installs the packed
# package into it (what npm users get), enables the config plugin and type-checks the public API.
#
# Usage: create-app.sh <sdk> <package.tgz> <app-dir>
set -euo pipefail

SDK="$1"
TARBALL="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
APP_DIR="$3"
COMPAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

npx --yes create-expo-app@latest "$APP_DIR" --template "blank-typescript@sdk-$SDK" --yes
cd "$APP_DIR"
npm install --no-audit --no-fund "$TARBALL"

# The package needs iOS 16.4, the default deployment target from SDK 56.
if [ "$SDK" -lt 56 ]; then
  npx expo install expo-build-properties
fi

SDK="$SDK" node <<'NODE'
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const expo = app.expo;
expo.ios = { ...expo.ios, bundleIdentifier: 'dev.expowallet.compat' };
expo.android = { ...expo.android, package: 'dev.expowallet.compat' };
expo.plugins = [
  ...(expo.plugins ?? []),
  ['@kyzegs/expo-wallet', { passTypeIdentifiers: ['pass.dev.expowallet.compat'] }],
];
if (Number(process.env.SDK) < 56) {
  // `expo install` added a bare entry; replace it so the options aren't skipped.
  expo.plugins = expo.plugins.filter((plugin) => plugin !== 'expo-build-properties');
  expo.plugins.push(['expo-build-properties', { ios: { deploymentTarget: '16.4' } }]);
}
fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
NODE

cp "$COMPAT_DIR/WalletUsage.tsx" .
npx tsc --noEmit
