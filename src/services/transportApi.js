import { API_BASE_URL } from './auth';

export async function transportRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/transport-kpis${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, credentials: 'include',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || 'No se pudo consultar transporte.');
  return result;
}

export async function downloadTransportExcel(filters) {
  const response = await fetch(`${API_BASE_URL}/transport-kpis/weekly.xlsx?${new URLSearchParams(filters)}`, { credentials: 'include' });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || 'No se pudo exportar el reporte.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `Transporte_${filters.from}_${filters.to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export const usd = value => value == null ? 'Sin dato' : Number(value).toLocaleString('es-VE', { style: 'currency', currency: 'USD' });
export const percent = value => value == null ? 'Sin dato' : `${(Number(value) * 100).toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export async function downloadTripReport(routeId, format = 'xlsx') {
  const response = await fetch(`${API_BASE_URL}/transport-kpis/trips/${encodeURIComponent(routeId)}/export?format=${format}`, { credentials: 'include' });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || 'No se pudo descargar el viaje.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `Liquidacion_${routeId}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}