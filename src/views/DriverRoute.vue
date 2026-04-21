<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const router = useRouter();
const route = useRoute();

const driverId = ref("");
const routeData = ref(null);
const assignedRoutes = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const feedback = ref("");
const updatingKey = ref("");
const openIssueForms = reactive({});
const issueForms = reactive({});
const editingRoute = ref(false);
const editableStops = ref([]);
const routeActionLoading = ref("");
const draggedStopIndex = ref(-1);
const dragOverStopIndex = ref(-1);

const activeRouteCount = computed(() => assignedRoutes.value.filter((route) => route?.status === "active").length);

const pendingStopsCount = computed(() =>
  Array.isArray(routeData.value?.stops)
    ? routeData.value.stops.filter((stop) => !stop.dispatched).length
    : 0,
);

const routeProgressPercent = computed(() => {
  const totalStops = Array.isArray(routeData.value?.stops) ? routeData.value.stops.length : 0;

  if (!totalStops) {
    return 0;
  }

  return Math.round((dispatchedCount.value / totalStops) * 100);
});

const importantRouteFacts = computed(() => {
  if (!routeData.value) {
    return [];
  }

  return [
    { label: "Tipo recomendado por sistema", value: "Mas cercana" },
    { label: "Tipo actual", value: routeData.value.routeTypeLabel || "Ruta generada" },
    { label: "Estado actual", value: routeData.value.status || "Sin estado" },
    { label: "Recorrido estimado", value: routeDistanceText.value },
    { label: "Paradas pendientes", value: String(pendingStopsCount.value) },
    { label: "Clientes no encontrados", value: String(routeData.value.missingClients?.length || 0) },
    { label: "Modificada por chofer", value: routeData.value.wasDriverModified ? "Si" : "No" },
    {
      label: "Ultima actualizacion",
      value: routeData.value.updatedAt ? new Date(routeData.value.updatedAt).toLocaleString("es-MX") : "Sin dato",
    },
  ];
});

const routeMapLinks = computed(() =>
  Array.isArray(routeData.value?.googleMapsRouteLinks) ? routeData.value.googleMapsRouteLinks : [],
);

const routeDistanceText = computed(() => {
  const totalDistanceKm = Number(routeData.value?.totalDistanceKm);

  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= 0) {
    return "Sin dato";
  }

  return `${totalDistanceKm.toFixed(2)} km`;
});

function cloneStops(stops) {
  return Array.isArray(stops)
    ? stops.map((stop) => ({ ...stop }))
    : [];
}

const dispatchedCount = computed(() =>
  Array.isArray(routeData.value?.stops)
    ? routeData.value.stops.filter((stop) => stop.dispatched).length
    : 0,
);

function createIssueItem() {
  return {
    productId: "",
    novelty: "",
    presentationType: "unidad",
    quantity: 1,
  };
}

function resetRouteUiState() {
  editingRoute.value = false;
  editableStops.value = [];
  Object.keys(openIssueForms).forEach((key) => {
    delete openIssueForms[key];
  });
  Object.keys(issueForms).forEach((key) => {
    delete issueForms[key];
  });
}

function selectRoute(routeId) {
  const nextRoute = assignedRoutes.value.find((route) => String(route?._id) === String(routeId));

  if (!nextRoute) {
    return;
  }

  routeData.value = nextRoute;
  resetRouteUiState();
}

function syncRouteCollection(updatedRoute) {
  const normalizedRouteId = String(updatedRoute?._id || "");

  if (!normalizedRouteId) {
    return;
  }

  const nextRoutes = assignedRoutes.value.some((route) => String(route?._id) === normalizedRouteId)
    ? assignedRoutes.value.map((route) => (String(route?._id) === normalizedRouteId ? updatedRoute : route))
    : [updatedRoute, ...assignedRoutes.value];

  const activeRoutes = nextRoutes.filter((route) => route?.status === "active");
  assignedRoutes.value = activeRoutes.length > 0 ? activeRoutes : nextRoutes;

  if (updatedRoute.status === "active") {
    routeData.value = updatedRoute;
    return;
  }

  const fallbackRoute = assignedRoutes.value.find((route) => route?.status === "active") || updatedRoute;
  routeData.value = fallbackRoute;
  resetRouteUiState();
}

