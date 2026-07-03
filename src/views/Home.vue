<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getPendingClientCount,
  getPendingClientQueue,
  queueClientForSync,
  removeQueuedClients,
} from "../services/offlineClientQueue";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const route = useRoute();
const router = useRouter();

const latitude = ref("");
const clientCount = ref(0)
const longitude = ref("");
const adminKeyInput = ref("");
import { computed } from "vue";

const isAdminMode = computed(() => adminKeyInput.value === "4321");
const numberInput = ref("");
const textInput = ref("");
const sucursalInput = ref("");

// --- Búsqueda de sedes de cadena ---
const cadenaSearchId = ref("");
const cadenaSearchResult = ref(null);
const cadenaSearchError = ref("");
const cadenaSearching = ref(false);
const nuevaSedeNombre = ref("");
const nuevaSedeLatitud = ref("");
const nuevaSedeLogitud = ref("");
const guardandoSede = ref(false);
const sedeFeedback = ref(null);
const showCadenaSection = ref(false);
const start = "08:00:00";
const end = "17:00:00";
const serverResponse = ref(null);
const clientData = ref(null);
const homeFeedback = ref("");
const formErrors = ref([]);
const fieldErrors = ref({
  latitude: "",
  longitude: "",
  clientId: "",
  clientName: "",
});
const isSaving = ref(false);
const isFetchingClient = ref(false);
const isSyncingPending = ref(false);
const pendingClientCount = ref(0);
const isOnline = ref(typeof navigator === "undefined" ? true : navigator.onLine);

const BACKEND_MESSAGE_MAP = {
  "All fields are required": "Completa todos los campos antes de guardar el cliente.",
  "Client with this ID already exists": "Ya existe un cliente con ese ID.",
  "Error registering client": "No se pudo guardar el cliente por un error del servidor.",
  "Client not found": "No se encontro un cliente con ese ID.",
  "Error getting client": "No se pudo consultar el cliente por un error del servidor.",
};

function translateServerMessage(message, fallback) {
  if (!message) {
    return fallback;
  }

  return BACKEND_MESSAGE_MAP[message] || message;
}

function setServerResponse(type, title, message, details = []) {
  serverResponse.value = {
    type,
    title,
    message,
    details,
  };
}

function resetFieldErrors() {
  fieldErrors.value = {
    latitude: "",
    longitude: "",
    clientId: "",
    clientName: "",
  };
}

function clearFieldError(fieldName) {
  fieldErrors.value = {
    ...fieldErrors.value,
    [fieldName]: "",
  };
}

function validateClientForm() {
  const errors = [];
  const clientId = String(numberInput.value ?? "").trim();
  const clientName = textInput.value.trim();
  const latitudeNumber = Number(latitude.value);
  const longitudeNumber = Number(longitude.value);
  const adminKey = adminKeyInput.value.trim();

  resetFieldErrors();

  if (!clientId) {
    const message = "Falta el ID del cliente.";
    errors.push(message);
    fieldErrors.value.clientId = message;
  }

  if (!clientName) {
    const message = "Falta el nombre del cliente.";
    errors.push(message);
    fieldErrors.value.clientName = message;
  }

  // Solo advertir si los campos están vacíos, no exigir clave admin para guardar
  if (!Number.isFinite(latitudeNumber)) {
    const message = "Falta obtener la latitud.";
    errors.push(message);
    fieldErrors.value.latitude = message;
  }
  if (!Number.isFinite(longitudeNumber)) {
    const message = "Falta obtener la longitud.";
    errors.push(message);
    fieldErrors.value.longitude = message;
  }

  return errors;
}

async function parseJsonResponse(response) {
  return response.json().catch(() => null);
}

function refreshPendingClientCount() {
  pendingClientCount.value = getPendingClientCount();
}

function resetClientForm() {
  latitude.value = "";
  longitude.value = "";
  numberInput.value = "";
  textInput.value = "";
  sucursalInput.value = "";
  adminKeyInput.value = "";
  formErrors.value = [];
  resetFieldErrors();
}

