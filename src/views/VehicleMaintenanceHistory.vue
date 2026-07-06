<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  createVehicleMaintenance,
  deleteVehicleMaintenanceById,
  fetchRecentVehicleMaintenance,
  fetchUpcomingVehicleMaintenance,
  fetchVehicleMaintenanceByPlaca,
  updateVehicleMaintenanceById,
} from "../services/vehicleMaintenanceApi";

const maintenanceRecords = ref([]);
const upcomingMaintenance = ref([]);
const placaBusqueda = ref("");
const adminKey = ref("");
const loading = ref(false);
const submitting = ref(false);
const savingRecordId = ref("");
const deletingRecordId = ref("");
const currentViewLabel = ref("Ultimos mantenimientos");
const errorMessage = ref("");
const feedbackMessage = ref("");
const editingRecordId = ref("");

const maintenanceForm = reactive(createEmptyMaintenanceForm());

function createEmptyItem() {
  return {
    descripcion: "",
    categoria: "preventivo",
    costo: 0,
  };
}

function createEmptyMaintenanceForm() {
  return {
    placa: "",
    modelo: "",
    anio: "",
    tipoServicio: "preventivo",
    estado: "completado",
    fechaServicio: new Date().toISOString().slice(0, 10),
    fechaProximoServicio: "",
    kilometraje: 0,
    taller: "",
    tecnicoResponsable: "",
    titulo: "",
    descripcion: "",
    moneda: "USD",
    costoTotal: 0,
    items: [createEmptyItem()],
  };
}

const totalCostFromItems = computed(() => maintenanceForm.items.reduce((sum, item) => sum + (Number(item.costo) || 0), 0));
const completedCount = computed(() => maintenanceRecords.value.filter((record) => record.estado === "completado").length);
const pendingCount = computed(() => maintenanceRecords.value.filter((record) => record.estado !== "completado").length);

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatUpcomingStatus(record) {
  const daysUntilService = Number(record?.daysUntilService);

  if (!Number.isFinite(daysUntilService)) {
    return "Sin fecha calculable";
  }

  if (daysUntilService < 0) {
    return `Atrasado por ${Math.abs(daysUntilService)} dia(s)`;
  }

  if (daysUntilService === 0) {
    return "Programado para hoy";
  }

  return `Faltan ${daysUntilService} dia(s)`;
}

function syncCostWithItems() {
  maintenanceForm.costoTotal = Number(totalCostFromItems.value.toFixed(2));
}

function resetForm() {
  Object.assign(maintenanceForm, createEmptyMaintenanceForm());
  editingRecordId.value = "";
}

function normalizePayload(form) {
  return {
    placa: String(form.placa || "").trim().toUpperCase(),
    modelo: String(form.modelo || "").trim(),
    anio: form.anio ? Number(form.anio) : null,
    tipoServicio: String(form.tipoServicio || "").trim(),
    estado: String(form.estado || "").trim(),
    fechaServicio: form.fechaServicio || "",
    fechaProximoServicio: form.fechaProximoServicio || "",
    kilometraje: Number(form.kilometraje) || 0,
    taller: String(form.taller || "").trim(),
    tecnicoResponsable: String(form.tecnicoResponsable || "").trim(),
    titulo: String(form.titulo || "").trim(),
    descripcion: String(form.descripcion || "").trim(),
    moneda: String(form.moneda || "USD").trim().toUpperCase(),
    costoTotal: Number(form.costoTotal) || 0,
    items: form.items
      .map((item) => ({
        descripcion: String(item.descripcion || "").trim(),
        categoria: String(item.categoria || "otro").trim(),
        costo: Number(item.costo) || 0,
      }))
      .filter((item) => item.descripcion),
  };
}