function getStopKey(stop) {
  return String(stop?.clientId || "");
}

function startRouteEditing() {
  if (!Array.isArray(routeData.value?.stops) || routeData.value.stops.length === 0) {
    return;
  }

  editableStops.value = cloneStops(routeData.value.stops);
  editingRoute.value = true;
  errorMessage.value = "";
  feedback.value = "";
}

function cancelRouteEditing() {
  editingRoute.value = false;
  editableStops.value = [];
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
}

function normalizeEditableStopOrder(stops) {
  return stops.map((stop, index) => ({
    ...stop,
    order: index + 1,
  }));
}

function startStopDrag(index) {
  draggedStopIndex.value = index;
  dragOverStopIndex.value = index;
}

function handleStopDragOver(index) {
  if (draggedStopIndex.value === -1) {
    return;
  }

  dragOverStopIndex.value = index;
}

function handleStopDrop(index) {
  if (draggedStopIndex.value === -1 || draggedStopIndex.value === index) {
    draggedStopIndex.value = -1;
    dragOverStopIndex.value = -1;
    return;
  }

  const nextStops = [...editableStops.value];
  const [draggedStop] = nextStops.splice(draggedStopIndex.value, 1);
  nextStops.splice(index, 0, draggedStop);
  editableStops.value = normalizeEditableStopOrder(nextStops);
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
}

function endStopDrag() {
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
}

async function saveRouteCustomization() {
  if (!routeData.value?._id || editableStops.value.length === 0) {
    return;
  }

  routeActionLoading.value = "save";
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/customize`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stops: editableStops.value.map((stop) => ({ clientId: stop.clientId })),
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo guardar la personalizacion de la ruta.";
      return;
    }

    syncRouteCollection(result?.route || routeData.value);
    feedback.value = "La ruta personalizada se guardo correctamente para este chofer.";
  } catch (error) {
    errorMessage.value = `Error guardando personalizacion: ${error.message}`;
  } finally {
    routeActionLoading.value = "";
  }
}

async function restoreOriginalRoute() {
  if (!routeData.value?._id) {
    return;
  }

  routeActionLoading.value = "reset";
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/reset`, {
      method: "POST",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo restaurar la ruta recomendada por el sistema.";
      return;
    }

    syncRouteCollection(result?.route || routeData.value);
    feedback.value = "La ruta recomendada por el sistema fue restaurada.";
  } catch (error) {
    errorMessage.value = `Error restaurando ruta: ${error.message}`;
  } finally {
    routeActionLoading.value = "";
  }
}

function ensureIssueForm(stop) {
  const stopKey = getStopKey(stop);

  if (!stopKey) {
    return null;
  }

  if (!issueForms[stopKey]) {
    issueForms[stopKey] = {
      orderNumber: "",
      items: [createIssueItem()],
      submitting: false,
      feedback: "",
      error: "",
    };
  }

  return issueForms[stopKey];
}

function resetIssueForm(stop) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  form.orderNumber = "";
  form.items = [createIssueItem()];
  form.submitting = false;
  form.feedback = "";
  form.error = "";
}

function addIssueItem(stop) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  form.items.push(createIssueItem());
}

function removeIssueItem(stop, index) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  if (form.items.length === 1) {
    form.items[0] = createIssueItem();
    return;
  }

  form.items.splice(index, 1);
}

function toggleIssueForm(stop) {
  const stopKey = getStopKey(stop);
  const currentlyOpen = Boolean(openIssueForms[stopKey]);

  if (!currentlyOpen) {
    ensureIssueForm(stop);
  }

  openIssueForms[stopKey] = !currentlyOpen;

  if (!openIssueForms[stopKey]) {
    const form = ensureIssueForm(stop);

    if (form) {
      form.error = "";
      form.feedback = "";
    }
  }
}

