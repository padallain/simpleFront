<script setup>
import { computed, ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const clientId = ref("");
const reporterName = ref("");
const details = ref("");
const clientData = ref(null);
const lookupMessage = ref("");
const errorMessage = ref("");
const feedback = ref("");
const lookupLoading = ref(false);
const submitLoading = ref(false);

const canLookup = computed(() => clientId.value.trim().length > 0);
const canSubmit = computed(() => clientId.value.trim().length > 0 && details.value.trim().length > 0);

async function lookupClient() {
  if (!canLookup.value) {
    errorMessage.value = "Ingresa el ID del cliente para validarlo.";
    return;
  }

  lookupLoading.value = true;
  errorMessage.value = "";
  feedback.value = "";
  lookupMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${clientId.value.trim()}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      clientData.value = null;
      lookupMessage.value = result?.message || "No se encontró el cliente con ese ID.";
      return;
    }

    clientData.value = result;
    lookupMessage.value = "Cliente encontrado. Ya puedes enviar la denuncia.";
  } catch (error) {
    clientData.value = null;
    errorMessage.value = `Error consultando cliente: ${error.message}`;
  } finally {
    lookupLoading.value = false;
  }
}

async function submitReport() {
  if (!canSubmit.value) {
    errorMessage.value = "Ingresa el ID del cliente y describe el problema.";
    return;
  }

  submitLoading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/clientLocationReports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: clientId.value.trim(),
        reporterName: reporterName.value.trim(),
        details: details.value.trim(),
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo registrar la denuncia.";
      return;
    }

    feedback.value = result?.clientFound
      ? `Denuncia registrada con folio ${result.reportId}. El equipo técnico revisará el cliente.`
      : `Denuncia registrada con folio ${result.reportId}. No se encontró un cliente activo con ese ID, pero el reporte quedó guardado.`;
    details.value = "";
    reporterName.value = "";
  } catch (error) {
    errorMessage.value = `Error enviando denuncia: ${error.message}`;
  } finally {
    submitLoading.value = false;
  }
}
</script>

<template>
  <section class="report-page">
    <div class="report-shell">
      <div class="report-hero">
        <p class="report-kicker">Novedades de ubicación</p>
        <h1>Reportar cliente mal ubicado</h1>
        <p class="report-copy">
          Usa esta pantalla para avisar que un cliente quedó registrado en una ubicación incorrecta. El reporte queda guardado y la corrección o eliminación se hace manualmente en MongoDB.
        </p>
      </div>

      <div class="report-card">
        <div class="report-grid">
          <div class="field-group">
            <label for="clientId">ID del cliente</label>
            <input id="clientId" v-model="clientId" type="text" placeholder="Ej. 1042" />
          </div>
          <div class="field-group">
            <label for="reporterName">Tu nombre (opcional)</label>
            <input id="reporterName" v-model="reporterName" type="text" placeholder="Para identificar el reporte" />
          </div>
          <div class="field-group field-group-full">
            <label for="details">Describe el error</label>
            <textarea
              id="details"
              v-model="details"
              rows="5"
              placeholder="Ej. El pin quedó en otra calle, la casa correcta está dos cuadras al norte."
            />
          </div>
        </div>

        <div class="report-actions">
          <button class="secondary-button" :disabled="lookupLoading || !canLookup" @click="lookupClient">
            {{ lookupLoading ? "Validando..." : "Validar cliente" }}
          </button>
          <button class="primary-button" :disabled="submitLoading || !canSubmit" @click="submitReport">
            {{ submitLoading ? "Enviando..." : "Enviar denuncia" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="feedback-card feedback-error">{{ errorMessage }}</div>
      <div v-if="lookupMessage" class="feedback-card feedback-info">{{ lookupMessage }}</div>
      <div v-if="feedback" class="feedback-card feedback-success">{{ feedback }}</div>

      <div v-if="clientData" class="report-card result-card">
        <div class="result-header">
          <strong>Cliente localizado</strong>
          <a v-if="clientData.googleMapsLink" :href="clientData.googleMapsLink" target="_blank" rel="noreferrer">
            Ver ubicación en Google Maps
          </a>
        </div>
        <pre>{{ JSON.stringify(clientData, null, 2) }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
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