function upsertMaintenanceRecord(record) {
  const recordId = String(record?._id || "");

  if (!recordId) {
    return;
  }

  const existingIndex = maintenanceRecords.value.findIndex((item) => item._id === recordId);

  if (existingIndex >= 0) {
    maintenanceRecords.value = maintenanceRecords.value.map((item) => (
      item._id === recordId ? record : item
    ));
    return;
  }

  maintenanceRecords.value = [record, ...maintenanceRecords.value];
}

function startEdit(record) {
  editingRecordId.value = String(record?._id || "");
  Object.assign(maintenanceForm, {
    placa: String(record?.placa || ""),
    modelo: String(record?.modelo || ""),
    anio: record?.anio || "",
    tipoServicio: String(record?.tipoServicio || "preventivo"),
    estado: String(record?.estado || "completado"),
    fechaServicio: record?.fechaServicio ? String(record.fechaServicio).slice(0, 10) : "",
    fechaProximoServicio: record?.fechaProximoServicio ? String(record.fechaProximoServicio).slice(0, 10) : "",
    kilometraje: Number(record?.kilometraje) || 0,
    taller: String(record?.taller || ""),
    tecnicoResponsable: String(record?.tecnicoResponsable || ""),
    titulo: String(record?.titulo || ""),
    descripcion: String(record?.descripcion || ""),
    moneda: String(record?.moneda || "USD"),
    costoTotal: Number(record?.costoTotal) || 0,
    items: Array.isArray(record?.items) && record.items.length
      ? record.items.map((item) => ({
        descripcion: String(item?.descripcion || ""),
        categoria: String(item?.categoria || "otro"),
        costo: Number(item?.costo) || 0,
      }))
      : [createEmptyItem()],
  });
  feedbackMessage.value = "";
  errorMessage.value = "";
}

function addItem() {
  maintenanceForm.items.push(createEmptyItem());
}

function removeItem(index) {
  if (maintenanceForm.items.length === 1) {
    maintenanceForm.items[0] = createEmptyItem();
    syncCostWithItems();
    return;
  }

  maintenanceForm.items.splice(index, 1);
  syncCostWithItems();
}

async function loadRecentMaintenance() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const result = await fetchRecentVehicleMaintenance();
    maintenanceRecords.value = Array.isArray(result?.mantenimientos) ? result.mantenimientos : [];
    currentViewLabel.value = "Ultimos mantenimientos";
    feedbackMessage.value = maintenanceRecords.value.length
      ? `Se cargaron ${maintenanceRecords.value.length} registros de mantenimiento.`
      : "No hay mantenimientos registrados por ahora.";
  } catch (error) {
    maintenanceRecords.value = [];
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function loadUpcomingMaintenance() {
  try {
    const result = await fetchUpcomingVehicleMaintenance();
    upcomingMaintenance.value = Array.isArray(result?.mantenimientos) ? result.mantenimientos : [];
  } catch (_error) {
    upcomingMaintenance.value = [];
  }
}

async function completeUpcomingMaintenance(record) {
  const recordId = String(record?._id || "");
  const normalizedAdminKey = adminKey.value.trim();

  if (!recordId) {
    errorMessage.value = "El mantenimiento no tiene un identificador valido.";
    feedbackMessage.value = "";
    return;
  }

  if (!normalizedAdminKey) {
    errorMessage.value = "Ingresa la clave interna para marcar el mantenimiento como completado.";
    feedbackMessage.value = "";
    return;
  }

  savingRecordId.value = recordId;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const payload = normalizePayload({
      ...record,
      estado: "completado",
      fechaServicio: new Date().toISOString().slice(0, 10),
      fechaProximoServicio: record?.fechaProximoServicio ? String(record.fechaProximoServicio).slice(0, 10) : "",
      items: Array.isArray(record?.items) ? record.items : [],
    });
    const result = await updateVehicleMaintenanceById(recordId, payload, normalizedAdminKey);

    upcomingMaintenance.value = upcomingMaintenance.value.filter((item) => item._id !== recordId);
    upsertMaintenanceRecord(result.maintenance);
    feedbackMessage.value = `Mantenimiento de ${result.maintenance?.placa || record.placa} marcado como completado.`;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    savingRecordId.value = "";
  }
}

