<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RouteOsmMap from "../components/RouteOsmMap.vue";
import { fetchSession, getAuthState } from "../services/auth";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const router = useRouter();
const route = useRoute();
const sessionUser = ref(getAuthState().user || null);

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
const priorityStopClientId = ref("");
const reorderMode = ref("drag");
const routeActionLoading = ref("");
const draggedStopIndex = ref(-1);
const dragOverStopIndex = ref(-1);
const previewDistanceKm = ref(null);
const previewDistanceLoading = ref(false);
const previewDistanceError = ref("");
const shareFeedback = ref("");
const addStopClientId = ref("");
const addStopLoading = ref(false);
const addStopBranchOptions = ref([]);
const selectedAddStopBranch = ref("");
const addStopPendingClientId = ref("");
const pendingRemovalClientId = ref("");

let previewDistanceTimer = null;
let previewDistanceRequestSeq = 0;

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

const routeMapStops = computed(() =>
  editingRoute.value
    ? editableStops.value
    : (Array.isArray(routeData.value?.stops) ? routeData.value.stops : []),
);

const routeDistanceText = computed(() => {
  const totalDistanceKm = Number(routeData.value?.totalDistanceKm);

  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= 0) {
    return "Sin dato";
  }

  return `${totalDistanceKm.toFixed(2)} km`;
});

const originalRouteDistanceKm = computed(() => {
  const original = Number(routeData.value?.originalTotalDistanceKm);

  if (Number.isFinite(original) && original > 0) {
    return original;
  }

  const current = Number(routeData.value?.totalDistanceKm);
  return Number.isFinite(current) && current > 0 ? current : null;
});

const driverModifiedRouteDistanceKm = computed(() => {
  if (editingRoute.value && Number.isFinite(previewDistanceKm.value) && previewDistanceKm.value > 0) {
    return previewDistanceKm.value;
  }

  const modified = Number(routeData.value?.totalDistanceKm);
  return Number.isFinite(modified) && modified > 0 ? modified : null;
});

const routeDistanceDeltaKm = computed(() => {
  if (originalRouteDistanceKm.value == null || driverModifiedRouteDistanceKm.value == null) {
    return null;
  }

  return Number((driverModifiedRouteDistanceKm.value - originalRouteDistanceKm.value).toFixed(2));
});

const shareStops = computed(() => {
  if (editingRoute.value && editableStops.value.length) {
    return editableStops.value;
  }

  return Array.isArray(routeData.value?.stops) ? routeData.value.stops : [];
});

const shareClientEntries = computed(() =>
  shareStops.value
    .filter((stop) => stop?.nombre && stop?.googleMapsLink)
    .map((stop, index) => ({
      id: stop.clientId || `${index}`,
      text: `${index + 1}. ${stop.nombre}, ${stop.googleMapsLink}`,
    })),
);

const shareMessage = computed(() => {
  if (!routeData.value) {
    return "";
  }

  const lines = [
    `Ruta: ${routeData.value.routeLabel || "Sin folio"}`,
    `Chofer: ${routeData.value.driverName || routeData.value.driverId || "Sin asignar"}`,
    `Km originales: ${formatKm(originalRouteDistanceKm.value)}`,
    `Km actuales: ${formatKm(driverModifiedRouteDistanceKm.value)}`,
    `Diferencia: ${routeDistanceDeltaKm.value == null ? "Sin dato" : `${routeDistanceDeltaKm.value > 0 ? "+" : ""}${routeDistanceDeltaKm.value.toFixed(2)} km`}`,
    "",
    "Orden de clientes:",
  ];

  if (!shareClientEntries.value.length) {
    lines.push("Sin links disponibles para compartir.");
    return lines.join("\n");
  }

  shareClientEntries.value.forEach((entry) => {
    lines.push(entry.text);
  });

  return lines.join("\n");
});

function formatKm(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Sin dato";
  }

  return `${value.toFixed(2)} km`;
}

function resetPreviewDistanceState() {
  previewDistanceKm.value = null;
  previewDistanceLoading.value = false;
  previewDistanceError.value = "";
}

