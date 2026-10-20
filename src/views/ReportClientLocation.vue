<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import RouteOsmMap from '../components/RouteOsmMap.vue';
import { API_BASE_URL, getAuthState, parseApiResponse } from '../services/auth';

const isAdmin = computed(() => getAuthState().user?.role === 'admin');
const clientId = ref('');
const clients = ref([]);
const selectedClientKey = ref('');
const selectedClient = computed(() => clients.value.find(client => String(client._id) === selectedClientKey.value) || null);
const details = ref('');
const latitude = ref('');
const longitude = ref('');
const accuracyMeters = ref(null);
const errorMessage = ref('');
const feedback = ref('');
const lookupLoading = ref(false);
const submitLoading = ref(false);
const gpsLoading = ref(false);
const reportsLoading = ref(false);
const reports = ref([]);
const statusFilter = ref('pending');
const reviewingId = ref('');
const reviewNotes = ref({});
const selectedReviewId = ref('');
const selectedReview = computed(() => reports.value.find(report => report._id === selectedReviewId.value) || null);
const proposalForm = ref(null);
const addressMapRef = ref(null);
let lookupSequence = 0;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: 'include',
    headers: { 'Content-Type': 'application/json' } });
  return parseApiResponse(response, 'No se pudo procesar la solicitud de direccion.');
}
const mapsLink = location => location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
  ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : '';
