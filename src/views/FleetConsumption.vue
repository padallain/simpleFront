<script setup>
import { onMounted, ref } from "vue";
import { fetchFuelConsumptionByPlaca } from "../services/fuelReportApi";

const fleet = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const days = ref(30);

async function loadFleetConsumption() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await fetchFuelConsumptionByPlaca({ days: Number(days.value) || 30 });
    fleet.value = Array.isArray(result?.summaryByPlaca) ? result.summaryByPlaca : [];
  } catch (error) {
    fleet.value = [];
    errorMessage.value = error.message || "No se pudo cargar el consumo por camión.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadFleetConsumption();
});
</script>

<template>
  <section class="fleet-page">
    <div class="fleet-shell">
      <header class="fleet-header">
        <p class="fleet-kicker">Administracion</p>
        <h1>Mi flota</h1>
        <p>Consumos por camión en el periodo seleccionado.</p>
      </header>

      <div class="fleet-toolbar">
        <label>
          Periodo (dias)
          <input v-model.number="days" type="number" min="1" max="365" step="1" />
        </label>
        <button type="button" @click="loadFleetConsumption" :disabled="loading">
          {{ loading ? "Consultando..." : "Consultar" }}
        </button>
      </div>

      <p v-if="errorMessage" class="feedback feedback-error">{{ errorMessage }}</p>

      <div v-if="!loading && !fleet.length && !errorMessage" class="fleet-empty">
        No hay consumo registrado para este periodo.
      </div>

      <div v-else class="fleet-grid">
        <article v-for="truck in fleet" :key="truck.placa" class="fleet-card">
          <div class="fleet-card-header">
            <h2>{{ truck.placa }}</h2>
            <span class="badge">{{ truck.reports }} reportes</span>
          </div>

          <div class="fleet-metrics">
            <div>
              <span>Litros</span>
              <strong>{{ truck.litersTotal }}</strong>
            </div>
            <div>
              <span>Monto</span>
              <strong>{{ truck.amountTotal }}</strong>
            </div>
            <div>
              <span>Distancia</span>
              <strong>{{ truck.distanceKm }} km</strong>
            </div>
            <div>
              <span>Km/L</span>
              <strong>{{ truck.kmPerLiter == null ? "N/A" : `${truck.kmPerLiter} km/L` }}</strong>
            </div>
          </div>

          <div class="fleet-meta">
            <span>Choferes: {{ (truck.choferes || []).join(", ") || "Sin chofer" }}</span>
            <span>Alertas: {{ truck.suspiciousReports || 0 }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fleet-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2.5rem;
  background: linear-gradient(180deg, #09111d 0%, #0c1b2d 52%, #0a1220 100%);
  color: #f3f6fb;
}

.fleet-shell {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.fleet-header h1,
.fleet-header p,
.fleet-kicker {
  margin: 0;
}

.fleet-kicker {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.75rem;
  color: #ffd59a;
}

.fleet-header h1 {
  margin-top: 0.35rem;
  font-size: clamp(2rem, 4vw, 3rem);
}

.fleet-header p {
  margin-top: 0.65rem;
  color: rgba(243, 246, 251, 0.76);
}

.fleet-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: end;
  padding: 1rem;
  border-radius: 18px;
  background: rgba(10, 19, 31, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.fleet-toolbar label {
  display: grid;
  gap: 0.4rem;
  font-weight: 600;
  color: rgba(243, 246, 251, 0.9);
}

.fleet-toolbar input {
  min-width: 130px;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 0.6rem 0.75rem;
  background: rgba(255, 255, 255, 0.94);
  color: #14253d;
}

.fleet-toolbar button,
button {
  min-height: 42px;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.fleet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.fleet-card {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(10, 19, 31, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
}

.fleet-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}

.fleet-card-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.badge {
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: rgba(69, 167, 255, 0.14);
  border: 1px solid rgba(69, 167, 255, 0.35);
  color: #bfe0ff;
  font-size: 0.75rem;
}

.fleet-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.fleet-metrics div {
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.fleet-metrics span,
.fleet-meta {
  display: block;
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.78rem;
}

.fleet-metrics strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.05rem;
  color: #fff;
}

.fleet-meta {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.25rem;
}

.fleet-empty {
  padding: 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(243, 246, 251, 0.78);
}

.feedback {
  padding: 0.7rem 0.8rem;
  border-radius: 12px;
  margin: 0;
}

.feedback-error {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.32);
}

@media (max-width: 660px) {
  .fleet-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .fleet-toolbar button {
    width: 100%;
  }
}
</style>
