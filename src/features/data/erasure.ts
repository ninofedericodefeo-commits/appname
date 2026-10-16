export type ErasureSteps = {
  resetRecords: () => Promise<void>; eraseOriginals: () => Promise<void>; eraseAttachments: () => Promise<void>;
  eraseDrafts: () => Promise<void>; clearRecovery: () => Promise<void>; clearCache: () => void;
  recordCompletion: () => Promise<void>; clearMarker: () => Promise<void>;
};
// Every step must be idempotent. Retain the marker through every fallible cleanup.
export async function completeErasure(steps: ErasureSteps) {
  await steps.resetRecords(); await steps.eraseOriginals(); await steps.eraseAttachments();
  await steps.eraseDrafts(); await steps.clearRecovery(); steps.clearCache();
  await steps.recordCompletion(); await steps.clearMarker();
}
