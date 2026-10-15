const { pauseController } = globalThis.GasFinderSpendingPause;

const api = globalThis.browser ?? globalThis.chrome;
const action = pauseController(api);
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only extension pages can operate the pause. No website messaging is exposed.
  if (sender.id !== api.runtime.id || !message || message.kind !== 'shopping-pause') return;
  action(message.command).then(state => sendResponse({ state }), error => sendResponse({ error: error instanceof Error ? error.message : 'Could not update checkout blocking. Reopen Spending Pause and try again.' }));
  return true; // Keep the async response channel open in both Safari and Chrome.
});
api.runtime.onStartup.addListener(() => { void action({ type: 'get' }).catch(() => {}); });
api.runtime.onInstalled.addListener(() => { void action({ type: 'get' }).catch(() => {}); });

api.alarms?.onAlarm.addListener(alarm => { if (alarm.name === 'pause-override') void action({ type: 'end-override' }).catch(() => {}); });
