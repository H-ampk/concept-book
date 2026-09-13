const AUTH_QUERY_KEYS = ["code", "state", "error", "error_code", "error_description", "sb_flow_id"];

const AUTH_HASH_MARKERS = ["access_token", "refresh_token", "provider_token", "token_type"];

const hasAuthHash = (hash: string): boolean => AUTH_HASH_MARKERS.some((marker) => hash.includes(marker));

/**
 * Magic Link / PKCE の callback パラメータを URL から除く。
 * アプリは URL ルーティングを主に使わないが、refresh で code が再利用されないようにする。
 */
export const stripAuthCallbackFromLocation = (
  locationHref: string = typeof window !== "undefined" ? window.location.href : "",
  replaceState: (url: string) => void = (url) => {
    if (typeof window === "undefined") {
      return;
    }
    window.history.replaceState(window.history.state, "", url);
  }
): void => {
  if (!locationHref) {
    return;
  }

  try {
    const url = new URL(locationHref);
    let changed = false;

    AUTH_QUERY_KEYS.forEach((key) => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });

    if (url.hash && hasAuthHash(url.hash)) {
      url.hash = "";
      changed = true;
    }

    if (!changed) {
      return;
    }

    replaceState(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL 解析に失敗しても認証・本体へ影響させない。
  }
};
