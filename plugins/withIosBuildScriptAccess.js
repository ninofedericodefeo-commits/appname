const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withIosBuildScriptAccess(config) {
  return withXcodeProject(config, (config) => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();

    for (const configuration of Object.values(configurations)) {
      if (configuration?.buildSettings?.ENABLE_USER_SCRIPT_SANDBOXING === 'YES') {
        configuration.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }

    return config;
  });
};
