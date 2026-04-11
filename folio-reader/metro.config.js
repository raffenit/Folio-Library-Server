const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove deprecated Metro watcher option added by older Expo SDK defaults
delete config.watcher?.unstable_workerThreads;

// Add support for epub.js and other CJS modules
config.resolver.assetExts.push('db', 'mp3', 'ttf', 'obj', 'png', 'jpg');

module.exports = config;
