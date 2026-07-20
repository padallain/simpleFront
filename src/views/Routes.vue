<script setup>
import { computed, ref, watch } from "vue";
import jsPDF from "jspdf";
import RouteOsmMap from "../components/RouteOsmMap.vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const driverId = ref("");
const driverName = ref("");
const routeWeight = ref(0);
const paradaInput = ref("");
const latInput = ref("");
const lonInput = ref("");
const adminKeyInput = ref("");
const paradas = ref([]);
const anchorClientId = ref("");
const sedePickerVisible = ref(false);
const sedePendingId = ref("");
const sedePendingNombre = ref("");
const sedeOpciones = ref([]);
const serverResponse = ref(null);
const routeTable = ref([]);
const loading = ref(false);
const feedback = ref("");
const errorMessage = ref("");
const shareFeedback = ref("");
const selectedRouteType = ref("closest");

const routeTypeOptions = [
  { value: "closest", label: "Mas cercana" },
  { value: "farthest", label: "Lejanos primero" },
  { value: "alphabetical", label: "Orden alfabetico" },
  { value: "mirrored", label: "Espejo (zona contraria)" },
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

function printRoutePDF() {
  if (!routeTable.value.length) {
    return;
  }

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Tabla de paradas para el chofer", 10, 10);
  doc.setFontSize(12);
  doc.text(`Chofer ID: ${driverId.value || "Sin asignar"}`, 10, 18);
  doc.text(`Tipo: ${activeRouteOption.value?.label || "Ruta generada"}`, 10, 26);
  doc.text(`Peso total: ${totalWeight.value}`, 10, 34);
  doc.text(`Clientes unicos: ${uniqueClientCount.value}`, 10, 42);
  doc.text(`Folio: ${currentRouteReference.value}`, 10, 50);
  doc.text("Orden", 10, 56);
  doc.text("Parada", 30, 56);
  doc.text("Ruta", 120, 56);

  routeTable.value.forEach((row, idx) => {
    const y = 66 + idx * 10;
    doc.text(String(row.orden), 10, y);
    doc.text(row.nombre, 30, y);
    doc.text(currentRouteReference.value, 120, y);
  });

  doc.save("paradas_chofer.pdf");
}

function agregarSede(sede) {
  paradas.value.push({
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
}

async function agregarParada() {
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

  if (lat && lon && adminKey === "4321") {
    paradas.value.push({
      parada: clientId,
      name: "Agregado manual",
      location: { latitude: lat, longitude: lon },
      sucursal: "",
    });
    paradaInput.value = "";
    latInput.value = "";
    lonInput.value = "";
    adminKeyInput.value = "";
    return;
  }

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
        return;
      }

      // Single-location client
      paradas.value.push({
        parada: clientId,
        name: data.nombre || "Cliente",
        location: data.location || null,
        sucursal: data.sucursal || "",
      });
    } else {
      paradas.value.push({ parada: clientId, name: "No encontrado", location: null, sucursal: "" });
    }
  } catch (_error) {
    paradas.value.push({ parada: clientId, name: "Error consultando", location: null, sucursal: "" });
  }

  paradaInput.value = "";
  latInput.value = "";
  lonInput.value = "";
  adminKeyInput.value = "";
}

function eliminarParada(idx) {
  const removed = paradas.value[idx];
  if (removed && removed.parada === anchorClientId.value) {
    anchorClientId.value = "";
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
            v-model="paradaInput"
            placeholder="Agregar ID de cliente"
            class="route-input"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="latInput"
            placeholder="Latitud (opcional, admin)"
            class="route-input"
            style="max-width: 140px;"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="lonInput"
            placeholder="Longitud (opcional, admin)"
            class="route-input"
            style="max-width: 140px;"
            @keyup.enter="agregarParada"
          />
          <el-input
            v-model="adminKeyInput"
            placeholder="Clave admin (4321)"
            class="route-input"
            style="max-width: 120px;"
            @keyup.enter="agregarParada"
            show-password
          />
          <el-button type="primary" class="route-action-button" @click="agregarParada">Agregar</el-button>
        </div>

        <div class="summary-strip">
          <span><strong>Clientes unicos:</strong> {{ uniqueClientCount }}</span>
          <span><strong>Peso total:</strong> {{ totalWeight }}</span>
          <span><strong>Repetidos detectados:</strong> {{ duplicateClientIds.length }}</span>
          <span v-if="anchorClientId" class="anchor-summary">
            Ancla: <strong>{{ anchorClientId }}</strong>
          </span>
        </div>
        <div v-if="anchorClientId" class="anchor-info-banner">
          El cliente <strong>{{ anchorClientId }}</strong> sera la primera parada fija. La ruta optima se construye desde ahi. El espejo tambien lo respeta.
        </div>
        <div v-if="duplicateClientIds.length" class="warning-inline">
          IDs repetidos: {{ duplicateClientIds.join(", ") }}. Al guardar la ruta se consolidan en un solo cliente.
        </div>
      </div>

      <div class="routes-card">
        <div class="table-wrapper">
          <el-table :data="paradas" class="responsive-table" :row-class-name="(row) => row.row.parada === anchorClientId ? 'anchor-row' : ''">
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

        <div
          v-if="activeRouteOption?.routeNames && activeRouteOption.routeNames.length"
          class="routes-card"
        >
          <div class="driver-table-header">
            <strong>Tabla de paradas para el chofer:</strong>
            <el-button
              type="primary"
              @click="printRoutePDF"
            >
              Imprimir PDF
            </el-button>
          </div>
          <div class="table-wrapper">
            <el-table :data="routeTable" class="responsive-table result-table">
          <el-table-column prop="orden" label="Orden" width="80" />
          <el-table-column prop="nombre" label="Nombre de la parada" />
          <el-table-column label="Novedades" width="200">
            <template #default="scope">
              <el-input
                v-model="scope.row.novedad"
                placeholder="Escriba aquí..."
              />
            </template>
          </el-table-column>
            </el-table>
          </div>
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

.routes-controls {
  margin-top: 0;
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