async function searchByPlaca() {
  const placa = placaBusqueda.value.trim();

  if (!placa) {
    errorMessage.value = "Ingresa una placa para consultar el historial.";
    feedbackMessage.value = "";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const result = await fetchVehicleMaintenanceByPlaca(placa);
    maintenanceRecords.value = Array.isArray(result?.mantenimientos) ? result.mantenimientos : [];
    currentViewLabel.value = `Historial de ${result?.placa || placa.toUpperCase()}`;
    feedbackMessage.value = `Se cargaron ${maintenanceRecords.value.length} mantenimientos para ${result?.placa || placa.toUpperCase()}.`;
  } catch (error) {
    maintenanceRecords.value = [];
    currentViewLabel.value = `Historial de ${placa.toUpperCase()}`;
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function submitMaintenance() {
  const payload = normalizePayload(maintenanceForm);
  const normalizedAdminKey = adminKey.value.trim();

  if (!payload.placa || !payload.titulo || !payload.tipoServicio || !payload.fechaServicio) {
    errorMessage.value = "Placa, titulo, tipo de servicio y fecha del servicio son obligatorios.";
    feedbackMessage.value = "";
    return;
  }

  if (!normalizedAdminKey) {
    errorMessage.value = "Ingresa la clave interna para guardar el mantenimiento.";
    feedbackMessage.value = "";
    return;
  }

  submitting.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    if (editingRecordId.value) {
      savingRecordId.value = editingRecordId.value;
      const result = await updateVehicleMaintenanceById(editingRecordId.value, payload, normalizedAdminKey);
      maintenanceRecords.value = maintenanceRecords.value.map((record) => (
        record._id === editingRecordId.value ? result.maintenance : record
      ));
      await loadUpcomingMaintenance();
      feedbackMessage.value = `Mantenimiento ${editingRecordId.value} actualizado correctamente.`;
    } else {
      const result = await createVehicleMaintenance(payload, normalizedAdminKey);
      maintenanceRecords.value = [result.maintenance, ...maintenanceRecords.value];
      await loadUpcomingMaintenance();
      feedbackMessage.value = `Mantenimiento de ${payload.placa} guardado correctamente.`;
    }

    resetForm();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
    savingRecordId.value = "";
  }
}

async function deleteRecord(record) {
  const recordId = String(record?._id || "");

  if (!recordId) {
    errorMessage.value = "El mantenimiento no tiene un identificador valido.";
    return;
  }

  if (!adminKey.value.trim()) {
    errorMessage.value = "Ingresa la clave interna para borrar el mantenimiento.";
    return;
  }

  const confirmed = window.confirm(`Se eliminara el mantenimiento ${record.titulo || recordId} del vehiculo ${record.placa}. Deseas continuar?`);

  if (!confirmed) {
    return;
  }

  deletingRecordId.value = recordId;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    await deleteVehicleMaintenanceById(recordId, adminKey.value.trim());
    maintenanceRecords.value = maintenanceRecords.value.filter((item) => item._id !== recordId);
    await loadUpcomingMaintenance();
    feedbackMessage.value = `Mantenimiento ${recordId} eliminado correctamente.`;

    if (editingRecordId.value === recordId) {
      resetForm();
    }
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    deletingRecordId.value = "";
  }
}

onMounted(() => {
  loadRecentMaintenance();
  loadUpcomingMaintenance();
  syncCostWithItems();
});
</script>

