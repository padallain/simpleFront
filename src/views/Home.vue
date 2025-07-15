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
  <div id="app">
     <h1 class="countClient">Clientes marcados: {{ clientCount }}</h1>

    <h1>Geolocalización</h1>
    <div>
      <label for="latitude">Latitud:</label>
      <input id="latitude" type="text" v-model="latitude" readonly />
    </div>
    <div>
      <label for="longitude">Longitud:</label>
      <input id="longitude" type="text" v-model="longitude" readonly />
    </div>
    <div>
      <label for="numberInput">Número:</label>
      <input id="numberInput" type="number" v-model="numberInput" />
    </div>
    <div>
      <label for="textInput">Texto:</label>
      <input id="textInput" type="text" v-model="textInput" />
    </div>
    <button @click="getGeolocation">Obtener Geolocalización</button>
    <button @click="saveClient">Guardar Cliente</button>
    <button @click="getClientAddress">Obtener Dirección del Cliente</button>
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
.countClient{
  margin-bottom: 6rem;
}

#app {
  text-align: center;
  margin-top: 2rem;
}

label {
  margin-right: 0.5rem;
}

input {
  margin-bottom: 1rem;
  padding: 0.5rem;
  width: 200px;
  color: white;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  margin: 0.5rem;
}
</style>
