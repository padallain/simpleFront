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
const serverResponse = ref(""); // Variable para almacenar la respuesta del servidor
const clientData = ref(null);
const homeFeedback = ref("");

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
      },
      (error) => {
        console.error("Error obteniendo la geolocalización:", error);
      }
    );
  } else {
    console.error("La geolocalización no es soportada por este navegador.");
  }
};

const saveClient = async () => {
  const clientData = {
    id: numberInput.value.toString(),
    nombre: textInput.value,
    latitude: parseFloat(latitude.value),
    longitude: parseFloat(longitude.value),
    start,
    end,
  };

  try {
    const response = await fetch(
      `${API_BASE_URL}/registerClient`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clientData),
      }
    );

    const result = await response.json().catch(() => null);

    if (response.ok) {
      serverResponse.value = result;
      window.location.reload();
    } else {
      // Si el backend manda un mensaje, lo mostramos, si no, mostramos el statusText
      serverResponse.value = result?.message
        ? { error: result.message }
        : { error: response.statusText };
    }
  } catch (error) {
    serverResponse.value = { error: error.message };
  }
  console.log(serverResponse.value);
};


const getClientAddress = async () => {
  const clientId = numberInput.value.toString();
  homeFeedback.value = "";

  try {
    const response = await fetch(
      `${API_BASE_URL}/getClient/${clientId}`,
      {
        method: "GET",
      }
    );

    if (response.ok) {
      const result = await response.json();
      clientData.value = result;
    } else {
      clientData.value = {
        error: `Error al obtener la dirección: ${response.statusText}`,
      };
    }
  } catch (error) {
    clientData.value = { error: `Error en la solicitud: ${error.message}` };
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
            <input id="latitude" type="text" v-model="latitude" readonly />
          </div>
          <div class="form-group">
            <label for="longitude">Longitud:</label>
            <input id="longitude" type="text" v-model="longitude" readonly />
          </div>
          <div class="form-group">
            <label for="numberInput">ID del cliente:</label>
            <input id="numberInput" type="number" v-model="numberInput" />
          </div>
          <div class="form-group">
            <label for="textInput">Nombre del cliente:</label>
            <input id="textInput" type="text" v-model="textInput" />
          </div>
        </div>

        <div class="button-group">
      <button class="geo-btn" @click="getGeolocation">Obtener Geolocalización</button>
      <button class="save-btn" @click="saveClient">Guardar Cliente</button>
      <button class="address-btn" @click="getClientAddress">Obtener Dirección del Cliente</button>
        </div>
      </div>

      <div v-if="serverResponse" class="response-card response-card-error">
        <strong>Respuesta del servidor:</strong>
        <pre>{{ typeof serverResponse === 'string' ? serverResponse : JSON.stringify(serverResponse, null, 2) }}</pre>
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

.response-card {
  margin-top: 1rem;
  padding: 1rem 1.2rem;
  text-align: left;
}

.response-card pre {
  margin: 0.75rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}

.response-card-error {
  color: #ffb4b4;
}

.response-card-info {
  color: #a8d0ff;
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