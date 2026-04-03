<script setup>
import { computed, reactive, ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const adminKey = ref("");
const reports = ref([]);
const errorMessage = ref("");
const feedback = ref("");
const loading = ref(false);
const editingReportId = ref("");
const savingReportId = ref("");
const deletingReportId = ref("");
const editForm = reactive({
  orderNumber: "",
  items: [],
});

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

function formatPresentation(value) {
  return value === "caja" ? "Caja" : "Unidad";
}

function createIssueItem(item = {}) {
  return {
    productId: String(item.productId || ""),
    novelty: String(item.novelty || ""),
    presentationType: item.presentationType === "caja" ? "caja" : "unidad",
    quantity: Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1,
  };
}

function startEdit(report) {
  editingReportId.value = String(report?._id || "");
  editForm.orderNumber = String(report?.orderNumber || "");
  editForm.items = Array.isArray(report?.items) && report.items.length
    ? report.items.map((item) => createIssueItem(item))
    : [createIssueItem()];
  errorMessage.value = "";
  feedback.value = "";
}

function cancelEdit() {
  editingReportId.value = "";
  editForm.orderNumber = "";
  editForm.items = [];
}

function addEditItem() {
  editForm.items.push(createIssueItem());
}

function removeEditItem(index) {
  if (editForm.items.length === 1) {
    editForm.items[0] = createIssueItem();
    return;
  }

  editForm.items.splice(index, 1);
}

function buildEditPayload() {
  return {
    orderNumber: String(editForm.orderNumber || "").trim(),
    items: editForm.items.map((item) => ({
      productId: String(item.productId || "").trim(),
      novelty: String(item.novelty || "").trim(),
      presentationType: item.presentationType,
      quantity: Number(item.quantity),
    })),
  };
}

function hasInvalidItems(items) {
  return items.some((item) => {
    if (!item.productId || !item.novelty) {
      return true;
    }

    if (!["caja", "unidad"].includes(item.presentationType)) {
      return true;
    }

    return !Number.isInteger(item.quantity) || item.quantity < 1;
  });
}

async function loadReports() {
  if (!canLoad.value) {
    errorMessage.value = "Ingresa la clave de administrador.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/dispatchIssueReports`, {
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      reports.value = [];
      errorMessage.value = result?.message || "No se pudieron cargar las novedades de despacho.";
      return;
    }

    reports.value = Array.isArray(result?.reports) ? result.reports : [];
    feedback.value = reports.value.length
      ? `Se cargaron ${reports.value.length} reportes de novedades.`
      : "No hay novedades registradas por ahora.";
  } catch (error) {
    reports.value = [];
    errorMessage.value = `Error cargando novedades: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function saveReport(report) {
  const reportId = String(report?._id || "");

  if (!reportId) {
    errorMessage.value = "El reporte no tiene un folio valido.";
    return;
  }

  if (!canLoad.value) {
    errorMessage.value = "Ingresa la clave de administrador.";
    return;
  }

  const payload = buildEditPayload();

  if (!payload.orderNumber) {
    errorMessage.value = "Debes indicar el numero de pedido.";
    return;
  }

  if (!payload.items.length || hasInvalidItems(payload.items)) {
    errorMessage.value = "Cada producto debe tener ID, novedad, tipo caja o unidad y cantidad valida.";
    return;
  }

  savingReportId.value = reportId;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/dispatchIssueReports/${reportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-delete-key": adminKey.value.trim(),
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo actualizar la novedad.";
      return;
    }

    reports.value = reports.value.map((currentReport) => (
      currentReport._id === reportId ? result.report : currentReport
    ));
    feedback.value = `Novedad ${reportId} actualizada correctamente.`;
    cancelEdit();
  } catch (error) {
    errorMessage.value = `Error actualizando novedad: ${error.message}`;
  } finally {
    savingReportId.value = "";
  }
}

async function deleteReport(report) {
  const reportId = String(report?._id || "");

  if (!reportId) {
    errorMessage.value = "El reporte no tiene un folio valido.";
    return;
  }

  if (!canLoad.value) {
    errorMessage.value = "Ingresa la clave de administrador.";
    return;
  }

  const confirmed = window.confirm(`Se eliminara la novedad ${reportId}. Esta accion no se puede deshacer. Deseas continuar?`);

  if (!confirmed) {
    return;
  }

  deletingReportId.value = reportId;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/dispatchIssueReports/${reportId}`, {
      method: "DELETE",
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo eliminar la novedad.";
      return;
    }

    reports.value = reports.value.filter((currentReport) => currentReport._id !== reportId);
    feedback.value = `Novedad ${reportId} eliminada correctamente.`;

    if (editingReportId.value === reportId) {
      cancelEdit();
    }
  } catch (error) {
    errorMessage.value = `Error eliminando novedad: ${error.message}`;
  } finally {
    deletingReportId.value = "";
  }
}
</script>

