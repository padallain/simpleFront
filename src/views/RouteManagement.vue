<script setup>
import { computed, reactive, ref } from "vue";
import { downloadLoadGuide } from "../services/loadGuidePdf";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const adminKey = ref("");
const savedRoutes = ref([]);
const routeAdminLoading = ref(false);
const routeAdminFeedback = ref("");
const routeAdminError = ref("");
const editingRouteId = ref("");
const savingRouteId = ref("");
const deletingRouteId = ref("");
const completingSelectedRoutes = ref(false);
const selectedRouteIds = ref([]);
const companyFilter = ref("");
const guideNumberFilter = ref("");
const editRouteForm = reactive({
  driverId: "",
  driverName: "",
  routeLabel: "",
  totalWeight: 0,
  status: "active",
});

const canManageRoutes = computed(() => adminKey.value.trim().length > 0);
const filteredRoutes = computed(() => {
  const companyQuery = companyFilter.value.trim().toLocaleLowerCase();
  const guideNumberQuery = guideNumberFilter.value.trim().toLocaleLowerCase();

  return savedRoutes.value.filter((route) => {
    const loadGuide = route?.loadGuide;
    const guides = loadGuide?.subGuides?.length ? loadGuide.subGuides : loadGuide ? [loadGuide] : [];
    const matchesCompany = !companyQuery || guides.some((guide) => {
      const companyNames = [guide.companyName, ...(guide.orders || []).flatMap((order) => [order.companyName, order.company])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return companyNames.includes(companyQuery);
    });
    const matchesGuideNumber = !guideNumberQuery || guides.some((guide) =>
      String(guide.number || "").toLocaleLowerCase().includes(guideNumberQuery));

    return matchesCompany && matchesGuideNumber;
  });
});
const selectableRouteIds = computed(() => filteredRoutes.value
  .filter((route) => String(route?.status || "").trim().toLowerCase() !== "completed")
  .map((route) => String(route?._id)));
const allPendingRoutesSelected = computed(() => selectableRouteIds.value.length > 0
  && selectableRouteIds.value.every((routeId) => selectedRouteIds.value.includes(routeId)));
const selectedRoutesCount = computed(() => savedRoutes.value.filter((route) =>
  selectedRouteIds.value.includes(String(route?._id))
  && String(route?.status || "").trim().toLowerCase() !== "completed",
).length);

function toggleSelectAllRoutes() {
  const visibleRouteIds = selectableRouteIds.value;
  selectedRouteIds.value = allPendingRoutesSelected.value
    ? selectedRouteIds.value.filter((routeId) => !visibleRouteIds.includes(routeId))
    : [...new Set([...selectedRouteIds.value, ...visibleRouteIds])];
}

function getGuideNumbers(route) {
  const loadGuide = route?.loadGuide;
  const guides = loadGuide?.subGuides?.length ? loadGuide.subGuides : loadGuide ? [loadGuide] : [];
  const labels = guides
    .map((guide) => {
      const number = String(guide?.number || "").trim();
      if (!number) return "";
      return guide.companyName ? `${guide.companyName}: ${number}` : number;
    })
    .filter(Boolean);

  return labels.length ? labels.join(" · ") : "Sin numero de guia";
}

function downloadGuide(route) {
  try {
    downloadLoadGuide(route.loadGuide, route);
  } catch (error) {
    routeAdminError.value = `No se pudo descargar la guia: ${error.message}`;
  }
}

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

async function loadSavedRoutes() {
  if (!canManageRoutes.value) {
    routeAdminError.value = "Ingresa la clave interna para administrar rutas.";
    return;
  }

  routeAdminLoading.value = true;
  routeAdminError.value = "";
  routeAdminFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/routes`, {
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      savedRoutes.value = [];
      routeAdminError.value = result?.message || "No se pudieron cargar las rutas guardadas.";
      return;
    }

    savedRoutes.value = Array.isArray(result?.routes) ? result.routes : [];
    selectedRouteIds.value = [];
    routeAdminFeedback.value = savedRoutes.value.length
      ? `Se cargaron ${savedRoutes.value.length} rutas guardadas.`
      : "No hay rutas guardadas por ahora.";
  } catch (error) {
    savedRoutes.value = [];
    routeAdminError.value = `Error cargando rutas: ${error.message}`;
  } finally {
    routeAdminLoading.value = false;
  }
}

function startRouteEdit(route) {
  editingRouteId.value = String(route?._id || "");
  editRouteForm.driverId = String(route?.driverId || "");
  editRouteForm.driverName = String(route?.driverName || "");
  editRouteForm.routeLabel = String(route?.routeLabel || "");
  editRouteForm.totalWeight = Number(route?.totalWeight || 0);
  editRouteForm.status = route?.status === "completed" ? "completed" : "active";
  routeAdminError.value = "";
  routeAdminFeedback.value = "";
}

function cancelRouteEdit() {
  editingRouteId.value = "";
  editRouteForm.driverId = "";
  editRouteForm.driverName = "";
  editRouteForm.routeLabel = "";
  editRouteForm.totalWeight = 0;
  editRouteForm.status = "active";
}

async function saveRoute(route) {
  const routeId = String(route?._id || "");

  if (!routeId) {
    routeAdminError.value = "La ruta no tiene un folio valido.";
    return;
  }

  if (!canManageRoutes.value) {
    routeAdminError.value = "Ingresa la clave interna para editar la ruta.";
    return;
  }

  const payload = {
    driverId: editRouteForm.driverId.trim(),
    driverName: editRouteForm.driverName.trim(),
    routeLabel: editRouteForm.routeLabel.trim(),
    totalWeight: Number(editRouteForm.totalWeight) || 0,
    status: editRouteForm.status,
  };

  if (!payload.driverId || !payload.routeLabel) {
    routeAdminError.value = "El ID del chofer y el nombre de la ruta son obligatorios.";
    return;
  }

  savingRouteId.value = routeId;
  routeAdminError.value = "";
  routeAdminFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/routes/${routeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-delete-key": adminKey.value.trim(),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeAdminError.value = result?.message || "No se pudo actualizar la ruta.";
      return;
    }

    savedRoutes.value = savedRoutes.value.map((currentRoute) => (
      currentRoute._id === routeId ? result.route : currentRoute
    ));
    routeAdminFeedback.value = `Ruta ${routeId} actualizada correctamente.`;
    cancelRouteEdit();
  } catch (error) {
    routeAdminError.value = `Error actualizando ruta: ${error.message}`;
  } finally {
    savingRouteId.value = "";
  }
}

async function completeSelectedRoutes() {
  if (!canManageRoutes.value) {
    routeAdminError.value = "Ingresa la clave interna para completar rutas.";
    return;
  }

  const pendingRoutes = savedRoutes.value.filter((route) => selectedRouteIds.value.includes(String(route?._id))
    && String(route?.status || "").trim().toLowerCase() !== "completed");

  if (!pendingRoutes.length) {
    routeAdminFeedback.value = "Selecciona al menos una guia pendiente por completar.";
    routeAdminError.value = "";
    return;
  }

  const confirmed = window.confirm(`Se marcaran ${pendingRoutes.length} rutas seleccionadas como completadas. Deseas continuar?`);

  if (!confirmed) {
    return;
  }

  completingSelectedRoutes.value = true;
  routeAdminError.value = "";
  routeAdminFeedback.value = "";

  try {
    let completedCount = 0;
    let failedCount = 0;
    const failedRouteIds = [];

    for (const route of pendingRoutes) {
      const routeId = String(route?._id || "");

      if (!routeId) {
        failedCount += 1;
        continue;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/internal/admin/routes/${routeId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-delete-key": adminKey.value.trim(),
          },
          body: JSON.stringify({
            driverId: String(route?.driverId || "").trim(),
            driverName: String(route?.driverName || "").trim(),
            routeLabel: String(route?.routeLabel || "").trim(),
            totalWeight: Number(route?.totalWeight) || 0,
            status: "completed",
          }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          failedCount += 1;
          failedRouteIds.push(routeId);
          console.error("Error completando ruta en lote:", routeId, result?.message || response.statusText);
          continue;
        }

        savedRoutes.value = savedRoutes.value.map((currentRoute) => (
          currentRoute._id === routeId ? { ...currentRoute, status: "completed" } : currentRoute
        ));
        completedCount += 1;
      } catch (error) {
        failedCount += 1;
        failedRouteIds.push(routeId);
        console.error("Fallo completando ruta en lote:", routeId, error);
      }
    }

    selectedRouteIds.value = failedRouteIds;

    if (failedCount === 0) {
      routeAdminFeedback.value = `Se completaron ${completedCount} guias seleccionadas correctamente.`;
      return;
    }

    routeAdminError.value = `Se completaron ${completedCount} rutas y ${failedCount} fallaron.`;
    routeAdminFeedback.value = "Algunas rutas quedaron pendientes. Revisa la lista y vuelve a intentar.";
  } catch (error) {
    routeAdminError.value = `Error completando las guias seleccionadas: ${error.message}`;
  } finally {
    completingSelectedRoutes.value = false;
  }
}

async function deleteRoute(route) {
  const routeId = String(route?._id || "");

  if (!routeId) {
    routeAdminError.value = "La ruta no tiene un folio valido.";
    return;
  }

  if (!canManageRoutes.value) {
    routeAdminError.value = "Ingresa la clave interna para eliminar la ruta.";
    return;
  }

  const confirmed = window.confirm(`Se eliminara la ruta ${route.routeLabel || routeId}. Esta accion tambien borrara sus novedades asociadas. Deseas continuar?`);

  if (!confirmed) {
    return;
  }

  deletingRouteId.value = routeId;
  routeAdminError.value = "";
  routeAdminFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/routes/${routeId}`, {
      method: "DELETE",
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeAdminError.value = result?.message || "No se pudo eliminar la ruta.";
      return;
    }

    savedRoutes.value = savedRoutes.value.filter((currentRoute) => currentRoute._id !== routeId);
    routeAdminFeedback.value = `Ruta ${routeId} eliminada correctamente.`;

    if (editingRouteId.value === routeId) {
      cancelRouteEdit();
    }
  } catch (error) {
    routeAdminError.value = `Error eliminando ruta: ${error.message}`;
  } finally {
    deletingRouteId.value = "";
  }
}
</script>

