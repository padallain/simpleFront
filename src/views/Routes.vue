<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from 'vue-router';
import RouteOsmMap from "../components/RouteOsmMap.vue";
import TransportTripEditor from "../components/TransportTripEditor.vue";
import DispatchCompanyPicker from "../components/DispatchCompanyPicker.vue";
import { downloadLoadGuide } from "../services/loadGuidePdf";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const pageRoute = useRoute();
const router = useRouter();
function getTodayOrderDate() {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const editingGuideId = ref('');
const guideUpdatedAt = ref(null);
const priorityPreviewLoading = ref(false);
let priorityPreviewSequence = 0;

const driverId = ref("");
const driverName = ref("");
const includeTransport = ref(false);
const transportEditor = ref(null);
const transportRouteId = ref('');
const routeComment = ref("");
const routeWeight = ref(0);
const paradaInput = ref("");
const orderNumberInput = ref("");
const orderDateInput = ref(getTodayOrderDate());
const orderTotalInput = ref(null);
const editingClientStopKey = ref('');
const editingClientId = ref('');
const clientEditBranches = ref([]);
const clientEditError = ref('');
const companyIdInput = ref('');
const companyCatalog = ref([]);
const defaultCompanyId = ref('');
const paradaInputRef = ref(null);
const dispatchRouteMapRef = ref(null);
const paradas = ref([]);
const paradasTableRef = ref(null);
const latestAddedStopKey = ref("");
let stopHighlightTimer = null;
let stopKeySequence = 0;
const anchorClientId = ref("");
const anchorSucursal = ref("");
const anchorStopKey = ref("");
const anchorReason = ref("priority");
const sedePickerVisible = ref(false);
const sedePendingId = ref("");
const sedePendingNombre = ref("");
const sedeOpciones = ref([]);
const serverResponse = ref(null);
const routeTable = ref([]);
const addingStop = ref(false);
const addStopStatus = ref("");
const addStopStatusType = ref("info");
const loading = ref(false);
const feedback = ref("");
const errorMessage = ref("");
const shareFeedback = ref("");
const insightsFeedback = ref("");
const selectedRouteType = ref("closest");
const reorderMode = ref("drag");

const routeTypeOptions = [
  { value: "closest", label: "Mas cercana" },
  { value: "farthest", label: "Lejanos primero" },
  { value: "alphabetical", label: "Orden alfabetico" },
  { value: "mirrored", label: "Espejo (zona contraria)" },
];

const anchorReasonOptions = [
  { value: "priority", label: "Prioridad operativa" },
  { value: "weight", label: "Mayor peso" },
];

function buildStopKey(stop) {
  const clientId = String(stop?.parada ?? stop?.clientId ?? stop?.id ?? "").trim();
  const sucursal = typeof stop?.sucursal === "string" ? stop.sucursal.trim() : "";

  return sucursal ? `${clientId}|${sucursal}` : clientId;
}

async function toggleAnchor(stop) {
  if (loading.value || addingStop.value || sedePickerVisible.value) return;
  const nextKey = buildStopKey(stop);

  if (anchorStopKey.value === nextKey) {
    anchorClientId.value = "";
    anchorSucursal.value = "";
    anchorStopKey.value = "";
  } else {
    anchorClientId.value = String(stop?.parada ?? stop?.clientId ?? '').trim();
    anchorSucursal.value = typeof stop?.sucursal === 'string' ? stop.sucursal.trim() : '';
    anchorStopKey.value = nextKey;
  }

  const sequence = ++priorityPreviewSequence;
  priorityPreviewLoading.value = true; errorMessage.value = '';
  try {
    const requested = new Map(paradas.value.map(item => [buildStopKey(item), { clientId: item.parada, sucursal: item.sucursal || '' }]));
    const response = await fetch(`${API_BASE_URL}/makeRoute/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: [...requested.values()], routeType: 'closest', preserveRouteOrder: false,
        anchorClientId: anchorClientId.value || undefined, anchorSucursal: anchorSucursal.value || undefined,
        anchorStopKey: anchorStopKey.value || undefined, routeWeight: totalWeight.value }) });
    const result = await response.json().catch(() => null);
    if (sequence !== priorityPreviewSequence) return;
    if (!response.ok) throw new Error(result?.message || 'No se pudo reorganizar la ruta desde la prioridad.');
    const saved = serverResponse.value?.savedRoute || null;
    selectedRouteType.value = result.routeType || 'closest';
    serverResponse.value = { ...serverResponse.value, ...result, savedRoute: saved };
    feedback.value = anchorClientId.value ? `Ruta reorganizada desde ${stop.name || anchorClientId.value}.` : 'Prioridad retirada y ruta recalculada.';
  } catch (failure) { if (sequence === priorityPreviewSequence) errorMessage.value = failure.message; }
  finally { if (sequence === priorityPreviewSequence) priorityPreviewLoading.value = false; }
}

const totalWeight = computed(() => Number(routeWeight.value) || 0);
const totalOrderAmount = computed(() => paradas.value.reduce((sum, stop) => (
  sum + Math.round(((Number(stop.orderTotal) || 0) + Number.EPSILON) * 100)
), 0) / 100);
const plannedTransportStops = computed(() => new Set(paradas.value.map(buildStopKey)).size);

watch(includeTransport, enabled => {
  if (enabled && serverResponse.value?.savedRoute?.routeId && !transportRouteId.value) {
    transportRouteId.value = String(serverResponse.value.savedRoute.routeId);
  }
});

function formatAmount(value) {
  return Number(value || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateCompanyCatalog(result) {
  companyCatalog.value = result.companies;
  defaultCompanyId.value = result.defaultCompanyId || '';
}

const uniqueClientCount = computed(() => {
  const uniqueIds = new Set(
    paradas.value
      .map(buildStopKey)
      .filter(Boolean),
  );

  return uniqueIds.size;
});

const duplicateClientIds = computed(() => {
  const seen = new Set();
  const duplicates = new Set();

  paradas.value.forEach((stop) => {
    const clientId = String(stop.parada || "").trim();
    const stopKey = buildStopKey(stop);

    if (!clientId) {
      return;
    }

    if (seen.has(stopKey)) {
      duplicates.add(clientId);
      return;
    }

    seen.add(stopKey);
  });

  return Array.from(duplicates);
});

function calculateDistanceKm(fromLocation, toLocation) {
  const fromLatitude = Number(fromLocation?.latitude);
  const fromLongitude = Number(fromLocation?.longitude);
  const toLatitude = Number(toLocation?.latitude);
  const toLongitude = Number(toLocation?.longitude);

  if (!Number.isFinite(fromLatitude)
    || !Number.isFinite(fromLongitude)
    || !Number.isFinite(toLatitude)
    || !Number.isFinite(toLongitude)) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLatitude - fromLatitude);
  const dLon = toRadians(toLongitude - fromLongitude);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(fromLatitude))
    * Math.cos(toRadians(toLatitude))
    * Math.sin(dLon / 2)
    * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function moveEditableRoute(fromIndex, toIndex) {
  const totalStops = editableRoute.value.length;

  if (fromIndex < 0 || fromIndex >= totalStops) {
    return;
  }

  const normalizedTargetIndex = Math.max(0, Math.min(totalStops - 1, toIndex));

  if (fromIndex === normalizedTargetIndex) {
    return;
  }

  const nextRoute = [...editableRoute.value];
  const [movedStop] = nextRoute.splice(fromIndex, 1);
  nextRoute.splice(normalizedTargetIndex, 0, movedStop);
  editableRoute.value = nextRoute;

  const nextTable = [...routeTable.value];
  const [movedRow] = nextTable.splice(fromIndex, 1);
  nextTable.splice(normalizedTargetIndex, 0, movedRow);
  routeTable.value = nextTable.map((row, index) => ({ ...row, orden: index + 1 }));
}

function moveStopToTop(index) {
  moveEditableRoute(index, 0);
}

function moveStopUp(index) {
  moveEditableRoute(index, index - 1);
}

function moveStopDown(index) {
  moveEditableRoute(index, index + 1);
}

function moveStopToPosition(index, positionValue) {
  const normalizedPosition = Number(positionValue);

  if (!Number.isFinite(normalizedPosition)) {
    return;
  }

  moveEditableRoute(index, Math.round(normalizedPosition) - 1);
}


const nearbyClientGroups = computed(() => {
  const stops = Array.isArray(activeRouteOption.value?.route) ? activeRouteOption.value.route : [];
  const MAX_GROUP_DISTANCE_KM = 1;
  const geoStops = stops.filter((stop) => Number.isFinite(Number(stop?.location?.latitude))
    && Number.isFinite(Number(stop?.location?.longitude)));

  if (!geoStops.length) {
    return [];
  }

  const adjacency = Array.from({ length: geoStops.length }, () => []);

  for (let leftIndex = 0; leftIndex < geoStops.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < geoStops.length; rightIndex += 1) {
      const distanceKm = calculateDistanceKm(geoStops[leftIndex].location, geoStops[rightIndex].location);

      if (distanceKm <= MAX_GROUP_DISTANCE_KM) {
        adjacency[leftIndex].push(rightIndex);
        adjacency[rightIndex].push(leftIndex);
      }
    }
  }

  const visited = new Array(geoStops.length).fill(false);
  const groups = [];

  for (let startIndex = 0; startIndex < geoStops.length; startIndex += 1) {
    if (visited[startIndex]) {
      continue;
    }

    const queue = [startIndex];
    visited[startIndex] = true;
    const componentIndexes = [];

    while (queue.length) {
      const currentIndex = queue.shift();
      componentIndexes.push(currentIndex);

      adjacency[currentIndex].forEach((neighborIndex) => {
        if (!visited[neighborIndex]) {
          visited[neighborIndex] = true;
          queue.push(neighborIndex);
        }
      });
    }

    if (componentIndexes.length < 2) {
      continue;
    }

    const groupStops = componentIndexes.map((index) => geoStops[index]);
    const centerLatitude = groupStops.reduce((sum, stop) => sum + Number(stop.location.latitude), 0) / groupStops.length;
    const centerLongitude = groupStops.reduce((sum, stop) => sum + Number(stop.location.longitude), 0) / groupStops.length;
    let maxInternalDistanceKm = 0;

    for (let leftIndex = 0; leftIndex < groupStops.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < groupStops.length; rightIndex += 1) {
        const distanceKm = calculateDistanceKm(groupStops[leftIndex].location, groupStops[rightIndex].location);

        if (Number.isFinite(distanceKm) && distanceKm > maxInternalDistanceKm) {
          maxInternalDistanceKm = distanceKm;
        }
      }
    }

    groups.push({
      groupKey: groupStops.map((stop) => String(stop.id || stop.nombre || "")).join("|"),
      centerLatitude,
      centerLongitude,
      maxInternalDistanceKm,
      clients: groupStops.map((stop) => ({
        id: stop.id,
        nombre: stop.nombre,
        sucursal: stop.sucursal || "",
      })),
    });
  }

  return groups
    .sort((leftGroup, rightGroup) => rightGroup.clients.length - leftGroup.clients.length)
    .map((group, index) => {
      const clientCount = group.clients.length;
    const densityLevel = clientCount >= 4 ? "high" : clientCount >= 3 ? "medium" : "low";
    const densityLabel = densityLevel === "high"
      ? "Alta"
      : densityLevel === "medium"
        ? "Media"
        : "Baja";

    return {
        ...group,
        priorityRank: index + 1,
        densityLevel,
        densityLabel,
      };
    });
});

const repeatedOrderClients = computed(() => {
  const clientsById = new Map();

  paradas.value.forEach((stop) => {
    const clientId = String(stop?.parada || "").trim();

    if (!clientId) {
      return;
    }

    if (!clientsById.has(clientId)) {
      clientsById.set(clientId, {
        clientId,
        nombre: String(stop?.name || "Cliente").trim() || "Cliente",
        orderCount: 0,
      });
    }

    clientsById.get(clientId).orderCount += 1;
  });

  return Array.from(clientsById.values())
    .filter((client) => client.orderCount >= 2)
    .sort((leftClient, rightClient) => rightClient.orderCount - leftClient.orderCount);
});

const anchorReasonLabel = computed(() => (
  anchorReasonOptions.find((option) => option.value === anchorReason.value)?.label || "Prioridad operativa"
));

const anchorStartStatus = computed(() => {
  if (!anchorClientId.value) {
    return null;
  }

  const route = Array.isArray(activeRouteOption.value?.route) ? activeRouteOption.value.route : [];

  if (!route.length) {
    return {
      applied: false,
      message: "Cliente ancla configurado. Se aplicara al crear la ruta.",
    };
  }

  const firstStopKey = buildStopKey(route[0]);
  const anchorStopKeyValue = anchorStopKey.value || buildStopKey({
    parada: anchorClientId.value,
    sucursal: anchorSucursal.value,
  });
  const isApplied = firstStopKey === anchorStopKeyValue;

  if (isApplied) {
    return {
      applied: true,
      message: `La ruta inicia en el cliente ancla ${anchorClientId.value}${anchorSucursal.value ? ` · ${anchorSucursal.value}` : ""} (${anchorReasonLabel.value}).`,
    };
  }

  return {
    applied: false,
    message: `El ancla ${anchorClientId.value}${anchorSucursal.value ? ` · ${anchorSucursal.value}` : ""} no quedo como primera parada en esta opcion. Revisa IDs o genera nuevamente.`,
  };
});

const routeRecommendationText = computed(() => {
  const topGroup = nearbyClientGroups.value[0];
  const repeatedTop = repeatedOrderClients.value[0];
  const suggestions = [];

  if (anchorClientId.value) {
    suggestions.push(`Inicia por el cliente ancla ${anchorClientId.value} (${anchorReasonLabel.value}).`);
  }

  if (topGroup) {
    suggestions.push(`Despues prioriza el grupo cercano (${topGroup.clients.length} clientes a menos de 1 km) alrededor de ${topGroup.centerLatitude.toFixed(4)}, ${topGroup.centerLongitude.toFixed(4)}.`);
  }

  if (repeatedTop) {
    suggestions.push(`Valida carga consolidada para ${repeatedTop.clientId}: tiene ${repeatedTop.orderCount} pedidos.`);
  }

  if (!suggestions.length) {
    return "Ruta balanceada: continua en el orden sugerido y valida ventanas de entrega en cada parada.";
  }

  return suggestions.join(" ");
});

const driverRouteLink = computed(() => {
  const normalizedDriverId = String(serverResponse.value?.savedRoute?.driverId || "").trim();

  if (!normalizedDriverId || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/driver-route?driverId=${encodeURIComponent(normalizedDriverId)}`;
});

const currentRouteReference = computed(() => {
  const routeId = String(serverResponse.value?.savedRoute?.routeId || "").trim();
  const routeLabel = String(serverResponse.value?.savedRoute?.routeLabel || "").trim();

  return routeLabel || (routeId ? `RUTA-${routeId}` : "Sin folio");
});

const routeOptions = computed(() => {
  if (Array.isArray(serverResponse.value?.routeOptions) && serverResponse.value.routeOptions.length) {
    return serverResponse.value.routeOptions;
  }

  if (Array.isArray(serverResponse.value?.route) && serverResponse.value.route.length) {
    return [{
      type: serverResponse.value?.routeType || "closest",
      label: serverResponse.value?.routeTypeLabel || "Ruta generada",
      description: "Resultado calculado para la ruta solicitada.",
      estimatedDistanceKm: null,
      route: serverResponse.value.route,
      routeNames: serverResponse.value.routeNames || [],
      googleMapsRouteLinks: serverResponse.value.googleMapsRouteLinks || [],
      openRouteLink: serverResponse.value.openRouteLink || "",
    }];
  }

  return [];
});

function normalizeKm(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function formatKm(value) {
  if (!Number.isFinite(value) || value == null || value <= 0) {
    return "Sin dato";
  }

  return `${Number(value).toFixed(2)} km`;
}

function calculateRouteDistancePreview(stops, origin) {
  const validStops = Array.isArray(stops)
    ? stops.filter((stop) => Number.isFinite(Number(stop?.location?.latitude))
      && Number.isFinite(Number(stop?.location?.longitude)))
    : [];

  if (!validStops.length) {
    return null;
  }

  const routePoints = [];

  if (Number.isFinite(Number(origin?.latitude)) && Number.isFinite(Number(origin?.longitude))) {
    routePoints.push({
      latitude: Number(origin.latitude),
      longitude: Number(origin.longitude),
    });
  }

  validStops.forEach((stop) => {
    routePoints.push({
      latitude: Number(stop.location.latitude),
      longitude: Number(stop.location.longitude),
    });
  });

  if (Number.isFinite(Number(origin?.latitude)) && Number.isFinite(Number(origin?.longitude))) {
    routePoints.push({
      latitude: Number(origin.latitude),
      longitude: Number(origin.longitude),
    });
  }

  if (routePoints.length < 2) {
    return null;
  }

  let totalDistanceKm = 0;

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const distanceKm = calculateDistanceKm(routePoints[index], routePoints[index + 1]);

    if (Number.isFinite(distanceKm)) {
      totalDistanceKm += distanceKm;
    }
  }

  return Number(totalDistanceKm.toFixed(2));
}

const originalRouteDistanceKm = computed(() => normalizeKm(activeRouteOption.value?.estimatedDistanceKm)
  ?? normalizeKm(serverResponse.value?.totalDistanceKm));

const modifiedRouteDistanceKm = computed(() => calculateRouteDistancePreview(editableRoute.value, activeRouteOrigin.value)
  ?? normalizeKm(activeRouteOption.value?.estimatedDistanceKm)
  ?? normalizeKm(serverResponse.value?.totalDistanceKm));

const routeDistanceDeltaKm = computed(() => {
  if (originalRouteDistanceKm.value == null || modifiedRouteDistanceKm.value == null) {
    return null;
  }

  return Number((modifiedRouteDistanceKm.value - originalRouteDistanceKm.value).toFixed(2));
});

const activeRouteOption = computed(() => {
  if (!routeOptions.value.length) {
    return null;
  }

  return routeOptions.value.find((option) => option.type === selectedRouteType.value) || routeOptions.value[0];
});

function focusDispatchRouteMap() {
  nextTick(() => {
    const mapElement = dispatchRouteMapRef.value?.$el || dispatchRouteMapRef.value;
    mapElement?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  });
}

const activeRouteOrigin = computed(() => {
  const fallbackOrigin = { latitude: 10.578208693113535, longitude: -71.67338068775426 };
  const rawLink = String(activeRouteOption.value?.openRouteLink || "").trim();

  if (!rawLink) {
    return fallbackOrigin;
  }

  try {
    const parsedUrl = new URL(rawLink);
    const latitude = Number(parsedUrl.searchParams.get("n1"));
    const longitude = Number(parsedUrl.searchParams.get("n2"));

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  } catch (_error) {
    // Keep default origin if URL parsing fails.
  }

  return fallbackOrigin;
});

const editableRoute = ref([]);
const draggedIndex = ref(null);

const activeRouteMapStops = computed(() => editableRoute.value);

const clientLinkEntries = computed(() =>
  editableRoute.value
    .filter((stop) => stop?.nombre && stop?.googleMapsLink)
    .map((stop) => ({
      id: stop.id,
      stopKey: buildStopKey(stop),
      nombre: stop.nombre,
      link: stop.googleMapsLink,
      text: `${stop.nombre}, ${stop.googleMapsLink}`,
    })),
);

function onDragStart(e, idx) {
  if (reorderMode.value !== "drag") {
    return;
  }

  draggedIndex.value = idx;
  e.dataTransfer.effectAllowed = "move";
}

function onDrop(e, targetIdx) {
  if (reorderMode.value !== "drag") {
    return;
  }

  e.preventDefault();
  const from = draggedIndex.value;
  draggedIndex.value = null;
  if (from === null || from === targetIdx) return;

  moveEditableRoute(from, targetIdx);
}

function onDragEnd() {
  draggedIndex.value = null;
}

const shareMessage = computed(() => {
  const lines = clientLinkEntries.value.map((entry) => entry.text);

  if (activeRouteOption.value?.label) {
    lines.unshift(`Tipo de ruta: ${activeRouteOption.value.label}`);
  }

  if (driverRouteLink.value) {
    lines.push("");
    lines.push(`Mi ruta: ${driverRouteLink.value}`);
  }

  return lines.join("\n");
});

watch(reorderMode, () => {
  draggedIndex.value = null;
});

watch(
  () => activeRouteOption.value?.route,
  (route) => {
    if (Array.isArray(route) && route.length) {
      editableRoute.value = [...route];
      routeTable.value = route.map((stop, idx) => ({
        orden: idx + 1,
        nombre: stop.nombre,
        novedad: "",
      }));
      return;
    }
    editableRoute.value = [];
    routeTable.value = [];
  },
  { immediate: true },
);

async function revealLatestStopRow() {
  await nextTick();

  const tableRoot = paradasTableRef.value?.$el || paradasTableRef.value;
  const scrollWrap = tableRoot?.querySelector?.(".el-scrollbar__wrap");

  if (scrollWrap) {
    scrollWrap.scrollTop = scrollWrap.scrollHeight;
  }
}

async function focusParadaInput() {
  await nextTick();

  const inputInstance = paradaInputRef.value;
  const nativeInput = inputInstance?.input
    || inputInstance?.$el?.querySelector?.("input");

  if (typeof nativeInput?.focus === "function") {
    nativeInput.focus();
  }
}

function markLatestAddedStop(stopKey) {
  latestAddedStopKey.value = stopKey;

  if (stopHighlightTimer) {
    window.clearTimeout(stopHighlightTimer);
  }

  stopHighlightTimer = window.setTimeout(() => {
    if (latestAddedStopKey.value === stopKey) {
      latestAddedStopKey.value = "";
    }
  }, 1200);
}

function resolveParadaRowClass(row) {
  const classes = [];

  if (buildStopKey(row) === anchorStopKey.value) {
    classes.push("anchor-row");
  }

  if (row?.__stopKey && row.__stopKey === latestAddedStopKey.value) {
    classes.push("recent-stop-row");
  }

  return classes.join(" ");
}

async function addStopAndReveal(stop) {
  stopKeySequence += 1;
  const stopKey = `stop-${Date.now()}-${stopKeySequence}`;

  paradas.value.push({
    companyId: companyIdInput.value,
    orderNumber: orderNumberInput.value.trim(),
    orderDate: orderDateInput.value,
    orderTotal: Number(orderTotalInput.value),
    ...stop,
    __stopKey: stopKey,
  });
  orderNumberInput.value = '';
  orderDateInput.value = getTodayOrderDate();
  orderTotalInput.value = null;
  companyIdInput.value = defaultCompanyId.value;
  markLatestAddedStop(stopKey);
  await revealLatestStopRow();
}

onBeforeUnmount(() => {
  if (stopHighlightTimer) {
    window.clearTimeout(stopHighlightTimer);
  }
});

async function agregarSede(sede) {
  await addStopAndReveal({
    parada: sede.id,
    name: sede.sucursal ? `${sede.nombre} — ${sede.sucursal}` : sede.nombre,
    location: sede.location,
    sucursal: sede.sucursal || "",
  });
  sedePickerVisible.value = false;
  sedeOpciones.value = [];
  sedePendingId.value = "";
  sedePendingNombre.value = "";
  paradaInput.value = "";
  focusParadaInput();
}

async function agregarParada() {
  if (addingStop.value || sedePickerVisible.value) {
    return;
  }

  const clientId = paradaInput.value.trim();

  if (!clientId) {
    errorMessage.value = "Ingresa el RIF o ID del cliente.";
    return;
  }

  if (!companyCatalog.value.some(company => company._id === companyIdInput.value)) {
    errorMessage.value = 'Selecciona o agrega la empresa a la que pertenece el pedido.';
    return;
  }

  if (!orderNumberInput.value.trim() || !orderDateInput.value || orderTotalInput.value == null || orderTotalInput.value === ''
    || !Number.isFinite(Number(orderTotalInput.value)) || Number(orderTotalInput.value) < 0) {
    errorMessage.value = "Ingresa el numero, la fecha del pedido y un monto valido antes de agregar el cliente.";
    return;
  }

  errorMessage.value = "";
  addStopStatus.value = "";

  addingStop.value = true;
  addStopStatusType.value = "info";
  addStopStatus.value = "Consultando cliente...";

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${clientId}`);
    if (response.ok) {
      const data = await response.json();

      // Chain client: show branch picker
      if (data.esCadena && Array.isArray(data.sedes) && data.sedes.length > 1) {
        sedePendingId.value = data.id;
        sedePendingNombre.value = data.nombre;
        sedeOpciones.value = data.sedes;
        sedePickerVisible.value = true;
        addStopStatusType.value = "info";
        addStopStatus.value = `Cliente ${clientId} tiene varias sedes. Selecciona una para agregar.`;
        return;
      }

      // Single-location client
      await addStopAndReveal({
        parada: clientId,
        name: data.nombre || "Cliente",
        location: data.location || null,
        sucursal: data.sucursal || "",
      });
      addStopStatusType.value = "success";
      addStopStatus.value = `Cliente ${clientId} agregado correctamente.`;
    } else {
      await addStopAndReveal({ parada: clientId, name: "No encontrado", location: null, sucursal: "" });
      addStopStatusType.value = "warning";
      addStopStatus.value = `Cliente ${clientId} no encontrado. Se agrego para revision.`;
    }
  } catch (_error) {
    await addStopAndReveal({ parada: clientId, name: "Error consultando", location: null, sucursal: "" });
    addStopStatusType.value = "warning";
    addStopStatus.value = `No se pudo consultar el cliente ${clientId}. Se agrego con estado de error.`;
  } finally {
    addingStop.value = false;
  }

  paradaInput.value = "";
  focusParadaInput();
}

function eliminarParada(idx) {
  const removed = paradas.value[idx];
  if (removed && buildStopKey(removed) === anchorStopKey.value) {
    anchorClientId.value = "";
    anchorSucursal.value = "";
    anchorStopKey.value = "";
    anchorReason.value = "priority";
  }
  paradas.value.splice(idx, 1);
  if (removed?.__stopKey === editingClientStopKey.value) cancelClientIdEdit();
}

function startClientIdEdit(stop) {
  editingClientStopKey.value = stop.__stopKey;
  editingClientId.value = String(stop.parada || '');
  clientEditBranches.value = [];
  clientEditError.value = '';
}

function cancelClientIdEdit() {
  editingClientStopKey.value = '';
  editingClientId.value = '';
  clientEditBranches.value = [];
  clientEditError.value = '';
}

function applyClientIdEdit(stop, client) {
  const wasAnchor = anchorStopKey.value === buildStopKey(stop);
  stop.parada = String(client.id || editingClientId.value).trim();
  stop.name = client.sucursal ? `${client.nombre} — ${client.sucursal}` : client.nombre;
  stop.sucursal = client.sucursal || '';
  stop.location = client.location || null;
  if (wasAnchor) {
    anchorClientId.value = stop.parada;
    anchorSucursal.value = stop.sucursal;
    anchorStopKey.value = buildStopKey(stop);
  }
  feedback.value = `RIF del pedido ${stop.orderNumber} actualizado a ${stop.parada}.`;
  cancelClientIdEdit();
}

async function saveClientIdEdit(stop, branch = null) {
  if (loading.value || editingClientStopKey.value !== stop.__stopKey) return;
  const clientId = editingClientId.value.trim();
  if (!clientId) { clientEditError.value = 'Ingresa un RIF o ID.'; return; }
  clientEditError.value = '';
  addStopStatus.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${encodeURIComponent(clientId)}`);
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || `El cliente ${clientId} no esta registrado.`);
    if (branch) {
      const selectedBranch = result?.sedes?.find(item => (item.sucursal || '') === (branch.sucursal || ''));
      if (!selectedBranch) throw new Error('La sede seleccionada ya no esta disponible.');
      applyClientIdEdit(stop, selectedBranch);
    } else if (result.esCadena && Array.isArray(result.sedes) && result.sedes.length > 1) {
      clientEditBranches.value = result.sedes;
      clientEditError.value = 'Selecciona la sede que corresponde a este pedido.';
      return;
    } else applyClientIdEdit(stop, result);
  } catch (failure) { clientEditError.value = failure.message; }
}

