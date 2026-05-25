module.exports = function (api) {
  // Cache por NODE_ENV: recomputa quando muda entre 'test' e outros valores.
  // Não usar api.env() aqui porque conflita com api.cache(true).
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      // Em modo test: jsxImportSource padrão (React) — o CSS interop do
      // NativeWind não funciona sem Metro e crasharia o jest.
      ['babel-preset-expo', { jsxImportSource: isTest ? 'react' : 'nativewind' }],
      ...(isTest ? [] : ['nativewind/babel']),
    ],
  };
};
