<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const MAX_POINTS_PER_REQUEST = 24;

const props = defineProps({
  title: {
    type: String,
    default: "Mapa de ruta",
  },
  description: {
    type: String,
    default: "Visualiza las paradas de la ruta sobre OpenStreetMap.",
  },
  stops: {
    type: Array,
    default: () => [],
  },
  origin: {
    type: Object,
    default: () => ({ latitude: 10.578208693113535, longitude: -71.67338068775426 }),
  },
  returnToOrigin: {
    type: Boolean,
    default: true,
  },
  canvasMinHeight: {
    type: [Number, String],
    default: 340,
  },
});

const mapElement = ref(null);
const routeFetchError = ref("");
let mapInstance = null;
let tileLayer = null;
let markerLayer = null;
let polylineLayer = null;
let renderRequestId = 0;

const normalizedStops = computed(() => props.stops
  .filter((stop) => Number.isFinite(Number(stop?.location?.latitude)) && Number.isFinite(Number(stop?.location?.longitude)))
  .map((stop, index) => ({
    id: stop.id || stop.clientId || `stop-${index + 1}`,
    name: stop.nombre || `Parada ${index + 1}`,
    order: stop.order || index + 1,
    latitude: Number(stop.location.latitude),
    longitude: Number(stop.location.longitude),
    googleMapsLink: stop.googleMapsLink || "",
    dispatched: Boolean(stop.dispatched),
  })));

const normalizedMapMinHeight = computed(() => {
  if (typeof props.canvasMinHeight === "number" && Number.isFinite(props.canvasMinHeight)) {
    return `${Math.max(props.canvasMinHeight, 280)}px`;
  }

  if (typeof props.canvasMinHeight === "string") {
    const trimmedValue = props.canvasMinHeight.trim();

    if (!trimmedValue) {
      return "340px";
    }

    if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
      return `${Math.max(Number(trimmedValue), 280)}px`;
    }

    return trimmedValue;
  }

  return "340px";
});

