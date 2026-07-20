import { API_BASE_URL, parseApiResponse, requestApiWithFallback } from "./auth";

const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:9000";
const fallbackApiBaseUrl = (import.meta.env.VITE_LOCAL_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");

export async function createVehicleMaintenance(payload, adminKey) {
  const response = await requestApiWithFallback(`/vehicle-maintenance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-delete-key": adminKey,
    },
    body: JSON.stringify(payload),
  }, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });

  return parseApiResponse(response, "No se pudo guardar el mantenimiento");
}

export async function fetchRecentVehicleMaintenance(limit = 30) {
  const response = await requestApiWithFallback(`/vehicle-maintenance?limit=${limit}`, {}, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });
  return parseApiResponse(response, "No se pudo cargar el historial de mantenimiento");
}

export async function fetchUpcomingVehicleMaintenance(limit = 20) {
  const response = await requestApiWithFallback(`/vehicle-maintenance/upcoming?limit=${limit}`, {}, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });
  return parseApiResponse(response, "No se pudo cargar la lista de proximos mantenimientos");
}

export async function fetchVehicleMaintenanceByPlaca(placa) {
  const response = await requestApiWithFallback(`/vehicle-maintenance/placa/${encodeURIComponent(placa)}`, {}, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });
  return parseApiResponse(response, "No se pudo cargar el historial por placa");
}

export async function updateVehicleMaintenanceById(id, payload, adminKey) {
  const response = await requestApiWithFallback(`/internal/admin/vehicle-maintenance/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-delete-key": adminKey,
    },
    body: JSON.stringify(payload),
  }, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });

  return parseApiResponse(response, "No se pudo actualizar el mantenimiento");
}

export async function deleteVehicleMaintenanceById(id, adminKey) {
  const response = await requestApiWithFallback(`/internal/admin/vehicle-maintenance/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-admin-delete-key": adminKey,
    },
  }, {
    apiBaseUrl: API_BASE_URL,
    fallbackBaseUrl,
  });

  return parseApiResponse(response, "No se pudo eliminar el mantenimiento");
}

export { API_BASE_URL };