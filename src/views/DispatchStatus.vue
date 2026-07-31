<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const createEmptyTotals = () => ({
  routes: 0,
  activeRoutes: 0,
  completedRoutes: 0,
  totalClients: 0,
  dispatchedCount: 0,
  remainingCount: 0,
  pendingMissingCount: 0,
  totalIssueReports: 0,
  totalIssueItems: 0,
  driversWithHighNoveltyIndicator: 0,
});

const createEmptyIssueInsights = () => ({
  overview: {
    totalIssueReports: 0,
    totalIssueItems: 0,
    driversWithHighNoveltyIndicator: 0,
    thresholdPer100Clients: 20,
  },
  topClients: [],
  topDrivers: [],
});

const createEmptyIssueForm = () => ({
  clientId: "",
  orderNumber: "",
  productId: "",
  novelty: "",
  presentationType: "unidad",
  quantity: 1,
});

const routes = ref([]);
const totals = ref(createEmptyTotals());
const issueInsights = ref(createEmptyIssueInsights());
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("");
const selectedRouteId = ref("");
const routeDetail = ref(null);
const routeReports = ref([]);
const detailLoading = ref(false);
const detailErrorMessage = ref("");
const adminKey = ref("");
const issueForm = ref(createEmptyIssueForm());
const issueFormFeedback = ref("");
const issueFormError = ref("");
const savingIssue = ref(false);

const activeRoutes = computed(() => routes.value.filter((route) => route.status === "active"));
const completedRoutes = computed(() => routes.value.filter((route) => route.status === "completed"));
const recentCompletedRoutes = computed(() => (
  [...completedRoutes.value]
    .sort((currentRoute, nextRoute) => {
      const currentDate = new Date(currentRoute.updatedAt || currentRoute.createdAt || 0).getTime();
      const nextDate = new Date(nextRoute.updatedAt || nextRoute.createdAt || 0).getTime();
      return nextDate - currentDate;
    })
    .slice(0, 10)
));

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return parsedDate.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeRouteId(route) {
  return String(route?.routeId || route?._id || "").trim();
}

function resetIssueForm() {
  issueForm.value = createEmptyIssueForm();
}

function setDefaultIssueClientId() {
  if (issueForm.value.clientId || !routeDetail.value?.stops?.length) {
    return;
  }

  issueForm.value.clientId = String(routeDetail.value.stops[0]?.clientId || "");
}

function getSelectedStopClientName() {
  const selectedClientId = String(issueForm.value.clientId || "");

  if (!selectedClientId || !Array.isArray(routeDetail.value?.stops)) {
    return "";
  }

  const stop = routeDetail.value.stops.find((item) => String(item?.clientId || "") === selectedClientId);
  return stop?.nombre || selectedClientId;
}

async function loadDispatchStatuses() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/route-dispatch-status`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routes.value = [];
      totals.value = createEmptyTotals();
      issueInsights.value = createEmptyIssueInsights();
      errorMessage.value = result?.message || "No se pudo cargar el estatus de despachos.";
      return;
    }

    routes.value = Array.isArray(result?.routes) ? result.routes : [];
    totals.value = result?.totals || createEmptyTotals();
    issueInsights.value = result?.issueInsights || createEmptyIssueInsights();
    feedbackMessage.value = routes.value.length
      ? `Se cargaron ${routes.value.length} rutas.`
      : "No hay rutas guardadas para mostrar.";
  } catch (error) {
    routes.value = [];
    totals.value = createEmptyTotals();
    issueInsights.value = createEmptyIssueInsights();
    errorMessage.value = `Error cargando estatus: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function loadRouteDetail(routeId) {
  const normalizedRouteId = String(routeId || "").trim();

  if (!normalizedRouteId) {
    return;
  }

  selectedRouteId.value = normalizedRouteId;
  detailLoading.value = true;
  detailErrorMessage.value = "";
  issueFormFeedback.value = "";
  issueFormError.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/route-dispatch-status/${encodeURIComponent(normalizedRouteId)}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeDetail.value = null;
      routeReports.value = [];
      detailErrorMessage.value = result?.message || "No se pudo cargar el detalle de la ruta.";
      return;
    }

    routeDetail.value = result?.route || null;
    routeReports.value = Array.isArray(result?.reports) ? result.reports : [];
    resetIssueForm();
    setDefaultIssueClientId();
  } catch (error) {
    routeDetail.value = null;
    routeReports.value = [];
    detailErrorMessage.value = `Error cargando detalle de ruta: ${error.message}`;
  } finally {
    detailLoading.value = false;
  }
}