function clearPreviewDistanceTimer() {
  if (previewDistanceTimer) {
    clearTimeout(previewDistanceTimer);
    previewDistanceTimer = null;
  }
}

async function fetchPreviewDistance() {
  if (!editingRoute.value || !routeData.value?._id || editableStops.value.length === 0) {
    return;
  }

  const requestSeq = ++previewDistanceRequestSeq;
  previewDistanceLoading.value = true;
  previewDistanceError.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/customize/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stops: editableStops.value.map((stop) => ({ clientId: stop.clientId })),
      }),
    });
    const result = await response.json().catch(() => null);

    if (requestSeq !== previewDistanceRequestSeq) {
      return;
    }

    if (!response.ok) {
      previewDistanceError.value = result?.message || "No se pudo calcular el preview de km.";
      previewDistanceKm.value = null;
      return;
    }

    const nextKm = Number(result?.preview?.totalDistanceKm);
    previewDistanceKm.value = Number.isFinite(nextKm) && nextKm > 0 ? nextKm : null;
  } catch (error) {
    if (requestSeq !== previewDistanceRequestSeq) {
      return;
    }

    previewDistanceError.value = `Error calculando preview: ${error.message}`;
    previewDistanceKm.value = null;
  } finally {
    if (requestSeq === previewDistanceRequestSeq) {
      previewDistanceLoading.value = false;
    }
  }
}

function schedulePreviewDistance() {
  clearPreviewDistanceTimer();

  if (!editingRoute.value || editableStops.value.length === 0) {
    return;
  }

  previewDistanceTimer = setTimeout(() => {
    fetchPreviewDistance();
  }, 260);
}

function cloneStops(stops) {
  return Array.isArray(stops)
    ? stops.map((stop) => ({ ...stop }))
    : [];
}

function resolveSessionDriverId() {
  const user = sessionUser.value || {};
  return String(user.username || user.email || user.id || "").trim();
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
  priorityStopClientId.value = "";
  clearPreviewDistanceTimer();
  resetPreviewDistanceState();
  shareFeedback.value = "";
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
  priorityStopClientId.value = String(editableStops.value[0]?.clientId || "").trim();
  editingRoute.value = true;
  errorMessage.value = "";
  feedback.value = "";
  previewDistanceError.value = "";
  schedulePreviewDistance();
}

function cancelRouteEditing() {
  editingRoute.value = false;
  editableStops.value = [];
  priorityStopClientId.value = "";
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
  clearPreviewDistanceTimer();
  resetPreviewDistanceState();
  shareFeedback.value = "";
}

async function copyShareMessage() {
  if (!shareMessage.value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    shareFeedback.value = "No se pudo copiar el mensaje en este navegador.";
    return;
  }

  try {
    await navigator.clipboard.writeText(shareMessage.value);
    shareFeedback.value = "Mensaje copiado. Ya puedes enviarlo al chofer.";
  } catch {
    shareFeedback.value = "No se pudo copiar el mensaje.";
  }
}

async function addClientToRoute() {
  if (!routeData.value?._id) {
    errorMessage.value = "No hay una ruta activa para editar.";
    return;
  }

  const normalizedClientId = addStopPendingClientId.value || addStopClientId.value.trim();

  if (!normalizedClientId) {
    errorMessage.value = "Escribe el ID del cliente que quieres agregar.";
    return;
  }

  const payload = {
    clientId: normalizedClientId,
  };

  if (addStopBranchOptions.value.length > 0) {
    payload.sucursal = selectedAddStopBranch.value;
  }

  addStopLoading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 409 && result?.requiresBranchSelection && Array.isArray(result?.branches) && result.branches.length > 0) {
        addStopBranchOptions.value = result.branches;
        selectedAddStopBranch.value = String(result.branches[0]?.sucursal ?? "");
        addStopPendingClientId.value = normalizedClientId;
        feedback.value = "Este cliente tiene varias sedes. Elige una para continuar.";
        return;
      }

      errorMessage.value = result?.message || "No se pudo agregar el cliente a la ruta.";
      return;
    }

    const updatedRoute = result?.route || routeData.value;
    syncRouteCollection(updatedRoute);
    editableStops.value = cloneStops(Array.isArray(updatedRoute?.stops) ? updatedRoute.stops : []);
    addStopClientId.value = "";
    addStopBranchOptions.value = [];
    selectedAddStopBranch.value = "";
    addStopPendingClientId.value = "";
    feedback.value = `Cliente ${normalizedClientId} agregado a la ruta.`;
    schedulePreviewDistance();
  } catch (error) {
    errorMessage.value = `Error agregando cliente: ${error.message}`;
  } finally {
    addStopLoading.value = false;
  }
}

