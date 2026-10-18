const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const actionKeys = (state: object) => Object.getOwnPropertyNames(state)
  .filter(key => typeof (state as Record<string, unknown>)[key] === 'function');

/** Backup data may extend the saved schema, but may never replace runtime actions. */
export function assertNoPersistedActions(value: unknown, initialState: object, name: string) {
  if (!isRecord(value)) throw new Error(`Backup validation failed: invalid state for ${name}.`);
  if (actionKeys(initialState).some(key => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`Backup validation failed: ${name} contains an app action.`);
  }
}

/** Recover data written by older versions without rehydrating poisoned action keys. */
export function mergePersistedState<State extends object>(persistedState: unknown, currentState: State): State {
  const data = isRecord(persistedState) ? { ...persistedState } : {};
  for (const key of actionKeys(currentState)) delete data[key];
  return { ...currentState, ...data };
}