const formatDate = value => value ? new Date(value).toLocaleString('es-VE', { timeZone: 'America/Caracas' }) : 'Sin fecha';
const statusLabel = value => ({ pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', legacy: 'Reporte anterior' }[value] || value);
const proposedLocation = computed(() => latitude.value !== '' && longitude.value !== ''
  && Number.isFinite(Number(latitude.value)) && Math.abs(Number(latitude.value)) <= 90
  && Number.isFinite(Number(longitude.value)) && Math.abs(Number(longitude.value)) <= 180
  ? { latitude: Number(latitude.value), longitude: Number(longitude.value) } : null);
const mapStops = computed(() => {
  const target = selectedReview.value || selectedClient.value;
  const original = selectedReview.value?.clientSnapshot?.location || selectedClient.value?.location;
  const proposed = selectedReview.value?.proposedLocation || proposedLocation.value;
  if (!target || !original) return [];
  return [{ id: 'original', nombre: 'Ubicacion registrada', location: original, order: 1 },
    ...(proposed ? [{ id: 'propuesta', nombre: 'Ubicacion propuesta', location: proposed, order: 2 }] : [])];
});
const mapOrigin = computed(() => mapStops.value[0]?.location || { latitude: 10.6, longitude: -71.6 });

watch(clientId, () => {
  lookupSequence += 1; clients.value = []; selectedClientKey.value = ''; selectedReviewId.value = '';
  latitude.value = ''; longitude.value = ''; accuracyMeters.value = null;
});
watch(selectedClientKey, () => { latitude.value = ''; longitude.value = ''; accuracyMeters.value = null; });
watch([latitude, longitude], () => { accuracyMeters.value = null; });

async function lookupClient() {
  const id = clientId.value.trim();
  if (!id) { errorMessage.value = 'Ingresa el RIF o ID del cliente.'; return; }
  const sequence = ++lookupSequence;
  lookupLoading.value = true; errorMessage.value = ''; feedback.value = ''; selectedReviewId.value = '';
  try {
    const result = await request(`/getClient/${encodeURIComponent(id)}`);
    if (sequence !== lookupSequence) return;
    clients.value = result.esCadena && Array.isArray(result.sedes) ? result.sedes : [result];
    selectedClientKey.value = clients.value.length === 1 ? String(clients.value[0]._id) : '';
  } catch (failure) { if (sequence === lookupSequence) errorMessage.value = failure.message; }
  finally { lookupLoading.value = false; }
}
async function loadReports() {
  reportsLoading.value = true;
  try { reports.value = (await request(`/clientLocationReports?status=${statusFilter.value}`)).reports; }
  catch (failure) { errorMessage.value = failure.message; }
  finally { reportsLoading.value = false; }
}
async function showReviewMap(report) {
  selectedReviewId.value = report._id;
  await nextTick();
  addressMapRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function captureGps() {
  if (!selectedClient.value || !navigator.geolocation) { errorMessage.value = 'Selecciona una sede y usa un dispositivo con GPS.'; return; }
  const target = selectedClientKey.value;
  gpsLoading.value = true; errorMessage.value = '';
  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
    if (selectedClientKey.value !== target) return;
    latitude.value = position.coords.latitude; longitude.value = position.coords.longitude;
    await Promise.resolve();
    accuracyMeters.value = position.coords.accuracy;
  } catch (_failure) { errorMessage.value = 'No se pudo obtener el GPS. Revisa el permiso de ubicacion o ingresa las coordenadas correctas.'; }
  finally { gpsLoading.value = false; }
}
async function submitReport() {
  if (!selectedClient.value || !proposedLocation.value || !proposalForm.value?.reportValidity()) {
    errorMessage.value = 'Busca y selecciona el cliente/sede, indica el punto correcto y describe el cambio.'; return;
  }
  submitLoading.value = true; errorMessage.value = ''; feedback.value = '';
  try {
    const result = await request('/clientLocationReports', { method: 'POST', body: JSON.stringify({
      clientId: selectedClient.value.id, sucursal: selectedClient.value.sucursal || '', details: details.value,
      proposedLocation: proposedLocation.value, accuracyMeters: accuracyMeters.value,
    }) });
    feedback.value = `${result.message} Folio: ${result.reportId}.`;
    details.value = ''; latitude.value = ''; longitude.value = '';
    await loadReports();
  } catch (failure) { errorMessage.value = failure.message; }
  finally { submitLoading.value = false; }
}
async function review(report, decision) {
  const note = reviewNotes.value[report._id] || '';
  if (decision === 'reject' && !note.trim()) { errorMessage.value = 'Escribe el motivo antes de rechazar la solicitud.'; return; }
  if (decision === 'approve' && !window.confirm(`Actualizar la ubicacion de ${report.clientSnapshot?.nombre || report.clientId}, sede ${report.sucursal || 'principal'}, al punto propuesto?`)) return;
  reviewingId.value = report._id; errorMessage.value = ''; feedback.value = '';
  try {
    const result = await request(`/clientLocationReports/${report._id}/${decision}`, { method: 'POST', body: JSON.stringify({ reviewNote: note }) });
    feedback.value = result.message;
    selectedReviewId.value = '';
    clients.value = []; selectedClientKey.value = '';
    await loadReports();
  } catch (failure) { errorMessage.value = failure.message; }
  finally { reviewingId.value = ''; }
}
onMounted(loadReports);
</script>

<template>
  <main class="address-page">
    <header><p>{{ isAdmin ? 'Revision administrativa' : 'Solicitudes del chofer' }}</p><h1>Arreglar direccion</h1></header>
    <p v-if="errorMessage" class="address-error" role="alert">{{ errorMessage }}</p><p v-if="feedback" class="address-success" role="status">{{ feedback }}</p>
    <form class="address-search" @submit.prevent="lookupClient"><label>RIF / ID del cliente<input v-model="clientId" required :disabled="submitLoading" /></label><button type="submit" :disabled="lookupLoading || submitLoading"><i class="mdi mdi-magnify" aria-hidden="true" /> {{ lookupLoading ? 'Buscando...' : 'Buscar cliente' }}</button></form>
    <section v-if="clients.length" class="address-proposal">
      <label>Sede del cliente<select v-model="selectedClientKey" :disabled="submitLoading"><option value="">Seleccionar sede</option><option v-for="client in clients" :key="client._id" :value="String(client._id)">{{ client.nombre }} - {{ client.sucursal || 'Principal' }}</option></select></label>
      <template v-if="selectedClient">
        <div class="address-current"><strong>{{ selectedClient.nombre }}</strong><span>{{ selectedClient.sucursal || 'Sede principal' }}</span><a :href="mapsLink(selectedClient.location)" target="_blank" rel="noreferrer">Ver punto registrado</a><span>{{ selectedClient.location?.latitude }}, {{ selectedClient.location?.longitude }}</span></div>
        <form ref="proposalForm" @submit.prevent="submitReport"><fieldset :disabled="submitLoading || gpsLoading">
          <div class="address-fields"><label>Latitud correcta<input v-model="latitude" type="number" min="-90" max="90" step="any" required /></label><label>Longitud correcta<input v-model="longitude" type="number" min="-180" max="180" step="any" required /></label>
            <label class="address-wide">Direccion correcta / referencia y motivo<textarea v-model="details" rows="3" maxlength="2000" required /></label></div>
          <div class="address-actions"><button type="button" @click="captureGps"><i class="mdi mdi-crosshairs-gps" aria-hidden="true" /> {{ gpsLoading ? 'Obteniendo GPS...' : 'Usar mi ubicacion GPS' }}</button><a v-if="proposedLocation" :href="mapsLink(proposedLocation)" target="_blank" rel="noreferrer">Ver punto propuesto</a><span v-if="accuracyMeters != null">Precision GPS: {{ Math.round(accuracyMeters) }} m</span><button type="submit"><i class="mdi mdi-send-outline" aria-hidden="true" /> {{ submitLoading ? 'Enviando...' : 'Solicitar arreglo' }}</button></div>
        </fieldset></form>
      </template>
    </section>
    <section v-if="mapStops.length" ref="addressMapRef" class="address-map"><RouteOsmMap title="Punto registrado y propuesto" :stops="mapStops" :origin="mapOrigin" :return-to-origin="false" :canvas-min-height="360" /></section>
    <section class="address-history"><div class="address-history-heading"><h2>{{ isAdmin ? 'Solicitudes para revision' : 'Mis solicitudes' }}</h2><div class="address-actions"><label>Estado<select v-model="statusFilter" @change="loadReports"><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option><option v-if="isAdmin" value="legacy">Reportes anteriores</option><option value="all">Todas</option></select></label><button type="button" :disabled="reportsLoading" @click="loadReports"><i class="mdi mdi-refresh" aria-hidden="true" /> Actualizar</button></div></div>
      <div class="address-table"><table><thead><tr><th>Cliente / sede</th><th>Chofer / fecha</th><th>Punto registrado al solicitar</th><th>Punto propuesto</th><th>Motivo</th><th>Estado / revision</th><th></th></tr></thead><tbody><tr v-for="report in reports" :key="report._id"><td>{{ report.clientSnapshot?.nombre || report.clientId }}<small>{{ report.clientId }} · {{ report.sucursal || report.clientSnapshot?.sucursal || 'Principal' }}</small></td><td>{{ report.reporterName }}<small>{{ formatDate(report.createdAt) }}</small></td><td><a v-if="mapsLink(report.clientSnapshot?.location)" :href="mapsLink(report.clientSnapshot.location)" target="_blank" rel="noreferrer">{{ report.clientSnapshot.location.latitude }}, {{ report.clientSnapshot.location.longitude }}</a><small v-if="report.locationChanged">El punto cambio desde esta solicitud.<a v-if="mapsLink(report.currentLocation)" :href="mapsLink(report.currentLocation)" target="_blank" rel="noreferrer"> Ver ubicacion vigente</a></small></td><td><a v-if="mapsLink(report.proposedLocation)" :href="mapsLink(report.proposedLocation)" target="_blank" rel="noreferrer">{{ report.proposedLocation.latitude }}, {{ report.proposedLocation.longitude }}</a><small v-else>Sin propuesta</small></td><td class="address-details">{{ report.details }}</td><td :class="`address-status-${report.status}`">{{ statusLabel(report.status) }}<small v-if="report.reviewedBy?.name">{{ report.reviewedBy.name }} · {{ formatDate(report.reviewedAt) }}</small><small>{{ report.reviewNote }}</small></td><td><button v-if="report.proposedLocation" type="button" title="Comparar puntos en mapa" aria-label="Comparar puntos en mapa" @click="showReviewMap(report)"><i class="mdi mdi-map-marker-outline" aria-hidden="true" /></button><div v-if="isAdmin && report.canReview" class="address-review-actions"><label>Observacion / motivo de rechazo<input v-model="reviewNotes[report._id]" maxlength="2000" :disabled="!!reviewingId" /></label><button type="button" :disabled="!!reviewingId || report.locationChanged" @click="review(report, 'approve')"><i class="mdi mdi-check" aria-hidden="true" /> Aprobar y actualizar</button><button type="button" :disabled="!!reviewingId" @click="review(report, 'reject')"><i class="mdi mdi-close" aria-hidden="true" /> Rechazar</button></div></td></tr></tbody></table></div>
      <p v-if="!reportsLoading && !reports.length">No hay solicitudes para este estado.</p><p v-if="reports.length === 500">Se muestran las 500 solicitudes mas recientes.</p>
    </section>
  </main>
</template>

<style scoped>
.address-page { max-width: 1450px; margin: 0 auto; padding: 24px; color: #f3f6fb; }
.address-page header p { font-size: 13px; color: #b5d8df; margin: 0; }
.address-page h1 { font-size: 28px; margin: 6px 0 20px; } .address-page h2 { font-size: 20px; }
.address-page label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; min-width: 0; }
.address-page input, .address-page select, .address-page textarea { width: 100%; min-width: 0; min-height: 40px; padding: 9px 11px; background: #fff; color: #18343d; border: 1px solid #adc3ca; border-radius: 4px; font: inherit; }
.address-page button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 13px; border: 1px solid #6c919f; border-radius: 4px; background: #245e6d; color: #fff; font: inherit; cursor: pointer; }
.address-page button:disabled { opacity: .55; cursor: default; } .address-page a { color: #98d2e5; }
.address-search, .address-actions, .address-current, .address-history-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.address-search { align-items: flex-end; } .address-search label { flex: 1 1 250px; max-width: 500px; }
.address-proposal { padding: 20px 0; margin: 18px 0; border-top: 1px solid #365561; border-bottom: 1px solid #365561; }
.address-current { margin: 16px 0; font-size: 14px; }
.address-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.address-wide { grid-column: 1 / -1; } .address-page fieldset { border: 0; padding: 0; min-width: 0; }
.address-actions { margin-top: 12px; } .address-map { margin: 20px 0; }
.address-history { margin-top: 24px; } .address-history-heading { justify-content: space-between; }
.address-table { max-height: 600px; overflow: auto; margin-top: 16px; width: 100%; }
.address-table table { width: 100%; min-width: 1100px; border-collapse: collapse; }
.address-table td, .address-table th { padding: 11px 10px; border-bottom: 1px solid #365561; text-align: left; font-size: 13px; vertical-align: top; }
.address-table th { position: sticky; top: 0; z-index: 1; background: #173442; color: #c0d9e1; }
.address-table small { display: block; margin-top: 5px; font-size: 11px; color: #c2d3d9; overflow-wrap: anywhere; }
.address-details { max-width: 250px; white-space: pre-wrap; overflow-wrap: anywhere; }
.address-review-actions { display: grid; gap: 8px; margin-top: 10px; min-width: 205px; }
.address-status-pending { color: #f6d68e; } .address-status-approved, .address-success { color: #99e0b7; }
.address-status-rejected, .address-error { color: #ffb5bc; }
@media (max-width: 640px) { .address-page { padding: 16px 12px; } .address-fields { grid-template-columns: 1fr; } .address-page h1 { font-size: 24px; } }
.report-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(255, 196, 120, 0.22), transparent 28%),
    radial-gradient(circle at top right, rgba(71, 157, 255, 0.18), transparent 34%),
    linear-gradient(180deg, #08111d 0%, #10213c 52%, #08111d 100%);
}

.report-shell {
  max-width: 920px;
  margin: 0 auto;
  color: #f3f6fb;
}

.report-hero {
  margin-bottom: 1.25rem;
}

.report-kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #ffd59a;
}

.report-hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
}

.report-copy {
  max-width: 720px;
  margin-top: 0.8rem;
  color: rgba(243, 246, 251, 0.8);
}

.report-card,
.feedback-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.72);
  border: 1px solid rgba(255, 213, 154, 0.16);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-group-full {
  grid-column: 1 / -1;
}

.field-group label {
  font-weight: 600;
}

.field-group input,
.field-group textarea {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  resize: vertical;
}

.report-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.report-actions button {
  min-height: 46px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
}

.secondary-button {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.primary-button {
  background: linear-gradient(135deg, #ffb34d 0%, #ef6c2f 100%);
}

.report-actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.feedback-error {
  color: #ffb4b4;
}

.feedback-info {
  color: #9fd1ff;
}

.feedback-success {
  color: #8df0b4;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.result-header a {
  color: #ffd59a;
  font-weight: 600;
}

.result-card pre {
  margin: 0.8rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .report-page {
    padding: 1rem 0.75rem 2rem;
  }

  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>