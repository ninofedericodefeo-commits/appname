// A free Apple Personal Team cannot sign apps with Push Notifications or App Groups.
// Keep those capabilities opt-in for builds signed by an enrolled developer team.
module.exports = ({ config }) => {
  const enableIosCapabilities = process.env.EXPO_ENABLE_IOS_CAPABILITIES === '1';
  // Sharing alone can be enabled for an enrolled team without push or widgets.
  // It still requires App Groups and cannot be signed by a free Personal Team.
  const enableIosSharing = process.env.EXPO_ENABLE_IOS_SHARING === '1' || enableIosCapabilities;
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
    ios: { ...config.ios, infoPlist: { ...config.ios.infoPlist,
      CFBundleDocumentTypes: [
        ...(config.ios.infoPlist.CFBundleDocumentTypes ?? []),
        { CFBundleTypeName: 'Bank statement', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Alternate', LSItemContentTypes: ['com.adobe.pdf', 'public.comma-separated-values-text'] },
      ],
      // iOS gives us an Inbox copy; this works with a free Personal Team.
      LSSupportsOpeningDocumentsInPlace: false,
    } },
    plugins: [...plugins, ['expo-sharing', {
      ios: { enabled: enableIosSharing, activationRule: { supportsText: true, supportsWebUrlWithMaxCount: 1, supportsFileWithMaxCount: 1 } },
      android: { enabled: true, singleShareMimeTypes: ['text/plain', 'application/pdf', 'text/csv'] },
    }]],
    extra: {
      ...config.extra,
      goalWidgetAvailable: enableIosCapabilities,
      mapsShareAvailable: enableIosSharing,
      amazonShareAvailable: enableIosSharing,
    },
  };
};