async function loadDriverRoute() {
  if (!driverId.value.trim()) {
    errorMessage.value = "Ingresa el ID del chofer.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${driverId.value.trim()}/current`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeData.value = null;
      assignedRoutes.value = [];
      errorMessage.value = result?.message || "No se pudo cargar la ruta del chofer.";
      return;
    }

    assignedRoutes.value = Array.isArray(result?.routes)
      ? result.routes
      : result?.route
        ? [result.route]
        : [];
    routeData.value = result?.route || assignedRoutes.value[0] || null;
    resetRouteUiState();
  } catch (error) {
    routeData.value = null;
    assignedRoutes.value = [];
    errorMessage.value = `Error cargando ruta: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function updateDispatch(stop, dispatched) {
  if (!routeData.value?._id) {
    return;
  }

  updatingKey.value = `stop:${stop.clientId}`;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops/${stop.clientId}/dispatch`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dispatched }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo actualizar el despacho.";
      return;
    }

    syncRouteCollection(result?.route || routeData.value);
    feedback.value = dispatched
      ? `Cliente ${stop.clientId} marcado como despachado.`
      : `Cliente ${stop.clientId} marcado como pendiente.`;
  } catch (error) {
    errorMessage.value = `Error actualizando despacho: ${error.message}`;
  } finally {
    updatingKey.value = "";
  }
}

async function resolveMissingClient(item, resolved) {
  if (!routeData.value?._id) {
    return;
  }

  updatingKey.value = `missing:${item.clientId}`;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/missing/${item.clientId}/resolve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resolved }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo actualizar el cliente no encontrado.";
      return;
    }

    syncRouteCollection(result?.route || routeData.value);
    feedback.value = resolved
      ? `Cliente no encontrado ${item.clientId} marcado como resuelto.`
      : `Cliente no encontrado ${item.clientId} marcado como pendiente.`;
  } catch (error) {
    errorMessage.value = `Error actualizando cliente no encontrado: ${error.message}`;
  } finally {
    updatingKey.value = "";
  }
}

function openClientRegistration(clientId) {
  window.open(`/?clientId=${encodeURIComponent(clientId)}`, "_blank", "noopener,noreferrer");
}

function openRouteIssueSummary() {
  if (!routeData.value?._id) {
    return;
  }

  router.push(`/driver-route/${routeData.value._id}/issues-summary`);
}

async function submitDispatchIssue(stop) {
  if (!routeData.value?._id) {
    return;
  }

  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  const payload = {
    orderNumber: form.orderNumber.trim(),
    items: form.items.map((item) => ({
      productId: item.productId.trim(),
      novelty: item.novelty.trim(),
      presentationType: item.presentationType,
      quantity: Number(item.quantity),
    })),
  };

  if (!payload.orderNumber) {
    form.error = "Completa el numero de pedido.";
    form.feedback = "";
    return;
  }

  const hasInvalidItem = payload.items.some((item) => {
    if (!item.productId || !item.novelty) {
      return true;
    }

    if (!["caja", "unidad"].includes(item.presentationType)) {
      return true;
    }

    return !Number.isInteger(item.quantity) || item.quantity < 1;
  });

  if (hasInvalidItem) {
    form.error = "Cada producto debe tener ID, novedad, tipo caja o unidad y cantidad valida.";
    form.feedback = "";
    return;
  }

  form.submitting = true;
  form.error = "";
  form.feedback = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops/${stop.clientId}/issues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      form.error = result?.message || "No se pudo guardar la novedad del despacho.";
      return;
    }

    const successMessage = `Novedad registrada con folio ${result?.reportId || "generado"}.`;
    feedback.value = `Se registro una novedad para el cliente ${stop.clientId}.`;
    resetIssueForm(stop);
    ensureIssueForm(stop).feedback = successMessage;
  } catch (error) {
    form.error = `Error guardando novedad: ${error.message}`;
  } finally {
    ensureIssueForm(stop).submitting = false;
  }
}

onMounted(() => {
  const prefilledDriverId = typeof route.query.driverId === "string"
    ? route.query.driverId.trim()
    : "";

  if (!prefilledDriverId) {
    return;
  }

  driverId.value = prefilledDriverId;
  loadDriverRoute();
});
</script>