async function buscarSedes() {
  const id = cadenaSearchId.value.trim();
  if (!id) {
    cadenaSearchError.value = "Ingresa un ID para buscar.";
    return;
  }
  cadenaSearching.value = true;
  cadenaSearchError.value = "";
  cadenaSearchResult.value = null;
  sedeFeedback.value = null;
  nuevaSedeNombre.value = "";
  nuevaSedeLatitud.value = "";
  nuevaSedeLogitud.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${id}/sedes`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      cadenaSearchError.value = data?.message || "Cliente no encontrado.";
    } else {
      cadenaSearchResult.value = data;
    }
  } catch {
    cadenaSearchError.value = "No se pudo conectar con el servidor.";
  } finally {
    cadenaSearching.value = false;
  }
}

async function guardarNuevaSede() {
  if (!cadenaSearchResult.value) return;
  const sucursal = nuevaSedeNombre.value.trim();
  const lat = Number(nuevaSedeLatitud.value);
  const lon = Number(nuevaSedeLogitud.value);

  if (!sucursal || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    sedeFeedback.value = { type: "error", message: "Nombre de sede, latitud y longitud son obligatorios." };
    return;
  }

  guardandoSede.value = true;
  sedeFeedback.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/registerClient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cadenaSearchResult.value.id,
        nombre: cadenaSearchResult.value.nombre,
        sucursal,
        latitude: lat,
        longitude: lon,
        start: "08:00:00",
        end: "17:00:00",
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      sedeFeedback.value = { type: "success", message: `Sede "${sucursal}" registrada.` };
      nuevaSedeNombre.value = "";
      nuevaSedeLatitud.value = "";
      nuevaSedeLogitud.value = "";
      await buscarSedes();
    } else {
      sedeFeedback.value = { type: "error", message: data?.message || "No se pudo registrar la sede." };
    }
  } catch {
    sedeFeedback.value = { type: "error", message: "Error de conexion con el servidor." };
  } finally {
    guardandoSede.value = false;
  }
}

async function submitClientPayload(payload) {
  const response = await fetch(`${API_BASE_URL}/registerClient`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await parseJsonResponse(response);

  return {
    ok: response.ok,
    result,
  };
}

async function syncPendingClients(options = {}) {
  if (isSyncingPending.value || !isOnline.value) {
    refreshPendingClientCount();
    return { syncedCount: 0, remainingCount: getPendingClientCount() };
  }

  const { silent = false } = options;
  const queue = getPendingClientQueue();

  if (queue.length === 0) {
    refreshPendingClientCount();
    return { syncedCount: 0, remainingCount: 0 };
  }

  isSyncingPending.value = true;
  const syncedQueueIds = [];
  let syncedCount = 0;
  let blockedByServer = false;

  try {
    for (const item of queue) {
      try {
        const submission = await submitClientPayload(item.payload);

        if (!submission.ok) {
          blockedByServer = true;
          break;
        }

        syncedQueueIds.push(item.queueId);
        syncedCount += 1;
      } catch (_error) {
        break;
      }
    }

    if (syncedQueueIds.length > 0) {
      removeQueuedClients(syncedQueueIds);
      await fetchClientCount();
    }

    refreshPendingClientCount();

    if (!silent) {
      if (syncedCount > 0 && pendingClientCount.value === 0) {
        setServerResponse(
          "success",
          "Sincronizacion completada",
          `Se enviaron ${syncedCount} cliente(s) pendientes al servidor.`,
        );
      } else if (syncedCount > 0) {
        setServerResponse(
          "info",
          "Sincronizacion parcial",
          `Se enviaron ${syncedCount} cliente(s). Aun quedan ${pendingClientCount.value} pendientes.`,
        );
      } else if (blockedByServer) {
        setServerResponse(
          "error",
          "No se pudieron sincronizar los pendientes",
          "El servidor rechazo al menos un cliente pendiente. Revisa los datos antes de reintentar.",
        );
      }
    }

    return {
      syncedCount,
      remainingCount: pendingClientCount.value,
    };
  } finally {
    isSyncingPending.value = false;
  }
}

function handleOnline() {
  isOnline.value = true;
  syncPendingClients();
}

function handleOffline() {
  isOnline.value = false;
}

const fetchClientCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/countClients`);
    if (response.ok) {
      const data = await response.json();
      clientCount.value = data.count;
    } else {
      clientCount.value = 0;
    }
  } catch (error) {
    clientCount.value = 0;
  }
};

