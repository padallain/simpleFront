<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const route = useRoute();
const router = useRouter();

const latitude = ref("");
const clientCount = ref(0)
const longitude = ref("");
const numberInput = ref(0);
const textInput = ref("");
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

  fetchClientCount();
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
    latitude: parseFloat(latitude.value),
    longitude: parseFloat(longitude.value),
    start,
    end,
  };

  isSaving.value = true;

  try {
    const response = await fetch(
      `${API_BASE_URL}/registerClient`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await parseJsonResponse(response);

    if (response.ok) {
      setServerResponse(
        "success",
        "Cliente guardado",
        translateServerMessage(result?.message, "El cliente se guardo correctamente."),
      );
      clientData.value = null;
      formErrors.value = [];
        resetFieldErrors();
      homeFeedback.value = "";
      await fetchClientCount();
    } else {
      setServerResponse(
        "error",
        "No se pudo guardar el cliente",
        translateServerMessage(result?.message, "Ocurrio un problema al guardar el cliente."),
      );
    }
  } catch (error) {
    setServerResponse(
      "error",
      "Sin conexion con el servidor",
      error.message || "No fue posible comunicarse con el servidor.",
    );
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
      setServerResponse(
        "info",
        "Cliente encontrado",
        `Se cargaron los datos del cliente ${clientId.trim()}.`,
      );
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

</script>

<template>
  <section class="home-page">
    <div class="home-container">
      <div class="home-hero">
        <p class="home-kicker">Registro de clientes</p>
        <h1 class="home-title">Geolocalización y alta de clientes</h1>
        <p class="home-subtitle">Captura ubicación, registra clientes y consulta la dirección guardada desde una sola pantalla.</p>
      </div>

      <div class="home-stats">
        <div class="count-card">
          <span class="count-label">Clientes marcados</span>
          <strong class="countClient">{{ clientCount }}</strong>
        </div>
        <div class="count-card shortcut-card">
          <span class="count-label">Denuncias publicas</span>
          <strong class="shortcut-title">Ver lista</strong>
          <button class="shortcut-button" @click="goToClientLocationReports">Abrir denuncias</button>
        </div>
        <div class="count-card shortcut-card">
          <span class="count-label">CRUD de rutas</span>
          <strong class="shortcut-title">Administrar</strong>
          <button class="shortcut-button" @click="goToRouteManagement">Abrir rutas</button>
        </div>
        <div class="count-card shortcut-card">
          <span class="count-label">Chequeos de camiones</span>
          <strong class="shortcut-title">Historial</strong>
          <button class="shortcut-button" @click="goToDailyCheckHistory">Abrir historial</button>
        </div>
        <div class="count-card shortcut-card">
          <span class="count-label">Despachos</span>
          <strong class="shortcut-title">Estatus</strong>
          <button class="shortcut-button" @click="goToDispatchStatus">Ver rutas</button>
        </div>
      </div>

      <div class="form-card">
        <div class="form-grid">
          <div class="form-group">
            <label for="latitude">Latitud:</label>
            <input id="latitude" :class="{ 'input-error': fieldErrors.latitude }" type="text" v-model="latitude" readonly />
            <p v-if="fieldErrors.latitude" class="field-error">{{ fieldErrors.latitude }}</p>
          </div>
          <div class="form-group">
            <label for="longitude">Longitud:</label>
            <input id="longitude" :class="{ 'input-error': fieldErrors.longitude }" type="text" v-model="longitude" readonly />
            <p v-if="fieldErrors.longitude" class="field-error">{{ fieldErrors.longitude }}</p>
          </div>
          <div class="form-group">
            <label for="numberInput">ID del cliente:</label>
            <input id="numberInput" :class="{ 'input-error': fieldErrors.clientId }" type="number" v-model="numberInput" min="1" @input="clearFieldError('clientId')" />
            <p v-if="fieldErrors.clientId" class="field-error">{{ fieldErrors.clientId }}</p>
          </div>
          <div class="form-group">
            <label for="textInput">Nombre del cliente:</label>
            <input id="textInput" :class="{ 'input-error': fieldErrors.clientName }" type="text" v-model="textInput" maxlength="80" @input="clearFieldError('clientName')" />
            <p v-if="fieldErrors.clientName" class="field-error">{{ fieldErrors.clientName }}</p>
          </div>
        </div>

        <div v-if="formErrors.length" class="validation-card">
          <strong>Corrige esto antes de continuar:</strong>
          <ul>
            <li v-for="error in formErrors" :key="error">{{ error }}</li>
          </ul>
        </div>

        <div class="button-group">
      <button class="geo-btn" @click="getGeolocation">Obtener Geolocalización</button>
      <button class="save-btn" :disabled="isSaving" @click="saveClient">{{ isSaving ? "Guardando..." : "Guardar Cliente" }}</button>
      <button class="address-btn" :disabled="isFetchingClient" @click="getClientAddress">{{ isFetchingClient ? "Consultando..." : "Obtener Dirección del Cliente" }}</button>
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
          <button class="shortcut-button maps-copy-button" @click="copyMapsLink">Copiar link</button>
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
  padding: 0;
  text-align: center;
}

.home-hero {
  margin-bottom: 1.5rem;
}

.home-kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.home-title {
  margin: 0;
  color: #f3f6fb;
  font-size: clamp(2rem, 5vw, 3.1rem);
}

.home-subtitle {
  max-width: 720px;
  margin: 0.9rem auto 0;
  color: rgba(243, 246, 251, 0.76);
}

.home-stats {
  margin-bottom: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.count-card,
.form-card,
.response-card {
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.count-card {
  padding: 1rem 1.2rem;
}

.shortcut-card {
  display: grid;
  gap: 0.55rem;
  align-content: center;
}

.count-label {
  display: block;
  color: rgba(243, 246, 251, 0.72);
}

.countClient {
  display: block;
  margin-top: 0.45rem;
  color: #f3f6fb;
  font-size: 2rem;
}

.shortcut-title {
  display: block;
  color: #f3f6fb;
  font-size: 1.35rem;
}

.shortcut-button {
  width: 100%;
}

.form-card {
  padding: 1.2rem;
}

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
  margin-bottom: 0.3rem;
  font-weight: 500;
  color: #f3f6fb;
}

input {
  padding: 0.85rem 1rem;
  width: 100%;
  max-width: none;
  color: #333;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-sizing: border-box;
}

.input-error {
  border-color: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.16);
}

.field-error {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  color: #ffb4b4;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.25rem;
}

button,
.geo-btn,
.save-btn,
.address-btn {
  min-height: 50px;
  padding: 0.85rem 1.4rem;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 16px;
  border: none;
  font-weight: 600;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
  transition: background 0.2s, color 0.2s;
}

button:hover,
.geo-btn:hover,
.save-btn:hover,
.address-btn:hover {
  background: linear-gradient(135deg, #2d95f5 0%, #0a4cb8 100%);
}

button:disabled,
.geo-btn:disabled,
.save-btn:disabled,
.address-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.validation-card {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  text-align: left;
  color: #ffe0b2;
  background: rgba(120, 53, 15, 0.34);
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.validation-card ul,
.response-list {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
}

.response-card {
  margin-top: 1rem;
  padding: 1rem 1.2rem;
  text-align: left;
}

.response-message {
  margin: 0.5rem 0 0;
  line-height: 1.5;
}

.response-card-error {
  color: #ffb4b4;
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(86, 26, 26, 0.45);
}

.response-card-success {
  color: #8df0b4;
  border-color: rgba(42, 181, 125, 0.28);
  background: rgba(22, 52, 36, 0.45);
}

.response-card-info {
  color: #a8d0ff;
  border-color: rgba(96, 165, 250, 0.32);
  background: rgba(20, 44, 82, 0.42);
}

.maps-link-row {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

.maps-link {
  color: #8dc7ff;
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
}

@media (max-width: 600px) {
  .home-page {
    padding: 1rem 0.75rem 2rem;
  }

  .home-stats {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .button-group {
    flex-direction: column;
    gap: 0.7rem;
  }

  button,
  .geo-btn,
  .save-btn,
  .address-btn {
    width: 100%;
  }
}
</style>