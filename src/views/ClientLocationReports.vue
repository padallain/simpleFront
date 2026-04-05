<script setup>
import { computed, ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const adminKey = ref("");
const reports = ref([]);
const errorMessage = ref("");
const feedback = ref("");
const loading = ref(false);
const deletingClientId = ref("");
const deletingReportId = ref("");

const canLoad = computed(() => adminKey.value.trim().length > 0);

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-MX");
}

async function loadReports() {
  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/clientLocationReports`);

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      reports.value = [];
      errorMessage.value = result?.message || "No se pudo cargar la lista de denuncias.";
      return;
    }

    reports.value = Array.isArray(result?.reports) ? result.reports : [];
    feedback.value = reports.value.length
      ? `Se cargaron ${reports.value.length} denuncias.`
      : "No hay denuncias registradas por ahora.";
  } catch (error) {
    reports.value = [];
    errorMessage.value = `Error cargando denuncias: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function deleteClient(report) {
  const clientId = report?.clientId ? String(report.clientId).trim() : "";

  if (!clientId) {
    errorMessage.value = "La denuncia no tiene un ID de cliente válido.";
    return;
  }

  if (!canLoad.value) {
    errorMessage.value = "Ingresa la clave de administrador.";
    return;
  }

  const confirmed = window.confirm(
    `Se eliminará el cliente con ID ${clientId}. La denuncia seguirá visible como historial. ¿Deseas continuar?`,
  );

  if (!confirmed) {
    return;
  }

  deletingClientId.value = clientId;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/deleteClient/${clientId}`, {
      method: "DELETE",
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo eliminar el cliente.";
      return;
    }

    feedback.value = `Cliente ${clientId} eliminado correctamente.`;
    reports.value = reports.value.map((currentReport) => {
      if (currentReport._id !== report._id) {
        return currentReport;
      }

      return {
        ...currentReport,
        clientFound: false,
        clientSnapshot: null,
      };
    });
  } catch (error) {
    errorMessage.value = `Error eliminando cliente: ${error.message}`;
  } finally {
    deletingClientId.value = "";
  }
}

async function deleteReport(report) {
  const reportId = report?._id ? String(report._id).trim() : "";

  if (!reportId) {
    errorMessage.value = "La denuncia no tiene un folio válido.";
    return;
  }

  if (!canLoad.value) {
    errorMessage.value = "Ingresa la clave de administrador.";
    return;
  }

  const confirmed = window.confirm(
    `Se eliminará la denuncia ${reportId}. Esta acción no se puede deshacer. ¿Deseas continuar?`,
  );

  if (!confirmed) {
    return;
  }

  deletingReportId.value = reportId;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/clientLocationReports/${reportId}`, {
      method: "DELETE",
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo eliminar la denuncia.";
      return;
    }

    feedback.value = `Denuncia ${reportId} eliminada correctamente.`;
    reports.value = reports.value.filter((currentReport) => currentReport._id !== reportId);
  } catch (error) {
    errorMessage.value = `Error eliminando denuncia: ${error.message}`;
  } finally {
    deletingReportId.value = "";
  }
}
</script>

