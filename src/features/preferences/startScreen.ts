export type StartScreen = 'index' | 'investment' | 'pocket' | 'subscriptions';

/** A normal launch follows the saved preference; explicit links keep their route. */
export function initialStartPath(pathname: string, start: StartScreen, incoming: string | null) {
  const bootstrap = incoming && (/^https?:\/\/[^/]+\/?$/.test(incoming) || /^exps?:\/\/[^/?#]+\/(?:--\/?)?$/.test(incoming) || /^exps?:\/\/[^/?#]+$/.test(incoming) || /^[a-z][a-z\d+.-]*:\/\/expo-development-client\/?\?[^#]*\burl=/.test(incoming));
  if (pathname !== '/' || start === 'index' || incoming && !bootstrap) return null;
  return `/${start}` as '/investment' | '/pocket' | '/subscriptions';
}