// Llama a la función al montar el componente
onMounted(() => {
  const queryClientId = typeof route.query.clientId === "string" ? route.query.clientId.trim() : "";

  if (queryClientId) {
    numberInput.value = queryClientId;
  }

  refreshPendingClientCount();
  fetchClientCount();
  syncPendingClients({ silent: true });
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
});

onBeforeUnmount(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
});


const getGeolocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude.value = position.coords.latitude;
        longitude.value = position.coords.longitude;
        clearFieldError("latitude");
        clearFieldError("longitude");
      },
      (error) => {
        console.error("Error obteniendo la geolocalización:", error);
        setServerResponse(
          "error",
          "No se pudo obtener la geolocalizacion",
          "Activa el permiso de ubicacion del navegador e intenta de nuevo.",
        );
      }
    );
  } else {
    console.error("La geolocalización no es soportada por este navegador.");
    setServerResponse(
      "error",
      "Navegador no compatible",
      "Este navegador no permite obtener la geolocalizacion.",
    );
  }
};

const saveClient = async () => {
  formErrors.value = validateClientForm();
  clientData.value = null;
  homeFeedback.value = "";

  if (formErrors.value.length > 0) {
    setServerResponse(
      "error",
      "Revisa el formulario",
      "Corrige los datos marcados antes de guardar el cliente.",
      formErrors.value,
    );
    return;
  }

  const payload = {
    id: numberInput.value.toString().trim(),
    nombre: textInput.value,
    sucursal: sucursalInput.value.trim(),
    latitude: parseFloat(latitude.value),
    longitude: parseFloat(longitude.value),
    start,
    end,
  };

  isSaving.value = true;

  try {
    if (!isOnline.value) {
      queueClientForSync(payload);
      refreshPendingClientCount();
      setServerResponse(
        "info",
        "Cliente guardado sin internet",
        `La ubicacion se capturo y el cliente quedo almacenado en este telefono. Hay ${pendingClientCount.value} pendiente(s) por sincronizar.`,
      );
      clientData.value = null;
      homeFeedback.value = "";
      resetClientForm();
      return;
    }

    const submission = await submitClientPayload(payload);

    if (submission.ok) {
      setServerResponse(
        "success",
        "Cliente guardado",
        translateServerMessage(submission.result?.message, "El cliente se guardo correctamente."),
      );
      clientData.value = null;
      homeFeedback.value = "";
      resetClientForm();
      await fetchClientCount();
    } else {
      setServerResponse(
        "error",
        "No se pudo guardar el cliente",
        translateServerMessage(submission.result?.message, "Ocurrio un problema al guardar el cliente."),
      );
    }
  } catch (error) {
    queueClientForSync(payload);
    refreshPendingClientCount();
    setServerResponse(
      "info",
      "Cliente guardado para sincronizar",
      `No fue posible comunicarse con el servidor, pero la ubicacion quedo almacenada localmente. Hay ${pendingClientCount.value} pendiente(s).`,
    );
    clientData.value = null;
    homeFeedback.value = "";
    resetClientForm();
  } finally {
    isSaving.value = false;
  }
};


const getClientAddress = async () => {
  const clientId = numberInput.value.toString();
  homeFeedback.value = "";
  formErrors.value = [];

  if (!clientId.trim()) {
    setServerResponse(
      "error",
      "Falta el ID del cliente",
      "Ingresa un ID valido para consultar la direccion del cliente.",
    );
    clientData.value = null;
    return;
  }

  isFetchingClient.value = true;

  try {
    const response = await fetch(
      `${API_BASE_URL}/getClient/${clientId}`,
      {
        method: "GET",
      }
    );

    const result = await parseJsonResponse(response);

    if (response.ok) {
      clientData.value = result;
      const title = result?.esCadena
        ? `Cadena encontrada — ${result.totalSedes} sedes registradas`
        : "Cliente encontrado";
      setServerResponse("info", title, `Datos del cliente ${clientId.trim()}.`);
    } else {
      clientData.value = null;
      setServerResponse(
        "error",
        "No se pudo obtener la direccion",
        translateServerMessage(result?.message, response.statusText || "Consulta no disponible."),
      );
    }
  } catch (error) {
    clientData.value = null;
    setServerResponse(
      "error",
      "Sin conexion con el servidor",
      error.message || "No fue posible consultar el cliente.",
    );
  } finally {
    isFetchingClient.value = false;
  }
};