<template>
  <section class="routes-page">
    <div class="routes-shell">
      <div class="routes-hero">
        <div>
          <p class="routes-kicker">CRUD interno</p>
          <h1>Administrar rutas guardadas</h1>
          <p class="routes-copy">Usa la clave interna para listar, editar o eliminar rutas ya creadas.</p>
        </div>
      </div>

      <div class="routes-card routes-admin-card">
        <div class="driver-table-header">
          <div>
            <strong>Panel de rutas</strong>
            <p class="admin-copy">Los cambios actualizan la ruta guardada y sus novedades asociadas.</p>
          </div>
          <div class="header-actions">
            <button class="admin-button" :disabled="routeAdminLoading || !canManageRoutes" @click="loadSavedRoutes">
              {{ routeAdminLoading ? "Cargando..." : "Ver rutas guardadas" }}
            </button>
            <button
              class="route-secondary-button"
              :disabled="routeAdminLoading || completingSelectedRoutes || selectableRouteIds.length === 0"
              @click="toggleSelectAllRoutes"
            >
              {{ allPendingRoutesSelected ? "Deseleccionar todas" : `Seleccionar todas (${selectableRouteIds.length})` }}
            </button>
            <button
              class="admin-button secondary-admin-button"
              :disabled="routeAdminLoading || completingSelectedRoutes || !canManageRoutes || selectedRoutesCount === 0"
              @click="completeSelectedRoutes"
            >
              {{ completingSelectedRoutes ? "Completando..." : `Completar seleccionadas (${selectedRoutesCount})` }}
            </button>
          </div>
        </div>

        <div class="input-grid input-grid-meta admin-grid">
          <div class="field-group field-group-wide">
            <label for="adminKey">Clave interna</label>
            <input id="adminKey" v-model="adminKey" type="password" placeholder="Necesaria para administrar rutas" />
          </div>
        </div>

        <div v-if="routeAdminError" class="warning-inline warning-inline-error">
          {{ routeAdminError }}
        </div>
        <div v-if="routeAdminFeedback" class="success-inline">
          {{ routeAdminFeedback }}
        </div>

        <div v-if="savedRoutes.length" class="input-grid input-grid-meta admin-grid route-filters">
          <div class="field-group">
            <label for="companyFilter">Buscar por empresa</label>
            <input id="companyFilter" v-model="companyFilter" type="search" placeholder="Nombre de la empresa" />
          </div>
          <div class="field-group">
            <label for="guideNumberFilter">Buscar por numero de guia</label>
            <input id="guideNumberFilter" v-model="guideNumberFilter" type="search" placeholder="Numero de guia" />
          </div>
        </div>

        <div v-if="filteredRoutes.length" class="saved-routes-list">
          <article v-for="savedRoute in filteredRoutes" :key="savedRoute._id" class="saved-route-item">
            <div class="driver-table-header saved-route-header">
              <div>
                <strong>{{ savedRoute.routeLabel }}</strong>
                <p class="saved-route-meta">{{ formatDate(savedRoute.createdAt) }} · {{ savedRoute.driverName || savedRoute.driverId }}</p>
              </div>
              <label v-if="savedRoute.status !== 'completed'" class="saved-route-select">
                <input
                  v-model="selectedRouteIds"
                  type="checkbox"
                  :value="String(savedRoute._id)"
                  :disabled="completingSelectedRoutes || deletingRouteId === savedRoute._id"
                />
                Seleccionar para completar
              </label>
              <span class="saved-route-status">{{ savedRoute.status }}</span>
            </div>

            <div class="summary-strip summary-strip-results">
              <span><strong>Folio:</strong> {{ savedRoute._id }}</span>
              <span><strong>Guia(s):</strong> {{ getGuideNumbers(savedRoute) }}</span>
              <span><strong>Chofer:</strong> {{ savedRoute.driverId }}</span>
              <span><strong>Clientes:</strong> {{ savedRoute.uniqueClientCount }}</span>
              <span><strong>Peso:</strong> {{ savedRoute.totalWeight }}</span>
            </div>

            <div class="saved-route-actions">
              <router-link v-if="savedRoute.loadGuide && savedRoute.status !== 'completed'" class="route-secondary-button" :to="{ path: '/routes', query: { guideId: savedRoute._id } }">Editar guia y pedidos</router-link>
              <button v-if="savedRoute.loadGuide" class="route-secondary-button" @click="downloadGuide(savedRoute)">
                <i class="mdi mdi-file-download-outline" aria-hidden="true" /> Descargar guia PDF
              </button>
              <button
                class="route-secondary-button"
                :disabled="completingSelectedRoutes || deletingRouteId === savedRoute._id"
                @click="startRouteEdit(savedRoute)"
              >
                {{ editingRouteId === savedRoute._id ? "Editando" : "Editar ruta" }}
              </button>
              <button
                class="route-danger-button"
                :disabled="deletingRouteId === savedRoute._id || completingSelectedRoutes"
                @click="deleteRoute(savedRoute)"
              >
                {{ deletingRouteId === savedRoute._id ? "Eliminando..." : "Eliminar ruta" }}
              </button>
            </div>

            <form v-if="editingRouteId === savedRoute._id" class="route-edit-form" @submit.prevent="saveRoute(savedRoute)">
              <div class="input-grid input-grid-meta">
                <div class="field-group">
                  <label>ID del chofer</label>
                  <input v-model="editRouteForm.driverId" type="text" />
                </div>
                <div class="field-group">
                  <label>Nombre del chofer</label>
                  <input v-model="editRouteForm.driverName" type="text" />
                </div>
                <div class="field-group field-group-wide">
                  <label>Nombre de la ruta</label>
                  <input v-model="editRouteForm.routeLabel" type="text" />
                </div>
                <div class="field-group">
                  <label>Peso total</label>
                  <input v-model="editRouteForm.totalWeight" type="number" min="0" step="0.01" />
                </div>
              </div>

              <div class="saved-route-actions">
                <button class="route-secondary-button" type="button" @click="cancelRouteEdit">Cancelar</button>
                <button class="admin-button" type="submit" :disabled="savingRouteId === savedRoute._id">
                  {{ savingRouteId === savedRoute._id ? "Guardando..." : "Guardar cambios" }}
                </button>
              </div>
            </form>
          </article>
        </div>

        <div v-else-if="savedRoutes.length && (companyFilter || guideNumberFilter)" class="warning-inline">
          No hay rutas que coincidan con esos filtros.
        </div>

        <div v-else-if="!routeAdminLoading" class="warning-inline">
          No hay rutas cargadas o todavia no has consultado la lista.
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.routes-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(69, 167, 255, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(22, 163, 74, 0.16), transparent 26%),
    linear-gradient(180deg, #08111f 0%, #11213d 50%, #09121f 100%);
}

