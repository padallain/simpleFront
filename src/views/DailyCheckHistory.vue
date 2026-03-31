<template>
  <section class="history-page">
    <div class="hero-panel">
      <div>
        <p class="eyebrow">Historial Daily Check</p>
        <h1>Ultimos 20 chequeos y busqueda por placa</h1>
        <p class="hero-copy">
          Visualiza los reportes mas recientes en orden cronologico y consulta el historial completo de cada vehiculo por placa.
        </p>
      </div>

      <RouterLink class="back-link" to="/daily-check">
        Nuevo reporte
      </RouterLink>
    </div>

    <div class="toolbar-card">
      <form class="search-form" @submit.prevent="buscarPorPlaca">
        <label for="placaBusqueda">Buscar por placa</label>

        <div class="search-row">
          <input
            id="placaBusqueda"
            v-model="placaBusqueda"
            type="text"
            placeholder="Ej: ABC123"
          />

          <button type="submit" :disabled="cargando">
            Buscar
          </button>

          <button type="button" class="secondary-button" :disabled="cargando" @click="cargarRecientes">
            Ver ultimos 20
          </button>
        </div>
      </form>

      <div class="summary-strip">
        <div>
          <span class="summary-label">Vista actual</span>
          <strong>{{ tituloListado }}</strong>
        </div>

        <div>
          <span class="summary-label">Total reportes</span>
          <strong>{{ reportes.length }}</strong>
        </div>
      </div>
    </div>

    <p v-if="errorMensaje" class="feedback error-text">
      {{ errorMensaje }}
    </p>

    <p v-else-if="cargando" class="feedback">
      Cargando reportes...
    </p>

    <p v-else-if="!reportes.length" class="feedback">
      No hay reportes para mostrar.
    </p>

    <div v-else class="reports-grid">
      <article v-for="reporte in reportes" :key="reporte._id" class="report-card">
        <header class="report-header">
          <div>
            <p class="plate-badge">{{ reporte.placa }}</p>
            <h2>{{ reporte.modelo }}</h2>
          </div>

          <div class="timestamp-block">
            <strong>{{ formatearFecha(reporte.fechaVisual) }}</strong>
            <span>{{ formatearHora(reporte.fechaVisual) }}</span>
          </div>
        </header>

        <div class="report-meta">
          <span><strong>Chofer:</strong> {{ reporte.chofer }}</span>
          <span><strong>Ano:</strong> {{ reporte.anio }}</span>
        </div>

        <div class="checklist-section">
          <div
            v-for="item in reporte.checklist"
            :key="`${reporte._id}-${item.nombre}`"
            class="check-item"
            :class="item.estado === 'NO_OK' ? 'check-item-alert' : 'check-item-ok'"
          >
            <div class="check-item-head">
              <span>{{ item.nombre }}</span>
              <span class="status-pill">{{ item.estado === "NO_OK" ? "No OK" : "OK" }}</span>
            </div>

            <p v-if="item.estado === 'NO_OK'" class="check-comment">
              {{ item.comentario }}
            </p>
          </div>
        </div>

        <footer class="report-footer">
          <p>
            <strong>Observaciones:</strong>
            {{ reporte.observaciones || "Sin observaciones" }}
          </p>
        </footer>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  API_BASE_URL,
  fetchDailyChecksByPlaca,
  fetchRecentDailyChecks,
} from "../services/dailyCheckApi";

console.log("[DailyCheckHistory] setup", {
  href: window.location.href,
  pathname: window.location.pathname,
  apiBaseUrl: API_BASE_URL,
});

const reportes = ref([]);
const placaBusqueda = ref("");
const cargando = ref(false);
const errorMensaje = ref("");
const modoActual = ref("recientes");

const tituloListado = computed(() =>
  modoActual.value === "placa" && placaBusqueda.value.trim()
    ? `Resultados para ${placaBusqueda.value.trim().toUpperCase()}`
    : "Ultimos 20 reportes",
);

function normalizarReporte(reporte) {
  return {
    ...reporte,
    checklist: Array.isArray(reporte?.checklist) ? reporte.checklist : [],
    fechaVisual:
      reporte?.fechaHoraRegistro ||
      reporte?.createdAt ||
      reporte?.updatedAt ||
      null,
  };
}

