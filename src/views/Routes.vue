<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import RouteOsmMap from "../components/RouteOsmMap.vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const driverId = ref("");
const driverName = ref("");
const routeWeight = ref(0);
const paradaInput = ref("");
const paradaInputRef = ref(null);
const latInput = ref("");
const lonInput = ref("");
const adminKeyInput = ref("");
const paradas = ref([]);
const paradasTableRef = ref(null);
const latestAddedStopKey = ref("");
let stopHighlightTimer = null;
let stopKeySequence = 0;
const anchorClientId = ref("");
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

function toggleAnchor(clientId) {
  anchorClientId.value = anchorClientId.value === clientId ? "" : clientId;
}

const totalWeight = computed(() => Number(routeWeight.value) || 0);

const uniqueClientCount = computed(() => {
  const uniqueIds = new Set(
    paradas.value
      .map((stop) => String(stop.parada || "").trim())
      .filter(Boolean),
  );

  return uniqueIds.size;
});

const duplicateClientIds = computed(() => {
  const seen = new Set();
  const duplicates = new Set();

  paradas.value.forEach((stop) => {
    const clientId = String(stop.parada || "").trim();

    if (!clientId) {
      return;
    }

    if (seen.has(clientId)) {
      duplicates.add(clientId);
      return;
    }

    seen.add(clientId);
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

  const firstStopId = String(route[0]?.id || "").trim();
  const isApplied = firstStopId === anchorClientId.value;

  if (isApplied) {
    return {
      applied: true,
      message: `La ruta inicia en el cliente ancla ${anchorClientId.value} (${anchorReasonLabel.value}).`,
    };
  }

  return {
    applied: false,
    message: `El ancla ${anchorClientId.value} no quedo como primera parada en esta opcion. Revisa IDs o genera nuevamente.`,
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

const activeRouteOption = computed(() => {
  if (!routeOptions.value.length) {
    return null;
  }

  return routeOptions.value.find((option) => option.type === selectedRouteType.value) || routeOptions.value[0];
});

const editableRoute = ref([]);
const draggedIndex = ref(null);

const activeRouteMapStops = computed(() => editableRoute.value);

const clientLinkEntries = computed(() =>
  editableRoute.value
    .filter((stop) => stop?.nombre && stop?.googleMapsLink)
    .map((stop) => ({
      id: stop.id,
      nombre: stop.nombre,
      link: stop.googleMapsLink,
      text: `${stop.nombre}, ${stop.googleMapsLink}`,
    })),
);

function onDragStart(e, idx) {
  draggedIndex.value = idx;
  e.dataTransfer.effectAllowed = "move";
}

function onDrop(e, targetIdx) {
  e.preventDefault();
  const from = draggedIndex.value;
  draggedIndex.value = null;
  if (from === null || from === targetIdx) return;

  const route = [...editableRoute.value];
  const [moved] = route.splice(from, 1);
  route.splice(targetIdx, 0, moved);
  editableRoute.value = route;

  const table = [...routeTable.value];
  const [movedRow] = table.splice(from, 1);
  table.splice(targetIdx, 0, movedRow);
  routeTable.value = table.map((row, i) => ({ ...row, orden: i + 1 }));
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

  if (row?.parada === anchorClientId.value) {
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
    ...stop,
    __stopKey: stopKey,
  });
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
  if (addingStop.value) {
    return;
  }

  const clientId = paradaInput.value.trim();
  const lat = latInput.value.trim();
  const lon = lonInput.value.trim();
  const adminKey = adminKeyInput.value.trim();

  if (!clientId) {
    errorMessage.value = "Ingresa un ID de cliente.";
    return;
  }

  if ((lat || lon) && adminKey !== "4321") {
    errorMessage.value = "Clave de administrador incorrecta para agregar coordenadas.";
    return;
  }

  errorMessage.value = "";
  addStopStatus.value = "";

  if (lat && lon && adminKey === "4321") {
    addingStop.value = true;
    addStopStatusType.value = "info";
    addStopStatus.value = "Agregando cliente manual...";

    try {
      await addStopAndReveal({
        parada: clientId,
        name: "Agregado manual",
        location: { latitude: lat, longitude: lon },
        sucursal: "",
      });
      addStopStatusType.value = "success";
      addStopStatus.value = `Cliente ${clientId} agregado manualmente.`;
    } finally {
      addingStop.value = false;
    }

    paradaInput.value = "";
    latInput.value = "";
    lonInput.value = "";
    adminKeyInput.value = "";
    focusParadaInput();
    return;
  }

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
  latInput.value = "";
  lonInput.value = "";
  adminKeyInput.value = "";
  focusParadaInput();
}

function eliminarParada(idx) {
  const removed = paradas.value[idx];
  if (removed && removed.parada === anchorClientId.value) {
    anchorClientId.value = "";
    anchorReason.value = "priority";
  }
  paradas.value.splice(idx, 1);
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
  if (!paradas.value.length) {
    errorMessage.value = "Agrega al menos un cliente antes de generar la ruta.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";
  shareFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/makeRoute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverId: driverId.value.trim(),
        driverName: driverName.value.trim(),
        routeType: selectedRouteType.value,
        routeWeight: Number(routeWeight.value) || 0,
        anchorClientId: anchorClientId.value.trim() || undefined,
        anchorReason: anchorClientId.value.trim() ? anchorReason.value : undefined,
        stops: paradas.value.map((stop) => ({
          clientId: stop.parada,
          ...(stop.sucursal ? { sucursal: stop.sucursal } : {}),
        })),
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      serverResponse.value = null;
      errorMessage.value = result?.message || "Error al crear la ruta.";
      return;
    }

    serverResponse.value = result;
    selectedRouteType.value = result?.routeType || selectedRouteType.value;
    feedback.value = result?.savedRoute?.routeId
      ? `Ruta ${result.routeTypeLabel || "seleccionada"} guardada con folio ${result.savedRoute.routeId} para el chofer ${result.savedRoute.driverId}.`
      : "Rutas calculadas correctamente. Selecciona un tipo y agrega un ID de chofer para dejar la opcion guardada.";

  } catch (error) {
    serverResponse.value = null;
    errorMessage.value = `Error en la solicitud: ${error.message}`;
  } finally {
    loading.value = false;
  }
}
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

        <div class="input-row">
          <el-input
            ref="paradaInputRef"
            v-model="paradaInput"
            placeholder="Agregar ID de cliente"
            class="route-input"
            :disabled="addingStop"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="latInput"
            placeholder="Latitud (opcional, admin)"
            class="route-input"
            style="max-width: 140px;"
            :disabled="addingStop"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="lonInput"
            placeholder="Longitud (opcional, admin)"
            class="route-input"
            style="max-width: 140px;"
            :disabled="addingStop"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="adminKeyInput"
            placeholder="Clave admin (4321)"
            class="route-input"
            style="max-width: 120px;"
            :disabled="addingStop"
            @keyup.enter="agregarParada"
            show-password
          />
          <el-button type="primary" class="route-action-button" :loading="addingStop" @click="agregarParada">
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
          El cliente <strong>{{ anchorClientId }}</strong> sera la primera parada fija. Motivo: <strong>{{ anchorReasonLabel }}</strong>.
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
          IDs repetidos: {{ duplicateClientIds.join(", ") }}. Al guardar la ruta se consolidan en un solo cliente.
        </div>
      </div>

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
                  :class="{ 'anchor-btn-active': scope.row.parada === anchorClientId }"
                  type="button"
                  :title="scope.row.parada === anchorClientId ? 'Quitar ancla' : 'Marcar como cliente ancla (primera parada fija)'"
                  @click="toggleAnchor(scope.row.parada)"
                >
                  {{ scope.row.parada === anchorClientId ? '⭐' : '☆' }}
                </button>
              </template>
            </el-table-column>
            <el-table-column prop="parada" label="Parada" />
            <el-table-column prop="name" label="Nombre" width="150" />
            <el-table-column label="Acciones" width="100">
              <template #default="scope">
                <el-button
                  type="danger"
                  size="small"
                  @click="eliminarParada(scope.$index)"
                >Eliminar</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-button type="success" class="route-submit-button" :loading="loading" @click="makeRoute"
          >Crear y guardar ruta</el-button
        >
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
            <span><strong>Chofer:</strong> {{ serverResponse.savedRoute?.driverId || 'Sin asignar' }}</span>
            <span><strong>Opcion activa:</strong> {{ activeRouteOption?.label || serverResponse.routeTypeLabel }}</span>
          </div>
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

        <div v-if="serverResponse.savedRoute || activeRouteOption?.openRouteLink || activeRouteOption?.googleMapsRouteLinks?.length" class="routes-card share-card">
          <div class="driver-table-header">
            <div>
              <strong>Datos para enviar al chofer</strong>
              <p class="share-copy">Copia el nombre del cliente con su link desde aqui, sin usar la consola.</p>
            </div>
            <button class="copy-button" type="button" @click="copyText(shareMessage, 'Mensaje copiado para compartir con el chofer.')">
              Copiar mensaje completo
            </button>
          </div>

          <div class="share-fields">
            <div v-if="clientLinkEntries.length" class="share-list">
              <p class="reorder-hint">Arrastra para cambiar el orden antes de copiar.</p>
              <article
                v-for="(entry, idx) in clientLinkEntries"
                :key="entry.id || entry.link"
                class="share-list-item"
                :class="{ 'share-item-dragging': draggedIndex === idx }"
                draggable="true"
                @dragstart="onDragStart($event, idx)"
                @dragover.prevent
                @drop="onDrop($event, idx)"
                @dragend="onDragEnd"
              >
                <span class="drag-handle" title="Arrastra para reordenar">⠿</span>
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

        <div v-if="activeRouteMapStops.length" class="routes-card">
          <RouteOsmMap
            title="Mapa OSM de la ruta"
            description="Las paradas se muestran numeradas sobre OpenStreetMap para revisarlas mejor también en teléfono."
            :stops="activeRouteMapStops"
          />
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

.input-row {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-top: 1rem;
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
.field-group select,
.route-input {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
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
