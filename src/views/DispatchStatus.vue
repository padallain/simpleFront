<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const routes = ref([]);
const totals = ref({
  routes: 0,
  activeRoutes: 0,
  completedRoutes: 0,
  totalClients: 0,
  dispatchedCount: 0,
  remainingCount: 0,
  pendingMissingCount: 0,
});
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("");

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

async function loadDispatchStatuses() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/route-dispatch-status`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routes.value = [];
      totals.value = {
        routes: 0,
        activeRoutes: 0,
        completedRoutes: 0,
        totalClients: 0,
        dispatchedCount: 0,
        remainingCount: 0,
        pendingMissingCount: 0,
      };
      errorMessage.value = result?.message || "No se pudo cargar el estatus de despachos.";
      return;
    }

    routes.value = Array.isArray(result?.routes) ? result.routes : [];
    totals.value = result?.totals || totals.value;
    feedbackMessage.value = routes.value.length
      ? `Se cargaron ${routes.value.length} rutas.`
      : "No hay rutas guardadas para mostrar.";
  } catch (error) {
    routes.value = [];
    totals.value = {
      routes: 0,
      activeRoutes: 0,
      completedRoutes: 0,
      totalClients: 0,
      dispatchedCount: 0,
      remainingCount: 0,
      pendingMissingCount: 0,
    };
    errorMessage.value = `Error cargando estatus: ${error.message}`;
  } finally {
    loading.value = false;
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
      </div>

      <p v-if="errorMessage" class="feedback error-text">
        {{ errorMessage }}
      </p>

      <p v-else-if="feedbackMessage" class="feedback success-text">
        {{ feedbackMessage }}
      </p>

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
              <RouterLink class="inline-link" :to="`/driver-route/${route.routeId}/issues-summary`">
                Ver novedades
              </RouterLink>
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
              <RouterLink class="inline-link" :to="`/driver-route/${route.routeId}/issues-summary`">
                Ver novedades
              </RouterLink>
            </div>
          </article>
        </section>
      </div>

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

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
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

.route-card-footer {
  color: rgba(243, 246, 251, 0.72);
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .board-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .metrics-grid {
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

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>