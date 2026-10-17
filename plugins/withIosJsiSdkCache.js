const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// Keep generated Pods and node_modules untouched by hand. This runs before the
// existing Expo build phase on every build, including builds started in Xcode.
const hook = `    installer.pods_project.targets.each do |target|
      next unless target.name == 'ExpoModulesJSI'
      target.build_phases.each do |phase|
        next unless phase.isa == 'PBXShellScriptBuildPhase' && phase.name == '[CP-User] Build ExpoModulesJSI xcframework'
        guard = 'bash "\${PODS_ROOT}/../../scripts/check-ios-jsi-cache.sh" "\${PODS_TARGET_SRCROOT}" "\${PLATFORM_NAME}" || exit $?'
        phase.shell_script = "#{guard}\\n#{phase.shell_script}" unless phase.shell_script.include?(guard)
      end
    end`;

module.exports = config => withPodfile(config, mod => {
  mod.modResults.contents = mergeContents({
    tag: 'gasfinder-jsi-sdk-cache', src: mod.modResults.contents, newSrc: hook,
    anchor: /post_install do \|installer\|/, offset: 1, comment: '#',
  }).contents;
  return mod;
});