<template>
  <section class="reports-page">
    <div class="reports-shell">
      <div class="reports-hero">
        <p class="reports-kicker">Denuncias publicas</p>
        <h1>Lista de denuncias</h1>
        <p class="reports-copy">
          Esta vista puede consultarse sin clave. La clave interna solo se usa para borrar clientes o eliminar denuncias.
        </p>
      </div>

      <div class="reports-card">
        <div class="field-group">
          <label for="adminKey">Clave de administrador</label>
          <input id="adminKey" v-model="adminKey" type="password" placeholder="Solo necesaria para eliminar" />
        </div>

        <div class="reports-actions">
          <button class="primary-button" :disabled="loading" @click="loadReports">
            {{ loading ? "Cargando..." : "Ver denuncias" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="feedback-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="feedback-card feedback-success">{{ feedback }}</div>

      <div v-if="reports.length" class="reports-list">
        <article v-for="report in reports" :key="report._id" class="reports-card report-item">
          <div class="report-item-header">
            <div>
              <strong>Cliente {{ report.clientId }}</strong>
              <p>{{ formatDate(report.createdAt) }}</p>
            </div>
            <span :class="report.clientFound ? 'status-found' : 'status-missing'">
              {{ report.clientFound ? "Cliente encontrado" : "Cliente no encontrado" }}
            </span>
          </div>

          <div class="report-meta">
            <span><strong>Folio:</strong> {{ report._id }}</span>
            <span><strong>Reportó:</strong> {{ report.reporterName || "Sin nombre" }}</span>
          </div>

          <p class="report-details">{{ report.details }}</p>

          <p class="report-actions-label">Acciones de la denuncia</p>

          <div class="report-actions-row">
            <button
              class="danger-button"
              :disabled="deletingClientId === report.clientId"
              @click="deleteClient(report)"
            >
              {{ deletingClientId === report.clientId ? "Eliminando..." : "Eliminar cliente" }}
            </button>
            <button
              class="ghost-danger-button"
              :disabled="deletingReportId === report._id"
              @click="deleteReport(report)"
            >
              {{ deletingReportId === report._id ? "Borrando reporte..." : "Borrar reporte" }}
            </button>
          </div>

          <details v-if="report.clientSnapshot">
            <summary>Snapshot del cliente</summary>
            <pre>{{ JSON.stringify(report.clientSnapshot, null, 2) }}</pre>
          </details>
        </article>
      </div>

      <div v-else-if="!loading" class="feedback-card feedback-info">
        No hay denuncias cargadas o todavía no has consultado la lista.
      </div>
    </div>
  </section>
</template>

<style scoped>
.reports-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(255, 153, 102, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(69, 167, 255, 0.14), transparent 30%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.reports-shell {
  max-width: 980px;
  margin: 0 auto;
  color: #f3f6fb;
}

.reports-hero {
  margin-bottom: 1.25rem;
}

.reports-kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #ffbf9f;
}

.reports-hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.8rem);
}

.reports-copy {
  max-width: 700px;
  margin-top: 0.8rem;
  color: rgba(243, 246, 251, 0.78);
}

.reports-card,
.feedback-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-group label {
  font-weight: 600;
}

.field-group input {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.reports-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 1rem;
}

.report-actions-row {
  display: flex;
  gap: 0.8rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.report-actions-label {
  margin: 0;
  font-weight: 700;
  color: rgba(243, 246, 251, 0.9);
}

.primary-button {
  min-height: 46px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.danger-button {
  min-height: 44px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.ghost-danger-button {
  min-height: 44px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 139, 102, 0.45);
  cursor: pointer;
  font-weight: 700;
  color: #ffcab8;
  background: rgba(217, 72, 95, 0.08);
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.danger-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ghost-danger-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.reports-list {
  display: grid;
  gap: 1rem;
}

.report-item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.report-item-header p {
  margin: 0.35rem 0 0;
  color: rgba(243, 246, 251, 0.68);
}

.report-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
  color: rgba(243, 246, 251, 0.82);
}

.report-details {
  margin: 1rem 0;
  white-space: pre-wrap;
}

.status-found,
.status-missing {
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.status-found {
  background: rgba(141, 240, 180, 0.16);
  color: #8df0b4;
}

.status-missing {
  background: rgba(255, 180, 180, 0.16);
  color: #ffb4b4;
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

details {
  margin-top: 0.8rem;
}

summary {
  cursor: pointer;
  font-weight: 700;
}

pre {
  margin: 0.8rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .reports-page {
    padding: 1rem 0.75rem 2rem;
  }

  .report-actions-row {
    flex-direction: column;
  }

  .primary-button,
  .danger-button,
  .ghost-danger-button {
    width: 100%;
  }
}
</style>