<template>
  <section class="driver-page">
    <div class="driver-shell">
      <div class="driver-hero">
        <p class="driver-kicker">Ruta del chofer</p>
        <h1>Consulta tu ruta asignada</h1>
        <p class="driver-copy">Ingresa tu ID para ver la ruta actual, los clientes despachados y los clientes que faltan por registrar.</p>
      </div>

      <div class="driver-card">
        <div class="driver-search-row">
          <input v-model="driverId" type="text" placeholder="Ingresa tu ID de chofer" class="driver-input" @keyup.enter="loadDriverRoute" />
          <button class="driver-button" :disabled="loading" @click="loadDriverRoute">
            {{ loading ? "Buscando..." : "Ver mi ruta" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="driver-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="driver-card feedback-success">{{ feedback }}</div>

      <div v-if="routeData" class="driver-results">
        <div v-if="assignedRoutes.length > 1" class="driver-card route-switcher-card">
          <div class="section-heading">
            <strong>Rutas pendientes de este chofer</strong>
            <span>{{ activeRouteCount }} rutas activas disponibles</span>
          </div>

          <div class="route-switcher-grid">
            <button
              v-for="route in assignedRoutes"
              :key="route._id"
              type="button"
              class="route-switcher-item"
              :class="String(routeData?._id) === String(route._id) ? 'route-switcher-item-active' : ''"
              @click="selectRoute(route._id)"
            >
              <strong>{{ route.routeLabel }}</strong>
              <span>{{ route.driverName || route.driverId }}</span>
              <span>
                {{ Array.isArray(route.stops) ? route.stops.filter((stop) => stop.dispatched).length : 0 }} /
                {{ Array.isArray(route.stops) ? route.stops.length : 0 }} despachados
              </span>
            </button>
          </div>
        </div>

        <div class="driver-card summary-card">
          <div class="summary-header">
            <div class="summary-grid">
            <span><strong>Ruta:</strong> {{ routeData.routeLabel }}</span>
            <span><strong>Chofer:</strong> {{ routeData.driverId }}</span>
            <span><strong>Estado:</strong> {{ routeData.status }}</span>
            <span><strong>Clientes unicos:</strong> {{ routeData.uniqueClientCount }}</span>
            <span><strong>Peso total:</strong> {{ routeData.totalWeight }}</span>
            <span><strong>Km estimados:</strong> {{ routeDistanceText }}</span>
            <span><strong>Despachados:</strong> {{ dispatchedCount }} / {{ routeData.stops.length }}</span>
            </div>
          </div>
          <div class="progress-strip">
            <div class="progress-bar">
              <span class="progress-bar-fill" :style="{ width: `${routeProgressPercent}%` }" />
            </div>
            <strong>{{ routeProgressPercent }}% completado</strong>
          </div>
        </div>

        <div class="driver-card info-card">
          <div class="section-heading">
            <strong>Datos importantes de la ruta</strong>
            <span>Referencia rapida para el chofer antes de salir.</span>
          </div>

          <div class="facts-grid">
            <article v-for="fact in importantRouteFacts" :key="fact.label" class="fact-item">
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </article>
          </div>
        </div>

        <div class="driver-card actions-card">
          <div class="section-heading">
            <strong>Acciones rapidas</strong>
            <span>Botones separados de los datos importantes para una vista mas clara.</span>
          </div>

          <div class="actions-grid">
            <button class="secondary-button action-button" type="button" @click="openRouteIssueSummary">
              Ver resumen de novedades
            </button>
            <button class="secondary-button action-button" type="button" @click="startRouteEditing">
              Personalizar orden
            </button>
            <button
              class="ghost-button action-button"
              type="button"
              :disabled="routeActionLoading === 'reset'"
              @click="restoreOriginalRoute"
            >
              {{ routeActionLoading === 'reset' ? "Restaurando..." : "Volver a ruta recomendada" }}
            </button>
          </div>

          <div class="route-links-grid">
            <a v-if="routeData.openRouteLink" :href="routeData.openRouteLink" target="_blank" rel="noreferrer" class="map-link-card">
              Abrir ruta completa en OpenRouteService
            </a>
            <a v-for="(link, index) in routeMapLinks" :key="`${routeData._id}-map-${index}`" :href="link" target="_blank" rel="noreferrer" class="map-link-card">
              Abrir tramo {{ index + 1 }} en Google Maps
            </a>
          </div>
        </div>

        <div class="driver-card editor-card">
          <div class="section-heading">
            <strong>Modificar orden de la ruta</strong>
            <span>Puedes mover las paradas y guardar tu version o volver a la ruta recomendada por el sistema.</span>
          </div>

          <div v-if="editingRoute" class="editor-panel">
            <p class="editor-help">
              Mantén presionada una parada, arrástrala y suéltala en la posición que quieras.
            </p>
            <div class="editable-stops-list">
              <article
                v-for="(stop, index) in editableStops"
                :key="`edit-${stop.clientId}`"
                class="editable-stop-item"
                :class="{
                  'editable-stop-item-dragging': draggedStopIndex === index,
                  'editable-stop-item-target': dragOverStopIndex === index && draggedStopIndex !== index,
                }"
                draggable="true"
                @dragstart="startStopDrag(index)"
                @dragover.prevent="handleStopDragOver(index)"
                @drop.prevent="handleStopDrop(index)"
                @dragend="endStopDrag"
              >
                <div>
                  <strong>{{ index + 1 }}. {{ stop.nombre }}</strong>
                  <p>ID {{ stop.clientId }}</p>
                </div>
                <div class="editable-stop-actions">
                  <span class="drag-handle">Arrastrar</span>
                </div>
              </article>
            </div>

            <div class="editor-actions">
              <button class="ghost-button" type="button" @click="cancelRouteEditing">
                Cancelar cambios
              </button>
              <button class="secondary-button" type="button" :disabled="routeActionLoading === 'save'" @click="saveRouteCustomization">
                {{ routeActionLoading === 'save' ? "Guardando..." : "Guardar mi orden" }}
              </button>
              <button class="ghost-button" type="button" :disabled="routeActionLoading === 'reset'" @click="restoreOriginalRoute">
                {{ routeActionLoading === 'reset' ? "Restaurando..." : "Restaurar ruta recomendada" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="routeData.missingClients?.length" class="driver-card missing-card">
          <strong>Clientes no encontrados</strong>
          <div class="missing-list">
            <article v-for="item in routeData.missingClients" :key="item.clientId" class="missing-item">
              <div>
                <p><strong>ID:</strong> {{ item.clientId }}</p>
                <p><strong>Estado:</strong> {{ item.resolved ? "Resuelto" : "Pendiente por registrar" }}</p>
              </div>
              <div class="missing-actions">
                <button class="secondary-button" @click="openClientRegistration(item.clientId)">
                  Registrar cliente
                </button>
                <button
                  class="ghost-button"
                  :disabled="updatingKey === `missing:${item.clientId}`"
                  @click="resolveMissingClient(item, !item.resolved)"
                >
                  {{ item.resolved ? "Marcar pendiente" : "Marcar resuelto" }}
                </button>
              </div>
            </article>
          </div>
        </div>

        <div class="driver-card">
          <div class="section-heading">
            <strong>Paradas asignadas</strong>
            <span>Abajo de cada cliente puedes registrar una novedad del despacho.</span>
          </div>
          <div class="stops-list">
            <article v-for="stop in routeData.stops" :key="stop.clientId" :class="['stop-item', stop.dispatched ? 'stop-item-done' : '']">
              <div class="stop-main">
                <div>
                  <p class="stop-order">{{ stop.order }}. {{ stop.nombre }}</p>
                  <p>ID {{ stop.clientId }}</p>
                </div>
                <div class="stop-actions">
                  <a :href="stop.googleMapsLink" target="_blank" rel="noreferrer">Abrir mapa</a>
                  <button
                    class="secondary-button"
                    type="button"
                    @click="toggleIssueForm(stop)"
                  >
                    {{ openIssueForms[stop.clientId] ? "Ocultar novedad" : "Reportar novedad" }}
                  </button>
                  <button
                    class="driver-button"
                    :disabled="updatingKey === `stop:${stop.clientId}`"
                    @click="updateDispatch(stop, !stop.dispatched)"
                  >
                    {{ stop.dispatched ? "Marcar pendiente" : "Marcar despachado" }}
                  </button>
                </div>
              </div>

              <form
                v-if="openIssueForms[stop.clientId]"
                class="issue-form"
                @submit.prevent="submitDispatchIssue(stop)"
              >
                <div class="issue-grid">
                  <label class="field-group field-group-full">
                    <span>Numero de pedido</span>
                    <input v-model="ensureIssueForm(stop).orderNumber" type="text" placeholder="Ej. PED-10294" />
                  </label>
                </div>

                <div class="issue-items-list">
                  <article
                    v-for="(item, index) in ensureIssueForm(stop).items"
                    :key="`${stop.clientId}-issue-${index}`"
                    class="issue-item-card"
                  >
                    <div class="issue-item-head">
                      <strong>Producto con novedad {{ index + 1 }}</strong>
                      <button class="ghost-button" type="button" @click="removeIssueItem(stop, index)">
                        {{ ensureIssueForm(stop).items.length === 1 ? "Limpiar producto" : "Quitar producto" }}
                      </button>
                    </div>

                    <div class="issue-grid">
                      <label class="field-group">
                        <span>ID del producto</span>
                        <input v-model="item.productId" type="text" placeholder="Ej. SKU-445" />
                      </label>
                      <label class="field-group">
                        <span>Presentacion</span>
                        <select v-model="item.presentationType">
                          <option value="unidad">Unidad</option>
                          <option value="caja">Caja</option>
                        </select>
                      </label>
                      <label class="field-group">
                        <span>Cantidad afectada</span>
                        <input v-model.number="item.quantity" type="number" min="1" step="1" />
                      </label>
                      <label class="field-group field-group-full">
                        <span>Cual es la novedad</span>
                        <textarea
                          v-model="item.novelty"
                          rows="3"
                          placeholder="Ej. Llegaron 2 unidades golpeadas o faltaba 1 caja del producto."
                        />
                      </label>
                    </div>
                  </article>
                </div>

                <p v-if="ensureIssueForm(stop).error" class="inline-feedback inline-feedback-error">
                  {{ ensureIssueForm(stop).error }}
                </p>
                <p v-if="ensureIssueForm(stop).feedback" class="inline-feedback inline-feedback-success">
                  {{ ensureIssueForm(stop).feedback }}
                </p>

                <div class="issue-actions">
                  <button class="secondary-button" type="button" @click="addIssueItem(stop)">
                    Agregar otro producto
                  </button>
                  <button class="ghost-button" type="button" @click="resetIssueForm(stop)">
                    Limpiar
                  </button>
                  <button class="driver-button" type="submit" :disabled="ensureIssueForm(stop).submitting">
                    {{ ensureIssueForm(stop).submitting ? "Guardando..." : "Guardar novedad" }}
                  </button>
                </div>
              </form>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.driver-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(71, 157, 255, 0.2), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 196, 120, 0.18), transparent 30%),
    linear-gradient(180deg, #08111d 0%, #10213c 52%, #08111d 100%);
}

.driver-shell {
  max-width: 1040px;
  margin: 0 auto;
  color: #f3f6fb;
}

.driver-hero {
  margin-bottom: 1.25rem;
}

.driver-kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.driver-copy {
  max-width: 720px;
  color: rgba(243, 246, 251, 0.78);
}

.driver-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.72);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

