<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
});

const mapElement = ref(null);
let mapInstance = null;
let tileLayer = null;
let markerLayer = null;
let polylineLayer = null;

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

function renderMapData() {
  if (!mapInstance || !markerLayer || !polylineLayer) {
    return;
  }

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

  if (points.length > 1) {
    polylineLayer.addLayer(L.polyline(points, {
      color: "#45a7ff",
      weight: 4,
      opacity: 0.85,
      lineJoin: "round",
    }));
  }

  if (points.length > 0) {
    mapInstance.fitBounds(points, {
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
        <strong>{{ title }}</strong>
        <p>{{ description }}</p>
      </div>
      <span>{{ normalizedStops.length }} paradas visibles</span>
    </div>
    <div ref="mapElement" class="osm-map-canvas" />
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

.osm-map-header span {
  color: #9fd1ff;
  font-weight: 700;
}

.osm-map-canvas {
  min-height: 340px;
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
  background: #22c55e;
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
    min-height: 300px;
  }
}
</style>