<template>
  <section class="maintenance-page">
    <div class="maintenance-shell">
      <div class="hero-panel">
        <div>
          <p class="eyebrow">Taller y reparaciones</p>
          <h1>Historial de mantenimiento vehicular</h1>
          <p class="hero-copy">
            Este modulo guarda servicios preventivos, reparaciones, repuestos y trabajos de taller por vehiculo.
            No reemplaza el Daily Check: el chequeo diario sigue siendo solo una inspeccion operativa del turno.
          </p>
        </div>

        <div class="hero-actions">
          <RouterLink class="secondary-link" to="/daily-check">
            Ir a Daily Check
          </RouterLink>
          <button class="primary-button" type="button" :disabled="loading" @click="loadRecentMaintenance">
            {{ loading ? "Actualizando..." : "Ver recientes" }}
          </button>
        </div>
      </div>

      <div class="summary-grid">
        <article class="summary-card accent-blue">
          <span class="summary-label">Registros visibles</span>
          <strong>{{ maintenanceRecords.length }}</strong>
          <small>{{ currentViewLabel }}</small>
        </article>
        <article class="summary-card accent-green">
          <span class="summary-label">Completados</span>
          <strong>{{ completedCount }}</strong>
          <small>Servicios o reparaciones cerradas</small>
        </article>
        <article class="summary-card accent-gold">
          <span class="summary-label">Pendientes</span>
          <strong>{{ pendingCount }}</strong>
          <small>Programados o en proceso</small>
        </article>
        <article class="summary-card accent-rose">
          <span class="summary-label">Costo actual</span>
          <strong>{{ formatCurrency(totalCostFromItems || maintenanceForm.costoTotal, maintenanceForm.moneda) }}</strong>
          <small>Calculado desde el formulario actual</small>
        </article>
      </div>

      <section class="panel-card upcoming-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Pendientes por cercania</p>
            <h2>Proximos mantenimientos</h2>
          </div>
          <span class="status-pill">{{ upcomingMaintenance.length }} pendientes</span>
        </div>

        <p v-if="!upcomingMaintenance.length" class="feedback">
          No hay proximos mantenimientos programados por ahora.
        </p>

        <div v-else class="upcoming-grid">
          <article v-for="record in upcomingMaintenance" :key="`upcoming-${record._id}`" class="upcoming-card" :class="record.isOverdue ? 'upcoming-card-overdue' : ''">
            <div>
              <p class="plate-badge">{{ record.placa }}</p>
              <h3>{{ record.titulo }}</h3>
              <p class="record-meta">{{ record.modelo || 'Modelo no registrado' }} · {{ record.tipoServicio }}</p>
            </div>

            <div class="upcoming-copy">
              <span><strong>Proximo servicio:</strong> {{ formatDate(record.fechaProximoServicio) }}</span>
              <span><strong>Estado:</strong> {{ formatUpcomingStatus(record) }}</span>
              <span><strong>Km actual:</strong> {{ record.kilometraje || 0 }}</span>
              <span><strong>Taller:</strong> {{ record.taller || 'No indicado' }}</span>
            </div>

            <div class="upcoming-actions">
              <button class="primary-button" type="button" :disabled="savingRecordId === record._id" @click="completeUpcomingMaintenance(record)">
                {{ savingRecordId === record._id ? 'Guardando...' : 'Marcar como completado' }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <div class="maintenance-layout">
        <section class="panel-card form-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Registro independiente</p>
              <h2>{{ editingRecordId ? 'Editar mantenimiento' : 'Nuevo mantenimiento' }}</h2>
            </div>
            <button v-if="editingRecordId" class="ghost-button" type="button" @click="resetForm">
              Cancelar edicion
            </button>
          </div>

          <form class="maintenance-form" @submit.prevent="submitMaintenance">
            <div class="form-grid">
              <label class="field-group">
                <span>Placa</span>
                <input v-model="maintenanceForm.placa" type="text" placeholder="ABC123" />
              </label>
              <label class="field-group">
                <span>Modelo</span>
                <input v-model="maintenanceForm.modelo" type="text" placeholder="NPR / Hino / etc" />
              </label>
              <label class="field-group">
                <span>Ano</span>
                <input v-model="maintenanceForm.anio" type="number" min="1900" max="2100" />
              </label>
              <label class="field-group">
                <span>Kilometraje</span>
                <input v-model="maintenanceForm.kilometraje" type="number" min="0" step="1" />
              </label>
              <label class="field-group">
                <span>Tipo de servicio</span>
                <select v-model="maintenanceForm.tipoServicio">
                  <option value="preventivo">Preventivo</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="revision">Revision</option>
                  <option value="reparacion">Reparacion</option>
                </select>
              </label>
              <label class="field-group">
                <span>Estado</span>
                <select v-model="maintenanceForm.estado">
                  <option value="programado">Programado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="completado">Completado</option>
                </select>
              </label>
              <label class="field-group">
                <span>Fecha del servicio</span>
                <input v-model="maintenanceForm.fechaServicio" type="date" />
              </label>
              <label class="field-group">
                <span>Proximo servicio</span>
                <input v-model="maintenanceForm.fechaProximoServicio" type="date" />
              </label>
              <label class="field-group field-group-wide">
                <span>Titulo</span>
                <input v-model="maintenanceForm.titulo" type="text" placeholder="Cambio de aceite y filtros" />
              </label>
              <label class="field-group field-group-wide">
                <span>Descripcion</span>
                <textarea v-model="maintenanceForm.descripcion" rows="3" placeholder="Que se hizo, por que se hizo y que quedo pendiente" />
              </label>
              <label class="field-group">
                <span>Taller</span>
                <input v-model="maintenanceForm.taller" type="text" placeholder="Nombre del taller" />
              </label>
              <label class="field-group">
                <span>Tecnico responsable</span>
                <input v-model="maintenanceForm.tecnicoResponsable" type="text" placeholder="Responsable o proveedor" />
              </label>
              <label class="field-group">
                <span>Moneda</span>
                <input v-model="maintenanceForm.moneda" type="text" maxlength="6" placeholder="USD" />
              </label>
              <label class="field-group">
                <span>Costo total</span>
                <input v-model="maintenanceForm.costoTotal" type="number" min="0" step="0.01" />
              </label>
            </div>

            <div class="items-card">
              <div class="panel-header panel-header-tight">
                <div>
                  <p class="panel-kicker">Detalle opcional</p>
                  <h3>Items del mantenimiento</h3>
                </div>
                <button class="ghost-button" type="button" @click="addItem">
                  Agregar item
                </button>
              </div>

              <article v-for="(item, index) in maintenanceForm.items" :key="`item-${index}`" class="item-row">
                <label class="field-group field-group-wide">
                  <span>Descripcion</span>
                  <input v-model="item.descripcion" type="text" placeholder="Filtro de aceite, pastillas, mano de obra, etc" @input="syncCostWithItems" />
                </label>
                <label class="field-group">
                  <span>Categoria</span>
                  <select v-model="item.categoria">
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="reparacion">Reparacion</option>
                    <option value="repuesto">Repuesto</option>
                    <option value="inspeccion">Inspeccion</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <label class="field-group">
                  <span>Costo</span>
                  <input v-model="item.costo" type="number" min="0" step="0.01" @input="syncCostWithItems" />
                </label>
                <button class="danger-inline-button" type="button" @click="removeItem(index)">
                  Quitar
                </button>
              </article>
            </div>

            <div class="admin-row">
              <label class="field-group field-group-wide">
                <span>Clave interna</span>
                <input v-model="adminKey" type="password" placeholder="Necesaria para editar o borrar registros existentes" />
              </label>
            </div>

            <div class="form-actions">
              <button class="primary-button" type="submit" :disabled="submitting || (Boolean(editingRecordId) && savingRecordId === editingRecordId)">
                {{ submitting ? 'Guardando...' : editingRecordId ? 'Guardar cambios' : 'Guardar mantenimiento' }}
              </button>
            </div>
          </form>
        </section>

        <section class="panel-card history-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Consulta</p>
              <h2>{{ currentViewLabel }}</h2>
            </div>
          </div>

          <form class="search-row" @submit.prevent="searchByPlaca">
            <input v-model="placaBusqueda" type="text" placeholder="Buscar por placa" />
            <button class="primary-button" type="submit" :disabled="loading">Buscar</button>
            <button class="ghost-button" type="button" :disabled="loading" @click="loadRecentMaintenance">Recientes</button>
          </form>

          <p v-if="errorMessage" class="feedback error-text">
            {{ errorMessage }}
          </p>

          <p v-else-if="feedbackMessage" class="feedback success-text">
            {{ feedbackMessage }}
          </p>

          <p v-if="loading" class="feedback">Cargando historial...</p>
          <p v-else-if="!maintenanceRecords.length" class="feedback">No hay registros para mostrar.</p>

          <div v-else class="records-grid">
            <article v-for="record in maintenanceRecords" :key="record._id" class="record-card">
              <div class="record-header">
                <div>
                  <p class="plate-badge">{{ record.placa }}</p>
                  <h3>{{ record.titulo }}</h3>
                  <p class="record-meta">{{ record.modelo || 'Modelo no registrado' }} · {{ record.tipoServicio }}</p>
                </div>
                <span class="status-pill" :class="`status-${record.estado}`">{{ record.estado }}</span>
              </div>

              <div class="record-summary">
                <span><strong>Fecha:</strong> {{ formatDate(record.fechaServicio) }}</span>
                <span><strong>Km:</strong> {{ record.kilometraje || 0 }}</span>
                <span><strong>Costo:</strong> {{ formatCurrency(record.costoTotal, record.moneda) }}</span>
              </div>

              <p class="record-description">
                {{ record.descripcion || 'Sin descripcion adicional.' }}
              </p>

              <div v-if="record.items?.length" class="record-items">
                <strong>Detalle</strong>
                <ul>
                  <li v-for="(item, index) in record.items" :key="`${record._id}-item-${index}`">
                    {{ item.descripcion }} · {{ item.categoria }} · {{ formatCurrency(item.costo, record.moneda) }}
                  </li>
                </ul>
              </div>

              <div class="record-footer">
                <div class="record-footer-copy">
                  <span><strong>Taller:</strong> {{ record.taller || 'No indicado' }}</span>
                  <span><strong>Responsable:</strong> {{ record.tecnicoResponsable || 'No indicado' }}</span>
                  <span><strong>Proximo servicio:</strong> {{ formatDate(record.fechaProximoServicio) }}</span>
                </div>

                <div class="record-actions">
                  <button class="ghost-button" type="button" @click="startEdit(record)">
                    {{ editingRecordId === record._id ? 'Editando' : 'Editar' }}
                  </button>
                  <button class="danger-button" type="button" :disabled="deletingRecordId === record._id" @click="deleteRecord(record)">
                    {{ deletingRecordId === record._id ? 'Eliminando...' : 'Borrar' }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(255, 176, 103, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(69, 167, 255, 0.14), transparent 30%),
    linear-gradient(180deg, #10151f 0%, #192739 45%, #0d1420 100%);
}

.maintenance-shell {
  max-width: 1320px;
  margin: 0 auto;
  color: #eef4fb;
}

.hero-panel,
.panel-card,
.summary-card,
.record-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 18, 31, 0.72);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.18);
}

