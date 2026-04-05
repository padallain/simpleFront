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

      <div class="admin-toolbar">
        <label for="adminKey">Clave interna</label>
        <input id="adminKey" v-model="adminKey" type="password" placeholder="Solo necesaria para editar o borrar" />
      </div>

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

    <section v-if="editingReport" class="edit-panel">
      <div class="edit-panel-header">
        <div>
          <p class="eyebrow">Edicion activa</p>
          <h2>Editar daily check de {{ editingReport.placa }}</h2>
          <p class="hero-copy compact-copy">
            Ajusta los datos del reporte sin expandir la tarjeta. Los cambios se guardan con la clave interna.
          </p>
        </div>

        <button class="secondary-button report-action-button" type="button" @click="cancelEdit">
          Cerrar editor
        </button>
      </div>

      <form class="edit-card edit-panel-card" @submit.prevent="guardarReporte(editingReport)">
        <div class="edit-grid compact-grid">
          <label>
            <span>Chofer</span>
            <input v-model="editForm.chofer" type="text" />
          </label>
          <label>
            <span>Placa</span>
            <input v-model="editForm.placa" type="text" />
          </label>
          <label>
            <span>Modelo</span>
            <input v-model="editForm.modelo" type="text" />
          </label>
          <label>
            <span>Ano</span>
            <input v-model="editForm.anio" type="number" min="1900" step="1" />
          </label>
          <label class="edit-full">
            <span>Observaciones</span>
            <textarea v-model="editForm.observaciones" rows="3" />
          </label>
        </div>

        <div class="edit-checklist">
          <article
            v-for="(item, index) in editForm.checklist"
            :key="`${editingReport._id}-edit-${index}`"
            class="edit-check-item"
          >
            <div class="edit-check-header">
              <strong>{{ item.nombre || `Item ${index + 1}` }}</strong>
              <span :class="item.estado === 'NO_OK' ? 'status-pill status-pill-alert' : 'status-pill status-pill-ok'">
                {{ item.estado === "NO_OK" ? "No OK" : "OK" }}
              </span>
            </div>

            <div class="edit-grid compact-grid">
              <label>
                <span>Item</span>
                <input v-model="item.nombre" type="text" />
              </label>
              <label>
                <span>Estado</span>
                <div class="status-toggle" role="radiogroup" aria-label="Estado del item">
                  <button
                    type="button"
                    class="status-toggle-button"
                    :class="item.estado === 'OK' ? 'status-toggle-button-active status-toggle-button-ok' : ''"
                    :aria-pressed="item.estado === 'OK'"
                    @click="item.estado = 'OK'"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    class="status-toggle-button"
                    :class="item.estado === 'NO_OK' ? 'status-toggle-button-active status-toggle-button-alert' : ''"
                    :aria-pressed="item.estado === 'NO_OK'"
                    @click="item.estado = 'NO_OK'"
                  >
                    No OK
                  </button>
                </div>
              </label>
              <label class="edit-full">
                <span>Comentario</span>
                <textarea v-model="item.comentario" rows="2" :disabled="item.estado !== 'NO_OK'" />
              </label>
            </div>
          </article>
        </div>

        <div class="report-actions">
          <button class="secondary-button report-action-button muted-button" type="button" @click="cancelEdit">
            Cancelar
          </button>
          <button class="primary-button report-action-button" type="submit" :disabled="savingReportId === editingReport._id">
            {{ savingReportId === editingReport._id ? "Guardando..." : "Guardar cambios" }}
          </button>
        </div>
      </form>
    </section>

    <p v-if="errorMensaje" class="feedback error-text">
      {{ errorMensaje }}
    </p>

    <p v-if="feedbackMensaje" class="feedback success-text">
      {{ feedbackMensaje }}
    </p>

    <p v-if="cargando" class="feedback">
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

          <div class="report-actions">
            <button class="secondary-button report-action-button" type="button" @click="startEdit(reporte)">
              {{ editingReportId === reporte._id ? "Editor abierto" : "Editar" }}
            </button>
            <button
              class="danger-button report-action-button"
              type="button"
              :disabled="deletingReportId === reporte._id"
              @click="eliminarReporte(reporte)"
            >
              {{ deletingReportId === reporte._id ? "Eliminando..." : "Borrar" }}
            </button>
          </div>
        </footer>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  API_BASE_URL,
  deleteDailyCheckById,
  fetchDailyChecksByPlaca,
  fetchRecentDailyChecks,
  updateDailyCheckById,
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
const feedbackMensaje = ref("");
const modoActual = ref("recientes");
const adminKey = ref("");
const editingReportId = ref("");
const savingReportId = ref("");
const deletingReportId = ref("");
const editForm = reactive({
  chofer: "",
  placa: "",
  modelo: "",
  anio: "",
  observaciones: "",
  checklist: [],
});