function formatearFecha(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function formatearHora(valor) {
  if (!valor) {
    return "Hora no disponible";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Hora no disponible";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

async function cargarRecientes() {
  cargando.value = true;
  errorMensaje.value = "";
  modoActual.value = "recientes";

  console.log("[DailyCheckHistory] cargarRecientes:start", {
    apiBaseUrl: API_BASE_URL,
  });

  try {
    const result = await fetchRecentDailyChecks(20);
    reportes.value = (result?.reportes || []).map(normalizarReporte);
    console.log("[DailyCheckHistory] cargarRecientes:success", {
      total: reportes.value.length,
    });
    console.log("[DailyCheckHistory] cargarRecientes:data", reportes.value);
  } catch (error) {
    reportes.value = [];
    errorMensaje.value = error.message;
    console.error("[DailyCheckHistory] cargarRecientes:error", error);
  } finally {
    cargando.value = false;
  }
}

async function buscarPorPlaca() {
  const placa = placaBusqueda.value.trim().toUpperCase();

  console.log("[DailyCheckHistory] buscarPorPlaca:start", {
    placaIngresada: placaBusqueda.value,
    placaNormalizada: placa,
  });

  if (!placa) {
    cargarRecientes();
    return;
  }

  cargando.value = true;
  errorMensaje.value = "";
  modoActual.value = "placa";

  try {
    const result = await fetchDailyChecksByPlaca(placa);
    reportes.value = (result?.reportes || []).map(normalizarReporte);
    placaBusqueda.value = placa;
    console.log("[DailyCheckHistory] buscarPorPlaca:success", {
      placa,
      total: reportes.value.length,
    });
    console.log("[DailyCheckHistory] buscarPorPlaca:data", reportes.value);
  } catch (error) {
    reportes.value = [];
    errorMensaje.value = error.message;
    console.error("[DailyCheckHistory] buscarPorPlaca:error", error);
  } finally {
    cargando.value = false;
  }
}

onMounted(() => {
  console.log("[DailyCheckHistory] mounted");
  cargarRecientes();
});
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  color: #f3f6fb;
  background:
    radial-gradient(circle at top left, rgba(87, 140, 255, 0.24), transparent 32%),
    radial-gradient(circle at top right, rgba(0, 208, 132, 0.18), transparent 26%),
    linear-gradient(180deg, #07111f 0%, #0d1b30 55%, #0b1424 100%);
}

.hero-panel,
.toolbar-card,
.reports-grid {
  max-width: 1180px;
  margin: 0 auto;
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #87c6ff;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1;
}

.hero-copy {
  max-width: 650px;
  margin-top: 0.8rem;
  color: rgba(243, 246, 251, 0.75);
}

.back-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  padding: 0.8rem 1.1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6fb;
  text-decoration: none;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(12px);
}

.toolbar-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(7, 17, 31, 0.58);
  border: 1px solid rgba(135, 198, 255, 0.16);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22);
}

.search-form {
  display: grid;
  gap: 0.8rem;
}

.search-form label,
.summary-label {
  color: rgba(243, 246, 251, 0.7);
}

.search-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-row input {
  flex: 1 1 260px;
  min-height: 48px;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6fb;
}

.search-row button {
  min-height: 48px;
  padding: 0.85rem 1.25rem;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.search-row button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.search-row .secondary-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.summary-strip {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.summary-strip > div {
  flex: 1 1 200px;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
}

.summary-strip strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.1rem;
}

.feedback {
  max-width: 1180px;
  margin: 1rem auto 0;
  color: rgba(243, 246, 251, 0.82);
}

.error-text {
  color: #ff9f9f;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.report-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.16);
}

.report-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.report-header h2 {
  margin: 0.4rem 0 0;
  text-align: left;
  font-size: 1.35rem;
}

.plate-badge {
  display: inline-flex;
  margin: 0;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(69, 167, 255, 0.18);
  color: #9fd1ff;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.timestamp-block {
  text-align: right;
  color: rgba(243, 246, 251, 0.82);
}

.timestamp-block span {
  display: block;
  margin-top: 0.25rem;
  color: rgba(243, 246, 251, 0.58);
}

.report-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: rgba(243, 246, 251, 0.82);
}

.checklist-section {
  display: grid;
  gap: 0.7rem;
}

.check-item {
  padding: 0.85rem 0.95rem;
  border-radius: 16px;
}

.check-item-ok {
  background: rgba(42, 181, 125, 0.12);
  border: 1px solid rgba(42, 181, 125, 0.2);
}

.check-item-alert {
  background: rgba(255, 117, 102, 0.12);
  border: 1px solid rgba(255, 117, 102, 0.26);
}

.check-item-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.status-pill {
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.8rem;
  font-weight: 700;
}

.check-comment,
.report-footer p {
  margin: 0.55rem 0 0;
  color: rgba(243, 246, 251, 0.8);
}

@media (max-width: 720px) {
  .history-page {
    padding: 1.2rem 0.8rem 2rem;
  }

  .hero-panel,
  .report-header {
    flex-direction: column;
  }

  .timestamp-block {
    text-align: left;
  }

  .search-row {
    flex-direction: column;
  }

  .search-row button,
  .search-row input,
  .back-link {
    width: 100%;
  }
}
</style>