<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { AUTH_ROUTE_PATHS, fetchSession, getAuthState, logoutSession } from './services/auth'

const router = useRouter()
const route = useRoute()

const PAGE_TITLES = {
  '/routes': 'Crear Ruta',
  '/daily-check': 'Chequeo Diario',
  '/fuel-report': 'Reporte Combustible',
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
  '/admin-users': 'Usuarios Admin',
  '/notifications': 'Notificaciones',
}

const currentPageTitle = computed(() => PAGE_TITLES[route.path] ?? '')
const showTopNav = computed(() => !AUTH_ROUTE_PATHS.has(route.path))
const isLoggingOut = ref(false)
const isBootstrapping = ref(true)
const authUser = ref(getAuthState().user || null)
const expandedSection = ref(null)
const isAdminUser = computed(() => Boolean(authUser.value?.isAdmin))
const isDriverUser = computed(() => String(authUser.value?.role || '').toLowerCase() === 'chofer')
const isWarehouseUser = computed(() => String(authUser.value?.role || '').toLowerCase() === 'almacenista')

function toggleSection(sectionKey) {
  expandedSection.value = expandedSection.value === sectionKey ? null : sectionKey
}

function goToHome()                    { router.push('/') }
function goToRoutes()                  { router.push('/routes') }
function goToDailyCheck()              { router.push('/daily-check') }
function goToFuelReport()              { router.push('/fuel-report') }
function goToDriverRoute()             { router.push('/driver-route') }
function goToClientReport()            { router.push('/report-client-location') }
function goToClientLocationReports()   { router.push('/client-location-reports') }
function goToDriverAnalytics()         { router.push('/driver-analytics') }
function goToWarehousePickerAnalytics(){ router.push('/warehouse-picker-analytics') }
function goToWarehousePicking()        { router.push('/warehouse-picking') }
function goToDispatchControl()         { router.push('/dispatch-control') }
function goToVehicleMaintenance()      { router.push('/vehicle-maintenance-history') }
function goToFleetConsumption()         { router.push('/fleet-consumption') }
function goToAdminUsers()              { router.push('/admin-users') }
function goToNotifications()           { router.push('/notifications') }

function goToDefaultLanding() {
  if (isWarehouseUser.value) {
    router.push('/warehouse-picking')
    return
  }

  router.push('/')
}

async function handleLogout() {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true

  try {
    await logoutSession()
  } finally {
    isLoggingOut.value = false
    router.replace({ path: '/login', query: { reason: 'signed-out' } })
  }
}

async function refreshAuthUser() {
  try {
    const sessionState = await fetchSession({ force: true })
    authUser.value = sessionState.user || null
  } catch (_error) {
    authUser.value = null
  }
}

onMounted(async () => {
  try {
    await fetchSession()
    const sessionState = getAuthState()
    authUser.value = sessionState.user || null
  } finally {
    isBootstrapping.value = false
  }
})

watch(() => route.fullPath, () => {
  refreshAuthUser()
  expandedSection.value = null
})

</script>

<template>
  <div class="app-shell">
    <div v-if="isBootstrapping" class="app-bootstrap-loader" role="status" aria-live="polite" aria-busy="true">
      <div class="app-bootstrap-card">
        <div class="app-bootstrap-brand">
          <span class="brand-mark">MR</span>
          <span class="brand-name">MakeRoute</span>
        </div>
        <div class="app-bootstrap-spinner" aria-hidden="true"></div>
        <p>Cargando sesión...</p>
      </div>
    </div>

    <nav v-if="!isBootstrapping && showTopNav" class="top-nav">
      <!-- Brand mark — always links to home -->
      <button class="nav-brand" type="button" @click="goToDefaultLanding" aria-label="Ir al inicio">
        <span class="brand-mark">MR</span>
        <span class="brand-name">MakeRoute</span>
      </button>

      <!-- Home: section dropdown navigation -->
      <div v-if="route.path === '/'" class="nav-modules" role="navigation">
        <div class="nav-group">
          <button class="nav-section-toggle" :class="{ active: expandedSection === 'operacion' }" type="button" @click="toggleSection('operacion')">
            Operación
            <span class="nav-section-caret">▾</span>
          </button>

          <div v-if="expandedSection === 'operacion'" class="nav-section-panel">
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToRoutes">Crear Ruta</button>
            <button class="nav-chip" type="button" @click="goToDailyCheck">Chequeo diario</button>
            <button class="nav-chip" type="button" @click="goToFuelReport">Combustible</button>
            <button class="nav-chip" type="button" @click="goToDriverRoute">Mi ruta</button>
          </div>
        </div>

        <div class="nav-group">
          <button class="nav-section-toggle" :class="{ active: expandedSection === 'logistica' }" type="button" @click="toggleSection('logistica')">
            Logística
            <span class="nav-section-caret">▾</span>
          </button>

          <div v-if="expandedSection === 'logistica'" class="nav-section-panel">
            <button v-if="isAdminUser || isWarehouseUser" class="nav-chip" type="button" @click="goToWarehousePicking">Picking</button>
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToClientReport">Reportar cliente</button>
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToClientLocationReports">Denuncias</button>
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToDispatchControl">Dispatch control</button>
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToVehicleMaintenance">Mantenimiento</button>
            <button v-if="isAdminUser" class="nav-chip" type="button" @click="goToFleetConsumption">Mi flota</button>
          </div>
        </div>

        <div v-if="isAdminUser" class="nav-group">
          <button class="nav-section-toggle" :class="{ active: expandedSection === 'administracion' }" type="button" @click="toggleSection('administracion')">
            Administración
            <span class="nav-section-caret">▾</span>
          </button>

          <div v-if="expandedSection === 'administracion'" class="nav-section-panel">
            <button class="nav-chip" type="button" @click="goToDriverAnalytics">Análisis choferes</button>
            <button class="nav-chip" type="button" @click="goToWarehousePickerAnalytics">Análisis almacenistas</button>
            <button class="nav-chip" type="button" @click="goToNotifications">Notificaciones</button>
            <button class="nav-chip" type="button" @click="goToAdminUsers">Usuarios admin</button>
          </div>
        </div>
      </div>

      <!-- Other pages: back button + page title -->
      <div v-else class="nav-back-row">
        <button class="nav-back" type="button" @click="goToDefaultLanding">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Inicio
        </button>
        <span v-if="currentPageTitle" class="nav-page-title">{{ currentPageTitle }}</span>
      </div>

      <div class="nav-actions">
        <button class="nav-logout" type="button" :disabled="isLoggingOut" @click="handleLogout">
          {{ isLoggingOut ? 'Saliendo...' : 'Cerrar sesion' }}
        </button>
      </div>
    </nav>

    <router-view v-if="!isBootstrapping" />
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
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 1.25rem;
  min-height: 56px;
  background: rgba(8, 15, 28, 0.9);
  border-bottom: 1px solid rgba(159, 209, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex-wrap: wrap;
  overflow: visible;
  isolation: isolate;
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
  flex: 1 1 auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.8rem;
  overflow: visible;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.1rem 0;
  min-width: 0;
  position: relative;
  z-index: 20;
  flex-wrap: nowrap;
}

