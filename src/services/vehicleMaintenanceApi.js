const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:9000";
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");
const fallbackApiBaseUrl = (import.meta.env.VITE_LOCAL_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL).replace(/\/$/, "");

async function requestWithFallback(path, options = {}) {
  const primaryUrl = `${configuredApiBaseUrl}${path}`;

  try {
    const response = await fetch(primaryUrl, options);

    if (response.status !== 404 || configuredApiBaseUrl === fallbackApiBaseUrl) {
      return response;
    }
  } catch (error) {
    if (configuredApiBaseUrl === fallbackApiBaseUrl) {
      throw error;
    }
  }

  return fetch(`${fallbackApiBaseUrl}${path}`, options);
}

async function parseResponse(response, defaultMessage) {
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || defaultMessage);
  }

  return result;
}

export async function createVehicleMaintenance(payload, adminKey) {
  const response = await requestWithFallback(`/vehicle-maintenance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-delete-key": adminKey,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, "No se pudo guardar el mantenimiento");
}

export async function fetchRecentVehicleMaintenance(limit = 30) {
  const response = await requestWithFallback(`/vehicle-maintenance?limit=${limit}`);
  return parseResponse(response, "No se pudo cargar el historial de mantenimiento");
}

export async function fetchUpcomingVehicleMaintenance(limit = 20) {
  const response = await requestWithFallback(`/vehicle-maintenance/upcoming?limit=${limit}`);
  return parseResponse(response, "No se pudo cargar la lista de proximos mantenimientos");
}

export async function fetchVehicleMaintenanceByPlaca(placa) {
  const response = await requestWithFallback(`/vehicle-maintenance/placa/${encodeURIComponent(placa)}`);
  return parseResponse(response, "No se pudo cargar el historial por placa");
}

export async function updateVehicleMaintenanceById(id, payload, adminKey) {
  const response = await requestWithFallback(`/internal/admin/vehicle-maintenance/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-delete-key": adminKey,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, "No se pudo actualizar el mantenimiento");
}

export async function deleteVehicleMaintenanceById(id, adminKey) {
  const response = await requestWithFallback(`/internal/admin/vehicle-maintenance/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-admin-delete-key": adminKey,
    },
  });

  return parseResponse(response, "No se pudo eliminar el mantenimiento");
}

export { configuredApiBaseUrl as API_BASE_URL };