async function copyMapsLink() {
  if (!clientData.value?.googleMapsLink) {
    return;
  }

  homeFeedback.value = "";

  try {
    await navigator.clipboard.writeText(clientData.value.googleMapsLink);
    homeFeedback.value = "Link de Google Maps copiado.";
  } catch (_error) {
    homeFeedback.value = "No se pudo copiar automaticamente.";
  }
}

const goToClientLocationReports = () => {
  router.push('/client-location-reports');
};

const goToRouteManagement = () => {
  router.push('/route-management');
};

const goToDailyCheckHistory = () => {
  router.push('/daily-check-history');
};

const goToDispatchStatus = () => {
  router.push('/dispatch-status');
};

const goToWarehousePicking = () => {
  router.push('/warehouse-picking');
};


</script>

<template>
  <section class="home-page">
    <div class="home-container">

      <!-- ── Hero ──────────────────────────────────── -->
      <header class="home-hero">
        <div class="hero-status">
          <span class="hero-status-dot" :class="isOnline ? 'dot-online' : 'dot-offline'"></span>
          <span>{{ isOnline ? 'Conectado' : 'Sin conexión' }}</span>
          <span class="hero-status-sep">·</span>
          <span>MakeRoute</span>
        </div>
        <h1 class="home-title">
          Alta y consulta
          <span class="title-gradient">de clientes</span>
        </h1>
        <p class="home-subtitle">
          Captura ubicaciones, registra clientes y consulta datos guardados desde una sola pantalla.
        </p>
      </header>

      <!-- ── Stat bar ───────────────────────────────── -->
      <div class="stat-bar">
        <div class="stat-item">
          <strong class="stat-number">{{ clientCount }}</strong>
          <span class="stat-label">Clientes en BD</span>
        </div>
        <div class="stat-sep"></div>
        <div class="stat-item">
          <strong class="stat-number" :class="pendingClientCount > 0 ? 'stat-number-warn' : ''">{{ pendingClientCount }}</strong>
          <span class="stat-label">Pendientes sync</span>
        </div>
        <div class="stat-sep stat-hide-sm"></div>
        <div class="stat-item stat-item-status stat-hide-sm">
          <span class="status-indicator" :class="isOnline ? 'status-online' : 'status-offline'"></span>
          <span class="stat-label">{{ isOnline ? 'En línea' : 'Sin conexión' }}</span>
        </div>
      </div>

      <!-- ── Module navigation ──────────────────────── -->
      <nav class="modules-grid" aria-label="Módulos del sistema">
        <button class="module-card" type="button" @click="goToClientLocationReports">
          <span class="mod-icon" style="--c:#f59e0b;--b:rgba(245,158,11,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Denuncias</strong>
            <em>Reportes públicos</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToRouteManagement">
          <span class="mod-icon" style="--c:#60a5fa;--b:rgba(96,165,250,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Rutas</strong>
            <em>Administrar</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToDailyCheckHistory">
          <span class="mod-icon" style="--c:#34d399;--b:rgba(52,211,153,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Chequeos</strong>
            <em>Historial camiones</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToDispatchStatus">
          <span class="mod-icon" style="--c:#a78bfa;--b:rgba(167,139,250,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Despachos</strong>
            <em>Estatus de rutas</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card module-card-wide" type="button" @click="goToWarehousePicking">
          <span class="mod-icon" style="--c:#2dd4bf;--b:rgba(45,212,191,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Picking</strong>
            <em>Registrar cajas y pedidos</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>
      </nav>

      <!-- ── Form card ──────────────────────────────── -->
      <div class="form-card">
        <div class="form-card-header">
          <div class="form-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <div>
            <h2 class="form-card-title">Alta de cliente</h2>
            <p class="form-card-desc">Completa los datos para registrar o consultar un cliente.</p>
          </div>
        </div>

        <div class="offline-banner" :class="isOnline ? '' : 'offline-banner-warning'">
          <div>
            <strong>{{ isOnline ? 'Modo sincronizable' : 'Modo sin internet' }}</strong>
            <p>
              {{ isOnline
                ? `Hay ${pendingClientCount} cliente(s) pendiente(s) por sincronizar en este dispositivo.`
                : `Puedes capturar ubicaciones sin internet. Se guardaran localmente y luego se enviaran. Pendientes: ${pendingClientCount}.` }}
            </p>
          </div>
          <button class="btn btn-secondary sync-button" :disabled="isSyncingPending || pendingClientCount === 0 || !isOnline" @click="syncPendingClients()">
            {{ isSyncingPending ? "Sincronizando..." : "Sincronizar" }}
          </button>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="adminKeyInput">Clave admin</label>
            <input id="adminKeyInput" type="password" v-model="adminKeyInput" maxlength="8" placeholder="Solo para edición manual" />
          </div>
          <div class="form-group">
            <label for="latitude">Latitud</label>
            <input id="latitude" :class="{ 'input-error': fieldErrors.latitude }" type="text" v-model="latitude" :readonly="!isAdminMode" />
            <p v-if="fieldErrors.latitude" class="field-error">{{ fieldErrors.latitude }}</p>
          </div>
          <div class="form-group">
            <label for="longitude">Longitud</label>
            <input id="longitude" :class="{ 'input-error': fieldErrors.longitude }" type="text" v-model="longitude" :readonly="!isAdminMode" />
            <p v-if="fieldErrors.longitude" class="field-error">{{ fieldErrors.longitude }}</p>
          </div>
          <div class="form-group">
            <label for="numberInput">ID del cliente</label>
            <input id="numberInput" :class="{ 'input-error': fieldErrors.clientId }" type="text" inputmode="numeric" v-model="numberInput" placeholder="Ej. 0504036749" @input="clearFieldError('clientId')" />
            <p v-if="fieldErrors.clientId" class="field-error">{{ fieldErrors.clientId }}</p>
          </div>
          <div class="form-group">
            <label for="textInput">Nombre del cliente</label>
            <input id="textInput" :class="{ 'input-error': fieldErrors.clientName }" type="text" v-model="textInput" maxlength="80" @input="clearFieldError('clientName')" />
            <p v-if="fieldErrors.clientName" class="field-error">{{ fieldErrors.clientName }}</p>
          </div>
          <div class="form-group">
            <label for="sucursalInput">Sede (solo para cadenas)</label>
            <input id="sucursalInput" type="text" v-model="sucursalInput" maxlength="60" placeholder="Sede Norte — dejar vacío si no es cadena" />
          </div>
        </div>

        <div v-if="formErrors.length" class="validation-card">
          <strong>Corrige esto antes de continuar:</strong>
          <ul>
            <li v-for="error in formErrors" :key="error">{{ error }}</li>
          </ul>
        </div>

        <div class="button-group">
          <button class="btn btn-geo" type="button" @click="getGeolocation">Obtener ubicación</button>
          <button class="btn btn-save" type="button" :disabled="isSaving" @click="saveClient">{{ isSaving ? "Guardando..." : "Guardar cliente" }}</button>
          <button class="btn btn-query" type="button" :disabled="isFetchingClient" @click="getClientAddress">{{ isFetchingClient ? "Consultando..." : "Consultar cliente" }}</button>
        </div>

        <!-- Sección de cadenas y sedes -->
        <div class="cadena-toggle-row">
          <button class="cadena-toggle-btn" type="button" @click="showCadenaSection = !showCadenaSection">
            {{ showCadenaSection ? '▲ Ocultar sedes de cadena' : '▼ Ver / agregar sedes de una cadena' }}
          </button>
        </div>

        <div v-if="showCadenaSection" class="cadena-section">
          <p class="cadena-desc">Busca un cliente por ID para ver todas sus sedes registradas o agregar una nueva.</p>

          <div class="cadena-search-row">
            <input
              v-model="cadenaSearchId"
              type="text"
              placeholder="ID del cliente cadena"
              class="cadena-input"
              @keyup.enter="buscarSedes"
            />
            <button class="btn btn-save cadena-search-btn" type="button" :disabled="cadenaSearching" @click="buscarSedes">
              {{ cadenaSearching ? 'Buscando...' : 'Buscar' }}
            </button>
          </div>

          <p v-if="cadenaSearchError" class="field-error">{{ cadenaSearchError }}</p>

          <div v-if="cadenaSearchResult" class="cadena-result">
            <p class="cadena-result-title">
              <strong>{{ cadenaSearchResult.nombre }}</strong>
              — {{ cadenaSearchResult.totalSedes }} sede(s) registrada(s)
            </p>

            <div class="sedes-grid">
              <a
                v-for="sede in cadenaSearchResult.sedes"
                :key="sede.sucursal || '_'"
                :href="sede.googleMapsLink || '#'"
                target="_blank"
                class="sede-chip"
                :title="sede.googleMapsLink ? 'Ver en Google Maps' : ''"
              >
                <strong>{{ sede.sucursal || 'Principal' }}</strong>
                <span>{{ sede.location?.latitude?.toFixed(4) }}, {{ sede.location?.longitude?.toFixed(4) }}</span>
              </a>
            </div>

            <div class="nueva-sede-form">
              <p class="nueva-sede-label">Agregar nueva sede a <strong>{{ cadenaSearchResult.nombre }}</strong>:</p>
              <div class="nueva-sede-grid">
                <input v-model="nuevaSedeNombre" type="text" placeholder="Nombre de la sede (ej. Sede Este)" class="cadena-input" />
                <input v-model="nuevaSedeLatitud" type="number" step="any" placeholder="Latitud" class="cadena-input" />
                <input v-model="nuevaSedeLogitud" type="number" step="any" placeholder="Longitud" class="cadena-input" />
              </div>
              <button class="btn btn-save" type="button" :disabled="guardandoSede" @click="guardarNuevaSede">
                {{ guardandoSede ? 'Registrando...' : 'Registrar sede' }}
              </button>
              <p v-if="sedeFeedback" :class="['sede-feedback', sedeFeedback.type === 'success' ? 'sede-feedback-ok' : 'sede-feedback-err']">
                {{ sedeFeedback.message }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="serverResponse"
        :class="[
          'response-card',
          `response-card-${serverResponse.type || 'info'}`,
        ]"
      >
        <strong>{{ serverResponse.title }}</strong>
        <p class="response-message">{{ serverResponse.message }}</p>
        <ul v-if="serverResponse.details?.length" class="response-list">
          <li v-for="detail in serverResponse.details" :key="detail">{{ detail }}</li>
        </ul>
      </div>

      <div v-if="clientData" class="response-card response-card-info">
        <strong>Datos del cliente:</strong>
        <pre>{{ typeof clientData === 'string' ? clientData : JSON.stringify(clientData, null, 2) }}</pre>
        <div v-if="clientData.googleMapsLink" class="maps-link-row">
          <input :value="clientData.googleMapsLink" type="text" readonly class="maps-link-input" />
          <button class="btn btn-secondary maps-copy-button" type="button" @click="copyMapsLink">Copiar link</button>
          <a
            :href="clientData.googleMapsLink"
            target="_blank"
            class="maps-link"
          >
            Ver ubicación en Google Maps
          </a>
        </div>
        <p v-if="homeFeedback" class="maps-feedback">{{ homeFeedback }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────── */
.home-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(87, 140, 255, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(124, 58, 237, 0.16), transparent 28%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.home-container {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
}

/* ── Hero ─────────────────────────────────────────── */
.home-hero {
  margin-bottom: 1.75rem;
}

.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 1rem;
  padding: 0.3rem 0.9rem;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.14);
  font-size: 0.78rem;
  color: rgba(243, 246, 251, 0.6);
}

