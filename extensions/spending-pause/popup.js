const { SHOPS, defaultPause, shoppingDomain } = globalThis.GasFinderSpendingPause;

const api = globalThis.browser ?? globalThis.chrome;
const element = id => document.getElementById(id);
let state = defaultPause(), busy = true;
const named = domain => SHOPS.find(shop => shop.domain === domain)?.name ?? domain;

function showError(message = '') { element('error').textContent = message; element('error').hidden = !message; }
function countdown() {
  const remaining = Math.max(0, state.reviewAt - Date.now());
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60), minutes = totalMinutes % 60;
  element('status').textContent = state.enabled ? remaining > 0 ? `${hours}h ${minutes}m to review` : 'Ready to review' : 'Give shopping a little time';
  element('detail').textContent = state.enabled ? `Checkout paused at ${state.sites.length} shop${state.sites.length === 1 ? '' : 's'}. ${remaining > 0 ? `Review after ${new Date(state.reviewAt).toLocaleString()}.` : 'Checkout stays paused until you choose to resume.'}` : 'Choose shops. You can still browse while checkout is paused.';
  element('resume').disabled = busy || remaining > 0;
}
function render() {
  const container = element('shops'); container.replaceChildren();
  for (const domain of [...new Set([...SHOPS.map(shop => shop.domain), ...state.sites])]) {
    const label = document.createElement('label'); label.className = 'shop';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = domain; checkbox.checked = state.sites.includes(domain);
    label.append(checkbox, document.createTextNode(named(domain))); container.append(label);
  }
  element('delay').value = String(state.delayHours);
  element('choices').disabled = busy || state.enabled;
  element('start').hidden = state.enabled; element('start').disabled = busy;
  element('resume').hidden = !state.enabled;
  countdown();
}
async function command(value) {
  const result = await api.runtime.sendMessage({ kind: 'shopping-pause', command: value });
  if (!result?.state) throw new Error(result?.error ?? 'Safari did not confirm this change. Try again.');
  state = result.state;
}
async function act(work) {
  if (busy) return;
  busy = true; showError(); render();
  try { await work(); }
  catch (error) { showError(error instanceof Error ? error.message : 'Could not update your pause. Try again.'); }
  finally { busy = false; render(); }
}
element('settings').addEventListener('submit', event => {
  event.preventDefault();
  const sites = [...element('shops').querySelectorAll('input:checked')].map(input => input.value);
  const delayHours = Number(element('delay').value);
  void act(async () => { await command({ type: 'configure', sites, delayHours }); await command({ type: 'start' }); });
});
element('add').addEventListener('click', () => {
  if (busy || state.enabled) return;
  try {
    const domain = shoppingDomain(element('domain').value);
    const sites = [...new Set([...element('shops').querySelectorAll('input:checked')].map(input => input.value).concat(domain))];
    if (sites.length > 30) throw new Error('Choose up to 30 shopping websites.');
    state = { ...state, sites, delayHours: Number(element('delay').value) }; element('domain').value = ''; showError(); render();
  } catch (error) { showError(error.message); }
});
element('resume').addEventListener('click', () => void act(() => command({ type: 'resume' })));
async function load() {
  try { await command({ type: 'get' }); busy = false; render(); }
  catch { showError('Could not read the extension. Reopen Spending Pause from your browser’s extensions menu.'); }
}
void load();
setInterval(() => { if (state.enabled) countdown(); }, 30_000);