<template>
  <section class="reports-page">
    <div class="reports-shell">
      <div class="reports-hero">
        <p class="reports-kicker">Ruta interna</p>
        <h1>Novedades de despacho</h1>
        <p class="reports-copy">
          Aqui puedes ver los reportes enviados por los choferes para validar pedidos con productos en novedad.
        </p>
      </div>

      <div class="reports-card">
        <div class="field-group">
          <label for="adminKey">Clave de administrador</label>
          <input id="adminKey" v-model="adminKey" type="password" placeholder="Ingresa la clave interna" />
        </div>

        <div class="reports-actions">
          <button class="primary-button" :disabled="loading || !canLoad" @click="loadReports">
            {{ loading ? "Cargando..." : "Ver novedades" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="feedback-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="feedback-card feedback-success">{{ feedback }}</div>

      <div v-if="reports.length" class="reports-list">
        <article v-for="report in reports" :key="report._id" class="reports-card report-item">
          <div class="report-item-header">
            <div>
              <strong>{{ report.clientName }} - Cliente {{ report.clientId }}</strong>
              <p>{{ formatDate(report.createdAt) }}</p>
            </div>
            <span class="status-pill">Pedido {{ report.orderNumber }}</span>
          </div>

          <div class="report-meta">
            <span><strong>Folio:</strong> {{ report._id }}</span>
            <span><strong>Ruta:</strong> {{ report.routeLabel || "Sin etiqueta" }}</span>
            <span><strong>Chofer:</strong> {{ report.driverName || report.driverId }}</span>
            <span><strong>Parada:</strong> {{ report.stopOrder }}</span>
          </div>

          <div class="report-actions-row">
            <button class="secondary-button" type="button" @click="startEdit(report)">
              {{ editingReportId === report._id ? "Editando" : "Editar" }}
            </button>
            <button
              class="danger-button"
              type="button"
              :disabled="deletingReportId === report._id"
              @click="deleteReport(report)"
            >
              {{ deletingReportId === report._id ? "Eliminando..." : "Eliminar" }}
            </button>
          </div>

          <form
            v-if="editingReportId === report._id"
            class="edit-form"
            @submit.prevent="saveReport(report)"
          >
            <label class="field-group">
              <span>Numero de pedido</span>
              <input v-model="editForm.orderNumber" type="text" placeholder="Ej. PED-10294" />
            </label>

            <div class="items-list">
              <article v-for="(item, index) in editForm.items" :key="`edit-${report._id}-${index}`" class="item-card item-card-edit">
                <div class="item-head">
                  <strong>Producto {{ index + 1 }}</strong>
                  <button class="ghost-button" type="button" @click="removeEditItem(index)">
                    {{ editForm.items.length === 1 ? "Limpiar producto" : "Quitar producto" }}
                  </button>
                </div>

                <div class="edit-grid">
                  <label class="field-group">
                    <span>ID del producto</span>
                    <input v-model="item.productId" type="text" />
                  </label>
                  <label class="field-group">
                    <span>Presentacion</span>
                    <select v-model="item.presentationType">
                      <option value="unidad">Unidad</option>
                      <option value="caja">Caja</option>
                    </select>
                  </label>
                  <label class="field-group">
                    <span>Cantidad</span>
                    <input v-model.number="item.quantity" type="number" min="1" step="1" />
                  </label>
                  <label class="field-group field-group-full">
                    <span>Novedad</span>
                    <textarea v-model="item.novelty" rows="3" />
                  </label>
                </div>
              </article>
            </div>

            <div class="report-actions-row">
              <button class="secondary-button" type="button" @click="addEditItem">Agregar producto</button>
              <button class="ghost-button" type="button" @click="cancelEdit">Cancelar</button>
              <button class="primary-button" type="submit" :disabled="savingReportId === report._id">
                {{ savingReportId === report._id ? "Guardando..." : "Guardar cambios" }}
              </button>
            </div>
          </form>

          <div class="items-list">
            <article v-for="(item, index) in report.items || []" :key="`${report._id}-${index}`" class="item-card">
              <div class="item-head">
                <strong>Producto {{ index + 1 }}</strong>
                <span>{{ formatPresentation(item.presentationType) }} x {{ item.quantity }}</span>
              </div>
              <p><strong>ID del producto:</strong> {{ item.productId }}</p>
              <p class="item-novelty"><strong>Novedad:</strong> {{ item.novelty }}</p>
            </article>
          </div>
        </article>
      </div>

      <div v-else-if="!loading" class="feedback-card feedback-info">
        No hay novedades cargadas o todavia no has consultado la lista.
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
  max-width: 1040px;
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

.reports-actions,
.report-actions-row,
.report-meta,
.report-item-header,
.item-head {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.reports-actions {
  margin-top: 1rem;
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

.secondary-button,
.danger-button,
.ghost-button {
  min-height: 44px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
}

.secondary-button {
  border: none;
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.danger-button {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.ghost-button {
  color: #d7e8ff;
  background: rgba(69, 167, 255, 0.16);
  border: 1px solid rgba(69, 167, 255, 0.32);
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.secondary-button:disabled,
.danger-button:disabled,
.ghost-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.reports-list,
.items-list {
  display: grid;
  gap: 1rem;
}

.edit-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.field-group span {
  font-size: 0.9rem;
  color: rgba(243, 246, 251, 0.86);
}

.field-group-full {
  grid-column: 1 / -1;
}

.field-group textarea,
.field-group select {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.item-card-edit {
  background: rgba(255, 213, 154, 0.05);
}

.report-item-header {
  align-items: flex-start;
  justify-content: space-between;
}

.report-item-header p {
  margin: 0.35rem 0 0;
  color: rgba(243, 246, 251, 0.68);
}

.report-meta {
  margin-top: 0.9rem;
  color: rgba(243, 246, 251, 0.82);
}

.status-pill {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  background: rgba(141, 240, 180, 0.16);
  color: #8df0b4;
}

.item-card {
  padding: 0.95rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.item-head {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.7rem;
}

.item-card p {
  margin: 0.3rem 0;
}

.item-novelty {
  white-space: pre-wrap;
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

@media (max-width: 640px) {
  .reports-page {
    padding: 1rem 0.75rem 2rem;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>