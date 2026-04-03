<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function goToRoutes() {
  router.push('/routes')
}
function goToHome() {
  router.push('/')
}

function goToDailyCheck() {
  router.push('/daily-check')
}

function goToDriverRoute() {
  router.push('/driver-route')
}

function goToClientReport() {
  router.push('/report-client-location')
}
</script>

<template>
  <div class="app-shell">
    <template v-if="route.path === '/'">
      <div class="top-nav-actions">
        <button @click="goToRoutes" class="top-nav-button">
          Crear Ruta
        </button>
        <button @click="goToDailyCheck" class="top-nav-button">
          Ir al chequeo diario
        </button>
        <button @click="goToDriverRoute" class="top-nav-button">
          Mi ruta
        </button>
        <button @click="goToClientReport" class="top-nav-button">
          Reportar cliente
        </button>
      </div>
    </template>
    <template v-else>
      <div class="top-nav-actions top-nav-actions-back">
        <button @click="goToHome" class="top-nav-button">
          Volver
        </button>
      </div>
    </template>
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  width: 100%;
}

.top-nav-actions {
  display: flex;
  justify-content: center;
  gap: 0.55rem;
  padding: 1rem 1rem 0;
  flex-wrap: wrap;
}

.top-nav-actions-back {
  justify-content: flex-start;
}

.top-nav-button {
  min-height: 38px;
  padding: 0.5rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(7, 18, 35, 0.52);
  color: #e9f2ff;
  font-weight: 600;
  font-size: 0.92rem;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(12px);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.top-nav-button:hover {
  background: rgba(20, 58, 112, 0.7);
  border-color: rgba(159, 209, 255, 0.3);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .top-nav-actions,
  .top-nav-actions-back {
    justify-content: center;
  }

  .top-nav-button {
    width: auto;
    min-width: 160px;
  }
}
</style>

  




  
    

 

    
      