.hero-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
}

.dot-offline {
  background: #f87171;
  box-shadow: 0 0 6px rgba(248, 113, 113, 0.6);
}

.hero-status-sep {
  opacity: 0.3;
}

.home-title {
  margin: 0;
  color: #f3f6fb;
  font-size: clamp(1.9rem, 4.5vw, 2.9rem);
  line-height: 1.18;
  letter-spacing: -0.02em;
}

.title-gradient {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.home-subtitle {
  max-width: 580px;
  margin: 0.8rem auto 0;
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.97rem;
  line-height: 1.6;
}

/* ── Stat bar ─────────────────────────────────────── */
.stat-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
  padding: 1rem 2rem;
  border-radius: 20px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.12);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-item-status {
  flex-direction: row;
  gap: 0.5rem;
}

.stat-number {
  font-size: 1.6rem;
  font-weight: 700;
  color: #f3f6fb;
  line-height: 1;
}

.stat-number-warn {
  color: #fbbf24;
}

.stat-label {
  font-size: 0.72rem;
  color: rgba(243, 246, 251, 0.42);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.stat-sep {
  width: 1px;
  height: 32px;
  background: rgba(159, 209, 255, 0.1);
  flex-shrink: 0;
}

.status-indicator {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-online {
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.55);
}

.status-offline {
  background: #f87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.5);
}

/* ── Module navigation ────────────────────────────── */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.95rem 1.1rem;
  border-radius: 18px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.12);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.module-card:hover {
  transform: translateX(3px);
  border-color: rgba(159, 209, 255, 0.28);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.module-card-wide {
  grid-column: 1 / -1;
}

.mod-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--b);
  color: var(--c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mod-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.mod-text strong {
  font-size: 0.92rem;
  font-weight: 600;
  color: #f3f6fb;
  display: block;
}

.mod-text em {
  font-size: 0.78rem;
  font-style: normal;
  color: rgba(243, 246, 251, 0.46);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mod-chevron {
  color: rgba(159, 209, 255, 0.3);
  font-size: 1.5rem;
  font-weight: 200;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.18s, transform 0.18s;
}

.module-card:hover .mod-chevron {
  color: rgba(159, 209, 255, 0.7);
  transform: translateX(2px);
}

/* ── Form card ────────────────────────────────────── */
.form-card {
  padding: 1.5rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.form-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(159, 209, 255, 0.08);
  text-align: left;
}

.form-header-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 14px;
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f3f6fb;
}

.form-card-desc {
  margin: 0.25rem 0 0;
  font-size: 0.83rem;
  color: rgba(243, 246, 251, 0.48);
}

/* ── Offline banner ───────────────────────────────── */
.offline-banner {
  margin-bottom: 1.25rem;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  text-align: left;
  background: rgba(8, 17, 29, 0.6);
  border: 1px solid rgba(159, 209, 255, 0.1);
}

.offline-banner strong {
  color: #f3f6fb;
  font-size: 0.9rem;
}

.offline-banner p {
  margin: 0.3rem 0 0;
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.84rem;
}

.offline-banner-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(71, 39, 5, 0.38);
}