async function copyText(text, successMessage) {
  if (!text) {
    return;
  }

  shareFeedback.value = "";

  try {
    await navigator.clipboard.writeText(text);
    shareFeedback.value = successMessage;
  } catch (_error) {
    errorMessage.value = "No se pudo copiar automaticamente. Puedes copiar el texto manualmente desde el panel.";
  }
}

function buildNearbyGroupCopyText(group) {
  const header = `Grupo ${group.priorityRank} (${group.clients.length} clientes, radio max ${group.maxInternalDistanceKm.toFixed(2)} km)`;
  const center = `Centro aprox: ${group.centerLatitude.toFixed(4)}, ${group.centerLongitude.toFixed(4)}`;
  const clients = group.clients.map((client) => `- ${client.nombre}${client.id ? ` [${client.id}]` : ""}`);

  return [header, center, ...clients].join("\n");
}

async function copyNearbyGroup(group) {
  const payload = buildNearbyGroupCopyText(group);

  insightsFeedback.value = "";

  try {
    await navigator.clipboard.writeText(payload);
    insightsFeedback.value = `Grupo ${group.priorityRank} copiado.`;
  } catch (_error) {
    errorMessage.value = "No se pudo copiar el grupo automaticamente. Intenta de nuevo.";
  }
}

async function makeRoute() {
  if (priorityPreviewLoading.value) return;
  if (!paradas.value.length) {
    errorMessage.value = "Agrega al menos un cliente antes de generar la ruta.";
    return;
  }

  if (!driverId.value.trim()) {
    errorMessage.value = "Ingresa el ID del chofer para guardar la ruta y sus pedidos.";
    return;
  }
  const incompleteOrder = paradas.value.find((stop) => !String(stop.orderNumber || '').trim()
    || !companyCatalog.value.some(company => company._id === stop.companyId)
    || !stop.orderDate
    || stop.orderTotal == null || stop.orderTotal === ''
    || !Number.isFinite(Number(stop.orderTotal)) || Number(stop.orderTotal) < 0);
  if (incompleteOrder) {
    errorMessage.value = `Completa la empresa, numero de documento, fecha y monto del pedido para ${incompleteOrder.parada}.`;
    return;
  }

  if (includeTransport.value && !transportEditor.value?.validate()) {
    errorMessage.value = "Completa los datos de transporte antes de crear la ruta.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";
  shareFeedback.value = "";

  try {
    const requestedStops = paradas.value
      .map((stop) => {
        const clientId = String(stop?.id || stop?.parada || "").trim();

        if (!clientId) {
          return null;
        }

        return {
          clientId,
          ...(stop?.sucursal ? { sucursal: String(stop.sucursal).trim() } : {}),
        };
      })
      .filter(Boolean);
    const requestedByKey = new Map(requestedStops.map(stop => [buildStopKey(stop), stop]));
    const selectedStops = [];
    for (const stop of editableRoute.value) {
      const key = buildStopKey(stop);
      if (requestedByKey.has(key)) { selectedStops.push(requestedByKey.get(key)); requestedByKey.delete(key); }
    }
    selectedStops.push(...requestedByKey.values());

    const updating = Boolean(editingGuideId.value);
    const endpoint = updating ? `/driver-routes/${editingGuideId.value}/guide` : '/makeRoute';
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: updating ? 'PATCH' : 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(updating ? { updatedAt: guideUpdatedAt.value } : {}),
        driverId: driverId.value.trim(),
        driverName: driverName.value.trim(),
        routeComment: routeComment.value.trim(),
        routeType: selectedRouteType.value,
        routeWeight: totalWeight.value,
        loadGuide: {
          orders: paradas.value.map((stop) => ({
            companyId: stop.companyId,
            clientId: String(stop.parada).trim(),
            sucursal: String(stop.sucursal || '').trim(),
            orderNumber: String(stop.orderNumber).trim(),
            date: stop.orderDate,
            total: Number(stop.orderTotal),
          })),
        },
        anchorClientId: anchorClientId.value.trim() || undefined,
        anchorSucursal: anchorSucursal.value.trim() || undefined,
        anchorStopKey: anchorStopKey.value.trim() || undefined,
        anchorReason: anchorClientId.value.trim() ? anchorReason.value : undefined,
        preserveRouteOrder: editableRoute.value.length > 0 && !anchorStopKey.value,
        stops: selectedStops,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      if (updating && (response.status === 404 || response.status === 405)) {
        errorMessage.value = 'El servidor conectado no encuentra la funcion para actualizar guias. Publica el backend actualizado en Render y vuelve a intentarlo.';
      } else if (response.status === 401) {
        errorMessage.value = 'Tu sesion de administrador vencio. Inicia sesion nuevamente antes de actualizar la guia.';
      } else if (response.status === 403) {
        errorMessage.value = 'Tu usuario no tiene permisos de administrador para actualizar esta guia.';
      } else if (response.status === 409) {
        errorMessage.value = result?.message || 'La guia cambio o fue terminada. Recargala antes de editar.';
      } else {
        errorMessage.value = result?.message || `No se pudo guardar la guia (HTTP ${response.status}).`;
      }
      return;
    }

    serverResponse.value = result;
    if (result?.savedRoute?.routeId) {
      editingGuideId.value = String(result.savedRoute.routeId);
      guideUpdatedAt.value = result.savedRoute.updatedAt;
      await router.replace({ path: '/routes', query: { guideId: editingGuideId.value } });
    }
    selectedRouteType.value = result?.routeType || selectedRouteType.value;
    feedback.value = result?.savedRoute?.routeId
      ? `Guia ${result.savedRoute.loadGuide?.number || result.savedRoute.routeId} ${updating ? 'actualizada' : 'creada'} para el chofer ${result.savedRoute.driverId}.`
      : "Rutas calculadas correctamente. Selecciona un tipo y agrega un ID de chofer para dejar la opcion guardada.";

    if (includeTransport.value && result?.savedRoute?.routeId) {
      const saved = await transportEditor.value.saveForRoute(String(result.savedRoute.routeId));
      if (!saved) feedback.value += " La ruta quedo guardada; revisa el formulario de transporte para guardar el viaje.";
      transportRouteId.value = String(result.savedRoute.routeId);
    }

  } catch (error) {
    errorMessage.value = `Error en la solicitud: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function loadGuide(id) {
  loading.value = true; errorMessage.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/by-id/${encodeURIComponent(id)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo cargar la guia.');
    const saved = result.route;
    if (!saved.loadGuide?.orders?.length) throw new Error('La ruta no tiene pedidos de una guia guardada.');
    editingGuideId.value = String(saved._id); guideUpdatedAt.value = saved.updatedAt;
    driverId.value = saved.driverId; driverName.value = saved.driverName || '';
    routeComment.value = saved.routeComment || ''; routeWeight.value = saved.totalWeight || 0;
    selectedRouteType.value = saved.routeType || 'closest';
    anchorClientId.value = saved.anchorClientId || '';
    anchorSucursal.value = saved.anchorSucursal || '';
    anchorStopKey.value = saved.anchorStopKey || (anchorClientId.value ? buildStopKey({ clientId: anchorClientId.value, sucursal: anchorSucursal.value }) : '');
    anchorReason.value = saved.anchorReason || 'priority';
    paradas.value = saved.loadGuide.orders.map((order, index) => {
      const matches = (saved.stops || []).filter(stop => stop.clientId === order.clientId);
      const stop = matches.find(item => (item.sucursal || '') === (order.sucursal || '')) || (matches.length === 1 ? matches[0] : null);
      return { parada: order.clientId, sucursal: order.sucursal || '', name: order.clientName || stop?.nombre || order.clientId,
        location: stop?.location || null, companyId: order.companyId || '', orderNumber: order.orderNumber,
        orderDate: order.date || '', orderTotal: order.total, __stopKey: `loaded-${index}` };
    });
    const stops = (saved.stops || []).map(stop => {
      const branches = [...new Set(saved.loadGuide.orders.filter(order => order.clientId === stop.clientId).map(order => order.sucursal || ''))];
      return { ...stop, id: stop.clientId, sucursal: stop.sucursal || (branches.length === 1 ? branches[0] : '') };
    });
    const option = { type: saved.routeType || 'closest', label: saved.routeTypeLabel || 'Ruta guardada', route: stops,
      estimatedDistanceKm: saved.totalDistanceKm, googleMapsRouteLinks: saved.googleMapsRouteLinks, openRouteLink: saved.openRouteLink };
    serverResponse.value = { ...saved, route: stops, routeOptions: [option], savedRoute: { ...saved, routeId: saved._id } };
    feedback.value = `Editando guia ${saved.loadGuide.number || saved.routeLabel}.`;
    transportRouteId.value = includeTransport.value ? String(saved._id) : '';
  } catch (failure) { errorMessage.value = failure.message; }
  finally { loading.value = false; }
}
function newGuide() {
  if ((editingGuideId.value || paradas.value.length) && !window.confirm('Crear una nueva guia? Los cambios sin guardar de esta pantalla se descartaran.')) return;
  editingGuideId.value = ''; guideUpdatedAt.value = null; serverResponse.value = null;
  priorityPreviewSequence += 1; priorityPreviewLoading.value = false;
  paradas.value = []; editableRoute.value = []; routeTable.value = [];
  transportRouteId.value = ''; includeTransport.value = false;
  driverId.value = ''; driverName.value = ''; routeComment.value = ''; routeWeight.value = 0;
  paradaInput.value = ''; orderNumberInput.value = ''; orderDateInput.value = getTodayOrderDate(); orderTotalInput.value = null;
  anchorClientId.value = ''; anchorSucursal.value = ''; anchorStopKey.value = '';
  sedePickerVisible.value = false; feedback.value = ''; errorMessage.value = ''; addStopStatus.value = '';
  router.replace({ path: '/routes', query: {} });
}
onMounted(() => { if (pageRoute.query.guideId) loadGuide(String(pageRoute.query.guideId)); });
watch(() => pageRoute.query.guideId, id => { if (id && String(id) !== editingGuideId.value) loadGuide(String(id)); });
</script>

<template>
  <section class="routes-page">
    <div class="routes-shell">
      <div class="routes-hero">
        <div>
          <p class="routes-kicker">Planeacion de ruta</p>
          <h1>Paradas del chofer</h1>
          <p class="routes-copy">Agrega clientes con su peso, asigna la ruta a un chofer y guarda el resultado para que luego pueda consultarlo por su ID.</p>
        </div>
      </div>

      <div class="routes-card routes-controls">
        <div class="input-grid input-grid-meta">
          <div class="field-group">
            <label for="driverId">ID del chofer</label>
            <input id="driverId" v-model="driverId" type="text" placeholder="Ej. CH-12" />
          </div>
          <div class="field-group">
            <label for="driverName">Nombre del chofer</label>
            <input id="driverName" v-model="driverName" type="text" placeholder="Opcional" />
          </div>
          <div class="field-group field-group-wide">
            <label for="routeComment">Comentario de la ruta</label>
            <textarea
              id="routeComment"
              v-model="routeComment"
              rows="3"
              placeholder="Agrega una observacion, instruccion o nota para esta ruta"
            />
          </div>
          <div class="field-group field-group-wide">
            <label>Folio de la ruta</label>
            <div class="generated-route-reference">
              {{ currentRouteReference }}
            </div>
          </div>
          <div class="field-group">
            <label for="routeType">Tipo de ruta a guardar</label>
            <select id="routeType" v-model="selectedRouteType">
              <option v-for="option in routeTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="field-group">
            <label for="routeWeight">Peso total de la ruta</label>
            <input id="routeWeight" v-model="routeWeight" type="number" min="0" step="0.01" placeholder="Ej. 1250" />
          </div>
        </div>

        <DispatchCompanyPicker v-model="companyIdInput" :disabled="addingStop || sedePickerVisible || loading" @catalog-updated="updateCompanyCatalog" />
        <div class="input-row client-order-row">
          <div class="field-group route-entry-field">
            <label for="clientIdInput">RIF / ID del cliente</label>
            <el-input
              id="clientIdInput"
              ref="paradaInputRef"
              v-model="paradaInput"
              placeholder="RIF / ID del cliente"
              class="route-input"
              :disabled="addingStop || sedePickerVisible"
              @keyup.enter="agregarParada"
            />
          </div>
          <div class="field-group route-entry-field">
            <label for="orderNumberInput">Numero de pedido</label>
            <el-input
              id="orderNumberInput"
              v-model="orderNumberInput"
              placeholder="Numero de pedido"
              class="route-input"
              :disabled="addingStop || sedePickerVisible"
              @keyup.enter="agregarParada"
            />
          </div>
          <div class="field-group route-entry-field">
            <label for="orderDateInput">Fecha del pedido</label>
            <el-input
              id="orderDateInput"
              v-model="orderDateInput"
              type="date"
              class="route-input"
              :disabled="addingStop || sedePickerVisible"
              @keyup.enter="agregarParada"
            />
          </div>
          <div class="field-group route-entry-field">
            <label for="orderTotalInput">Monto del pedido ($)</label>
            <el-input-number
              id="orderTotalInput"
              v-model="orderTotalInput"
              :min="0"
              :precision="2"
              :step="0.01"
              :controls="false"
              placeholder="Monto del pedido ($)"
              class="route-input"
              :disabled="addingStop || sedePickerVisible"
              @keyup.enter="agregarParada"
            />
          </div>
          <el-button type="primary" class="route-action-button" :loading="addingStop" :disabled="sedePickerVisible" @click="agregarParada">
            {{ addingStop ? "Agregando..." : "Agregar" }}
          </el-button>
        </div>
        <p v-if="addStopStatus" class="add-stop-status" :class="`add-stop-status-${addStopStatusType}`">{{ addStopStatus }}</p>

        <div class="summary-strip">
          <span><strong>Clientes unicos:</strong> {{ uniqueClientCount }}</span>
          <span><strong>Peso total:</strong> {{ totalWeight }}</span>
          <span><strong>Repetidos detectados:</strong> {{ duplicateClientIds.length }}</span>
          <span v-if="anchorClientId" class="anchor-summary">
            Ancla: <strong>{{ anchorClientId }}</strong>
          </span>
        </div>
        <div v-if="anchorClientId" class="anchor-info-banner">
          El cliente <strong>{{ anchorClientId }}</strong>{{ anchorSucursal ? ` · ${anchorSucursal}` : "" }} sera la primera parada fija. Motivo: <strong>{{ anchorReasonLabel }}</strong>.
          La ruta optima se construye desde ahi y el espejo tambien lo respeta.
        </div>
        <div v-if="anchorClientId" class="anchor-controls-row">
          <label for="anchorReason" class="anchor-controls-label">Motivo de la estrella</label>
          <select id="anchorReason" v-model="anchorReason" class="anchor-reason-select">
            <option v-for="option in anchorReasonOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div v-if="duplicateClientIds.length" class="warning-inline">
          Varios pedidos para la misma sede: {{ duplicateClientIds.join(", ") }}. Se guardan todos los pedidos y se consolida una parada por sede.
        </div>
      </div>

      <section class="route-transport-section">
        <div class="summary-strip">
          <label><input v-model="includeTransport" type="checkbox" :disabled="loading" /> Datos de transporte del viaje</label>
          <router-link to="/transport-kpis">KPIs de transporte</router-link>
        </div>
        <TransportTripEditor v-if="includeTransport" ref="transportEditor" planning-mode :loaded-amount="totalOrderAmount" :loaded-kg="totalWeight" :planned-stops="plannedTransportStops" :route-id="transportRouteId" />
      </section>

      <div class="routes-card">
        <p class="table-scroll-hint">La lista mantiene scroll vertical cuando agregas muchos clientes.</p>
        <div class="table-wrapper">
          <el-table
            ref="paradasTableRef"
            :data="paradas"
            class="responsive-table"
            :max-height="380"
            :row-class-name="(rowContext) => resolveParadaRowClass(rowContext.row)"
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column label="Ancla" width="90">
              <template #default="scope">
                <button
                  class="anchor-btn"
                  :class="{ 'anchor-btn-active': buildStopKey(scope.row) === anchorStopKey }"
                  type="button"
                  :disabled="loading || addingStop || sedePickerVisible"
                  :title="buildStopKey(scope.row) === anchorStopKey ? 'Quitar ancla' : 'Marcar como cliente ancla (primera parada fija)'"
                  @click="toggleAnchor(scope.row)"
                >
                  {{ buildStopKey(scope.row) === anchorStopKey ? '⭐' : '☆' }}
                </button>
              </template>
            </el-table-column>
            <el-table-column label="RIF / ID" min-width="185">
              <template #default="scope">
                <div v-if="editingClientStopKey === scope.row.__stopKey" class="client-id-editor">
                  <el-input v-model="editingClientId" :disabled="loading" aria-label="Editar RIF o ID" placeholder="RIF / ID registrado" @input="clientEditBranches = []; clientEditError = ''" @keyup.enter="saveClientIdEdit(scope.row)" />
                  <div class="client-id-actions">
                    <el-button type="success" circle title="Validar y guardar RIF" aria-label="Validar y guardar RIF" :disabled="loading" @click="saveClientIdEdit(scope.row)"><i class="mdi mdi-check" aria-hidden="true" /></el-button>
                    <el-button circle title="Cancelar edicion del RIF" aria-label="Cancelar edicion del RIF" :disabled="loading" @click="cancelClientIdEdit"><i class="mdi mdi-close" aria-hidden="true" /></el-button>
                  </div>
                  <div v-if="clientEditBranches.length" class="client-id-branch-options">
                    <button v-for="branch in clientEditBranches" :key="branch.sucursal || branch._id" type="button" :disabled="loading" @click="saveClientIdEdit(scope.row, branch)">{{ branch.sucursal || 'Sede principal' }}</button>
                  </div>
                  <small v-if="clientEditError" class="client-id-edit-error" role="alert">{{ clientEditError }}</small>
                </div>
                <div v-else class="client-id-display">
                  <span>{{ scope.row.parada }}</span>
                  <button type="button" class="client-id-pencil" title="Editar RIF o ID de este pedido" :aria-label="`Editar RIF o ID del pedido ${scope.row.orderNumber}`" :disabled="loading" @click="startClientIdEdit(scope.row)"><i class="mdi mdi-pencil-outline" aria-hidden="true" /></button>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="Nombre" width="150" />
            <el-table-column label="Empresa del pedido" min-width="220">
              <template #default="scope">
                <el-select v-model="scope.row.companyId" placeholder="Empresa" :aria-label="`Empresa del pedido ${scope.row.orderNumber || scope.row.parada}`" :disabled="loading">
                  <el-option v-for="company in companyCatalog" :key="company._id" :label="company.name" :value="company._id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="Numero de documento" min-width="190">
              <template #default="scope">
                <el-input v-model="scope.row.orderNumber" placeholder="Numero de documento" :aria-label="`Numero de documento de ${scope.row.parada}`" :disabled="loading" />
              </template>
            </el-table-column>
            <el-table-column label="Fecha del pedido" min-width="170">
              <template #default="scope">
                <el-input v-model="scope.row.orderDate" type="date" :aria-label="`Fecha del pedido de ${scope.row.parada}`" :disabled="loading" />
              </template>
            </el-table-column>
            <el-table-column label="Monto del pedido ($)" min-width="190">
              <template #default="scope">
                <el-input-number v-model="scope.row.orderTotal" :min="0" :precision="2" :step="0.01" :controls="false" placeholder="Monto del pedido" :aria-label="`Monto del pedido de ${scope.row.parada}`" :disabled="loading" />
              </template>
            </el-table-column>
            <el-table-column label="Acciones" width="180">
              <template #default="scope">
                <el-button
                  type="danger"
                  size="small"
                  @click="eliminarParada(scope.$index)"
                >Eliminar pedido</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="summary-strip">
          <span><strong>Pedidos:</strong> {{ paradas.length }}</span>
          <span><strong>Total de los pedidos:</strong> $ {{ formatAmount(totalOrderAmount) }}</span>
        </div>
        <el-button type="success" class="route-submit-button" :loading="loading || priorityPreviewLoading" @click="makeRoute"
          >{{ editingGuideId ? 'Actualizar guia' : 'Crear y guardar ruta' }}</el-button
        >
        <el-button type="primary" :disabled="loading" @click="newGuide"><i class="mdi mdi-plus" aria-hidden="true" /> Nueva guia</el-button>
        <el-button v-if="serverResponse?.savedRoute?.loadGuide" type="primary" :disabled="loading" @click="downloadLoadGuide(serverResponse.savedRoute.loadGuide, serverResponse.savedRoute)"><i class="mdi mdi-file-download-outline" aria-hidden="true" /> Descargar guia PDF</el-button>
      </div>

      <div v-if="sedePickerVisible" class="routes-card sede-picker-card">
        <div class="sede-picker-header">
          <div>
            <strong>Cliente cadena: {{ sedePendingNombre }}</strong>
            <p class="share-copy">Este cliente tiene {{ sedeOpciones.length }} sedes. Selecciona la que vas a visitar.</p>
          </div>
          <button class="copy-button" type="button" @click="sedePickerVisible = false">Cancelar</button>
        </div>
        <div class="sede-option-grid">
          <button
            v-for="sede in sedeOpciones"
            :key="sede.sucursal || sede._id"
            type="button"
            class="sede-option-btn"
            @click="agregarSede(sede)"
          >
            <strong>{{ sede.sucursal || 'Sede principal' }}</strong>
            <span>{{ sede.location?.latitude }}, {{ sede.location?.longitude }}</span>
            <small>{{ sede.googleMapsLink ? 'Ver en mapa →' : '' }}</small>
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="routes-card error-card">
        <pre>{{ errorMessage }}</pre>
      </div>

      <div v-if="feedback" class="routes-card success-card">
        <pre>{{ feedback }}</pre>
      </div>

      <div v-if="serverResponse" class="routes-results">
        <div class="routes-card summary-card">
          <div class="summary-strip summary-strip-results">
            <span><strong>Folio:</strong> {{ currentRouteReference }}</span>
            <span><strong>Clientes unicos:</strong> {{ serverResponse.uniqueClientCount }}</span>
            <span><strong>Peso total:</strong> {{ serverResponse.totalWeight }}</span>
            <span v-if="serverResponse.savedRoute?.loadGuide"><strong>Total de los pedidos:</strong> $ {{ formatAmount(serverResponse.savedRoute.loadGuide.totalAmount) }}</span>
            <span><strong>Chofer:</strong> {{ serverResponse.savedRoute?.driverId || 'Sin asignar' }}</span>
            <span><strong>Opcion activa:</strong> {{ activeRouteOption?.label || serverResponse.routeTypeLabel }}</span>
          </div>
          <button v-if="activeRouteOption?.route?.length" class="route-map-shortcut" type="button" @click="focusDispatchRouteMap"><i class="mdi mdi-map-marker-path" aria-hidden="true" /> Ver ruta de despacho</button>
          <div v-if="serverResponse.duplicateClientIds?.length" class="warning-inline">
            IDs consolidados por repeticion: {{ serverResponse.duplicateClientIds.join(", ") }}
          </div>
        </div>

        <div v-if="routeOptions.length > 1" class="routes-card route-options-card">
          <div class="driver-table-header">
            <div>
              <strong>Opciones de ruta</strong>
              <p class="share-copy">Selecciona el tipo que quieres revisar en el frontend.</p>
            </div>
          </div>

          <div class="route-option-grid">
            <button
              v-for="option in routeOptions"
              :key="option.type"
              type="button"
              class="route-option-button"
              :class="{ 'route-option-button-active': selectedRouteType === option.type }"
              @click="selectedRouteType = option.type"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
              <small v-if="option.estimatedDistanceKm !== null">{{ option.estimatedDistanceKm }} km aprox.</small>
            </button>
          </div>
        </div>

        <div
          v-if="serverResponse.savedRoute || activeRouteOption?.openRouteLink || activeRouteOption?.googleMapsRouteLinks?.length"
          class="routes-result-grid"
        >
          <div class="routes-card share-card">
            <div class="driver-table-header">
              <div>
                <strong>Datos para enviar al chofer</strong>
                <p class="share-copy">Copia el nombre del cliente con su link desde aqui, sin usar la consola.</p>
              </div>
              <button class="copy-button" type="button" @click="copyText(shareMessage, 'Mensaje copiado para compartir con el chofer.')">
                Copiar mensaje completo
              </button>
            </div>

            <div class="reorder-mode-switch" role="group" aria-label="Metodo para ordenar clientes">
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

            <div class="distance-summary-grid">
              <article class="distance-summary-item">
                <span>Km ruta original</span>
                <strong>{{ formatKm(originalRouteDistanceKm) }}</strong>
              </article>
              <article class="distance-summary-item">
                <span>Km ruta modificada</span>
                <strong>{{ formatKm(modifiedRouteDistanceKm) }}</strong>
              </article>
              <article class="distance-summary-item">
                <span>Diferencia</span>
                <strong :class="routeDistanceDeltaKm > 0 ? 'distance-up' : (routeDistanceDeltaKm < 0 ? 'distance-down' : '')">
                  {{ routeDistanceDeltaKm == null ? 'Sin dato' : `${routeDistanceDeltaKm > 0 ? '+' : ''}${routeDistanceDeltaKm.toFixed(2)} km` }}
                </strong>
              </article>
            </div>

            <div class="share-fields">
              <div v-if="clientLinkEntries.length" class="share-list">
                <p class="reorder-hint">Arrastra para cambiar el orden antes de copiar.</p>
                <article
                  v-for="(entry, idx) in clientLinkEntries"
                  :key="entry.stopKey"
                  class="share-list-item"
                  :class="{ 'share-item-dragging': draggedIndex === idx }"
                  :draggable="reorderMode === 'drag'"
                  @dragstart="onDragStart($event, idx)"
                  @dragover.prevent="reorderMode === 'drag'"
                  @drop="onDrop($event, idx)"
                  @dragend="onDragEnd"
                >
                  <template v-if="reorderMode === 'drag'">
                    <span class="drag-handle" title="Arrastra para reordenar">⠿</span>
                  </template>
                  <template v-else-if="reorderMode === 'arrows'">
                    <div class="reorder-buttons-group">
                      <button class="reorder-step-btn" type="button" :disabled="idx === 0" @click="moveStopToTop(idx)">1°</button>
                      <button class="reorder-step-btn" type="button" :disabled="idx === 0" @click="moveStopUp(idx)">↑</button>
                      <button class="reorder-step-btn" type="button" :disabled="idx === editableRoute.length - 1" @click="moveStopDown(idx)">↓</button>
                    </div>
                  </template>
                  <template v-else>
                    <label class="reorder-position-input" :for="`pos-${encodeURIComponent(entry.stopKey)}`">
                      <span>#</span>
                      <input
                        :id="`pos-${encodeURIComponent(entry.stopKey)}`"
                        type="number"
                        min="1"
                        :max="editableRoute.length"
                        :value="idx + 1"
                        @change="moveStopToPosition(idx, $event.target.value)"
                        @keyup.enter="moveStopToPosition(idx, $event.target.value)"
                      />
                    </label>
                  </template>
                  <div class="entry-info">
                    <strong>{{ entry.nombre }}</strong>
                    <p>{{ entry.link }}</p>
                  </div>
                  <button class="copy-button copy-button-inline" type="button" @click="copyText(entry.text, `${entry.nombre} copiado.`)">
                    Copiar
                  </button>
                </article>
              </div>

              <label v-if="driverRouteLink" class="field-group field-group-full">
                <span>Link directo de Mi ruta</span>
                <div class="copy-row copy-row-stacked">
                  <textarea :value="driverRouteLink" rows="2" readonly />
                  <button class="copy-button copy-button-inline" type="button" @click="copyText(driverRouteLink, 'Link de Mi ruta copiado.')">
                    Copiar link
                  </button>
                </div>
              </label>

              <label class="field-group field-group-full">
                <span>Mensaje listo para compartir</span>
                <textarea :value="shareMessage" rows="6" readonly />
              </label>
            </div>

            <p v-if="shareFeedback" class="share-feedback">{{ shareFeedback }}</p>
          </div>

          <div v-if="activeRouteMapStops.length" ref="dispatchRouteMapRef" class="routes-card map-card">
            <RouteOsmMap
              title="Mapa OSM de la ruta"
              description="Las paradas se muestran numeradas sobre OpenStreetMap para revisarlas mejor también en teléfono."
              :stops="activeRouteMapStops"
              :origin="activeRouteOrigin"
              canvasMinHeight="clamp(620px, 78vh, 1040px)"
            />
          </div>
        </div>

        <div class="routes-card">
          <strong>Resumen de la ruta:</strong>
          <div class="table-wrapper">
            <el-table
              :data="editableRoute"
              class="responsive-table result-table"
            >
        <el-table-column prop="id" label="ID" width="150" />
        <el-table-column prop="nombre" label="Nombre" />
        <el-table-column label="Latitud">
          <template #default="scope">
            {{ scope.row.location.latitude }}
          </template>
        </el-table-column>
        <el-table-column label="Longitud">
          <template #default="scope">
            {{ scope.row.location.longitude }}
          </template>
        </el-table-column>
        <el-table-column label="Google Maps">
          <template #default="scope">
            <a
              :href="scope.row.googleMapsLink"
              target="_blank"
              style="color: #646cff"
              >Ver ubicación</a
            >
          </template>
        </el-table-column>
            </el-table>
          </div>
        </div>

        <div
          v-if="serverResponse.notFoundClients && serverResponse.notFoundClients.length"
          class="routes-card"
        >
          <strong>Clientes no encontrados:</strong>
          <div class="table-wrapper">
            <el-table
              :data="serverResponse.notFoundClients"
              class="responsive-table"
            >
          <el-table-column prop="clientId" label="ID no encontrado" />
            </el-table>
          </div>
        </div>

        <div
          v-if="
            serverResponse.googleMapsRouteLinks &&
            serverResponse.googleMapsRouteLinks.length
          "
          class="routes-card"
        >
          <strong>Ruta en Google Maps:</strong>
          <div class="table-wrapper">
            <el-table
              :data="serverResponse.googleMapsRouteLinks.map((link) => ({ link }))"
              class="responsive-table"
            >
          <el-table-column label="Ruta">
            <template #default="scope">
              <a :href="scope.row.link" target="_blank" style="color: #16a34a"
                >Ver ruta</a
              >
            </template>
          </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-if="activeRouteOption?.openRouteLink" class="routes-card link-card">
          <strong>Ruta en OpenRouteService:</strong>
          <a
            :href="activeRouteOption.openRouteLink"
            target="_blank"
            class="ors-link"
            >Ver en OpenRouteService</a
          >
        </div>

        <div v-if="serverResponse.error" class="routes-card error-card">
          <h3>Error:</h3>
          <pre>{{ serverResponse.error }}</pre>
        </div>

        <div class="routes-card insights-card">
          <div class="driver-table-header">
            <div>
              <strong>Informacion relevante para el chofer</strong>
              <p class="share-copy">Resumen de zonas con clientes cercanos y clientes con pedidos repetidos en esta carga.</p>
            </div>
          </div>

          <p class="route-recommendation">Sugerencia de ejecucion: {{ routeRecommendationText }}</p>

          <p
            v-if="anchorStartStatus"
            class="anchor-status-banner"
            :class="anchorStartStatus.applied ? 'anchor-status-ok' : 'anchor-status-warning'"
          >
            {{ anchorStartStatus.message }}
          </p>

          <div class="insights-grid">
            <article class="insight-panel">
              <h3>Zonas con varios clientes</h3>
              <p class="insight-copy">Clientes agrupados por cercania real (menos de 1 km entre si) para facilitar entregas consecutivas.</p>

              <ul v-if="nearbyClientGroups.length" class="insight-list">
                <li
                  v-for="group in nearbyClientGroups"
                  :key="group.groupKey"
                  class="insight-item"
                  :class="`insight-density-${group.densityLevel}`"
                >
                  <div class="insight-item-head">
                    <strong>Grupo {{ group.priorityRank }} · {{ group.clients.length }} clientes</strong>
                    <span>Centro {{ group.centerLatitude.toFixed(4) }}, {{ group.centerLongitude.toFixed(4) }}</span>
                  </div>
                  <div class="insight-tags-row">
                    <span class="insight-density-tag" :class="`insight-density-tag-${group.densityLevel}`">
                      Densidad {{ group.densityLabel }}
                    </span>
                    <span class="insight-distance-tag">Distancia interna max: {{ group.maxInternalDistanceKm.toFixed(2) }} km</span>
                  </div>
                  <p>{{ group.clients.map((client) => client.nombre).join(" | ") }}</p>
                  <button class="copy-button copy-button-inline insight-copy-btn" type="button" @click="copyNearbyGroup(group)">
                    Copiar grupo
                  </button>
                </li>
              </ul>

              <p v-else class="insight-empty">No hay grupos de dos o mas clientes a menos de 1 km entre si en la ruta activa.</p>
            </article>

            <article class="insight-panel">
              <h3>Clientes con dos o mas pedidos</h3>
              <p class="insight-copy">Clientes repetidos en la carga actual para validar consolidacion antes de salir.</p>

              <ul v-if="repeatedOrderClients.length" class="insight-list">
                <li v-for="client in repeatedOrderClients" :key="client.clientId" class="insight-item">
                  <div class="insight-item-head">
                    <strong>{{ client.clientId }}</strong>
                    <span>{{ client.orderCount }} pedidos</span>
                  </div>
                  <p>{{ client.nombre }}</p>
                </li>
              </ul>

              <p v-else class="insight-empty">No hay clientes repetidos en la carga actual.</p>
            </article>
          </div>

          <p v-if="insightsFeedback" class="insights-feedback">{{ insightsFeedback }}</p>
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
.anchor-controls-row {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
}
.anchor-controls-label {
  color: rgba(243, 246, 251, 0.82);
  font-size: 0.9rem;
}
.anchor-reason-select {
  min-height: 40px;
  min-width: 220px;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.28);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
}
}

.routes-controls {
  margin-top: 0;
.route-recommendation {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: rgba(243, 246, 251, 0.94);
  font-size: 0.92rem;
}
.anchor-status-banner {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  font-size: 0.9rem;
}
.anchor-status-ok {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.36);
  color: #bbf7d0;
}
.anchor-status-warning {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.38);
  color: #fde68a;
}
}

.routes-card {
  overflow: hidden;
}

.route-transport-section { padding: 18px 0; }
.route-transport-section label { display: inline-flex; gap: 8px; align-items: center; }
.route-transport-section a { color: #9fd1ff; }
.route-map-shortcut { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; margin-top: 12px; padding: 8px 12px; border: 1px solid #699ca6; border-radius: 4px; background: #1e6776; color: #fff; cursor: pointer; }

.input-row {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-top: 1rem;
}

.client-order-row {
  flex-wrap: wrap;
  align-items: flex-end;
}

.route-entry-field {
  flex: 1 1 200px;
  min-width: 0;
  width: 100%;
}

.route-entry-field :deep(.el-input-number) {
  width: 100%;
  height: auto;
}

.client-id-display,
.client-id-editor,
.client-id-actions,
.client-id-branch-options {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.client-id-display > span { overflow-wrap: anywhere; }
.client-id-pencil,
.client-id-actions :deep(.el-button) { flex: 0 0 34px; width: 34px; height: 34px; min-height: 34px; padding: 0; }
.client-id-branch-options button { min-height: 34px; padding: 6px 9px; border: 1px solid #72949e; border-radius: 4px; background: #eef5f7; color: #1c414c; cursor: pointer; }
.client-id-edit-error { flex: 1 0 100%; color: #ffb7bd; white-space: normal; }
.client-id-actions { flex-wrap: nowrap; }
.responsive-table :deep(.el-table__cell) { overflow-wrap: anywhere; }

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
.field-group select,
.field-group textarea,
.route-input {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.field-group textarea {
  resize: vertical;
  min-height: 96px;
}

.generated-route-reference {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px dashed rgba(159, 209, 255, 0.28);
  background: rgba(159, 209, 255, 0.08);
  color: #f3f6fb;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.route-input {
  flex: 1 1 auto;
}

.route-action-button,
.route-submit-button {
  min-height: 46px;
}

.route-submit-button {
  margin-top: 1rem;
}

.routes-results {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.routes-result-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(460px, 1.35fr);
  gap: 1rem;
  align-items: start;
  margin-top: 1rem;
}

.routes-result-grid .share-card,
.routes-result-grid .map-card {
  margin-top: 0;
}

.routes-result-grid .map-card {
  min-height: 100%;
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

.table-scroll-hint {
  margin: 0;
  color: rgba(243, 246, 251, 0.68);
  font-size: 0.9rem;
}

.add-stop-status {
  margin: 0.6rem 0 0;
  font-size: 0.88rem;
  font-weight: 600;
}

.add-stop-status-info {
  color: #9fd1ff;
}

.add-stop-status-success {
  color: #8df0b4;
}

.add-stop-status-warning {
  color: #f8ca5b;
}

.share-card {
  display: grid;
  gap: 1rem;
}

.share-copy {
  margin: 0.35rem 0 0;
  color: rgba(243, 246, 251, 0.72);
}

.reorder-mode-switch {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1rem;
  padding: 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.16);
}

.reorder-mode-btn {
  min-height: 36px;
  padding: 0.45rem 0.8rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(243, 246, 251, 0.82);
  font-weight: 700;
  cursor: pointer;
}

.reorder-mode-btn-active {
  background: linear-gradient(135deg, #45a7ff 0%, #1dd3b0 100%);
  color: #08111f;
}

.distance-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.distance-summary-item {
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.14);
  display: grid;
  gap: 0.35rem;
}

.distance-summary-item span {
  color: rgba(243, 246, 251, 0.68);
  font-size: 0.8rem;
}

.distance-summary-item strong {
  color: #f3f6fb;
}

.distance-up {
  color: #f8ca5b;
}

.distance-down {
  color: #8df0b4;
}

.share-fields {
  display: grid;
  gap: 0.9rem;
}

.share-list {
  display: grid;
  gap: 0.8rem;
}

.share-list-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.share-list-item p {
  margin: 0.3rem 0 0;
  color: rgba(243, 246, 251, 0.72);
  word-break: break-word;
}

.reorder-buttons-group {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.reorder-step-btn {
  min-width: 36px;
  min-height: 36px;
  padding: 0.35rem 0.45rem;
  border-radius: 10px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.05);
  color: #f3f6fb;
  font-weight: 700;
  cursor: pointer;
}

.reorder-step-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.reorder-position-input {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.3rem 0.45rem;
  border-radius: 10px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.05);
  color: #f3f6fb;
  font-weight: 700;
}

.reorder-position-input input {
  width: 66px;
  min-height: 34px;
  padding: 0.2rem 0.4rem;
  border-radius: 8px;
  border: 1px solid rgba(159, 209, 255, 0.22);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.copy-row {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.copy-row-stacked {
  align-items: flex-start;
}

.copy-button {
  min-height: 44px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(159, 209, 255, 0.18);
  background: rgba(69, 167, 255, 0.14);
  color: #f3f6fb;
  font-weight: 700;
  cursor: pointer;
}

.copy-button-inline {
  white-space: nowrap;
}

.share-fields textarea {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  resize: vertical;
}

.share-feedback {
  margin: 0;
  color: #8df0b4;
  font-weight: 600;
}

.route-options-card {
  display: grid;
  gap: 1rem;
}

@media (max-width: 980px) {
  .routes-result-grid {
    grid-template-columns: 1fr;
  }

  .distance-summary-grid {
    grid-template-columns: 1fr;
  }
}

.route-option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.9rem;
}

.route-option-button {
  display: grid;
  gap: 0.4rem;
  text-align: left;
  padding: 1rem;
  border-radius: 18px;
  border: 1px solid rgba(159, 209, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f6fb;
  cursor: pointer;
}

.route-option-button span {
  color: rgba(243, 246, 251, 0.72);
}

.route-option-button small {
  color: #9fd1ff;
}

.route-option-button-active {
  border-color: rgba(69, 167, 255, 0.7);
  background: rgba(69, 167, 255, 0.16);
  box-shadow: 0 0 0 2px rgba(69, 167, 255, 0.18);
}


.table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin-top: 1rem;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch;
}

.responsive-table {
  min-width: 560px;
}

.result-table {
  min-width: 680px;
}

.link-card,
.error-card,
.success-card {
  text-align: left;
}

.ors-link {
  display: inline-flex;
  margin-top: 0.75rem;
  color: #f8ca5b;
}

.error-card h3,
.error-card pre {
  margin: 0;
}

.error-card pre {
  margin-top: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.success-card pre {
  margin: 0;
  color: #8df0b4;
  white-space: pre-wrap;
  word-break: break-word;
}

.driver-table-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.insights-card {
  display: grid;
  gap: 1rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.insight-panel {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.12);
}

.insight-panel h3 {
  margin: 0;
  font-size: 1rem;
}

.insight-copy {
  margin: 0.5rem 0 0.8rem;
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.9rem;
}

.insight-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.6rem;
}

.insight-item {
  padding: 0.7rem 0.75rem;
  border-radius: 14px;
  background: rgba(6, 17, 31, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.insight-item-head {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: baseline;
}

.insight-item-head span {
  color: #9fd1ff;
  font-size: 0.83rem;
}

.insight-tags-row {
  margin-top: 0.4rem;
}

.insight-density-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.insight-density-tag-high {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.55);
  color: #fecaca;
}

.insight-density-tag-medium {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.55);
  color: #fde68a;
}

.insight-density-tag-low {
  background: rgba(56, 189, 248, 0.18);
  border-color: rgba(56, 189, 248, 0.52);
  color: #bae6fd;
}

.insight-distance-tag {
  display: inline-flex;
  align-items: center;
  margin-left: 0.45rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(15, 23, 42, 0.48);
  border: 1px solid rgba(159, 209, 255, 0.3);
  color: #c7e6ff;
}

.insight-density-high {
  border-color: rgba(239, 68, 68, 0.42);
  background: rgba(239, 68, 68, 0.08);
}

.insight-density-medium {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(245, 158, 11, 0.08);
}

.insight-density-low {
  border-color: rgba(56, 189, 248, 0.32);
  background: rgba(56, 189, 248, 0.06);
}

.insight-item p {
  margin: 0.45rem 0 0;
  color: rgba(243, 246, 251, 0.82);
  font-size: 0.88rem;
}

.insight-empty {
  margin: 0;
  color: rgba(243, 246, 251, 0.66);
  font-size: 0.9rem;
}

.insight-copy-btn {
  margin-top: 0.7rem;
}

.insights-feedback {
  margin: 0;
  color: #8df0b4;
  font-weight: 600;
}


@media (max-width: 960px) {
  .route-entry-field {
    flex: 0 1 auto;
  }

  .input-row,
  .copy-row,
  .share-list-item,
  .driver-table-header,
  .summary-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .input-grid {
    grid-template-columns: 1fr;
  }

  .field-group-wide {
    grid-column: auto;
  }

  .route-action-button,
  .route-submit-button {
    width: 100%;
  }

  .insights-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .routes-page {
    padding: 1rem 0.75rem 2rem;
  }

  .responsive-table {
    min-width: 520px;
  }

  .result-table {
    min-width: 620px;
  }
}

.sede-picker-card {
  border-color: rgba(96, 165, 250, 0.45);
  background: rgba(20, 44, 82, 0.7);
}

.sede-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.sede-option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.8rem;
}

.sede-option-btn {
  display: grid;
  gap: 0.3rem;
  text-align: left;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f6fb;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.sede-option-btn:hover {
  background: rgba(69, 167, 255, 0.16);
  border-color: rgba(69, 167, 255, 0.6);
}

.sede-option-btn span {
  color: rgba(243, 246, 251, 0.65);
  font-size: 0.85rem;
}

.sede-option-btn small {
  color: #9fd1ff;
  font-size: 0.8rem;
}

.anchor-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(159, 209, 255, 0.2);
  background: rgba(255, 255, 255, 0.04);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;
}

.anchor-btn:hover {
  background: rgba(255, 200, 60, 0.14);
  border-color: rgba(255, 200, 60, 0.45);
}

.anchor-btn-active {
  background: rgba(255, 200, 60, 0.18);
  border-color: rgba(255, 200, 60, 0.65);
  box-shadow: 0 0 0 2px rgba(255, 200, 60, 0.18);
}

.anchor-summary {
  color: #f8ca5b;
}

.anchor-info-banner {
  margin-top: 0.8rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: rgba(248, 202, 91, 0.1);
  border: 1px solid rgba(248, 202, 91, 0.3);
  color: #f8ca5b;
  font-size: 0.95rem;
}

:deep(.anchor-row td) {
  background: rgba(248, 202, 91, 0.07) !important;
}

:deep(.recent-stop-row td) {
  animation: recentStopPulse 1.2s ease;
  background: rgba(56, 189, 248, 0.16) !important;
}

@keyframes recentStopPulse {
  0% {
    background: rgba(56, 189, 248, 0.34);
  }

  100% {
    background: rgba(56, 189, 248, 0.08);
  }
}

/* ── Drag-and-drop reorder ────────────────────────── */
.reorder-hint {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  color: rgba(243, 246, 251, 0.38);
}

.share-list-item {
  cursor: grab;
}

.share-list-item:active {
  cursor: grabbing;
}

.share-item-dragging {
  opacity: 0.35;
  border-style: dashed !important;
}

.drag-handle {
  font-size: 1.25rem;
  color: rgba(159, 209, 255, 0.35);
  flex-shrink: 0;
  cursor: grab;
  line-height: 1;
  user-select: none;
}

.entry-info {
  flex: 1;
  min-width: 0;
}
</style>
