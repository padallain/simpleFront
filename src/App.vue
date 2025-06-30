<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function goToRoutes() {
  router.push('/routes')
}
function goToHome() {
  router.push('/')
}

const latitude = ref('')
const longitude = ref('')
const numberInput = ref(0)
const textInput = ref('')
const start = '08:00:00'
const end = '17:00:00'
const serverResponse = ref('')
const clientData = ref(null)
const showCamera = ref(false)
const showRoutes = ref(false) // NUEVO: para alternar la vista




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




const paradaInput = ref('')
const paradas = ref([])

function agregarParada() {
  if (paradaInput.value.trim() !== '') {
    paradas.value.push(paradaInput.value.trim())
    paradaInput.value = ''
  }
}

function eliminarParada(idx) {
  paradas.value.splice(idx, 1)
}

</script>

<template>
  <div id="app">
    <template v-if="route.path === '/'">
      <button @click="goToRoutes" style="margin-bottom: 2rem;">
        Ir a Routes
      </button>
      
    </template>
    <template v-else-if="route.path === '/routes'">
      <button @click="goToHome" style="margin-bottom: 2rem;">
        Volver
      </button>
    </template>
    <router-view />
  </div>
</template>

  




  
    

 

    
      