.sync-button {
  min-width: 130px;
  flex-shrink: 0;
}

/* ── Form ─────────────────────────────────────────── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

label {
  margin-bottom: 0.35rem;
  font-size: 0.84rem;
  font-weight: 500;
  color: rgba(243, 246, 251, 0.75);
}

input {
  padding: 0.8rem 1rem;
  width: 100%;
  color: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.97);
  box-sizing: border-box;
  font-size: 0.95rem;
  font-family: inherit;
}

.input-error {
  border-color: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.14);
}

.field-error {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #ffb4b4;
}

/* ── Buttons ──────────────────────────────────────── */
button {
  font-family: inherit;
}

.btn {
  min-height: 48px;
  padding: 0.8rem 1.35rem;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 14px;
  border: none;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  white-space: nowrap;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-geo {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #93c5fd;
}

.btn-geo:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.55);
}

.btn-save {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(11, 87, 208, 0.28);
}

.btn-save:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d95f5 0%, #0a4cb8 100%);
  box-shadow: 0 6px 20px rgba(11, 87, 208, 0.4);
}

.btn-query {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.28);
  color: #c4b5fd;
}

.btn-query:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.5);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.18);
  color: #9fd1ff;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(159, 209, 255, 0.32);
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  justify-content: center;
  margin-top: 1.25rem;
}

