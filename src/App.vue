<script setup>
import { ref } from 'vue'

const latitude = ref('')
const longitude = ref('')
const numberInput = ref(0)
const textInput = ref('')
const start = '08:00:00'
const end = '17:00:00'
const serverResponse = ref('') // Variable para almacenar la respuesta del servidor

const getGeolocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude.value = position.coords.latitude
        longitude.value = position.coords.longitude
      },
      (error) => {
        console.error('Error obteniendo la geolocalización:', error)
      }
    )
  } else {
    console.error('La geolocalización no es soportada por este navegador.')
  }
}

const saveClient = async () => {
  const clientData = {
    id: numberInput.value.toString(),
    nombre: textInput.value,
    latitude: parseFloat(latitude.value),
    longitude: parseFloat(longitude.value),
    start,
    end,
  }

  try {
    const response = await fetch('https://testingclient.onrender.com/saveClient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    })

    if (response.ok) {
      const result = await response.json()
      serverResponse.value = `Cliente guardado con éxito: ${JSON.stringify(result)}`
    } else {
      serverResponse.value = `Error al guardar el cliente: ${response.statusText}`
    }
  } catch (error) {
    serverResponse.value = `Error en la solicitud: ${error.message}`
  }
}
</script>

<template>
  <div id="app">
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
    <div v-if="serverResponse" style="margin-top: 1rem; color: green;">
      <strong>Respuesta del servidor:</strong> {{ serverResponse }}
    </div>
  </div>
</template>

<style scoped>
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
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  margin: 0.5rem;
}
</style>