.routes-shell {
  max-width: 1180px;
  margin: 0 auto;
  color: #f3f6fb;
}

.routes-hero {
  margin-bottom: 1.5rem;
}

.routes-kicker {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.routes-copy {
  max-width: 720px;
  color: rgba(243, 246, 251, 0.76);
}

.routes-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(8, 17, 31, 0.68);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.input-grid-meta {
  margin-bottom: 0.25rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-group-wide {
  grid-column: 1 / -1;
}

.field-group input,
.route-select {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.driver-table-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.admin-button,
.route-secondary-button,
.route-danger-button {
  min-height: 46px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
}

.admin-button {
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.secondary-admin-button {
  background: linear-gradient(135deg, #4ade80 0%, #15803d 100%);
}

.route-secondary-button {
  color: #08111f;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.route-danger-button {
  color: #fff;
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.admin-button:disabled,
.route-secondary-button:disabled,
.route-danger-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.summary-strip {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
  color: rgba(243, 246, 251, 0.88);
}

.summary-strip-results {
  margin-top: 0;
}

.warning-inline {
  margin-top: 0.8rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: rgba(248, 202, 91, 0.12);
  color: #f8ca5b;
}

.warning-inline-error {
  background: rgba(255, 120, 120, 0.12);
  color: #ffb4b4;
}

.success-inline {
  margin-top: 0.8rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: rgba(141, 240, 180, 0.1);
  color: #8df0b4;
}

.admin-copy,
.saved-route-meta {
  margin: 0.35rem 0 0;
  color: rgba(243, 246, 251, 0.72);
}

.admin-grid {
  margin-top: 1rem;
}

.route-filters {
  margin-bottom: 0.75rem;
}

.saved-routes-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.saved-route-item {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.saved-route-header {
  align-items: flex-start;
}

.saved-route-select {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(243, 246, 251, 0.86);
  font-weight: 600;
  cursor: pointer;
}

.saved-route-select input {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
  accent-color: #34d399;
}

.saved-route-status {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(141, 240, 180, 0.16);
  color: #8df0b4;
  font-weight: 700;
  text-transform: lowercase;
}

.saved-route-actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.route-edit-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

@media (max-width: 960px) {
  .driver-table-header,
  .saved-route-actions,
  .summary-strip,
  .saved-route-header {
    flex-direction: column;
    align-items: stretch;
  }

  .input-grid {
    grid-template-columns: 1fr;
  }

  .field-group-wide {
    grid-column: auto;
  }

  .admin-button,
  .route-secondary-button,
  .route-danger-button {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .routes-page {
    padding: 1rem 0.75rem 2rem;
  }
}
</style>