async function removeClientFromRoute(clientId) {
  if (!routeData.value?._id) {
    errorMessage.value = "No hay una ruta activa para editar.";
    return;
  }

  const normalizedClientId = String(clientId || "").trim();

  if (!normalizedClientId) {
    return;
  }

  routeActionLoading.value = `remove:${normalizedClientId}`;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops/${encodeURIComponent(normalizedClientId)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo quitar el cliente de la ruta.";
      return;
    }

    const updatedRoute = result?.route || routeData.value;
    syncRouteCollection(updatedRoute);
    editableStops.value = cloneStops(Array.isArray(updatedRoute?.stops) ? updatedRoute.stops : []);

    if (priorityStopClientId.value === normalizedClientId) {
      priorityStopClientId.value = String(editableStops.value[0]?.clientId || "").trim();
    }

    pendingRemovalClientId.value = "";
    feedback.value = `Cliente ${normalizedClientId} eliminado de la ruta.`;
    schedulePreviewDistance();
  } catch (error) {
    errorMessage.value = `Error quitando cliente: ${error.message}`;
  } finally {
    routeActionLoading.value = "";
  }
}

function requestStopRemoval(clientId) {
  const normalizedClientId = String(clientId || "").trim();

  if (!normalizedClientId) {
    return;
  }

  pendingRemovalClientId.value = normalizedClientId;
}

function cancelStopRemoval() {
  pendingRemovalClientId.value = "";
}

async function finalizeAndReoptimizeRoute() {
  if (!routeData.value?._id) {
    errorMessage.value = "No hay una ruta activa para recalcular.";
    return;
  }

  routeActionLoading.value = "optimize";
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/reoptimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo recalcular la ruta optima.";
      return;
    }

    const updatedRoute = result?.route || routeData.value;
    syncRouteCollection(updatedRoute);
    editableStops.value = cloneStops(Array.isArray(updatedRoute?.stops) ? updatedRoute.stops : []);
    previewDistanceKm.value = null;
    previewDistanceLoading.value = false;
    previewDistanceError.value = "";
    addStopBranchOptions.value = [];
    selectedAddStopBranch.value = "";
    addStopPendingClientId.value = "";
    feedback.value = "Ruta recalculada con el orden mas optimo.";
  } catch (error) {
    errorMessage.value = `Error recalculando ruta: ${error.message}`;
  } finally {
    routeActionLoading.value = "";
  }
}

function handleAddStopClientIdInput() {
  addStopBranchOptions.value = [];
  selectedAddStopBranch.value = "";
  addStopPendingClientId.value = "";
}

function togglePriorityStop(clientId) {
  const normalizedClientId = String(clientId || "").trim();

  if (!normalizedClientId) {
    return;
  }

  priorityStopClientId.value = priorityStopClientId.value === normalizedClientId
    ? ""
    : normalizedClientId;
}

function applyMirroredRouteOrder() {
  if (!editingRoute.value || editableStops.value.length < 2) {
    return;
  }

  const stops = [...editableStops.value];
  const normalizedPriorityId = String(priorityStopClientId.value || "").trim();
  let nextStops = [];

  if (normalizedPriorityId) {
    const priorityStop = stops.find((stop) => String(stop?.clientId || "").trim() === normalizedPriorityId);

    if (priorityStop) {
      const remainingStops = stops.filter((stop) => String(stop?.clientId || "").trim() !== normalizedPriorityId);
      nextStops = [priorityStop, ...remainingStops.reverse()];
    } else {
      nextStops = stops.reverse();
      priorityStopClientId.value = "";
    }
  } else {
    nextStops = stops.reverse();
  }

  editableStops.value = normalizeEditableStopOrder(nextStops);
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
  errorMessage.value = "";
  feedback.value = normalizedPriorityId
    ? `Orden espejo aplicado con prioridad en cliente ${normalizedPriorityId}.`
    : "Orden espejo aplicado sin cliente prioritario.";
}

