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
</script>

<template>
  <div class="app-shell">
    <template v-if="route.path === '/'">
      <button @click="goToRoutes" class="top-nav-button">
        Ir a Routes
      </button>
    </template>
    <template v-else-if="route.path === '/routes'">
      <button @click="goToHome" class="top-nav-button">
        Volver
      </button>
    </template>
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  width: 100%;
}

.top-nav-button {
  margin: 2rem auto 0;
  display: block;
}
</style>

  




  
    

 

    
      