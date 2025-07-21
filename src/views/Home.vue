<script setup>
import { ref , onMounted} from "vue";

const latitude = ref("");
const clientCount = ref(0)
const longitude = ref("");
const numberInput = ref(0);
const textInput = ref("");
const start = "08:00:00";
const end = "17:00:00";
const serverResponse = ref(""); // Variable para almacenar la respuesta del servidor
const clientData = ref(null);

const fetchClientCount = async () => {
  try {
    const response = await fetch("https://testingclient.onrender.com/countClients");
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
      "https://testingclient.onrender.com/registerClient",
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

  try {
    const response = await fetch(
      `https://testingclient.onrender.com/getClient/${clientId}`,
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





</script>

<template>
  <div id="app" class="home-container">
    <h1 class="countClient">Clientes marcados: {{ clientCount }}</h1>

    <h1>Geolocalización</h1>
    <div class="form-group">
      <label for="latitude">Latitud:</label>
      <input id="latitude" type="text" v-model="latitude" readonly />
    </div>
    <div class="form-group">
      <label for="longitude">Longitud:</label>
      <input id="longitude" type="text" v-model="longitude" readonly />
    </div>
    <div class="form-group">
      <label for="numberInput">Número:</label>
      <input id="numberInput" type="number" v-model="numberInput" />
    </div>
    <div class="form-group">
      <label for="textInput">Texto:</label>
      <input id="textInput" type="text" v-model="textInput" />
    </div>
    <div class="button-group">
      <button class="geo-btn" @click="getGeolocation">Obtener Geolocalización</button>
      <button class="save-btn" @click="saveClient">Guardar Cliente</button>
      <button class="address-btn" @click="getClientAddress">Obtener Dirección del Cliente</button>
    </div>
    <div v-if="serverResponse" style="margin-top: 1rem; color: red">
      <strong>Respuesta del servidor:</strong>
      <pre>{{ typeof serverResponse === 'string' ? serverResponse : JSON.stringify(serverResponse, null, 2) }}</pre>
    </div>
    <div v-if="clientData" style="margin-top: 1rem; color: blue">
      <strong>Datos del cliente:</strong>
      <pre>{{ typeof clientData === 'string' ? clientData : JSON.stringify(clientData, null, 2) }}</pre>
      <div v-if="clientData.googleMapsLink" style="margin-top: 1rem">
        <a
          :href="clientData.googleMapsLink"
          target="_blank"
          style="color: #646cff"
        >
          Ver ubicación en Google Maps
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem 1rem;
  text-align: center;
}

.countClient {
  margin-bottom: 2rem;
  font-size: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 1rem;
}

label {
  margin-bottom: 0.3rem;
  font-weight: 500;
  color: #fff; /* blanco */
}

input {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  width: 100%;
  max-width: 300px;
  color: #333;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #f9f9f9;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

button,
.geo-btn,
.save-btn,
.address-btn {
  padding: 0.7rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  background: #7c3aed; /* violeta */
  color: #fff;         /* texto blanco */
  transition: background 0.2s, color 0.2s;
}

button:hover,
.geo-btn:hover,
.save-btn:hover,
.address-btn:hover {
  background: #5b21b6; /* violeta oscuro */
}

@media (max-width: 600px) {
  .home-container {
    padding: 1rem 0.2rem;
  }
  .form-group {
    max-width: 100vw;
  }
  input {
    max-width: 100vw;
  }
  .button-group {
    flex-direction: column;
    gap: 0.7rem;
  }
}
</style>