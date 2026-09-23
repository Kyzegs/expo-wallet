// Used by Jest (through jest-expo) to compile the TypeScript sources and tests.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
