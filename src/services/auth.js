const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");
export const AUTH_ROUTE_PATHS = new Set(["/login", "/signup", "/recover-password"]);

const SESSION_REDIRECT_REASON_KEY = "makeroute.sessionRedirectReason";

const authState = {
  checked: false,
  authenticated: false,
  user: null,
};

let sessionRequest = null;
let fetchInterceptorInstalled = false;

function getCurrentHashPath() {
  const hash = window.location.hash || "#/";
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathWithQuery] = normalizedHash.split("#");
  return pathWithQuery || "/";
}

function buildLoginHash(reason, redirectPath = "/") {
  const searchParams = new URLSearchParams();
  if (reason) {
    searchParams.set("reason", reason);
  }
  if (redirectPath && redirectPath !== "/login") {
    searchParams.set("redirect", redirectPath);
  }

  const query = searchParams.toString();
  return `#/login${query ? `?${query}` : ""}`;
}

function isApiRequest(input) {
  const requestUrl = typeof input === "string"
    ? input
    : input instanceof Request
      ? input.url
      : String(input);

  return requestUrl.startsWith(API_BASE_URL);
}

function withApiDefaults(options = {}) {
  return {
    ...options,
    credentials: options.credentials || "include",
  };
}

function storeRedirectReason(reason) {
  if (!reason) {
    sessionStorage.removeItem(SESSION_REDIRECT_REASON_KEY);
    return;
  }

  sessionStorage.setItem(SESSION_REDIRECT_REASON_KEY, reason);
}

export function consumeRedirectReason() {
  const reason = sessionStorage.getItem(SESSION_REDIRECT_REASON_KEY);
  if (reason) {
    sessionStorage.removeItem(SESSION_REDIRECT_REASON_KEY);
  }
  return reason;
}

export function clearAuthState() {
  authState.checked = true;
  authState.authenticated = false;
  authState.user = null;
  sessionRequest = null;
}

export function setAuthenticatedUser(user) {
  authState.checked = true;
  authState.authenticated = true;
  authState.user = user;
}

export function getAuthState() {
  return { ...authState };
}

export function redirectToLogin(reason = "auth-required", redirectPath = getCurrentHashPath()) {
  clearAuthState();
  storeRedirectReason(reason);

  if (AUTH_ROUTE_PATHS.has(redirectPath.split("?")[0])) {
    return;
  }

  const nextHash = buildLoginHash(reason, redirectPath);
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

async function parseJson(response) {
  return response.json().catch(() => null);
}

export async function fetchSession({ force = false } = {}) {
  if (!force && authState.checked) {
    return getAuthState();
  }

  if (!force && sessionRequest) {
    return sessionRequest;
  }

  sessionRequest = (async () => {
    const response = await fetch(`${API_BASE_URL}/session`, withApiDefaults({
      headers: {
        "x-skip-auth-redirect": "true",
      },
    }));

    const result = await parseJson(response);

    if (!response.ok || !result?.authenticated) {
      clearAuthState();
      return getAuthState();
    }

    setAuthenticatedUser(result.user || null);
    return getAuthState();
  })();

  try {
    return await sessionRequest;
  } finally {
    sessionRequest = null;
  }
}

export async function loginWithSession({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/login`, withApiDefaults({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-skip-auth-redirect": "true",
    },
    body: JSON.stringify({ email, password }),
  }));

  const result = await parseJson(response);

  if (!response.ok) {
    throw new Error(result?.message || "No se pudo iniciar sesion");
  }

  setAuthenticatedUser(result?.user || null);
  storeRedirectReason("");
  return result;
}

export async function logoutSession() {
  const response = await fetch(`${API_BASE_URL}/logout`, withApiDefaults({
    method: "POST",
    headers: {
      "x-skip-auth-redirect": "true",
    },
  }));

  clearAuthState();
  return response;
}

export function installApiAuthInterceptor() {
  if (fetchInterceptorInstalled) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const isTrackedApiRequest = isApiRequest(input);
    const requestOptions = isTrackedApiRequest ? withApiDefaults(init) : init;
    const response = await originalFetch(input, requestOptions);

    if (
      isTrackedApiRequest
      && response.status === 401
      && !requestOptions.headers?.["x-skip-auth-redirect"]
    ) {
      redirectToLogin("session-expired");
    }

    return response;
  };

  fetchInterceptorInstalled = true;
}