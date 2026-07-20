import { API_BASE_URL, parseApiResponse, requestApiWithFallback } from "./auth";

const fallbackApiBaseUrl = API_BASE_URL;

export async function createDailyCheck(payload) {
  const response = await requestApiWithFallback(`/dailyCheck`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response, "No se pudo guardar el reporte diario");
}

export async function fetchRecentDailyChecks(limit = 20) {
  const response = await requestApiWithFallback(`/dailyCheck?limit=${limit}`);
  return parseApiResponse(response, "No se pudieron cargar los reportes recientes");
}

export async function fetchDailyChecksByPlaca(placa) {
  const response = await requestApiWithFallback(`/dailyCheck/placa/${encodeURIComponent(placa)}`);
  return parseApiResponse(response, "No se pudieron cargar los reportes por placa");
}

export async function updateDailyCheckById(id, payload, adminKey) {
  const response = await requestApiWithFallback(`/internal/admin/dailyCheck/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-delete-key": adminKey,
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response, "No se pudo actualizar el reporte diario");
}

export async function deleteDailyCheckById(id, adminKey) {
  const response = await requestApiWithFallback(`/internal/admin/dailyCheck/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-admin-delete-key": adminKey,
    },
  });

  return parseApiResponse(response, "No se pudo eliminar el reporte diario");
}

export { API_BASE_URL };
export { fallbackApiBaseUrl as DAILY_CHECK_LOCAL_API_BASE_URL };