async function toggleRouteDetail(route) {
  const routeId = normalizeRouteId(route);

  if (!routeId) {
    return;
  }

  if (selectedRouteId.value === routeId && routeDetail.value) {
    selectedRouteId.value = "";
    routeDetail.value = null;
    routeReports.value = [];
    detailErrorMessage.value = "";
    issueFormFeedback.value = "";
    issueFormError.value = "";
    return;
  }

  await loadRouteDetail(routeId);
}

async function submitAdminIssue() {
  const routeId = String(routeDetail.value?.routeId || selectedRouteId.value || "").trim();
  const clientId = String(issueForm.value.clientId || "").trim();
  const orderNumber = String(issueForm.value.orderNumber || "").trim();
  const productId = String(issueForm.value.productId || "").trim();
  const novelty = String(issueForm.value.novelty || "").trim();
  const presentationType = String(issueForm.value.presentationType || "").trim().toLowerCase();
  const quantity = Number(issueForm.value.quantity);

  issueFormFeedback.value = "";
  issueFormError.value = "";

  if (!adminKey.value.trim()) {
    issueFormError.value = "Ingresa la clave de administrador para registrar la novedad.";
    return;
  }

  if (!routeId || !clientId || !orderNumber || !productId || !novelty) {
    issueFormError.value = "Completa cliente, pedido, producto y descripcion de novedad.";
    return;
  }

  if (!["caja", "unidad"].includes(presentationType)) {
    issueFormError.value = "El tipo de presentacion debe ser caja o unidad.";
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    issueFormError.value = "La cantidad debe ser un numero entero mayor o igual a 1.";
    return;
  }

  savingIssue.value = true;

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/driver-routes/${encodeURIComponent(routeId)}/stops/${encodeURIComponent(clientId)}/issues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-delete-key": adminKey.value.trim(),
      },
      body: JSON.stringify({
        orderNumber,
        items: [
          {
            productId,
            novelty,
            presentationType,
            quantity,
          },
        ],
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      issueFormError.value = result?.message || "No se pudo registrar la novedad.";
      return;
    }

    const selectedClientName = getSelectedStopClientName();
    issueFormFeedback.value = `Novedad registrada para ${selectedClientName || clientId}.`;
    resetIssueForm();
    setDefaultIssueClientId();
    await Promise.all([loadDispatchStatuses(), loadRouteDetail(routeId)]);
  } catch (error) {
    issueFormError.value = `Error registrando novedad: ${error.message}`;
  } finally {
    savingIssue.value = false;
  }
}

onMounted(() => {
  loadDispatchStatuses();
});
</script>