.hero-panel,
.panel-card {
  padding: 1.2rem;
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.eyebrow,
.panel-kicker {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #ffb067;
}

.hero-copy {
  max-width: 760px;
  color: rgba(238, 244, 251, 0.8);
}

.hero-actions,
.search-row,
.form-actions,
.record-actions,
.record-footer,
.panel-header {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.summary-grid,
.maintenance-layout {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.maintenance-layout {
  grid-template-columns: minmax(340px, 460px) minmax(0, 1fr);
  align-items: start;
}

.upcoming-grid {
  display: grid;
  gap: 0.9rem;
  margin-top: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

.upcoming-card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  min-height: 100%;
  border-radius: 20px;
  border: 1px solid rgba(255, 176, 103, 0.18);
  background: rgba(255, 255, 255, 0.04);
}

.upcoming-card-overdue {
  border-color: rgba(255, 120, 120, 0.32);
  background: rgba(255, 120, 120, 0.07);
}

.upcoming-copy {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.8rem;
  color: rgba(238, 244, 251, 0.78);
}

.upcoming-actions {
  display: flex;
  justify-content: stretch;
  margin-top: auto;
  padding-top: 1rem;
}

.upcoming-actions .primary-button {
  width: 100%;
}

.summary-card {
  padding: 1rem;
}

.summary-label,
.record-meta,
.feedback,
.record-description,
.record-footer-copy,
.record-items,
.hero-panel small,
.summary-card small {
  color: rgba(238, 244, 251, 0.72);
}

.summary-card strong {
  display: block;
  margin: 0.35rem 0;
  font-size: 1.7rem;
}

.accent-blue { border-color: rgba(101, 187, 255, 0.24); }
.accent-green { border-color: rgba(141, 240, 180, 0.24); }
.accent-gold { border-color: rgba(255, 208, 120, 0.24); }
.accent-rose { border-color: rgba(255, 144, 144, 0.24); }

.form-grid,
.item-row,
.record-summary,
.record-footer-copy {
  display: grid;
  gap: 0.8rem;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-group-wide {
  grid-column: 1 / -1;
}

input,
select,
textarea,
.primary-button,
.secondary-link,
.ghost-button,
.danger-button,
.danger-inline-button {
  border-radius: 16px;
}

input,
select,
textarea {
  width: 100%;
  min-height: 46px;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #1c2431;
}

textarea {
  min-height: 110px;
  resize: vertical;
}

.maintenance-form,
.records-grid,
.items-card {
  display: grid;
  gap: 1rem;
}

.items-card {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-header-tight {
  margin-bottom: 0.4rem;
}

.item-row {
  grid-template-columns: minmax(0, 1.8fr) minmax(160px, 0.8fr) minmax(140px, 0.8fr) auto;
  align-items: end;
  padding: 0.9rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.primary-button,
.ghost-button,
.danger-button,
.danger-inline-button,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0.8rem 1rem;
  border: none;
  text-decoration: none;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  color: #fff;
  background: linear-gradient(135deg, #ffb067 0%, #ea580c 100%);
}

.ghost-button,
.secondary-link {
  color: #eef4fb;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.danger-button,
.danger-inline-button {
  color: #fff;
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.danger-inline-button {
  min-width: 96px;
}

.plate-badge,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-weight: 700;
}

.plate-badge {
  background: rgba(255, 176, 103, 0.16);
  color: #ffcf9f;
}

.status-pill {
  text-transform: capitalize;
  background: rgba(255, 255, 255, 0.08);
}

.status-completado { color: #8df0b4; background: rgba(141, 240, 180, 0.16); }
.status-en_proceso { color: #ffd077; background: rgba(255, 208, 119, 0.16); }
.status-programado { color: #9fd1ff; background: rgba(159, 209, 255, 0.16); }

.record-card {
  padding: 1rem;
}

.record-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.record-summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0.9rem 0;
}

.record-items ul {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}

.admin-row {
  margin-top: 0.4rem;
}

.error-text { color: #ffb4b4; }
.success-text { color: #8df0b4; }

@media (max-width: 1080px) {
  .summary-grid,
  .maintenance-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .form-grid,
  .record-summary,
  .item-row {
    grid-template-columns: 1fr;
  }

  .record-header,
  .record-footer,
  .hero-panel,
  .panel-header,
  .search-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .maintenance-page {
    padding: 1rem 0.75rem 2rem;
  }
}
</style>