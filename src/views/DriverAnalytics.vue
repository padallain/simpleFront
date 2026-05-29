<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const createEmptyOverview = () => ({
  drivers: 0,
  routes: 0,
  totalKg: 0,
  totalClients: 0,
  completedRoutes: 0,
  activeRoutes: 0,
  completionRate: 0,
  dispatchRate: 0,
  pendingCount: 0,
  avgKgPerDriver: 0,
  avgClientsPerDriver: 0,
});

const selectedMonth = ref(getCurrentMonthValue());
const periodLabel = ref("");
const overview = ref(createEmptyOverview());
const drivers = ref([]);
const monthlyHistory = ref([]);
const topDriver = ref(null);
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("");

const historyPeakKg = computed(() => Math.max(...monthlyHistory.value.map((item) => item.totalKg || 0), 1));

function getCurrentMonthValue() {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDecimal(value, decimals = 1) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value) || 0);
}

function formatKg(value) {
  return `${formatDecimal(value, 1)} kg`;
}

function formatDistance(value) {
  return `${formatDecimal(value, 1)} km`;
}

function getHistoryBarHeight(value) {
  return `${Math.max((Number(value) || 0) / historyPeakKg.value * 100, 8)}%`;
}

async function loadAnalytics() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-performance-analytics?month=${selectedMonth.value}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      overview.value = createEmptyOverview();
      drivers.value = [];
      monthlyHistory.value = [];
      topDriver.value = null;
      periodLabel.value = "";
      errorMessage.value = result?.message || "No se pudo cargar la analitica de choferes.";
      return;
    }

    overview.value = result?.overview || createEmptyOverview();
    drivers.value = Array.isArray(result?.drivers) ? result.drivers : [];
    monthlyHistory.value = Array.isArray(result?.monthlyHistory) ? result.monthlyHistory : [];
    topDriver.value = result?.topDriver || null;
    periodLabel.value = result?.period?.label || selectedMonth.value;
    feedbackMessage.value = drivers.value.length
      ? `Se cargaron KPIs de ${drivers.value.length} choferes para ${periodLabel.value}.`
      : `No hay rutas registradas para ${periodLabel.value}.`;
  } catch (error) {
    overview.value = createEmptyOverview();
    drivers.value = [];
    monthlyHistory.value = [];
    topDriver.value = null;
    periodLabel.value = "";
    errorMessage.value = `Error cargando analitica: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadAnalytics();
});
</script>

<template>
  <section class="analytics-page">
    <div class="analytics-shell">
      <div class="analytics-hero">
        <div>
          <p class="eyebrow">Rendimiento operativo</p>
          <h1>Analisis mensual de choferes</h1>
          <p class="hero-copy">
            Compara kilos movidos, clientes atendidos y KPIs de cumplimiento por chofer para detectar productividad,
            carga operativa y rezagos del mes.
          </p>
        </div>

        <div class="hero-actions">
          <label class="month-field">
            <span>Mes de analisis</span>
            <input v-model="selectedMonth" type="month" />
          </label>
          <button class="primary-button" type="button" :disabled="loading" @click="loadAnalytics">
            {{ loading ? "Actualizando..." : "Actualizar KPIs" }}
          </button>
          <RouterLink class="secondary-link" to="/dispatch-status">
            Ver despachos
          </RouterLink>
        </div>
      </div>

      <div class="summary-grid">
        <article class="summary-card accent-orange">
          <span class="summary-label">Kilogramos del mes</span>
          <strong>{{ formatKg(overview.totalKg) }}</strong>
          <small>{{ formatDecimal(overview.avgKgPerDriver, 1) }} kg por chofer</small>
        </article>
        <article class="summary-card accent-sky">
          <span class="summary-label">Clientes asignados</span>
          <strong>{{ formatInteger(overview.totalClients) }}</strong>
          <small>{{ formatDecimal(overview.avgClientsPerDriver, 1) }} por chofer</small>
        </article>
        <article class="summary-card accent-green">
          <span class="summary-label">Cumplimiento de rutas</span>
          <strong>{{ overview.completionRate }}%</strong>
          <small>{{ formatInteger(overview.completedRoutes) }} completadas de {{ formatInteger(overview.routes) }}</small>
        </article>
        <article class="summary-card accent-rose">
          <span class="summary-label">Cobertura de despacho</span>
          <strong>{{ overview.dispatchRate }}%</strong>
          <small>{{ formatInteger(overview.pendingCount) }} pendientes del mes</small>
        </article>
      </div>

      <p v-if="errorMessage" class="feedback error-text">
        {{ errorMessage }}
      </p>

      <p v-else-if="feedbackMessage" class="feedback success-text">
        {{ feedbackMessage }}
      </p>

      <div class="analytics-layout">
        <section class="panel spotlight-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Chofer destacado</p>
              <h2>{{ periodLabel || selectedMonth }}</h2>
            </div>
            <span class="panel-badge">{{ formatInteger(overview.drivers) }} choferes</span>
          </div>

          <div v-if="topDriver" class="spotlight-grid">
            <div class="spotlight-main">
              <p class="spotlight-rank">Top del mes</p>
              <h3>{{ topDriver.driverName || topDriver.driverId }}</h3>
              <p class="spotlight-id">ID {{ topDriver.driverId }}</p>

              <div class="spotlight-metrics">
                <div>
                  <span>Kg movilizados</span>
                  <strong>{{ formatKg(topDriver.totalKg) }}</strong>
                </div>
                <div>
                  <span>Clientes</span>
                  <strong>{{ formatInteger(topDriver.totalClients) }}</strong>
                </div>
                <div>
                  <span>Rutas completadas</span>
                  <strong>{{ formatInteger(topDriver.completedRoutes) }}</strong>
                </div>
                <div>
                  <span>Promedio por ruta</span>
                  <strong>{{ formatDecimal(topDriver.avgKgPerRoute, 1) }} kg</strong>
                </div>
              </div>
            </div>

            <div class="kpi-stack">
              <article class="kpi-card">
                <span>Efectividad de cierre</span>
                <strong>{{ topDriver.completionRate }}%</strong>
                <small>Rutas completadas sobre rutas asignadas</small>
              </article>
              <article class="kpi-card">
                <span>Cobertura operativa</span>
                <strong>{{ topDriver.dispatchRate }}%</strong>
                <small>Clientes y faltantes resueltos del mes</small>
              </article>
              <article class="kpi-card">
                <span>Distancia promedio</span>
                <strong>{{ formatDistance(topDriver.avgDistancePerRoute) }}</strong>
                <small>Promedio recorrido por ruta</small>
              </article>
            </div>
          </div>

          <div v-else class="empty-panel">
            No hay datos del mes seleccionado para calcular un chofer destacado.
          </div>
        </section>

        <section class="panel history-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Tendencia</p>
              <h2>Ultimos 6 meses</h2>
            </div>
          </div>

          <div class="history-bars">
            <article v-for="item in monthlyHistory" :key="item.month" class="history-card">
              <div class="history-visual">
                <div class="history-bar" :style="{ height: getHistoryBarHeight(item.totalKg) }" />
              </div>
              <strong>{{ item.label }}</strong>
              <span>{{ formatKg(item.totalKg) }}</span>
              <small>
                {{ formatInteger(item.routes) }} rutas · {{ item.completionRate }}% cierre · {{ formatInteger(item.activeDrivers) }} choferes
              </small>
            </article>
          </div>
        </section>
      </div>

      <section class="panel table-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Comparativo</p>
            <h2>Ranking por chofer</h2>
          </div>
          <span class="panel-badge">{{ periodLabel || selectedMonth }}</span>
        </div>

        <div v-if="drivers.length" class="driver-grid">
          <article v-for="(driver, index) in drivers" :key="driver.driverId" class="driver-card">
            <div class="driver-card-header">
              <div>
                <p class="driver-rank">#{{ index + 1 }}</p>
                <h3>{{ driver.driverName || driver.driverId }}</h3>
                <span class="driver-id">{{ driver.driverId }}</span>
              </div>
              <div class="driver-status-group">
                <span class="status-chip">{{ driver.completionRate }}% cierre</span>
                <span class="status-chip status-chip-alt">{{ driver.dispatchRate }}% despacho</span>
              </div>
            </div>

            <div class="driver-metrics-grid">
              <div>
                <span>Kg totales</span>
                <strong>{{ formatKg(driver.totalKg) }}</strong>
              </div>
              <div>
                <span>Clientes</span>
                <strong>{{ formatInteger(driver.totalClients) }}</strong>
              </div>
              <div>
                <span>Rutas</span>
                <strong>{{ formatInteger(driver.routeCount) }}</strong>
              </div>
              <div>
                <span>Pendientes</span>
                <strong>{{ formatInteger(driver.pendingCount) }}</strong>
              </div>
            </div>

            <div class="driver-progress-group">
              <div>
                <div class="progress-meta">
                  <span>Cumplimiento</span>
                  <strong>{{ driver.completionRate }}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill progress-fill-orange" :style="{ width: `${driver.completionRate}%` }" />
                </div>
              </div>
              <div>
                <div class="progress-meta">
                  <span>Despacho</span>
                  <strong>{{ driver.dispatchRate }}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill progress-fill-green" :style="{ width: `${driver.dispatchRate}%` }" />
                </div>
              </div>
            </div>

            <div class="driver-footer">
              <span>{{ formatDecimal(driver.avgClientsPerRoute, 1) }} clientes/ruta</span>
              <span>{{ formatDecimal(driver.avgKgPerRoute, 1) }} kg/ruta</span>
              <span>{{ formatDistance(driver.avgDistancePerRoute) }}</span>
            </div>
          </article>
        </div>

        <div v-else class="empty-panel">
          No hay rutas cargadas para ese periodo. Cambia el mes o genera rutas para comenzar el analisis.
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.analytics-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  color: #fff7ed;
  background:
    radial-gradient(circle at top left, rgba(255, 160, 72, 0.24), transparent 28%),
    radial-gradient(circle at 85% 10%, rgba(42, 157, 143, 0.2), transparent 22%),
    linear-gradient(180deg, #21100f 0%, #341916 38%, #101c20 100%);
}

.analytics-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.analytics-hero {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.eyebrow,
.panel-kicker,
.driver-rank,
.spotlight-rank {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
}

.eyebrow,
.panel-kicker,
.driver-rank {
  color: #ffcf99;
}

.spotlight-rank {
  color: #75f6d4;
}

h1,
h2,
h3,
p,
strong,
small,
span {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 5vw, 3.1rem);
}

.hero-copy {
  max-width: 760px;
  margin-top: 0.85rem;
  color: rgba(255, 247, 237, 0.76);
}

.hero-actions {
  display: flex;
  gap: 0.9rem;
  align-items: end;
  flex-wrap: wrap;
}

.month-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 180px;
  color: rgba(255, 247, 237, 0.75);
}

.month-field input,
.primary-button,
.secondary-link {
  min-height: 46px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  font-weight: 700;
}

.month-field input {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 248, 240, 0.96);
  color: #221513;
}

.primary-button {
  border: none;
  cursor: pointer;
  color: #1d120f;
  background: linear-gradient(135deg, #ffcf7a 0%, #ff8c42 100%);
  box-shadow: 0 16px 32px rgba(255, 140, 66, 0.28);
}

.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff7ed;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
}

.primary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.summary-grid,
.driver-grid {
  display: grid;
  gap: 1rem;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 1rem;
}

.summary-card,
.panel,
.driver-card,
.kpi-card,
.history-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 252, 247, 0.06);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(14px);
}

.summary-card {
  padding: 1.1rem;
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.summary-card strong {
  font-size: 1.8rem;
}

.summary-card small,
.feedback,
.driver-id,
.spotlight-id,
.empty-panel,
.history-card small {
  color: rgba(255, 247, 237, 0.72);
}

.summary-label {
  color: rgba(255, 247, 237, 0.68);
}

.accent-orange {
  border-color: rgba(255, 166, 79, 0.34);
}

.accent-sky {
  border-color: rgba(126, 214, 255, 0.3);
}

.accent-green {
  border-color: rgba(117, 246, 212, 0.34);
}

.accent-rose {
  border-color: rgba(255, 133, 162, 0.32);
}

.feedback {
  margin: 0 0 1rem;
  padding: 0.95rem 1rem;
  border-radius: 18px;
}

.error-text {
  background: rgba(255, 120, 120, 0.12);
  color: #ffc1c1;
}

.success-text {
  background: rgba(117, 246, 212, 0.12);
  color: #a7ffe8;
}

.analytics-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel,
.driver-card,
.kpi-card,
.history-card {
  border-radius: 24px;
}

.panel {
  padding: 1.2rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.panel-badge,
.status-chip,
.status-chip-alt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-weight: 700;
}

.panel-badge,
.status-chip {
  background: rgba(255, 166, 79, 0.16);
  color: #ffcf99;
}

.status-chip-alt {
  background: rgba(117, 246, 212, 0.14);
  color: #95ffe3;
}

.spotlight-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 1rem;
}

.spotlight-main {
  padding: 1.1rem;
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255, 145, 77, 0.18), rgba(28, 88, 88, 0.16));
}

.spotlight-main h3 {
  margin-top: 0.45rem;
  font-size: clamp(1.5rem, 4vw, 2.3rem);
}

.spotlight-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 1.2rem;
}

.spotlight-metrics div,
.driver-metrics-grid div {
  padding: 0.95rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.spotlight-metrics span,
.driver-metrics-grid span,
.kpi-card span,
.progress-meta span {
  color: rgba(255, 247, 237, 0.7);
}

.spotlight-metrics strong,
.driver-metrics-grid strong,
.kpi-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.25rem;
}

.kpi-stack {
  display: grid;
  gap: 0.85rem;
}

.kpi-card {
  padding: 1rem;
}

.kpi-card strong {
  margin: 0.5rem 0 0.3rem;
  font-size: 1.8rem;
}

.history-bars {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  min-height: 100%;
}

.history-card {
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.history-visual {
  height: 140px;
  display: flex;
  align-items: end;
}

.history-bar {
  width: 100%;
  border-radius: 16px 16px 8px 8px;
  background: linear-gradient(180deg, #ffcf7a 0%, #ff8c42 100%);
}

.table-panel {
  margin-top: 1rem;
}

.driver-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.driver-card {
  padding: 1.05rem;
}

.driver-card-header,
.driver-status-group,
.driver-footer,
.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.driver-status-group {
  justify-content: flex-end;
}

.driver-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}

.driver-progress-group {
  display: grid;
  gap: 0.8rem;
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: 0.4rem;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
}

.progress-fill-orange {
  background: linear-gradient(90deg, #ffb261 0%, #ff7b54 100%);
}

.progress-fill-green {
  background: linear-gradient(90deg, #6cf0d0 0%, #2ec4b6 100%);
}

.driver-footer {
  margin-top: 1rem;
  color: rgba(255, 247, 237, 0.78);
}

.empty-panel {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 1100px) {
  .summary-grid,
  .driver-grid,
  .analytics-layout,
  .spotlight-grid,
  .history-bars,
  .driver-metrics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .analytics-hero,
  .panel-header,
  .driver-card-header,
  .driver-status-group,
  .driver-footer,
  .progress-meta {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions {
    width: 100%;
  }

  .month-field,
  .primary-button,
  .secondary-link {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .analytics-page {
    padding: 1rem 0.75rem 2rem;
  }
}
</style>