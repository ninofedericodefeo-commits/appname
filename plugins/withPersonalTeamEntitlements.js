const { withEntitlementsPlist } = require('expo/config-plugins');

// expo-notifications applies its config plugin automatically when installed.
// Local scheduled notifications do not need the APNs entitlement it adds.
module.exports = (config) => withEntitlementsPlist(config, (mod) => {
  delete mod.modResults['aps-environment'];
  return mod;
});
