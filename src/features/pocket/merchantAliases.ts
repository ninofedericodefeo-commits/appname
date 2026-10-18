// Keep merchant names as data even when they match JavaScript object properties.
// The prefix is escaped too, so a literal merchant name cannot collide with an
// encoded reserved name. Ordinary persisted keys remain unchanged.
const aliasKeyPrefix = '~gasfinder-alias:';
const reservedKeys = new Set(['__proto__', 'constructor', 'prototype']);

export function merchantAliasStorageKey(key: string): string {
  return reservedKeys.has(key) || key.startsWith(aliasKeyPrefix) ? `${aliasKeyPrefix}${key}` : key;
}

export function getMerchantAlias(aliases: Record<string, string>, key: string): string | undefined {
  const storedKey = merchantAliasStorageKey(key);
  if (!Object.prototype.hasOwnProperty.call(aliases, storedKey)) return undefined;
  const value = aliases[storedKey];
  return typeof value === 'string' ? value : undefined;
}

export function setMerchantAlias(aliases: Record<string, string>, key: string, value: string | null): Record<string, string> {
  const next = { ...aliases }, storedKey = merchantAliasStorageKey(key);
  if (value === null) delete next[storedKey]; else next[storedKey] = value;
  return next;
}

// Only apply when loading the old, unencoded dictionary version. Reading both
// representations at runtime would confuse old literal prefix names with new
// encoded reserved names.
export function migrateLegacyMerchantAliases(legacy: unknown): Record<string, string> {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return {};
  return Object.fromEntries(Object.entries(legacy)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => [merchantAliasStorageKey(key), value]));
}
