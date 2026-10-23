const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const DIRECTORY = 'PurchaseInboxIntent';
const SOURCE = 'QueueWalletPurchaseIntent.swift';

function writeIntent(projectRoot, platformRoot) {
  const directory = path.join(platformRoot, DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'modules/purchase-inbox/app-target', SOURCE), path.join(directory, SOURCE));
}

function addIntent(project) {
  const target = project.getFirstTarget();
  const relativePath = `${DIRECTORY}/${SOURCE}`;
  // Keep the AppIntent in the main target; a pod-only source is not discovered
  // as an application action by the AppIntents metadata build phase.
  let group = project.findPBXGroupKey({ name: DIRECTORY });
  if (!group) {
    const created = project.addPbxGroup([], DIRECTORY);
    group = created.uuid;
    project.addToPbxGroup(group, project.getFirstProject().firstProject.mainGroup);
  }
  // This is a virtual group: the file reference already includes DIRECTORY.
  // node-xcode otherwise serializes an omitted group path as `undefined`,
  // which Xcode interprets as a real directory. Also repair existing projects.
  delete project.getPBXGroupByKey(group).path;
  if (!project.hasFile(relativePath)) {
    project.addSourceFile(relativePath, { target: target.uuid }, group);
  }
}

module.exports = config => {
  config = withDangerousMod(config, ['ios', mod => {
    writeIntent(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
    return mod;
  }]);
  return withXcodeProject(config, mod => {
    addIntent(mod.modResults);
    return mod;
  });
};
module.exports.writeIntent = writeIntent;
module.exports.addIntent = addIntent;
