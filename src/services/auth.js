const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");
export const AUTH_ROUTE_PATHS = new Set(["/login", "/signup", "/recover-password"]);

const SESSION_REDIRECT_REASON_KEY = "makeroute.sessionRedirectReason";
const AUTH_TOKEN_STORAGE_KEY = "makeroute.authToken";

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

function getHeaderValue(headers, key) {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  const normalizedKey = key.toLowerCase();

  if (Array.isArray(headers)) {
    const foundEntry = headers.find(([entryKey]) => String(entryKey).toLowerCase() === normalizedKey);
    return foundEntry ? foundEntry[1] : null;
  }

  return headers[key] || headers[normalizedKey] || null;
}

function withApiDefaults(options = {}) {
  const headers = new Headers(options.headers || {});
  const authToken = getStoredAuthToken();

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return {
    ...options,
    headers,
    credentials: options.credentials || "include",
  };
}

function getStoredAuthToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
}

function setStoredAuthToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function canUseLocalFallback(fallbackBaseUrl) {
  if (!fallbackBaseUrl || fallbackBaseUrl === API_BASE_URL) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const hostname = String(window.location.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
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
  setStoredAuthToken("");
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

function handleUnauthorizedResponse(requestUrl, requestOptions, response) {
  if (response.status !== 401) {
    return;
  }

  if (getHeaderValue(requestOptions.headers, "x-skip-auth-redirect")) {
    return;
  }

  if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
    const redirectReason = authState.authenticated ? "session-expired" : "auth-required";
    redirectToLogin(redirectReason);
  }
}

async function fetchWithSession(url, options = {}) {
  const requestOptions = withApiDefaults(options);
  const response = await fetch(url, requestOptions);

  handleUnauthorizedResponse(url, requestOptions, response);
  return response;
}

export async function requestApiWithFallback(path, options = {}, {
  apiBaseUrl = API_BASE_URL,
  fallbackBaseUrl = DEFAULT_LOCAL_API_BASE_URL,
  retryOnStatus = 404,
} = {}) {
  const primaryUrl = `${apiBaseUrl}${path}`;
  const shouldTryFallback = canUseLocalFallback(fallbackBaseUrl);

  try {
    const response = await fetchWithSession(primaryUrl, options);

    if (response.status !== retryOnStatus || !shouldTryFallback) {
      return response;
    }
  } catch (error) {
    if (!shouldTryFallback) {
      throw error;
    }
  }

  return fetchWithSession(`${fallbackBaseUrl}${path}`, options);
}

export async function parseApiResponse(response, defaultMessage) {
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || defaultMessage);
  }

  return result;
}

export async function fetchSession({ force = false } = {}) {
  if (!force && authState.checked) {
    return getAuthState();
  }

  if (!force && sessionRequest) {
    return sessionRequest;
  }

  sessionRequest = (async () => {
    try {
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
    } catch (error) {
      console.warn("[auth] session check failed", error);
      clearAuthState();
      return getAuthState();
    }
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

  setStoredAuthToken(result?.token || "");
  setAuthenticatedUser(result?.user || null);

  const sessionState = await fetchSession({ force: true });

  if (!sessionState.authenticated) {
    clearAuthState();
    throw new Error("La sesion no pudo mantenerse despues del inicio. Revisa cookies del navegador o la configuracion del servidor.");
  }

  storeRedirectReason("");
  return result;
}

export async function registerUser({ email, username, password }) {
  const response = await fetch(`${API_BASE_URL}/register`, withApiDefaults({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-skip-auth-redirect": "true",
    },
    body: JSON.stringify({ email, username, password }),
  }));

  const result = await parseJson(response);

  if (!response.ok) {
    throw new Error(result?.message || "No se pudo crear la cuenta");
  }

  return result;
}

export async function logoutSession() {
  const response = await fetchWithSession(`${API_BASE_URL}/logout`, {
    method: "POST",
    headers: {
      "x-skip-auth-redirect": "true",
    },
  });

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

    if (isTrackedApiRequest) {
      const requestUrl = typeof input === "string" ? input : input.url;
      handleUnauthorizedResponse(requestUrl, requestOptions, response);
    }

    return response;
  };

  fetchInterceptorInstalled = true;
}