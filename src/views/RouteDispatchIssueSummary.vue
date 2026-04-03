<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const route = useRoute();
const router = useRouter();
const routeSummary = ref(null);
const reports = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const feedback = ref("");
const adminKey = ref("");
const editingReportId = ref("");
const savingReportId = ref("");
const deletingReportId = ref("");
const editForm = reactive({
  orderNumber: "",
  items: [],
});

const groupedReports = computed(() => {
  const groups = new Map();

  reports.value.forEach((report) => {
    const key = String(report.clientId || "sin-cliente");
    const currentGroup = groups.get(key) || {
      clientId: report.clientId,
      clientName: report.clientName,
      entries: [],
    };

    currentGroup.entries.push(report);
    groups.set(key, currentGroup);
  });

  return Array.from(groups.values());
});

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("es-MX");
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

async function loadSummary() {
  const routeId = String(route.params.routeId || "").trim();

  if (!routeId) {
    errorMessage.value = "No se recibio un ID de ruta valido.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeId}/issues-summary`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeSummary.value = null;
      reports.value = [];
      errorMessage.value = result?.message || "No se pudo cargar el resumen de novedades.";
      return;
    }

    routeSummary.value = result?.route || null;
    reports.value = Array.isArray(result?.reports) ? result.reports : [];
  } catch (error) {
    routeSummary.value = null;
    reports.value = [];
    errorMessage.value = `Error cargando resumen: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.back();
}

async function saveReport(report) {
  const reportId = String(report?._id || "");

  if (!reportId) {
    errorMessage.value = "El reporte no tiene un folio valido.";
    return;
  }

  if (!adminKey.value.trim()) {
    errorMessage.value = "Ingresa la clave de administrador para editar.";
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

  if (!adminKey.value.trim()) {
    errorMessage.value = "Ingresa la clave de administrador para eliminar.";
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

onMounted(loadSummary);
</script>

<template>
  <section class="summary-page">
    <div class="summary-shell">
      <div class="summary-hero">
        <p class="summary-kicker">Resumen de ruta</p>
        <h1>Novedades reportadas</h1>
        <p class="summary-copy">
          Esta vista resume las novedades de una ruta por cliente para que se vea exactamente lo que el chofer reporto.
        </p>
      </div>

      <div class="summary-card actions-card">
        <button class="ghost-button" type="button" @click="goBack">Volver</button>
        <label class="admin-key-group">
          <span>Clave de administrador</span>
          <input v-model="adminKey" type="password" placeholder="Necesaria para editar o eliminar" />
        </label>
      </div>

      <div v-if="errorMessage" class="summary-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="summary-card feedback-success">{{ feedback }}</div>

      <div v-if="routeSummary" class="summary-card">
        <div class="route-meta">
          <span><strong>Ruta:</strong> {{ routeSummary.routeLabel }}</span>
          <span><strong>ID de ruta:</strong> {{ routeSummary.routeId }}</span>
          <span><strong>Chofer:</strong> {{ routeSummary.driverName || routeSummary.driverId }}</span>
          <span><strong>Estado:</strong> {{ routeSummary.status }}</span>
          <span><strong>Clientes:</strong> {{ routeSummary.uniqueClientCount }}</span>
          <span><strong>Peso total:</strong> {{ routeSummary.totalWeight }}</span>
        </div>
      </div>

      <div v-if="loading" class="summary-card feedback-info">Cargando novedades...</div>

      <div v-else-if="groupedReports.length" class="client-groups">
        <article v-for="group in groupedReports" :key="group.clientId" class="summary-card client-card">
          <div class="client-head">
            <div>
              <strong>{{ group.clientName }}</strong>
              <p>Cliente {{ group.clientId }}</p>
            </div>
            <span class="count-pill">{{ group.entries.length }} reportes</span>
          </div>

          <div class="report-list">
            <article v-for="entry in group.entries" :key="entry._id" class="report-entry">
              <div class="entry-head">
                <div>
                  <strong>Pedido {{ entry.orderNumber }}</strong>
                  <p>{{ formatDate(entry.createdAt) }}</p>
                </div>
                <span class="entry-pill">Parada {{ entry.stopOrder }}</span>
              </div>

              <div class="entry-actions">
                <button class="secondary-button" type="button" @click="startEdit(entry)">
                  {{ editingReportId === entry._id ? "Editando" : "Editar" }}
                </button>
                <button
                  class="danger-button"
                  type="button"
                  :disabled="deletingReportId === entry._id"
                  @click="deleteReport(entry)"
                >
                  {{ deletingReportId === entry._id ? "Eliminando..." : "Eliminar" }}
                </button>
              </div>

              <form v-if="editingReportId === entry._id" class="edit-form" @submit.prevent="saveReport(entry)">
                <label class="field-group">
                  <span>Numero de pedido</span>
                  <input v-model="editForm.orderNumber" type="text" placeholder="Ej. PED-10294" />
                </label>

                <div class="items-list">
                  <article v-for="(item, index) in editForm.items" :key="`edit-${entry._id}-${index}`" class="item-card item-card-edit">
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

                <div class="entry-actions">
                  <button class="secondary-button" type="button" @click="addEditItem">Agregar producto</button>
                  <button class="ghost-button" type="button" @click="cancelEdit">Cancelar</button>
                  <button class="primary-button" type="submit" :disabled="savingReportId === entry._id">
                    {{ savingReportId === entry._id ? "Guardando..." : "Guardar cambios" }}
                  </button>
                </div>
              </form>

              <div class="items-list">
                <article v-for="(item, index) in entry.items || []" :key="`${entry._id}-${index}`" class="item-card">
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
        </article>
      </div>

      <div v-else-if="routeSummary && !loading" class="summary-card feedback-info">
        Esta ruta no tiene novedades reportadas todavia.
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(71, 157, 255, 0.2), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 196, 120, 0.18), transparent 30%),
    linear-gradient(180deg, #08111d 0%, #10213c 52%, #08111d 100%);
}

.summary-shell {
  max-width: 1080px;
  margin: 0 auto;
  color: #f3f6fb;
}

.summary-hero {
  margin-bottom: 1.25rem;
}

.summary-kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.summary-copy {
  max-width: 720px;
  color: rgba(243, 246, 251, 0.78);
}

.summary-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.72);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

.actions-card,
.route-meta,
.client-head,
.entry-head,
.item-head,
.entry-actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.route-meta,
.client-head,
.entry-head,
.item-head {
  justify-content: space-between;
}

.ghost-button {
  min-height: 44px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  color: #d7e8ff;
  background: rgba(69, 167, 255, 0.16);
  border: 1px solid rgba(69, 167, 255, 0.32);
}

.primary-button,
.secondary-button,
.danger-button {
  min-height: 44px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  border: none;
}

.primary-button {
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.secondary-button {
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.danger-button {
  color: #fff;
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled,
.ghost-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.admin-key-group,
.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.admin-key-group {
  flex: 1 1 320px;
}

.admin-key-group span,
.field-group span {
  font-size: 0.9rem;
  color: rgba(243, 246, 251, 0.86);
}

.admin-key-group input,
.field-group input,
.field-group select,
.field-group textarea {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
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

.field-group-full {
  grid-column: 1 / -1;
}

.client-groups,
.report-list,
.items-list {
  display: grid;
  gap: 1rem;
}

.client-card,
.report-entry,
.item-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.report-entry,
.item-card {
  padding: 0.95rem;
  border-radius: 18px;
}

.item-card-edit {
  background: rgba(255, 213, 154, 0.05);
}

.client-head p,
.entry-head p {
  margin: 0.35rem 0 0;
  color: rgba(243, 246, 251, 0.68);
}

.count-pill,
.entry-pill {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.count-pill {
  background: rgba(141, 240, 180, 0.16);
  color: #8df0b4;
}

.entry-pill {
  background: rgba(255, 213, 154, 0.16);
  color: #ffd59a;
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

@media (max-width: 720px) {
  .summary-page {
    padding: 1rem 0.75rem 2rem;
  }

  .route-meta,
  .client-head,
  .entry-head,
  .item-head,
  .entry-actions,
  .actions-card {
    flex-direction: column;
    align-items: stretch;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>