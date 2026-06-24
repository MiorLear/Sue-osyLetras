// Configuración de Metro: excluye la carpeta de referencia de diseños del bundling.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/[\\/]design-reference[\\/].*/];

module.exports = config;
