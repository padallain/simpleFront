<script setup>
import { computed, onMounted, ref } from "vue";
import { fetchSession, getAuthState } from "../services/auth";
import { createFuelReport, fetchDailyFuelSummary } from "../services/fuelReportApi";

const sessionUser = ref(getAuthState().user || null);
const placa = ref("");
const fuelType = ref("gasoil");
const liters = ref("");
const odometerKm = ref("");
const totalAmount = ref("");
const station = ref("");
const notes = ref("");
const loading = ref(false);
const successMessage = ref("");
const errorMessage = ref("");
const summary = ref([]);
const summaryLoading = ref(false);
const summaryError = ref("");

const chofer = computed(() => {
  const user = sessionUser.value || {};
  return String(user.username || user.email || user.id || "").trim();
});

const canSubmit = computed(() => (
  Boolean(chofer.value)
  && Boolean(placa.value.trim())
  && ["gasoil", "gasolina"].includes(fuelType.value)
  && Number(liters.value) > 0
  && Number(odometerKm.value) >= 0
));

function resetForm() {
  fuelType.value = "gasoil";
  liters.value = "";
  odometerKm.value = "";
  totalAmount.value = "";
  station.value = "";
  notes.value = "";
}

async function loadSessionUser() {
  try {
    const sessionState = await fetchSession({ force: true });
    sessionUser.value = sessionState.user || null;
  } catch {
    sessionUser.value = null;
  }
}

async function loadSummary() {
  summaryLoading.value = true;
  summaryError.value = "";

  try {
    const result = await fetchDailyFuelSummary({
      days: 14,
      placa: placa.value.trim(),
    });

    summary.value = Array.isArray(result?.daily) ? [...result.daily].reverse() : [];
  } catch (error) {
    summary.value = [];
    summaryError.value = error.message || "No se pudo cargar el resumen.";
  } finally {
    summaryLoading.value = false;
  }
}

async function submitFuelReport() {
  if (!canSubmit.value) {
    errorMessage.value = "Completa chofer, placa, litros y odometro.";
    return;
  }

  loading.value = true;
  successMessage.value = "";
  errorMessage.value = "";

  try {
    await createFuelReport({
      placa: placa.value.trim().toUpperCase(),
      fuelType: fuelType.value,
      liters: Number(liters.value),
      odometerKm: Number(odometerKm.value),
      totalAmount: totalAmount.value === "" ? null : Number(totalAmount.value),
      station: station.value.trim(),
      notes: notes.value.trim(),
    });

    successMessage.value = "Recarga registrada correctamente.";
    resetForm();
    await loadSummary();
  } catch (error) {
    errorMessage.value = error.message || "No se pudo guardar la recarga.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadSessionUser();
  await loadSummary();
});
</script>

<template>
  <section class="fuel-page">
    <div class="fuel-shell">
      <header class="fuel-header">
        <p class="fuel-kicker">Operacion</p>
        <h1>Reporte de combustible</h1>
        <p>El chofer registra cada recarga cuando surte, sin depender del reporte diario del vehiculo.</p>
      </header>

      <form class="fuel-card" @submit.prevent="submitFuelReport">
        <div class="fuel-grid">
          <label>
            Chofer en sesion
            <div class="session-pill" :class="{ 'session-pill-error': !chofer }">{{ chofer || "Sesion no disponible" }}</div>
          </label>
          <label>
            Placa
            <input v-model="placa" type="text" required placeholder="Ej. A12BCD" />
          </label>
          <label>
            Tipo combustible
            <select v-model="fuelType" required>
              <option value="gasoil">Gasoil</option>
              <option value="gasolina">Gasolina</option>
            </select>
          </label>
          <label>
            Litros
            <input v-model="liters" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            Odometro (km)
            <input v-model="odometerKm" type="number" min="0" step="0.1" required />
          </label>
          <label>
            Monto total (opcional)
            <input v-model="totalAmount" type="number" min="0" step="0.01" />
          </label>
          <label>
            Estacion (opcional)
            <input v-model="station" type="text" maxlength="80" placeholder="Ej. PDV Centro" />
          </label>
          <label class="field-wide">
            Nota (opcional)
            <textarea v-model="notes" rows="2" placeholder="Observaciones de la recarga" />
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="loading || !canSubmit">{{ loading ? "Guardando..." : "Guardar recarga" }}</button>
          <button type="button" class="secondary-btn" :disabled="summaryLoading" @click="loadSummary">{{ summaryLoading ? "Actualizando..." : "Actualizar resumen" }}</button>
        </div>

        <p v-if="errorMessage" class="feedback feedback-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="feedback feedback-success">{{ successMessage }}</p>
      </form>

      <section class="fuel-card">
        <h2>Consumo diario (ultimos 14 dias)</h2>
        <p v-if="summaryError" class="feedback feedback-error">{{ summaryError }}</p>
        <p v-else-if="!summary.length" class="muted">Sin recargas registradas en el periodo.</p>
        <div v-else class="summary-grid">
          <article v-for="day in summary" :key="day.date" class="summary-item">
            <strong>{{ day.date }}</strong>
            <span>Recargas: {{ day.refills }}</span>
            <span>Litros: {{ day.litersTotal }}</span>
            <span>Km estimados: {{ day.distanceKmTotal }}</span>
            <span>Rendimiento: {{ day.kmPerLiter == null ? "N/A" : `${day.kmPerLiter} km/L` }}</span>
            <span v-if="day.amountTotal > 0">Monto: {{ day.amountTotal }}</span>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.fuel-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2.5rem;
  background:
    radial-gradient(circle at 14% 10%, rgba(245, 158, 11, 0.22), transparent 25%),
    radial-gradient(circle at 84% 10%, rgba(59, 130, 246, 0.2), transparent 28%),
    linear-gradient(180deg, #08111d 0%, #0f223b 55%, #091220 100%);
  color: #f3f6fb;
}

.fuel-shell {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.fuel-header h1,
.fuel-header p,
.fuel-kicker {
  margin: 0;
}

.fuel-kicker {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  color: #ffd59a;
}

.fuel-header h1 {
  margin-top: 0.35rem;
  font-size: clamp(1.7rem, 4vw, 2.8rem);
}

.fuel-header p {
  margin-top: 0.7rem;
  color: rgba(243, 246, 251, 0.76);
}

.fuel-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 18, 32, 0.72);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.2);
  padding: 1rem;
}

.fuel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.fuel-grid label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.field-wide {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  width: 100%;
  min-height: 42px;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.95);
  color: #15253f;
}

textarea {
  min-height: 80px;
  resize: vertical;
}

.session-pill {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.session-pill-error {
  border-color: rgba(248, 113, 113, 0.5);
}

.form-actions {
  margin-top: 0.8rem;
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

button {
  min-height: 42px;
  padding: 0.55rem 0.9rem;
  border: none;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  font-weight: 700;
  cursor: pointer;
}

.secondary-btn {
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.feedback {
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
}

.feedback-error {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.32);
}

.feedback-success {
  color: #bbf7d0;
  background: rgba(21, 128, 61, 0.3);
}

.muted {
  color: rgba(243, 246, 251, 0.74);
}

.summary-grid {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.7rem;
}

.summary-item {
  display: grid;
  gap: 0.22rem;
  padding: 0.75rem;
  border-radius: 14px;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
}

.summary-item strong {
  font-size: 0.9rem;
}

.summary-item span {
  color: rgba(243, 246, 251, 0.8);
  font-size: 0.85rem;
}

@media (max-width: 900px) {
  .fuel-grid {
    grid-template-columns: 1fr;
  }

  button {
    width: 100%;
  }
}
</style>
