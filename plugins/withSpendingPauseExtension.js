const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const TARGET = 'SpendingPauseExtension';

// This plugin owns generated extension files. Never hand-edit ios/.
function writeExtension(projectRoot, platformRoot, version, buildNumber) {
  const directory = path.join(platformRoot, TARGET);
  fs.mkdirSync(directory, { recursive: true });
  fs.rmSync(path.join(directory, 'Resources'), { recursive: true, force: true });
  fs.cpSync(path.join(projectRoot, 'extensions/spending-pause'), path.join(directory, 'Resources'), { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'native/spending-pause/SafariWebExtensionHandler.swift'), path.join(directory, 'SafariWebExtensionHandler.swift'));
  fs.writeFileSync(path.join(directory, 'Info.plist'), plist.build({
    CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)', CFBundleDisplayName: 'GasFinder Spending Pause',
    CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleInfoDictionaryVersion: '6.0', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: 'XPC!',
    CFBundleShortVersionString: version, CFBundleVersion: buildNumber,
    NSExtension: { NSExtensionPointIdentifier: 'com.apple.Safari.web-extension', NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler' },
  }));
}

function addExtension(project, bundleIdentifier, version, buildNumber, team) {
  const existing = project.pbxTargetByName(TARGET);
  const target = existing ? { pbxNativeTarget: existing } : project.addTarget(TARGET, 'app_extension', TARGET, bundleIdentifier);
  const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const reference of configurations.buildConfigurations) {
    const settings = project.pbxXCBuildConfigurationSection()[reference.value].buildSettings;
    Object.assign(settings, { INFOPLIST_FILE: `${TARGET}/Info.plist`, SWIFT_VERSION: '5.0',
      IPHONEOS_DEPLOYMENT_TARGET: '16.4', TARGETED_DEVICE_FAMILY: '"1,2"',
      APPLICATION_EXTENSION_API_ONLY: 'YES', GENERATE_INFOPLIST_FILE: 'NO',
      CURRENT_PROJECT_VERSION: buildNumber, MARKETING_VERSION: version, CODE_SIGN_STYLE: 'Automatic',
      PRODUCT_BUNDLE_IDENTIFIER: bundleIdentifier,
      ...(team ? { DEVELOPMENT_TEAM: team } : {}) });
  }
  if (existing) return; // Refresh settings without duplicating native targets or build phases.
  project.addBuildPhase([`${TARGET}/SafariWebExtensionHandler.swift`], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([`${TARGET}/Resources`], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  for (const reference of Object.values(project.pbxFileReferenceSection())) {
    if (typeof reference === 'object' && reference.path?.replaceAll('"', '') === `${TARGET}/Resources`) reference.lastKnownFileType = 'folder';
  }
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  project.addFramework('SafariServices.framework', { target: target.uuid, link: true });
}

module.exports = config => {
  const identifier = `${config.ios.bundleIdentifier}.spendingpause`;
  const version = config.version ?? '1.0.0', buildNumber = config.ios.buildNumber ?? '1';
  // EAS must provision the extension along with its containing application.
  const extra = config.extra ?? {}, eas = extra.eas ?? {}, build = eas.build ?? {}, experimental = build.experimental ?? {}, ios = experimental.ios ?? {};
  config.extra = { ...extra, eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: { ...ios,
    appExtensions: [...(ios.appExtensions ?? []).filter(item => item.targetName !== TARGET), { targetName: TARGET, bundleIdentifier: identifier, entitlements: {} }],
  } } } } };
  config = withDangerousMod(config, ['ios', mod => {
    writeExtension(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot, version, buildNumber); return mod;
  }]);
  return withXcodeProject(config, mod => {
    addExtension(mod.modResults, identifier, version, buildNumber, config.ios.appleTeamId); return mod;
  });
};
module.exports.addExtension = addExtension;
module.exports.writeExtension = writeExtension;
