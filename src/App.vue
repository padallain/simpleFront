<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const PAGE_TITLES = {
  '/routes': 'Crear Ruta',
  '/daily-check': 'Chequeo Diario',
  '/driver-route': 'Mi Ruta',
  '/report-client-location': 'Reportar Cliente',
  '/client-location-reports': 'Denuncias',
  '/driver-analytics': 'Análisis Choferes',
  '/warehouse-picker-analytics': 'Análisis Almacenistas',
  '/dispatch-control': 'Dispatch Control',
  '/vehicle-maintenance-history': 'Mantenimiento',
  '/warehouse-picking': 'Picking',
  '/dispatch-status': 'Estatus Despachos',
  '/daily-check-history': 'Historial Chequeos',
  '/route-management': 'Gestión de Rutas',
}

const currentPageTitle = computed(() => PAGE_TITLES[route.path] ?? '')

function goToHome()                    { router.push('/') }
function goToRoutes()                  { router.push('/routes') }
function goToDailyCheck()              { router.push('/daily-check') }
function goToDriverRoute()             { router.push('/driver-route') }
function goToClientReport()            { router.push('/report-client-location') }
function goToClientLocationReports()   { router.push('/client-location-reports') }
function goToDriverAnalytics()         { router.push('/driver-analytics') }
function goToWarehousePickerAnalytics(){ router.push('/warehouse-picker-analytics') }
function goToDispatchControl()         { router.push('/dispatch-control') }
function goToVehicleMaintenance()      { router.push('/vehicle-maintenance-history') }
</script>

<template>
  <div class="app-shell">
    <nav class="top-nav">
      <!-- Brand mark — always links to home -->
      <button class="nav-brand" type="button" @click="goToHome" aria-label="Ir al inicio">
        <span class="brand-mark">MR</span>
        <span class="brand-name">MakeRoute</span>
      </button>

      <!-- Home: scrollable module chips -->
      <div v-if="route.path === '/'" class="nav-modules" role="navigation">
        <button class="nav-chip" type="button" @click="goToRoutes">Crear Ruta</button>
        <button class="nav-chip" type="button" @click="goToDailyCheck">Chequeo diario</button>
        <button class="nav-chip" type="button" @click="goToDriverRoute">Mi ruta</button>
        <button class="nav-chip" type="button" @click="goToClientReport">Reportar cliente</button>
        <button class="nav-chip" type="button" @click="goToClientLocationReports">Denuncias</button>
        <button class="nav-chip" type="button" @click="goToDriverAnalytics">Análisis choferes</button>
        <button class="nav-chip" type="button" @click="goToWarehousePickerAnalytics">Análisis almacenistas</button>
        <button class="nav-chip" type="button" @click="goToDispatchControl">Dispatch control</button>
        <button class="nav-chip" type="button" @click="goToVehicleMaintenance">Mantenimiento</button>
      </div>

      <!-- Other pages: back button + page title -->
      <div v-else class="nav-back-row">
        <button class="nav-back" type="button" @click="goToHome">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Inicio
        </button>
        <span v-if="currentPageTitle" class="nav-page-title">{{ currentPageTitle }}</span>
      </div>
    </nav>

    <router-view />
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────── */
.app-shell {
  min-height: 100vh;
  width: 100%;
}

/* ── Top nav ──────────────────────────────────────── */
.top-nav {
  position: sticky;
  top: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.25rem;
  height: 56px;
  background: rgba(8, 15, 28, 0.9);
  border-bottom: 1px solid rgba(159, 209, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* ── Brand ────────────────────────────────────────── */
.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  text-decoration: none;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, #45a7ff 0%, #6c3bff 100%);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.02em;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(69, 167, 255, 0.35);
}

.brand-name {
  font-size: 0.98rem;
  font-weight: 700;
  color: #f3f6fb;
  letter-spacing: -0.01em;
}

/* ── Module chips (home) ──────────────────────────── */
.nav-modules {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.2rem 0;
  mask-image: linear-gradient(to right, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%);
}

.nav-modules::-webkit-scrollbar {
  display: none;
}

.nav-chip {
  flex-shrink: 0;
  padding: 0.36rem 0.85rem;
  border-radius: 100px;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(243, 246, 251, 0.7);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.nav-chip:hover {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.38);
  color: #93c5fd;
}

.nav-chip:active {
  transform: scale(0.97);
}

/* ── Back row (inner pages) ───────────────────────── */
.nav-back-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  overflow: hidden;
}

.nav-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.36rem 0.85rem;
  border-radius: 100px;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: #9fd1ff;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.nav-back:hover {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.32);
}

.nav-page-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: rgba(243, 246, 251, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 480px) {
  .brand-name {
    display: none;
  }

  .top-nav {
    gap: 0.75rem;
    padding: 0 1rem;
  }
}
</style>