.driver-search-row,
.summary-grid,
.summary-header,
.stop-main,
.missing-actions,
.section-heading,
.issue-actions,
.editor-actions,
.editable-stop-actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.section-heading {
  justify-content: space-between;
  align-items: center;
}

.summary-header {
  justify-content: space-between;
  align-items: flex-start;
}

.section-heading span {
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.92rem;
}

.driver-input {
  flex: 1 1 320px;
  min-height: 46px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.driver-button,
.secondary-button,
.ghost-button {
  min-height: 44px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
}

.driver-button {
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.secondary-button {
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.ghost-button {
  color: #d7e8ff;
  background: rgba(69, 167, 255, 0.16);
  border: 1px solid rgba(69, 167, 255, 0.32);
}

.driver-results,
.stops-list,
.missing-list,
.editor-panel,
.editable-stops-list,
.route-links-grid,
.actions-grid {
  display: grid;
  gap: 1rem;
}

.actions-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.action-button {
  width: 100%;
  justify-content: center;
}

.facts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.editor-help {
  margin: 0;
  color: rgba(243, 246, 251, 0.72);
}

.fact-item,
.editable-stop-item,
.map-link-card {
  padding: 0.95rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.fact-item span {
  display: block;
  color: rgba(243, 246, 251, 0.68);
  margin-bottom: 0.35rem;
}

.map-link-card {
  color: #f3f6fb;
  text-decoration: none;
}

.editable-stop-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  cursor: grab;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.editable-stop-item-dragging {
  opacity: 0.55;
  cursor: grabbing;
}

.editable-stop-item-target {
  border-color: rgba(69, 167, 255, 0.72);
  background: rgba(69, 167, 255, 0.12);
  transform: translateY(-2px);
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(243, 246, 251, 0.82);
  font-weight: 700;
}

.progress-strip {
  margin-top: 1rem;
}

.progress-bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  margin-bottom: 0.55rem;
}

.progress-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, #45a7ff 0%, #22c55e 100%);
}

.route-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
}

.route-switcher-item {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem;
  text-align: left;
  border-radius: 18px;
  border: 1px solid rgba(159, 209, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f6fb;
  cursor: pointer;
}

.route-switcher-item span {
  color: rgba(243, 246, 251, 0.74);
}

.route-switcher-item-active {
  border-color: rgba(255, 213, 154, 0.48);
  background: rgba(255, 213, 154, 0.12);
  box-shadow: 0 0 0 1px rgba(255, 213, 154, 0.18) inset;
}

.missing-card {
  border-color: rgba(248, 202, 91, 0.26);
  background: rgba(70, 52, 11, 0.22);
}

.missing-item,
.stop-item {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stop-item-done {
  border-color: rgba(141, 240, 180, 0.3);
  background: rgba(141, 240, 180, 0.08);
}

.stop-order {
  margin: 0;
  font-weight: 700;
}

.stop-main {
  align-items: center;
  justify-content: space-between;
}

.stop-actions {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  flex-wrap: wrap;
}

.issue-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.issue-items-list {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.85rem;
}

.issue-item-card {
  padding: 0.9rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.issue-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.issue-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.field-group {
  display: grid;
  gap: 0.4rem;
}

.field-group span {
  font-size: 0.9rem;
  color: rgba(243, 246, 251, 0.86);
}

.field-group input,
.field-group select,
.field-group textarea {
  width: 100%;
  min-height: 44px;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.field-group textarea {
  min-height: 96px;
  resize: vertical;
}

.field-group-full {
  grid-column: 1 / -1;
}

.inline-feedback {
  margin: 0.8rem 0 0;
  font-weight: 600;
}

.inline-feedback-error {
  color: #ffb4b4;
}

.inline-feedback-success {
  color: #8df0b4;
}

.issue-actions {
  margin-top: 0.85rem;
  justify-content: flex-end;
}

.stop-actions a {
  color: #ffd59a;
  font-weight: 600;
}

.feedback-error {
  color: #ffb4b4;
}

.feedback-success {
  color: #8df0b4;
}

@media (max-width: 960px) {
  .summary-header,
  .stop-main,
  .missing-actions,
  .stop-actions,
  .issue-actions,
  .section-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .route-switcher-grid,
  .issue-grid {
    grid-template-columns: 1fr;
  }

  .driver-button,
  .secondary-button,
  .ghost-button,
  .stop-actions a {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 720px) {
  .driver-page {
    padding: 1rem 0.75rem 2rem;
  }

  .driver-search-row,
  .route-switcher-grid {
    flex-direction: column;
  }
}
</style>