function normalizeEditableStopOrder(stops) {
  return stops.map((stop, index) => ({
    ...stop,
    order: index + 1,
  }));
}

function moveEditableStop(fromIndex, toIndex) {
  const totalStops = editableStops.value.length;

  if (fromIndex < 0 || fromIndex >= totalStops) {
    return;
  }

  const clampedTargetIndex = Math.max(0, Math.min(totalStops - 1, toIndex));

  if (fromIndex === clampedTargetIndex) {
    return;
  }

  const nextStops = [...editableStops.value];
  const [movedStop] = nextStops.splice(fromIndex, 1);
  nextStops.splice(clampedTargetIndex, 0, movedStop);
  editableStops.value = normalizeEditableStopOrder(nextStops);
  draggedStopIndex.value = -1;
  dragOverStopIndex.value = -1;
}

function moveStopToTop(index) {
  moveEditableStop(index, 0);
}

function moveStopUp(index) {
  moveEditableStop(index, index - 1);
}

function moveStopDown(index) {
  moveEditableStop(index, index + 1);
}

function moveStopToPosition(index, targetPosition) {
  const parsedPosition = Number(targetPosition);

  if (!Number.isFinite(parsedPosition)) {
    return;
  }

  moveEditableStop(index, Math.round(parsedPosition) - 1);
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

  moveEditableStop(draggedStopIndex.value, index);
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
    shareFeedback.value = "Ruta guardada. Puedes copiar el mensaje para el chofer.";
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
    resetRouteUiState();
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

async function loadDriverRouteById(routeId) {
  const normalizedRouteId = String(routeId || "").trim();

  if (!normalizedRouteId) {
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/by-id/${encodeURIComponent(normalizedRouteId)}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeData.value = null;
      assignedRoutes.value = [];
      errorMessage.value = result?.message || "No se pudo cargar la ruta seleccionada.";
      return;
    }

    assignedRoutes.value = Array.isArray(result?.routes)
      ? result.routes
      : result?.route
        ? [result.route]
        : [];
    routeData.value = result?.route || assignedRoutes.value[0] || null;
    driverId.value = String(routeData.value?.driverId || driverId.value || "").trim();
    resetRouteUiState();
  } catch (error) {
    routeData.value = null;
    assignedRoutes.value = [];
    errorMessage.value = `Error cargando ruta seleccionada: ${error.message}`;
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

function openRouteIssueSummary() {
  if (!routeData.value?._id) {
    return;
  }

  router.push(`/driver-route/${routeData.value._id}/issues-summary`);
}

async function downloadRouteGpx() {
  const routeId = String(routeData.value?._id || "").trim();

  if (!routeId) {
    errorMessage.value = "No hay una ruta seleccionada para exportar.";
    return;
  }

  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${encodeURIComponent(routeId)}/export-gpx`);

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      errorMessage.value = result?.message || "No se pudo exportar el GPX oficial del backend.";
      return;
    }

    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const matchedFileName = contentDisposition.match(/filename="?([^\";]+)"?/i);
    const fileName = matchedFileName?.[1] || `${routeData.value?.routeLabel || "ruta"}.gpx`;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    feedback.value = "GPX oficial descargado desde backend. Ese archivo respeta la ruta exacta del sistema.";
  } catch (error) {
    errorMessage.value = `Error exportando GPX: ${error.message}`;
  }
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

onMounted(async () => {
  try {
    const sessionState = await fetchSession();
    sessionUser.value = sessionState.user || null;
  } catch {
    sessionUser.value = null;
  }

  const prefilledDriverId = typeof route.query.driverId === "string"
    ? route.query.driverId.trim()
    : "";
  const prefilledRouteId = typeof route.query.routeId === "string"
    ? route.query.routeId.trim()
    : "";

  if (prefilledRouteId) {
    await loadDriverRouteById(prefilledRouteId);
    return;
  }

  const sessionDriverId = resolveSessionDriverId();
  const nextDriverId = prefilledDriverId || sessionDriverId;

  if (!nextDriverId) {
    return;
  }

  driverId.value = nextDriverId;
  loadDriverRoute();
});

watch(
  () => editingRoute.value,
  (isEditing) => {
    if (!isEditing) {
      clearPreviewDistanceTimer();
      resetPreviewDistanceState();
      return;
    }

    schedulePreviewDistance();
  },
);

watch(
  () => editableStops.value.map((stop) => String(stop?.clientId || "")).join("|"),
  () => {
    if (!editingRoute.value) {
      return;
    }

    schedulePreviewDistance();
  },
);
</script>

<template>
  <section class="driver-page">
    <div class="driver-shell">
      <div class="driver-hero">
        <p class="driver-kicker">Ruta del chofer</p>
        <h1>Consulta tu ruta asignada</h1>
        <p class="driver-copy">Tu ID se toma de la sesion cuando esta disponible. Tambien puedes consultarlo manualmente para ver la ruta actual y los clientes pendientes.</p>
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
            <button class="secondary-button action-button" type="button" @click="downloadRouteGpx">
              Descargar GPX exacto
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

        <div class="driver-card map-card">
          <div class="map-editor-layout">
            <div class="map-pane">
              <RouteOsmMap
                title="Mapa OSM de la ruta"
                :description="editingRoute
                  ? 'Vista previa en vivo: al mover el orden de clientes, el mapa se actualiza de inmediato.'
                  : 'Aquí sí se muestran las paradas con su orden dentro del teléfono, sin depender del visor externo.'"
                :stops="routeMapStops"
                :canvas-min-height="640"
              />
            </div>

            <div class="editor-pane">
              <div class="section-heading">
                <strong>Modificar orden de la ruta</strong>
                <span>Puedes mover las paradas y guardar tu version o volver a la ruta recomendada por el sistema.</span>
              </div>

              <div class="distance-compare-grid">
                <article class="distance-compare-item">
                  <span>Ruta original</span>
                  <strong>{{ formatKm(originalRouteDistanceKm) }}</strong>
                </article>
                <article class="distance-compare-item">
                  <span>Ruta por modificacion del chofer</span>
                  <strong>{{ formatKm(driverModifiedRouteDistanceKm) }}</strong>
                  <small v-if="editingRoute && previewDistanceLoading" class="distance-preview-note">Calculando preview...</small>
                  <small v-else-if="editingRoute && previewDistanceKm != null" class="distance-preview-note">Preview sin guardar</small>
                </article>
                <article class="distance-compare-item">
                  <span>Diferencia</span>
                  <strong :class="routeDistanceDeltaKm > 0 ? 'distance-up' : (routeDistanceDeltaKm < 0 ? 'distance-down' : '')">
                    {{ routeDistanceDeltaKm == null ? "Sin dato" : `${routeDistanceDeltaKm > 0 ? '+' : ''}${routeDistanceDeltaKm.toFixed(2)} km` }}
                  </strong>
                  <small v-if="editingRoute && previewDistanceError" class="distance-preview-error">{{ previewDistanceError }}</small>
                </article>
              </div>

              <div v-if="editingRoute" class="editor-panel">
                <p class="editor-help">
                  Mantén presionada una parada, arrástrala y suéltala en la posición que quieras.
                </p>
                <div class="add-stop-panel">
                  <strong>Agregar cliente a esta ruta</strong>
                  <div class="add-stop-grid">
                    <input
                      v-model="addStopClientId"
                      type="text"
                      placeholder="ID cliente"
                      @input="handleAddStopClientIdInput"
                      @keyup.enter="addClientToRoute"
                    />
                    <button class="secondary-button" type="button" :disabled="addStopLoading" @click="addClientToRoute">
                      {{ addStopLoading ? "Agregando..." : "Agregar cliente" }}
                    </button>
                  </div>
                  <button
                    class="ghost-button add-stop-optimize-button"
                    type="button"
                    :disabled="routeActionLoading === 'optimize' || addStopLoading"
                    @click="finalizeAndReoptimizeRoute"
                  >
                    {{ routeActionLoading === "optimize" ? "Recalculando..." : "Finalizar agregados y recalcular ruta optima" }}
                  </button>
                  <div v-if="addStopBranchOptions.length" class="add-stop-branch-picker">
                    <label for="branchSelect">Este ID tiene varias sedes. Elige una:</label>
                    <select id="branchSelect" v-model="selectedAddStopBranch" :disabled="addStopLoading">
                      <option
                        v-for="branch in addStopBranchOptions"
                        :key="`${branch.sucursal || 'principal'}-${branch.nombre}`"
                        :value="branch.sucursal"
                      >
                        {{ branch.label }}
                      </option>
                    </select>
                    <button class="secondary-button" type="button" :disabled="addStopLoading" @click="addClientToRoute">
                      {{ addStopLoading ? "Agregando..." : "Agregar sede seleccionada" }}
                    </button>
                  </div>
                </div>
                <div class="editor-mirror-controls">
                  <button class="ghost-button" type="button" @click="applyMirroredRouteOrder">
                    Aplicar espejo
                  </button>
                  <div class="reorder-mode-switch" role="group" aria-label="Modo de reordenamiento">
                    <button
                      class="reorder-mode-btn"
                      :class="{ 'reorder-mode-btn-active': reorderMode === 'drag' }"
                      type="button"
                      @click="reorderMode = 'drag'"
                    >
                      Arrastrar
                    </button>
                    <button
                      class="reorder-mode-btn"
                      :class="{ 'reorder-mode-btn-active': reorderMode === 'arrows' }"
                      type="button"
                      @click="reorderMode = 'arrows'"
                    >
                      Flechas
                    </button>
                    <button
                      class="reorder-mode-btn"
                      :class="{ 'reorder-mode-btn-active': reorderMode === 'position' }"
                      type="button"
                      @click="reorderMode = 'position'"
                    >
                      Posicion #
                    </button>
                  </div>
                  <span class="editor-priority-note">
                    {{ priorityStopClientId ? `Prioridad: ${priorityStopClientId}` : "Sin prioridad fija" }}
                  </span>
                </div>
                <div class="editable-stops-list">
                  <article
                    v-for="(stop, index) in editableStops"
                    :key="`edit-${stop.clientId}`"
                    class="editable-stop-item"
                    :class="{
                      'editable-stop-item-draggable': reorderMode === 'drag',
                      'editable-stop-item-dragging': draggedStopIndex === index,
                      'editable-stop-item-target': dragOverStopIndex === index && draggedStopIndex !== index,
                    }"
                    :draggable="reorderMode === 'drag'"
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
                      <button
                        class="priority-star-btn"
                        :class="{ 'priority-star-btn-active': priorityStopClientId === String(stop.clientId) }"
                        type="button"
                        :title="priorityStopClientId === String(stop.clientId) ? 'Quitar prioridad' : 'Marcar prioridad para espejo'"
                        @click="togglePriorityStop(stop.clientId)"
                      >
                        {{ priorityStopClientId === String(stop.clientId) ? "★" : "☆" }}
                      </button>
                      <button
                        class="remove-stop-btn"
                        type="button"
                        :disabled="routeActionLoading === `remove:${stop.clientId}`"
                        title="Quitar cliente"
                        aria-label="Quitar cliente"
                        @click="requestStopRemoval(stop.clientId)"
                      >
                        ×
                      </button>
                      <template v-if="reorderMode === 'drag'">
                        <span class="drag-handle">Arrastrar</span>
                      </template>
                      <template v-else-if="reorderMode === 'arrows'">
                        <button
                          class="reorder-btn"
                          type="button"
                          title="Mover al inicio"
                          :disabled="index === 0"
                          @click="moveStopToTop(index)"
                        >
                          1°
                        </button>
                        <button
                          class="reorder-btn"
                          type="button"
                          title="Subir una posicion"
                          :disabled="index === 0"
                          @click="moveStopUp(index)"
                        >
                          ↑
                        </button>
                        <button
                          class="reorder-btn"
                          type="button"
                          title="Bajar una posicion"
                          :disabled="index === editableStops.length - 1"
                          @click="moveStopDown(index)"
                        >
                          ↓
                        </button>
                      </template>
                      <template v-else>
                        <label class="reorder-position-input" title="Mover a posicion">
                          <span>#</span>
                          <input
                            type="number"
                            min="1"
                            :max="editableStops.length"
                            :value="index + 1"
                            @change="moveStopToPosition(index, Number($event.target.value))"
                            @keyup.enter="moveStopToPosition(index, Number($event.target.value))"
                          />
                        </label>
                      </template>
                    </div>
                    <div
                      v-if="pendingRemovalClientId === String(stop.clientId)"
                      class="remove-stop-popout"
                    >
                      <p>Quitar cliente {{ stop.clientId }} de la ruta?</p>
                      <div class="remove-stop-popout-actions">
                        <button class="ghost-button" type="button" @click="cancelStopRemoval">Cancelar</button>
                        <button
                          class="remove-stop-confirm-btn"
                          type="button"
                          :disabled="routeActionLoading === `remove:${stop.clientId}`"
                          @click="removeClientFromRoute(stop.clientId)"
                        >
                          {{ routeActionLoading === `remove:${stop.clientId}` ? "Quitando..." : "Confirmar" }}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>

                <div class="share-message-card">
                  <div class="share-message-header">
                    <strong>Mensaje para enviar al chofer</strong>
                    <button class="secondary-button" type="button" @click="copyShareMessage">
                      Copiar mensaje
                    </button>
                  </div>
                  <p class="share-message-help">Se arma con el orden actual, incluyendo los km y links de cada cliente.</p>
                  <pre class="share-message-preview">{{ shareMessage }}</pre>
                  <p v-if="shareFeedback" class="inline-feedback inline-feedback-success">{{ shareFeedback }}</p>
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

              <div v-else class="editor-panel">
                <p class="editor-help">Activa la edicion para reorganizar clientes desde este mismo bloque del mapa.</p>
                <div class="editor-actions">
                  <button class="secondary-button" type="button" @click="startRouteEditing">
                    Editar orden en este mapa
                  </button>
                </div>
              </div>
            </div>
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
  width: min(1040px, 100%);
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

.driver-results {
  width: 100%;
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

.add-stop-panel {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem;
  border-radius: 14px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);
}

.add-stop-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.add-stop-grid > * {
  min-width: 0;
}

.add-stop-grid input {
  width: 100%;
  min-height: 42px;
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.add-stop-optimize-button {
  width: 100%;
}

.add-stop-branch-picker {
  display: grid;
  gap: 0.45rem;
}

.add-stop-branch-picker label {
  color: rgba(243, 246, 251, 0.78);
  font-size: 0.9rem;
}

.add-stop-branch-picker select {
  width: 100%;
  min-height: 42px;
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.editor-mirror-controls {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.reorder-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);
}

.reorder-mode-btn {
  border: none;
  min-height: 34px;
  padding: 0.45rem 0.7rem;
  border-radius: 999px;
  background: transparent;
  color: rgba(243, 246, 251, 0.78);
  font-weight: 700;
  cursor: pointer;
}

.reorder-mode-btn-active {
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.editor-priority-note {
  color: rgba(243, 246, 251, 0.76);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.share-message-card {
  display: grid;
  gap: 0.6rem;
  padding: 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);
}

.share-message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.share-message-help {
  margin: 0;
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.9rem;
}

.share-message-preview {
  margin: 0;
  padding: 0.8rem;
  border-radius: 12px;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, Monaco, "Courier New", monospace;
  background: rgba(7, 16, 30, 0.76);
  border: 1px solid rgba(159, 209, 255, 0.2);
  color: rgba(243, 246, 251, 0.92);
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.editable-stop-item-draggable {
  cursor: grab;
}

.editable-stop-item > div:first-child {
  min-width: 0;
}

.editable-stop-item > div:first-child strong,
.editable-stop-item > div:first-child p {
  overflow-wrap: anywhere;
}

.editable-stop-actions {
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
  flex-shrink: 0;
}

.reorder-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  min-height: 36px;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  border: 1px solid rgba(159, 209, 255, 0.28);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(243, 246, 251, 0.88);
  font-weight: 700;
  cursor: pointer;
}

.reorder-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.reorder-position-input {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0.2rem 0.3rem 0.2rem 0.55rem;
  border-radius: 10px;
  border: 1px solid rgba(159, 209, 255, 0.28);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(243, 246, 251, 0.88);
  font-weight: 700;
}

.reorder-position-input input {
  width: 68px;
  min-height: 30px;
  padding: 0.2rem 0.45rem;
  border-radius: 8px;
  border: 1px solid rgba(159, 209, 255, 0.24);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
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

.priority-star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.34);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(243, 246, 251, 0.9);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.priority-star-btn-active {
  border-color: rgba(255, 213, 154, 0.55);
  background: rgba(255, 213, 154, 0.16);
  color: #ffe8c3;
}

.remove-stop-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  min-width: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.24);
  color: #fecaca;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.remove-stop-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.remove-stop-popout {
  grid-column: 1 / -1;
  margin-top: 0.55rem;
  padding: 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.22);
  display: grid;
  gap: 0.55rem;
}

.remove-stop-popout p {
  margin: 0;
  color: #fee2e2;
  font-size: 0.88rem;
}

.remove-stop-popout-actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.remove-stop-confirm-btn {
  min-height: 36px;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(252, 165, 165, 0.5);
  background: rgba(185, 28, 28, 0.35);
  color: #fee2e2;
  font-weight: 700;
  cursor: pointer;
}

.remove-stop-confirm-btn:disabled {
  opacity: 0.7;
  cursor: wait;
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
  max-height: min(46vh, 420px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(159, 209, 255, 0.45) rgba(255, 255, 255, 0.08);
}

.route-switcher-grid::-webkit-scrollbar {
  width: 8px;
}

.route-switcher-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

.route-switcher-grid::-webkit-scrollbar-thumb {
  background: rgba(159, 209, 255, 0.45);
  border-radius: 999px;
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

.map-card {
  width: 100%;
  margin-left: 0;
  transform: none;
}

.map-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr);
  gap: 1rem;
  align-items: start;
}

.map-pane,
.editor-pane {
  min-width: 0;
}

.editor-pane {
  display: grid;
  gap: 0.9rem;
}

.distance-compare-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.distance-compare-item {
  padding: 0.75rem 0.8rem;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.35rem;
}

.distance-compare-item span {
  font-size: 0.8rem;
  color: rgba(243, 246, 251, 0.66);
}

.distance-compare-item strong {
  font-size: 0.98rem;
}

.distance-preview-note {
  font-size: 0.76rem;
  color: rgba(243, 246, 251, 0.68);
}

.distance-preview-error {
  font-size: 0.76rem;
  color: #ffb4b4;
}

.distance-up {
  color: #fbbf24;
}

.distance-down {
  color: #8df0b4;
}

.editor-pane .editable-stops-list {
  max-height: 460px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
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

@media (max-width: 1320px) {
  .editable-stop-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
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

  .map-editor-layout {
    grid-template-columns: 1fr;
  }

  .distance-compare-grid {
    grid-template-columns: 1fr;
  }

  .add-stop-grid {
    grid-template-columns: 1fr;
  }

  .editor-pane .editable-stops-list {
    max-height: 340px;
  }

  .route-switcher-grid {
    max-height: min(38vh, 340px);
  }

  .driver-button,
  .secondary-button,
  .ghost-button,
  .stop-actions a {
    width: 100%;
    text-align: center;
  }

  .map-card {
    width: auto;
    margin-left: 0;
    transform: none;
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