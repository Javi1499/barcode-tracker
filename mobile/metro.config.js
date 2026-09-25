const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Excluir el backend para que Metro no lo vigile
config.resolver.blockList = [
  /.*[/\\]backend[/\\].*/
];

module.exports = config;
