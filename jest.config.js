const {
  getAndroidPreset,
  getIOSPreset,
  getNodePreset,
  getWebPreset,
  withWatchPlugins,
} = require('jest-expo/config');

// The library's tests run once per platform, so `Platform.OS` and `.ios.tsx` files resolve like
// they do in an app. The config plugin runs in Node during prebuild, so it's tested there.
const libraryRoots = { roots: ['<rootDir>/src'] };

// Watch plugins are only allowed at the top level, which `withWatchPlugins` adds back.
const withoutWatchPlugins = ({ watchPlugins, ...config }) => config;

module.exports = withWatchPlugins({
  projects: [
    { ...getIOSPreset(), ...libraryRoots },
    { ...getAndroidPreset(), ...libraryRoots },
    { ...getWebPreset(), ...libraryRoots },
    { ...getNodePreset(), ...libraryRoots },
    {
      ...getNodePreset(),
      displayName: { name: 'plugin', color: 'magenta' },
      roots: ['<rootDir>/plugin/src'],
    },
  ].map(withoutWatchPlugins),
});
