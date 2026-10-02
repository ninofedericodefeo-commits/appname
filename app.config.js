// A free Apple Personal Team cannot sign apps with Push Notifications or App Groups.
// Keep those capabilities opt-in for builds signed by an enrolled developer team.
module.exports = ({ config }) => {
  const enableIosCapabilities = process.env.EXPO_ENABLE_IOS_CAPABILITIES === '1';
  const plugins = enableIosCapabilities
    ? config.plugins
    : [
        ...config.plugins.filter((plugin) => {
          const name = Array.isArray(plugin) ? plugin[0] : plugin;
          return name !== 'expo-notifications' && name !== 'expo-widgets';
        }),
        './plugins/withPersonalTeamEntitlements',
      ];

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      goalWidgetAvailable: enableIosCapabilities,
    },
  };
};
