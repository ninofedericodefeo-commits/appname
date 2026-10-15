(function (root) {
const DELAYS = [24, 48, 168];
const SHOPS = [
  { domain: 'amazon.com', name: 'Amazon', aliases: ['a.co'] },
  { domain: 'ebay.com', name: 'eBay' },
  { domain: 'walmart.com', name: 'Walmart' },
  { domain: 'target.com', name: 'Target' },
  { domain: 'etsy.com', name: 'Etsy' },
  { domain: 'temu.com', name: 'Temu' },
  { domain: 'shein.com', name: 'SHEIN' },
];

function shoppingDomain(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048 || /[\s\\\x00-\x1f\x7f*]/.test(input.trim())) throw new Error('Enter a shopping website, such as amazon.com.');
  let url;
  try { url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`); }
  catch { throw new Error('Enter a valid website address.'); }
  const domain = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
    domain.length > 253 || !domain.includes('.') || /^\d+(?:\.\d+){3}$/.test(domain) ||
    !domain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) throw new Error('Use a public website address without a login or port.');
  const shop = SHOPS.find(item => [item.domain, ...(item.aliases ?? [])].some(host => domain === host || domain.endsWith(`.${host}`)));
  return shop?.domain ?? domain;
}

function domains(input) {
  if (!Array.isArray(input) || input.length > 30) throw new Error('Choose up to 30 shopping websites.');
  return [...new Set(input.map(shoppingDomain))];
}

function defaultPause() {
  return { enabled: false, delayHours: 24, sites: ['amazon.com', 'ebay.com'], pausedAt: null, reviewAt: null };
}

function readPause(raw) {
  const defaults = defaultPause();
  if (!raw || typeof raw !== 'object') return defaults;
  let sites;
  try { sites = domains(raw.sites); } catch { return defaults; }
  const delayHours = DELAYS.includes(raw.delayHours) ? raw.delayHours : 24;
  const enabled = raw.enabled === true && sites.length > 0 && Number.isSafeInteger(raw.pausedAt) && raw.pausedAt > 0 &&
    Number.isSafeInteger(raw.reviewAt) && raw.reviewAt === raw.pausedAt + delayHours * 3_600_000;
  const override = enabled && raw.override && sites.includes(raw.override.site) && Number.isSafeInteger(raw.override.until) && raw.override.until > 0 ? { site: raw.override.site, until: raw.override.until } : null;
  return { enabled, delayHours, sites, pausedAt: enabled ? raw.pausedAt : null, reviewAt: enabled ? raw.reviewAt : null, ...(override ? { override } : {}) };
}

function changePause(state, command, now = Date.now()) {
  if (!command || typeof command !== 'object') throw new Error('This action is not supported.');
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Could not read the current time.');
  if (command.type === 'configure') {
    if (state.enabled) throw new Error('Finish the current pause before changing websites or its duration.');
    if (!DELAYS.includes(command.delayHours)) throw new Error('Choose 24 hours, 2 days or 7 days.');
    return { ...state, delayHours: command.delayHours, sites: domains(command.sites) };
  }
  if (command.type === 'start') {
    if (state.enabled) return state; // Repeated taps cannot reset or shorten a pause.
    if (!state.sites.length) throw new Error('Choose at least one shopping website.');
    return { ...state, enabled: true, pausedAt: now, reviewAt: now + state.delayHours * 3_600_000 };
  }
  if (command.type === 'override') {
    if (!state.enabled || !state.sites.includes(command.site)) throw Error('Choose a shop in the active pause.');
    return { ...state, override: { site: command.site, until: now + 10 * 60_000 } };
  }
  if (command.type === 'end-override') { const next = { ...state }; delete next.override; return next; }
  if (command.type === 'resume') {
    if (!state.enabled) return state;
    if (now < state.reviewAt) throw new Error('Your cooling-off period is still running.');
    const next = { ...state, enabled: false, pausedAt: null, reviewAt: null }; delete next.override; return next;
  }
  throw new Error('This action is not supported.');
}

function blockingRules(state, now = Date.now()) {
  if (!state.enabled) return [];
  // Match request URLs, not page contents. Product and cart browsing stay available.
  const patterns = [
    '^https?://[^/]+/([^?#]*/)?(checkout|check-out|payment|payments|place-order|place_order|confirm-order)([/?#.]|$)',
    '^https?://(checkout|pay|payments)\\.[^/]+([/?#]|$)',
  ];
  const rules = patterns.map((regexFilter, index) => ({ id: 1000 + index, priority: 1, action: { type: 'block' },
    condition: { requestDomains: state.sites, regexFilter, resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } }));
  if (state.sites.includes('amazon.com')) rules.push({ id: 1100, priority: 1, action: { type: 'block' },
    condition: { requestDomains: ['amazon.com'], regexFilter: '^https?://[^/]+/(gp/buy|buy)([/?#]|$)', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  if (state.sites.includes('ebay.com')) rules.push({ id: 1101, priority: 1, action: { type: 'block' },
    condition: { requestDomains: ['ebay.com'], regexFilter: '^https?://[^/]+/ck([/?#]|$)', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  if (state.override && state.override.until > now && state.sites.includes(state.override.site)) rules.push({ id: 1200, priority: 10, action: { type: 'allow' }, condition: { requestDomains: [state.override.site], resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  return rules;
}

// All extension actions share this queue, including startup and popup reads.
// Update Safari's actual rules before reporting success or saving preferences.
function pauseController(api, clock = Date.now) {
  let pending = Promise.resolve();
  async function rules(state) {
    const current = await api.declarativeNetRequest.getDynamicRules();
    await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: current.map(rule => rule.id), addRules: blockingRules(state, clock()) });
    if (api.alarms) { try { await api.alarms.clear('pause-override'); if (state.override?.until > clock()) await api.alarms.create('pause-override', { when: state.override.until }); } catch (error) { const strict = { ...state }; delete strict.override; await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: blockingRules(state, clock()).map(rule => rule.id), addRules: blockingRules(strict, clock()) }); throw error; } }
  }
  async function run(command) {
    if (!command || typeof command !== 'object') throw new Error('This action is not supported.');
    if (command.type === 'override' && !api.alarms) throw Error('Temporary access is unavailable in this browser build. Keep the pause or use browser settings.');
    const saved = await api.storage.local.get('shoppingPause');
    const previous = readPause(saved.shoppingPause);
    if (command.type === 'get') { await rules(previous); return previous; }
    const next = changePause(previous, command, clock());
    try { await rules(next); } catch (error) { try { await rules(previous); } catch {} throw error; }
    try { await api.storage.local.set({ shoppingPause: next }); }
    catch {
      // A storage failure must not leave a new, unsaved pause behind.
      await rules(previous);
      throw new Error('Could not save this pause. Try again.');
    }
    return next;
  }
  return command => {
    const result = pending.then(() => run(command));
    pending = result.catch(() => {});
    return result;
  };
}

const api = { DELAYS, SHOPS, shoppingDomain, defaultPause, readPause, changePause, blockingRules, pauseController };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.GasFinderSpendingPause = api;
})(globalThis);
