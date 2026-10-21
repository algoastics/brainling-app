const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'org.gradle.jvmargs';

/**
 * Raises the Gradle daemon heap: with the full MVP native library set, D8 dex merging runs out
 * of memory with the template's 2 GB default.
 */
module.exports = function withGradleJvmArgs(config, { jvmArgs }) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === KEY),
    );
    cfg.modResults.push({ type: 'property', key: KEY, value: jvmArgs });
    return cfg;
  });
};