function createStopIcon(order, dispatched) {
  return L.divIcon({
    className: "route-stop-marker",
    html: `<div class="route-stop-badge ${dispatched ? "route-stop-badge-done" : ""}">${order}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createOriginIcon() {
  return L.divIcon({
    className: "route-origin-marker",
    html: '<div class="route-origin-badge">Inicio</div>',
    iconSize: [52, 28],
    iconAnchor: [26, 14],
  });
}

function buildRoutePoints() {
  const points = [];
  const originLat = Number(props.origin?.latitude);
  const originLng = Number(props.origin?.longitude);

  if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
    points.push([originLat, originLng]);
  }

  normalizedStops.value.forEach((stop) => {
    points.push([stop.latitude, stop.longitude]);
  });

  if (
    props.returnToOrigin
    && normalizedStops.value.length > 0
    && Number.isFinite(originLat)
    && Number.isFinite(originLng)
  ) {
    points.push([originLat, originLng]);
  }

  return points;
}

function buildOsrmChunks(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < points.length - 1) {
    const endIndex = Math.min(startIndex + (MAX_POINTS_PER_REQUEST - 1), points.length - 1);
    chunks.push(points.slice(startIndex, endIndex + 1));
    startIndex = endIndex;
  }

  return chunks;
}

function arePointsEqual(leftPoint, rightPoint) {
  if (!Array.isArray(leftPoint) || !Array.isArray(rightPoint)) {
    return false;
  }

  return Math.abs(leftPoint[0] - rightPoint[0]) < 0.00001
    && Math.abs(leftPoint[1] - rightPoint[1]) < 0.00001;
}

async function fetchRoadPolyline(points) {
  const chunks = buildOsrmChunks(points);

  if (chunks.length === 0) {
    return [];
  }

  const mergedPolyline = [];

  for (const chunk of chunks) {
    const coordinatesParam = chunk
      .map(([latitude, longitude]) => `${longitude},${latitude}`)
      .join(";");
    const response = await fetch(`${OSRM_ROUTE_URL}/${coordinatesParam}?overview=full&geometries=geojson`);
    const result = await response.json().catch(() => null);

    if (!response.ok || !Array.isArray(result?.routes) || !result.routes[0]?.geometry?.coordinates) {
      throw new Error("OSRM route lookup failed");
    }

    const chunkPolyline = result.routes[0].geometry.coordinates
      .map((coordinate) => [Number(coordinate?.[1]), Number(coordinate?.[0])])
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));

    if (chunkPolyline.length === 0) {
      continue;
    }

    if (mergedPolyline.length > 0 && arePointsEqual(mergedPolyline[mergedPolyline.length - 1], chunkPolyline[0])) {
      mergedPolyline.push(...chunkPolyline.slice(1));
    } else {
      mergedPolyline.push(...chunkPolyline);
    }
  }

  return mergedPolyline;
}

async function renderMapData() {
  if (!mapInstance || !markerLayer || !polylineLayer) {
    return;
  }

  const currentRenderId = ++renderRequestId;
  routeFetchError.value = "";

  markerLayer.clearLayers();
  polylineLayer.clearLayers();

  const points = [];
  const originLat = Number(props.origin?.latitude);
  const originLng = Number(props.origin?.longitude);

  if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
    const originMarker = L.marker([originLat, originLng], { icon: createOriginIcon() });
    originMarker.bindPopup("Punto de inicio");
    markerLayer.addLayer(originMarker);
    points.push([originLat, originLng]);
  }

  normalizedStops.value.forEach((stop) => {
    const marker = L.marker([stop.latitude, stop.longitude], {
      icon: createStopIcon(stop.order, stop.dispatched),
    });

    marker.bindPopup(`
      <strong>${stop.order}. ${stop.name}</strong><br/>
      ID: ${stop.id}<br/>
      ${stop.googleMapsLink ? `<a href="${stop.googleMapsLink}" target="_blank" rel="noreferrer">Abrir en Google Maps</a>` : ""}
    `);

    markerLayer.addLayer(marker);
    points.push([stop.latitude, stop.longitude]);
  });

  let linePoints = [...points];

  if (points.length > 1) {
    try {
      const roadPolyline = await fetchRoadPolyline(buildRoutePoints());

      if (currentRenderId !== renderRequestId) {
        return;
      }

      if (roadPolyline.length > 1) {
        linePoints = roadPolyline;
      }
    } catch (_error) {
      routeFetchError.value = "No se pudo trazar por calles. Se muestra linea referencial.";
    }

    polylineLayer.addLayer(L.polyline(linePoints, {
      color: "#45a7ff",
      weight: 4,
      opacity: 0.85,
      lineJoin: "round",
    }));
  }

  if (linePoints.length > 0) {
    mapInstance.fitBounds(linePoints, {
      padding: [28, 28],
      maxZoom: 15,
    });
    return;
  }

  mapInstance.setView([props.origin.latitude, props.origin.longitude], 12);
}

onMounted(() => {
  if (!mapElement.value) {
    return;
  }

  mapInstance = L.map(mapElement.value, {
    zoomControl: true,
    scrollWheelZoom: true,
  }).setView([props.origin.latitude, props.origin.longitude], 12);

  tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  });
  tileLayer.addTo(mapInstance);

  markerLayer = L.layerGroup().addTo(mapInstance);
  polylineLayer = L.layerGroup().addTo(mapInstance);

  renderMapData();
});

watch(normalizedStops, () => {
  renderMapData();
}, { deep: true });

watch(() => [props.origin?.latitude, props.origin?.longitude, props.returnToOrigin], () => {
  renderMapData();
});

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});
</script>

<template>
  <section class="osm-map-card">
    <div class="osm-map-header">
      <div>
        <strong class="map-title">{{ title }}</strong>
        <p>{{ description }}</p>
        <p v-if="routeFetchError" class="map-warning">{{ routeFetchError }}</p>
      </div>
      <span>{{ normalizedStops.length }} paradas visibles</span>
    </div>
    <div ref="mapElement" class="osm-map-canvas" :style="{ '--map-min-height': normalizedMapMinHeight }" />
  </section>
</template>

<style scoped>
.osm-map-card {
  display: grid;
  gap: 0.9rem;
}

.osm-map-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.osm-map-header p {
  margin: 0.3rem 0 0;
  color: rgba(243, 246, 251, 0.72);
}

.map-title {
  display: block;
  font-size: clamp(1.35rem, 2vw, 1.95rem);
  line-height: 1.15;
}

.map-warning {
  margin-top: 0.45rem;
  color: #ffd18f;
  font-size: 0.84rem;
}

.osm-map-header span {
  color: #9fd1ff;
  font-weight: 700;
}

.osm-map-canvas {
  min-height: var(--map-min-height, 340px);
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid rgba(159, 209, 255, 0.18);
}

:deep(.route-stop-badge) {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #45a7ff;
  color: #fff;
  font-weight: 800;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 18px rgba(11, 87, 208, 0.22);
}

:deep(.route-stop-badge-done) {
  background: #ef4444;
}

:deep(.route-origin-badge) {
  min-width: 52px;
  height: 28px;
  padding: 0 0.7rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #f59e0b;
  color: #08111d;
  font-size: 0.78rem;
  font-weight: 800;
  border: 2px solid rgba(255, 255, 255, 0.9);
}

@media (max-width: 640px) {
  .osm-map-canvas {
    min-height: min(var(--map-min-height, 340px), 380px);
  }
}
</style>