import { API_BASE_URL, parseApiResponse, requestApiWithFallback } from "./auth";

const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:9000";
const fallbackApiBaseUrl = (import.meta.env.VITE_LOCAL_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");

export async function createFuelReport(payload) {
  const response = await requestApiWithFallback("/fuel-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl: fallbackApiBaseUrl,
  });

  return parseApiResponse(response, "No se pudo guardar la recarga de combustible");
}

export async function fetchDailyFuelSummary({ days = 14, placa = "", chofer = "" } = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set("days", String(days));

  if (placa) {
    queryParams.set("placa", String(placa).trim().toUpperCase());
  }

  if (chofer) {
    queryParams.set("chofer", String(chofer).trim());
  }

  const response = await requestApiWithFallback(`/fuel-reports/daily-summary?${queryParams.toString()}`, {}, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl: fallbackApiBaseUrl,
  });

  return parseApiResponse(response, "No se pudo cargar el resumen de combustible");
}