.nav-modules::-webkit-scrollbar {
  display: none;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  position: relative;
  z-index: 2;
}

.nav-section-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #e2ecff;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.nav-section-toggle.active {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.4);
  color: #dbeafe;
}

.nav-section-caret {
  font-size: 0.7rem;
  opacity: 0.8;
}

.nav-section-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  min-width: min(62vw, 260px);
  width: max-content;
  max-width: min(62vw, 260px);
  padding: 0.6rem;
  border-radius: 14px;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(7, 17, 29, 0.96);
  box-shadow: 0 18px 28px rgba(0, 0, 0, 0.22);
  z-index: 40;
  pointer-events: auto;
}

.nav-chip {
  width: 100%;
  text-align: left;
  padding: 0.46rem 0.7rem;
  border-radius: 10px;
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

.nav-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.nav-logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.nav-admin-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.5rem;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, 0.34);
  background: rgba(30, 64, 175, 0.24);
  color: #bfdbfe;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.nav-admin-link:hover {
  background: rgba(37, 99, 235, 0.32);
  border-color: rgba(147, 197, 253, 0.5);
}

.nav-logout:hover:enabled {
  background: rgba(185, 28, 28, 0.32);
  border-color: rgba(252, 165, 165, 0.44);
  color: #fee2e2;
}

.nav-logout:disabled {
  opacity: 0.7;
  cursor: wait;
}

.app-bootstrap-loader {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at top, rgba(96, 165, 250, 0.2), transparent 30%),
    linear-gradient(180deg, #07111d 0%, #0b1730 100%);
  color: rgba(243, 246, 251, 0.9);
}

.app-bootstrap-card {
  min-width: min(92vw, 260px);
  display: grid;
  place-items: center;
  gap: 0.8rem;
  padding: 1.4rem 1.2rem;
  border: 1px solid rgba(159, 209, 255, 0.16);
  border-radius: 22px;
  background: rgba(8, 15, 28, 0.8);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.28);
}

.app-bootstrap-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
}

.app-bootstrap-brand .brand-mark {
  width: 36px;
  height: 36px;
  font-size: 0.8rem;
}

.app-bootstrap-spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #8ec5ff;
  border-right-color: #60a5fa;
  animation: spin 0.8s linear infinite;
}

.app-bootstrap-card p {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(243, 246, 251, 0.8);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 480px) {
  .brand-name {
    display: none;
  }

  .top-nav {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem;
    row-gap: 0.55rem;
    min-height: 56px;
    padding: 0.55rem 0.85rem;
  }

  .nav-actions {
    margin-left: auto;
    flex-shrink: 0;
  }

  .nav-logout {
    white-space: nowrap;
  }

  .nav-modules,
  .nav-back-row {
    order: 3;
    flex: 1 1 100%;
    min-width: 0;
  }

  .nav-modules {
    padding-bottom: 0.15rem;
    gap: 0.5rem;
    mask-image: none;
    -webkit-mask-image: none;
  }

  .nav-chip {
    padding: 0.34rem 0.72rem;
    font-size: 0.78rem;
  }

  .nav-page-title {
    font-size: 0.82rem;
  }
}
</style>
