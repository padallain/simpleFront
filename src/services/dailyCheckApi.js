const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");
const fallbackApiBaseUrl = DEFAULT_LOCAL_API_BASE_URL;

async function requestWithFallback(path, options = {}) {
  const primaryUrl = `${configuredApiBaseUrl}${path}`;

  console.log("[dailyCheckApi] request:start", {
    primaryUrl,
    method: options.method || "GET",
  });

  try {
    const response = await fetch(primaryUrl, options);

    console.log("[dailyCheckApi] request:primary-response", {
      primaryUrl,
      status: response.status,
      ok: response.ok,
      data: response.data
    });

    if (response.status !== 404 || configuredApiBaseUrl === fallbackApiBaseUrl) {
      return response;
    }

    console.warn("[dailyCheckApi] Primary API returned 404, retrying against local backend", {
      primaryUrl,
      fallbackUrl: `${fallbackApiBaseUrl}${path}`,
    });
  } catch (error) {
    if (configuredApiBaseUrl === fallbackApiBaseUrl) {
      throw error;
    }

    console.warn("[dailyCheckApi] Primary API request failed, retrying against local backend", {
      primaryUrl,
      fallbackUrl: `${fallbackApiBaseUrl}${path}`,
      error: error.message,
    });
  }

  const fallbackUrl = `${fallbackApiBaseUrl}${path}`;
  const fallbackResponse = await fetch(fallbackUrl, options);

  console.log("[dailyCheckApi] request:fallback-response", {
    fallbackUrl,
    status: fallbackResponse.status,
    ok: fallbackResponse.ok,
  });

  return fallbackResponse;
}

async function parseResponse(response, defaultMessage) {
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || defaultMessage);
  }

  return result;
}

export async function createDailyCheck(payload) {
  const response = await requestWithFallback(`/dailyCheck`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, "No se pudo guardar el reporte diario");
}

export async function fetchRecentDailyChecks(limit = 20) {
  const response = await requestWithFallback(`/dailyCheck?limit=${limit}`);
  return parseResponse(response, "No se pudieron cargar los reportes recientes");
}

export async function fetchDailyChecksByPlaca(placa) {
  const response = await requestWithFallback(`/dailyCheck/placa/${encodeURIComponent(placa)}`);
  return parseResponse(response, "No se pudieron cargar los reportes por placa");
}

export { configuredApiBaseUrl as API_BASE_URL, fallbackApiBaseUrl as DAILY_CHECK_LOCAL_API_BASE_URL };