const tituloListado = computed(() =>
  modoActual.value === "placa" && placaBusqueda.value.trim()
    ? `Resultados para ${placaBusqueda.value.trim().toUpperCase()}`
    : "Ultimos 20 reportes",
);

const editingReport = computed(() =>
  reportes.value.find((reporte) => reporte._id === editingReportId.value) || null,
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

function crearChecklistItem(item = {}) {
  return {
    nombre: String(item.nombre || ""),
    estado: item.estado === "NO_OK" ? "NO_OK" : "OK",
    comentario: String(item.comentario || ""),
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

function startEdit(reporte) {
  editingReportId.value = String(reporte?._id || "");
  editForm.chofer = String(reporte?.chofer || "");
  editForm.placa = String(reporte?.placa || "");
  editForm.modelo = String(reporte?.modelo || "");
  editForm.anio = String(reporte?.anio || "");
  editForm.observaciones = String(reporte?.observaciones || "");
  editForm.checklist = Array.isArray(reporte?.checklist) && reporte.checklist.length
    ? reporte.checklist.map((item) => crearChecklistItem(item))
    : [];
  errorMensaje.value = "";
  feedbackMensaje.value = "";
}

function cancelEdit() {
  editingReportId.value = "";
  editForm.chofer = "";
  editForm.placa = "";
  editForm.modelo = "";
  editForm.anio = "";
  editForm.observaciones = "";
  editForm.checklist = [];
}

function validarEditForm() {
  if (!editForm.chofer.trim() || !editForm.placa.trim() || !editForm.modelo.trim() || !String(editForm.anio).trim()) {
    return "Chofer, placa, modelo y ano son obligatorios.";
  }

  if (!Array.isArray(editForm.checklist) || !editForm.checklist.length) {
    return "El checklist no puede quedar vacio.";
  }

  const invalidItem = editForm.checklist.find((item) => {
    if (!item.nombre.trim()) {
      return true;
    }

    if (!["OK", "NO_OK"].includes(item.estado)) {
      return true;
    }

    return item.estado === "NO_OK" && !item.comentario.trim();
  });

  if (invalidItem) {
    return "Cada item debe tener nombre, estado valido y comentario si esta en No OK.";
  }

  return "";
}

async function cargarRecientes() {
  cargando.value = true;
  errorMensaje.value = "";
  feedbackMensaje.value = "";
  modoActual.value = "recientes";

  try {
    const result = await fetchRecentDailyChecks(20);
    reportes.value = (result?.reportes || []).map(normalizarReporte);
  } catch (error) {
    reportes.value = [];
    errorMensaje.value = error.message;
  } finally {
    cargando.value = false;
  }
}

async function buscarPorPlaca() {
  const placa = placaBusqueda.value.trim().toUpperCase();

  if (!placa) {
    await cargarRecientes();
    return;
  }

  cargando.value = true;
  errorMensaje.value = "";
  feedbackMensaje.value = "";
  modoActual.value = "placa";

  try {
    const result = await fetchDailyChecksByPlaca(placa);
    reportes.value = (result?.reportes || []).map(normalizarReporte);
    placaBusqueda.value = placa;
  } catch (error) {
    reportes.value = [];
    errorMensaje.value = error.message;
  } finally {
    cargando.value = false;
  }
}

async function guardarReporte(reporte) {
  const reporteId = String(reporte?._id || "");

  if (!reporteId) {
    errorMensaje.value = "El reporte no tiene un identificador valido.";
    return;
  }

  if (!adminKey.value.trim()) {
    errorMensaje.value = "Ingresa la clave interna para editar.";
    return;
  }

  const validationError = validarEditForm();

  if (validationError) {
    errorMensaje.value = validationError;
    return;
  }

  savingReportId.value = reporteId;
  errorMensaje.value = "";
  feedbackMensaje.value = "";

  try {
    const result = await updateDailyCheckById(
      reporteId,
      {
        chofer: editForm.chofer.trim(),
        placa: editForm.placa.trim(),
        modelo: editForm.modelo.trim(),
        anio: Number(editForm.anio),
        observaciones: editForm.observaciones.trim(),
        checklist: editForm.checklist.map((item) => ({
          nombre: item.nombre.trim(),
          estado: item.estado,
          comentario: item.comentario.trim(),
        })),
      },
      adminKey.value.trim(),
    );

    const normalized = normalizarReporte(result?.dailyCheck || result);
    reportes.value = reportes.value.map((current) => current._id === reporteId ? normalized : current);
    feedbackMensaje.value = `Reporte ${reporteId} actualizado correctamente.`;
    cancelEdit();
  } catch (error) {
    errorMensaje.value = error.message;
  } finally {
    savingReportId.value = "";
  }
}

async function eliminarReporte(reporte) {
  const reporteId = String(reporte?._id || "");

  if (!reporteId) {
    errorMensaje.value = "El reporte no tiene un identificador valido.";
    return;
  }

  if (!adminKey.value.trim()) {
    errorMensaje.value = "Ingresa la clave interna para borrar.";
    return;
  }

  const confirmed = window.confirm(`Se eliminara el daily check ${reporteId}. Deseas continuar?`);

  if (!confirmed) {
    return;
  }

  deletingReportId.value = reporteId;
  errorMensaje.value = "";
  feedbackMensaje.value = "";

  try {
    await deleteDailyCheckById(reporteId, adminKey.value.trim());
    reportes.value = reportes.value.filter((current) => current._id !== reporteId);
    feedbackMensaje.value = `Reporte ${reporteId} eliminado correctamente.`;

    if (editingReportId.value === reporteId) {
      cancelEdit();
    }
  } catch (error) {
    errorMensaje.value = error.message;
  } finally {
    deletingReportId.value = "";
  }
}

onMounted(() => {
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

.search-form,
.admin-toolbar {
  display: grid;
  gap: 0.8rem;
}

.search-form label,
.admin-toolbar label,
.summary-label {
  color: rgba(243, 246, 251, 0.7);
}

.search-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-row input,
.admin-toolbar input {
  min-height: 48px;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6fb;
}

.search-row input {
  flex: 1 1 260px;
}

.search-row button,
.report-action-button {
  min-height: 48px;
  padding: 0.85rem 1.25rem;
  border: none;
  border-radius: 16px;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.search-row button:disabled,
.report-action-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.primary-button,
.search-row button {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.secondary-button,
.muted-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.danger-button {
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
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

.edit-panel {
  max-width: 1180px;
  margin: 1.25rem auto 0;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(7, 17, 31, 0.72);
  border: 1px solid rgba(69, 167, 255, 0.22);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.2);
}

.edit-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.compact-copy {
  margin-bottom: 0;
}

.error-text {
  color: #ff9f9f;
}

.success-text {
  color: #8df0b4;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

.report-meta,
.report-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: rgba(243, 246, 251, 0.82);
}

.checklist-section,
.edit-checklist {
  display: grid;
  gap: 0.7rem;
}

.check-item,
.edit-check-item {
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

.edit-check-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.edit-check-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.8rem;
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

.status-pill-ok {
  background: rgba(42, 181, 125, 0.16);
  color: #9bf0c4;
}

.status-pill-alert {
  background: rgba(255, 117, 102, 0.18);
  color: #ffb7ad;
}

.check-comment,
.report-footer p {
  margin: 0.55rem 0 0;
  color: rgba(243, 246, 251, 0.8);
}

.edit-card {
  display: grid;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.edit-panel-card {
  padding-top: 0;
  border-top: none;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.compact-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.edit-grid label {
  display: grid;
  gap: 0.35rem;
}

.edit-grid span {
  color: rgba(243, 246, 251, 0.7);
}

.edit-grid input,
.edit-grid textarea {
  min-height: 44px;
  padding: 0.8rem 0.9rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6fb;
}

.status-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.status-toggle-button {
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(243, 246, 251, 0.78);
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.status-toggle-button:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.28);
}

.status-toggle-button-active {
  color: #f3f6fb;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.status-toggle-button-ok {
  background: linear-gradient(135deg, rgba(42, 181, 125, 0.32), rgba(42, 181, 125, 0.14));
  border-color: rgba(42, 181, 125, 0.5);
}

.status-toggle-button-alert {
  background: linear-gradient(135deg, rgba(255, 117, 102, 0.32), rgba(255, 117, 102, 0.14));
  border-color: rgba(255, 117, 102, 0.55);
}

.edit-full {
  grid-column: 1 / -1;
}

@media (max-width: 960px) {
  .hero-panel,
  .edit-panel-header,
  .report-header,
  .report-actions,
  .report-meta,
  .check-item-head,
  .edit-check-header,
  .search-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-row button,
  .search-row input,
  .admin-toolbar input,
  .back-link,
  .report-action-button {
    width: 100%;
  }

  .edit-grid,
  .compact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .history-page {
    padding: 1.2rem 0.8rem 2rem;
  }

  .timestamp-block {
    text-align: left;
  }
}
</style>