<template>
  <section class="dispatch-status-page">
    <div class="dispatch-shell">
      <div class="hero-panel">
        <div>
          <p class="eyebrow">Monitoreo logistico</p>
          <h1>Estatus de despachos</h1>
          <p class="hero-copy">
            Revisa como van todas las rutas, cuantos clientes ya se despacharon y cuantos siguen pendientes.
          </p>
        </div>

        <div class="hero-actions">
          <button class="primary-button" type="button" :disabled="loading" @click="loadDispatchStatuses">
            {{ loading ? "Actualizando..." : "Actualizar" }}
          </button>
          <RouterLink class="secondary-link" to="/driver-analytics">
            Analisis choferes
          </RouterLink>
          <RouterLink class="secondary-link" to="/route-management">
            Administrar rutas
          </RouterLink>
        </div>
      </div>

      <div class="summary-grid">
        <article class="summary-card accent-blue">
          <span class="summary-label">Rutas activas</span>
          <strong>{{ totals.activeRoutes }}</strong>
        </article>
        <article class="summary-card accent-green">
          <span class="summary-label">Rutas completadas</span>
          <strong>{{ totals.completedRoutes }}</strong>
        </article>
        <article class="summary-card accent-gold">
          <span class="summary-label">Clientes despachados</span>
          <strong>{{ totals.dispatchedCount }}</strong>
        </article>
        <article class="summary-card accent-red">
          <span class="summary-label">Clientes pendientes</span>
          <strong>{{ totals.remainingCount }}</strong>
        </article>
        <article class="summary-card accent-amber">
          <span class="summary-label">Novedades reportadas</span>
          <strong>{{ totals.totalIssueReports }}</strong>
        </article>
        <article class="summary-card accent-rose-soft">
          <span class="summary-label">Choferes con alto indicador</span>
          <strong>{{ totals.driversWithHighNoveltyIndicator }}</strong>
        </article>
      </div>

      <p v-if="errorMessage" class="feedback error-text">
        {{ errorMessage }}
      </p>

      <p v-else-if="feedbackMessage" class="feedback success-text">
        {{ feedbackMessage }}
      </p>

      <div v-if="issueInsights.topDrivers.length || issueInsights.topClients.length" class="insights-grid">
        <section class="board-column">
          <div class="column-header">
            <h2>Riesgo por chofer</h2>
            <span>{{ issueInsights.topDrivers.length }}</span>
          </div>

          <article v-for="driver in issueInsights.topDrivers.slice(0, 10)" :key="driver.driverId" class="route-card">
            <div class="route-card-header">
              <div>
                <p class="route-label">{{ driver.driverId }}</p>
                <h3>{{ driver.driverName || driver.driverId }}</h3>
              </div>
              <span class="status-chip" :class="driver.highNoveltyIndicator ? 'status-chip-risk' : 'status-chip-ok'">
                {{ driver.highNoveltyIndicator ? 'Alto indicador' : 'Controlado' }}
              </span>
            </div>

            <div class="metrics-grid metrics-grid-3">
              <div>
                <span class="metric-label">Novedades</span>
                <strong>{{ driver.reportCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Clientes con novedad</span>
                <strong>{{ driver.clientsWithIssuesCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Reincidencias cliente</span>
                <strong>{{ driver.repeatIssueClientsCount }}</strong>
              </div>
            </div>

            <div class="progress-block">
              <div class="progress-meta">
                <span>Tasa novedades / 100 clientes</span>
                <strong>{{ driver.issueRatePer100Clients }}%</strong>
              </div>
              <div class="progress-track">
                <div class="progress-bar progress-bar-risk" :style="{ width: `${Math.min(driver.issueRatePer100Clients, 100)}%` }" />
              </div>
            </div>
          </article>
        </section>

        <section class="board-column">
          <div class="column-header">
            <h2>Novedades por cliente</h2>
            <span>{{ issueInsights.topClients.length }}</span>
          </div>

          <article v-for="client in issueInsights.topClients.slice(0, 12)" :key="client.clientId" class="route-card route-card-complete">
            <div class="route-card-header">
              <div>
                <p class="route-label">{{ client.clientId }}</p>
                <h3>{{ client.clientName || client.clientId }}</h3>
              </div>
              <span class="status-chip status-chip-complete">{{ client.reportCount }} novedades</span>
            </div>

            <div class="metrics-grid metrics-grid-3">
              <div>
                <span class="metric-label">Items afectados</span>
                <strong>{{ client.itemCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Choferes involucrados</span>
                <strong>{{ client.affectedDriversCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Ultima novedad</span>
                <strong>{{ formatDate(client.lastIssueAt) }}</strong>
              </div>
            </div>
          </article>
        </section>
      </div>

      <div v-if="routes.length" class="board-grid">
        <section class="board-column">
          <div class="column-header">
            <h2>Rutas activas</h2>
            <span>{{ activeRoutes.length }}</span>
          </div>

          <article v-for="route in activeRoutes" :key="route.routeId" class="route-card">
            <div class="route-card-header">
              <div>
                <p class="route-label">{{ route.routeLabel }}</p>
                <h3>{{ route.driverName || route.driverId || "Chofer sin asignar" }}</h3>
              </div>
              <span class="status-chip status-chip-active">Activa</span>
            </div>

            <div class="metrics-grid">
              <div>
                <span class="metric-label">Despachados</span>
                <strong>{{ route.dispatchedCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Faltan</span>
                <strong>{{ route.remainingCount }}</strong>
              </div>
              <div>
                <span class="metric-label">No encontrados</span>
                <strong>{{ route.pendingMissingCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Total clientes</span>
                <strong>{{ route.totalClients }}</strong>
              </div>
              <div>
                <span class="metric-label">Novedades</span>
                <strong>{{ route.issueReportCount || 0 }}</strong>
              </div>
            </div>

            <div class="progress-block">
              <div class="progress-meta">
                <span>Avance</span>
                <strong>{{ route.completionPercentage }}%</strong>
              </div>
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: `${route.completionPercentage}%` }" />
              </div>
            </div>

            <div class="route-card-footer">
              <span>{{ formatDate(route.updatedAt || route.createdAt) }}</span>
              <div class="route-actions-inline">
                <RouterLink
                  class="inline-link inline-link-button"
                  :to="`/driver-route?routeId=${encodeURIComponent(String(route.routeId || ''))}&driverId=${encodeURIComponent(String(route.driverId || ''))}`"
                >
                  Abrir en mi ruta
                </RouterLink>
                <RouterLink class="inline-link" :to="`/driver-route/${route.routeId}/issues-summary`">
                  Ver novedades
                </RouterLink>
              </div>
            </div>
          </article>
        </section>

        <section class="board-column">
          <div class="column-header">
            <h2>Ultimas 10 rutas completadas</h2>
            <span>{{ recentCompletedRoutes.length }}</span>
          </div>

          <article v-for="route in recentCompletedRoutes" :key="route.routeId" class="route-card route-card-complete">
            <div class="route-card-header">
              <div>
                <p class="route-label">{{ route.routeLabel }}</p>
                <h3>{{ route.driverName || route.driverId || "Chofer sin asignar" }}</h3>
              </div>
              <span class="status-chip status-chip-complete">Completada</span>
            </div>

            <div class="metrics-grid">
              <div>
                <span class="metric-label">Despachados</span>
                <strong>{{ route.dispatchedCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Faltan</span>
                <strong>{{ route.remainingCount }}</strong>
              </div>
              <div>
                <span class="metric-label">No encontrados resueltos</span>
                <strong>{{ route.resolvedMissingCount }}</strong>
              </div>
              <div>
                <span class="metric-label">Total clientes</span>
                <strong>{{ route.totalClients }}</strong>
              </div>
              <div>
                <span class="metric-label">Novedades</span>
                <strong>{{ route.issueReportCount || 0 }}</strong>
              </div>
            </div>

            <div class="progress-block">
              <div class="progress-meta">
                <span>Avance</span>
                <strong>{{ route.completionPercentage }}%</strong>
              </div>
              <div class="progress-track">
                <div class="progress-bar progress-bar-complete" :style="{ width: `${route.completionPercentage}%` }" />
              </div>
            </div>

            <div class="route-card-footer">
              <span>{{ formatDate(route.updatedAt || route.createdAt) }}</span>
              <div class="route-actions-inline">
                <RouterLink
                  class="inline-link inline-link-button"
                  :to="`/driver-route?routeId=${encodeURIComponent(String(route.routeId || ''))}&driverId=${encodeURIComponent(String(route.driverId || ''))}`"
                >
                  Abrir en mi ruta
                </RouterLink>
                <RouterLink class="inline-link" :to="`/driver-route/${route.routeId}/issues-summary`">
                  Ver novedades
                </RouterLink>
              </div>
            </div>
          </article>
        </section>
      </div>

      <section v-if="selectedRouteId" class="board-column route-detail-panel">
        <div class="column-header">
          <h2>Detalle de estatus de ruta</h2>
          <button class="secondary-link compact-button" type="button" :disabled="detailLoading" @click="loadRouteDetail(selectedRouteId)">
            {{ detailLoading ? "Cargando..." : "Recargar detalle" }}
          </button>
        </div>

        <p v-if="detailErrorMessage" class="feedback error-text">{{ detailErrorMessage }}</p>
        <p v-else-if="detailLoading" class="feedback success-text">Cargando detalle de ruta...</p>

        <div v-else-if="routeDetail" class="route-detail-content">
          <div class="metrics-grid metrics-grid-3">
            <div>
              <span class="metric-label">Ruta</span>
              <strong>{{ routeDetail.routeLabel }}</strong>
            </div>
            <div>
              <span class="metric-label">Chofer</span>
              <strong>{{ routeDetail.driverName || routeDetail.driverId || "Sin asignar" }}</strong>
            </div>
            <div>
              <span class="metric-label">Estado</span>
              <strong>{{ routeDetail.status === "completed" ? "Completada" : "Activa" }}</strong>
            </div>
            <div>
              <span class="metric-label">Tipo de ruta</span>
              <strong>{{ routeDetail.routeTypeLabel || routeDetail.routeType || "Sin dato" }}</strong>
            </div>
            <div>
              <span class="metric-label">Distancia total</span>
              <strong>{{ Number(routeDetail.totalDistanceKm || 0).toFixed(2) }} km</strong>
            </div>
            <div>
              <span class="metric-label">Novedades</span>
              <strong>{{ routeDetail.issueReportCount || 0 }}</strong>
            </div>
          </div>

          <div class="detail-columns">
            <article class="detail-card">
              <h3>Paradas</h3>
              <div v-if="routeDetail.stops?.length" class="detail-list">
                <div v-for="stop in routeDetail.stops" :key="`${routeDetail.routeId}-${stop.clientId}`" class="detail-list-item">
                  <div>
                    <p class="route-label">#{{ stop.order }} · {{ stop.clientId }}</p>
                    <strong>{{ stop.nombre }}</strong>
                  </div>
                  <span class="status-chip" :class="stop.dispatched ? 'status-chip-complete' : 'status-chip-active'">
                    {{ stop.dispatched ? "Despachado" : "Pendiente" }}
                  </span>
                </div>
              </div>
              <p v-else class="empty-text">Sin paradas registradas.</p>
            </article>

            <article class="detail-card">
              <h3>Clientes no encontrados</h3>
              <div v-if="routeDetail.missingClients?.length" class="detail-list">
                <div v-for="missing in routeDetail.missingClients" :key="`${routeDetail.routeId}-${missing.clientId}`" class="detail-list-item">
                  <div>
                    <p class="route-label">{{ missing.clientId }}</p>
                    <strong>{{ Number(missing.weight || 0).toFixed(2) }} kg</strong>
                  </div>
                  <span class="status-chip" :class="missing.resolved ? 'status-chip-complete' : 'status-chip-risk'">
                    {{ missing.resolved ? "Resuelto" : "Pendiente" }}
                  </span>
                </div>
              </div>
              <p v-else class="empty-text">No hay clientes pendientes por resolver.</p>
            </article>
          </div>

          <article class="detail-card">
            <div class="column-header compact-column-header">
              <h3>Novedades de la ruta</h3>
              <span>{{ routeReports.length }}</span>
            </div>
            <div v-if="routeReports.length" class="detail-list">
              <div v-for="report in routeReports.slice(0, 12)" :key="report._id" class="detail-list-item detail-list-item-vertical">
                <div>
                  <p class="route-label">Pedido {{ report.orderNumber }} · Cliente {{ report.clientId }}</p>
                  <strong>{{ report.clientName || report.clientId }}</strong>
                </div>
                <small class="metric-label">{{ formatDate(report.createdAt) }}</small>
              </div>
            </div>
            <p v-else class="empty-text">No hay novedades registradas en esta ruta.</p>
          </article>

          <article class="detail-card admin-issue-card">
            <h3>Registrar novedad como administrador</h3>
            <p class="metric-label">Este formulario usa clave de administrador para registrar novedades manuales.</p>

            <div class="admin-form-grid">
              <label>
                Clave admin
                <input v-model="adminKey" type="password" autocomplete="off" placeholder="Ingresa tu clave" />
              </label>

              <label>
                Cliente de la ruta
                <select v-model="issueForm.clientId">
                  <option value="" disabled>Selecciona cliente</option>
                  <option v-for="stop in routeDetail.stops" :key="`issue-stop-${stop.clientId}`" :value="stop.clientId">
                    {{ stop.order }} - {{ stop.clientId }} - {{ stop.nombre }}
                  </option>
                </select>
              </label>

              <label>
                Numero de pedido
                <input v-model="issueForm.orderNumber" type="text" placeholder="Ej: 700123" />
              </label>

              <label>
                ID producto
                <input v-model="issueForm.productId" type="text" placeholder="Ej: 45890" />
              </label>

              <label>
                Novedad
                <input v-model="issueForm.novelty" type="text" placeholder="Ej: Faltante 2 unidades" />
              </label>

              <label>
                Presentacion
                <select v-model="issueForm.presentationType">
                  <option value="unidad">Unidad</option>
                  <option value="caja">Caja</option>
                </select>
              </label>

              <label>
                Cantidad
                <input v-model.number="issueForm.quantity" type="number" min="1" step="1" />
              </label>
            </div>

            <div class="route-actions-inline">
              <button class="primary-button compact-button" type="button" :disabled="savingIssue" @click="submitAdminIssue">
                {{ savingIssue ? "Guardando novedad..." : "Registrar novedad" }}
              </button>
            </div>

            <p v-if="issueFormError" class="feedback error-text">{{ issueFormError }}</p>
            <p v-else-if="issueFormFeedback" class="feedback success-text">{{ issueFormFeedback }}</p>
          </article>
        </div>
      </section>

      <p v-else-if="!loading" class="feedback empty-text">
        No hay rutas para mostrar en este momento.
      </p>
    </div>
  </section>
</template>

<style scoped>
.dispatch-status-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  color: #f3f6fb;
  background:
    radial-gradient(circle at top left, rgba(69, 167, 255, 0.18), transparent 30%),
    radial-gradient(circle at top right, rgba(33, 208, 122, 0.16), transparent 24%),
    linear-gradient(180deg, #091423 0%, #10213a 55%, #0c1525 100%);
}

.dispatch-shell {
  max-width: 1220px;
  margin: 0 auto;
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #93cfff;
}

h1,
h2,
h3,
.route-label,
.summary-label,
.metric-label {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
}

.hero-copy {
  max-width: 680px;
  margin-top: 0.8rem;
  color: rgba(243, 246, 251, 0.75);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.primary-button,
.secondary-link,
.inline-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  font-weight: 700;
  text-decoration: none;
}

.inline-link-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  cursor: pointer;
  font-size: 0.9rem;
}

.primary-button {
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-link,
.inline-link {
  color: #f3f6fb;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.summary-card,
.route-card,
.board-column {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(9, 20, 35, 0.68);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.summary-card {
  padding: 1rem 1.15rem;
}

.summary-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 2rem;
}

.summary-label,
.metric-label {
  color: rgba(243, 246, 251, 0.7);
}

.accent-blue {
  border-color: rgba(69, 167, 255, 0.28);
}

.accent-green {
  border-color: rgba(42, 181, 125, 0.28);
}

.accent-gold {
  border-color: rgba(240, 185, 11, 0.28);
}

.accent-red {
  border-color: rgba(255, 117, 102, 0.28);
}

.accent-amber {
  border-color: rgba(251, 191, 36, 0.32);
}

.accent-rose-soft {
  border-color: rgba(244, 114, 182, 0.3);
}

.feedback {
  margin: 0.5rem 0 1rem;
}

.error-text {
  color: #ffabab;
}

.success-text {
  color: #97f0bf;
}

.empty-text {
  color: rgba(243, 246, 251, 0.78);
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.board-column {
  padding: 1rem;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.column-header span,
.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 32px;
  padding: 0.2rem 0.75rem;
  border-radius: 999px;
  font-weight: 700;
}

.column-header span {
  background: rgba(255, 255, 255, 0.08);
}

.route-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.route-card + .route-card {
  margin-top: 0.9rem;
}

.route-card-complete {
  border-color: rgba(42, 181, 125, 0.22);
}

.route-card-header,
.route-card-footer,
.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.route-label {
  color: #8ec7ff;
  font-size: 0.88rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.route-card h3 {
  margin-top: 0.35rem;
  font-size: 1.2rem;
}

.status-chip-active {
  background: rgba(240, 185, 11, 0.16);
  color: #ffd56b;
}

.status-chip-complete {
  background: rgba(42, 181, 125, 0.18);
  color: #94f0c1;
}

.status-chip-risk {
  background: rgba(255, 117, 102, 0.2);
  color: #ffb0a5;
}

.status-chip-ok {
  background: rgba(56, 189, 248, 0.16);
  color: #b9e6ff;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.metrics-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metrics-grid > div {
  padding: 0.85rem 0.95rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
}

.metrics-grid strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.25rem;
}

.progress-block {
  display: grid;
  gap: 0.5rem;
}

.progress-track {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.progress-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #f0b90b 0%, #ff8b66 100%);
}

.progress-bar-complete {
  background: linear-gradient(90deg, #2ab57d 0%, #61d59c 100%);
}

.progress-bar-risk {
  background: linear-gradient(90deg, #ff9a5a 0%, #ff5f6d 100%);
}

.route-card-footer {
  color: rgba(243, 246, 251, 0.72);
}

.route-actions-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.route-detail-panel {
  margin-top: 1rem;
}

.route-detail-content {
  display: grid;
  gap: 1rem;
}

.detail-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.detail-card {
  border-radius: 20px;
  padding: 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.8rem;
}

.detail-list {
  display: grid;
  gap: 0.55rem;
}

.detail-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  border-radius: 14px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
}

.detail-list-item-vertical {
  align-items: flex-start;
}

.compact-column-header {
  margin-bottom: 0;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.admin-form-grid label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.88rem;
  color: rgba(243, 246, 251, 0.86);
}

.admin-form-grid input,
.admin-form-grid select {
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 17, 30, 0.78);
  color: #f3f6fb;
  padding: 0.55rem 0.65rem;
}

.compact-button {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .board-grid {
    grid-template-columns: 1fr;
  }

  .insights-grid {
    grid-template-columns: 1fr;
  }

  .detail-columns {
    grid-template-columns: 1fr;
  }

  .admin-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid-3 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .dispatch-status-page {
    padding: 1.1rem 0.8rem 2rem;
  }

  .hero-panel,
  .hero-actions,
  .column-header,
  .route-card-header,
  .route-card-footer,
  .progress-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .primary-button,
  .secondary-link,
  .inline-link {
    width: 100%;
  }

  .route-actions-inline {
    width: 100%;
  }

  .admin-form-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>