/* ── Validation / Response cards ──────────────────── */
.validation-card {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  text-align: left;
  color: #ffe0b2;
  background: rgba(120, 53, 15, 0.3);
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.validation-card ul,
.response-list {
  margin: 0.7rem 0 0;
  padding-left: 1.2rem;
}

.response-card {
  margin-top: 1rem;
  padding: 1.1rem 1.25rem;
  border-radius: 20px;
  text-align: left;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(10, 20, 36, 0.7);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.response-message {
  margin: 0.5rem 0 0;
  line-height: 1.5;
  font-size: 0.93rem;
}

.response-card-error {
  color: #ffb4b4;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(86, 26, 26, 0.45);
}

.response-card-success {
  color: #8df0b4;
  border-color: rgba(42, 181, 125, 0.25);
  background: rgba(22, 52, 36, 0.45);
}

.response-card-info {
  color: #a8d0ff;
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(20, 44, 82, 0.42);
}

.maps-link-row {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

.maps-link {
  color: #8dc7ff;
  font-size: 0.9rem;
}

.maps-link-input {
  color: #1f2937;
}

.maps-copy-button {
  width: 100%;
}

.maps-feedback {
  margin: 0.75rem 0 0;
  color: #8df0b4;
  font-size: 0.88rem;
}

/* ── Chain / Cadenas section ──────────────────────── */
.cadena-toggle-row {
  margin-top: 1.25rem;
  display: flex;
  justify-content: center;
}

.cadena-toggle-btn {
  min-height: auto;
  padding: 0.45rem 1.1rem;
  font-size: 0.84rem;
  font-weight: 600;
  border-radius: 100px;
  border: 1px solid rgba(159, 209, 255, 0.2);
  background: rgba(69, 167, 255, 0.07);
  color: #9fd1ff;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.cadena-toggle-btn:hover {
  background: rgba(69, 167, 255, 0.14);
}

.cadena-section {
  margin-top: 1rem;
  padding: 1.1rem;
  border-radius: 16px;
  border: 1px dashed rgba(159, 209, 255, 0.18);
  background: rgba(69, 167, 255, 0.04);
  display: grid;
  gap: 0.9rem;
}

.cadena-desc {
  margin: 0;
  color: rgba(243, 246, 251, 0.6);
  font-size: 0.87rem;
}

.cadena-search-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cadena-input {
  flex: 1 1 160px;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.97);
  color: #1f2937;
  font-size: 0.93rem;
  box-sizing: border-box;
  font-family: inherit;
}

.cadena-search-btn {
  min-height: 44px;
  white-space: nowrap;
}

.cadena-result {
  display: grid;
  gap: 0.85rem;
}

.cadena-result-title {
  margin: 0;
  color: #f3f6fb;
  font-size: 0.93rem;
}

.sedes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.sede-chip {
  display: grid;
  gap: 0.2rem;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.18);
  text-decoration: none;
  color: #f3f6fb;
  font-size: 0.86rem;
  transition: background 0.15s;
}

.sede-chip:hover {
  background: rgba(69, 167, 255, 0.14);
}

.sede-chip span {
  color: rgba(243, 246, 251, 0.55);
  font-size: 0.76rem;
}

.nueva-sede-form {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.nueva-sede-label {
  margin: 0;
  color: rgba(243, 246, 251, 0.75);
  font-size: 0.88rem;
}

.nueva-sede-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0.6rem;
}

.sede-feedback {
  margin: 0;
  font-size: 0.88rem;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
}

.sede-feedback-ok {
  color: #8df0b4;
  background: rgba(22, 52, 36, 0.45);
}

.sede-feedback-err {
  color: #ffb4b4;
  background: rgba(86, 26, 26, 0.35);
}

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 600px) {
  .home-page {
    padding: 1.25rem 0.85rem 2rem;
  }

  .stat-bar {
    gap: 1.2rem;
    padding: 0.9rem 1.2rem;
  }

  .stat-hide-sm {
    display: none;
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }

  .module-card-wide {
    grid-column: auto;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .offline-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .button-group {
    flex-direction: column;
    gap: 0.7rem;
  }

  .btn {
    width: 100%;
  }

  .sync-button {
    min-width: 0;
  }

  .nueva-sede-grid {
    grid-template-columns: 1fr;
  }

  .cadena-search-row {
    flex-direction: column;
  }
}
</style>