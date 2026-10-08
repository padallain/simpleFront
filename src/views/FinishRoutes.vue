<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import TransportTripEditor from '../components/TransportTripEditor.vue';
import { transportRequest, usd } from '../services/transportApi';

const route = useRoute();
const routes = ref([]);
const status = ref('active');
const search = ref('');
const loading = ref(false);
const error = ref('');
const selectedRouteId = ref(String(route.query.routeId || ''));
const selectedLabel = ref('');
const visibleRoutes = computed(() => {
  const query = search.value.trim().toLowerCase();
  return routes.value.filter(item => [item.routeLabel, item._id, item.driverId, item.driverName, item.loadGuide?.number].some(value => String(value || '').toLowerCase().includes(query)));
});
async function load() {
  loading.value = true; error.value = '';
  try { routes.value = (await transportRequest(`/routes-to-finish?status=${status.value}`)).routes; }
  catch (failure) { error.value = failure.message; }
  finally { loading.value = false; }
}
function select(item) {
  selectedRouteId.value = item._id;
  selectedLabel.value = item.loadGuide?.number || item.routeLabel;
}
onMounted(load);
</script>

<template>
  <main class="finish-page">
    <header class="finish-heading"><div><p>Operaciones</p><h1>Terminar ruta</h1></div><router-link to="/transport-kpis">KPIs de transporte</router-link></header>
    <form class="finish-filters" @submit.prevent="load">
      <label>Estado<select v-model="status" @change="load"><option value="active">En curso</option><option value="completed">Terminadas</option><option value="all">Todas</option></select></label>
      <label>Guia, folio o chofer<input v-model="search" type="search" /></label>
      <button type="submit" :disabled="loading"><i class="mdi mdi-refresh" aria-hidden="true" /> Actualizar</button>
    </form>
    <p v-if="error" role="alert" class="finish-error">{{ error }}</p>
    <p v-if="routes.length === 500">Listado limitado a las 500 rutas mas recientes.</p>
    <div class="finish-table"><table><thead><tr><th>Fecha / guia</th><th>Chofer</th><th>Pedidos</th><th>Cargado ($)</th><th>Devuelto ($)</th><th>Ruta</th><th>Liquidacion</th><th></th></tr></thead><tbody>
      <tr v-for="item in visibleRoutes" :key="item._id"><td>{{ item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }) : 'Sin fecha' }}<small>{{ item.loadGuide?.number || item.routeLabel }}</small></td><td>{{ item.driverName || item.driverId }}</td><td>{{ item.loadGuide?.orders?.length ?? 'Sin guia' }}</td><td>{{ usd(item.trip?.loadedAmount ?? item.loadGuide?.totalAmount) }}</td><td>{{ usd(item.trip?.returnedAmount) }}</td><td>{{ item.status === 'completed' ? 'Terminada' : 'En curso' }}</td><td>{{ item.trip?.status === 'closed' ? 'Cerrada' : item.trip ? 'Borrador' : 'Pendiente' }}</td><td><button :disabled="!item.loadGuide?.orders?.length" @click="select(item)"><i class="mdi mdi-clipboard-check-outline" aria-hidden="true" /> {{ item.trip?.status === 'closed' ? 'Ver liquidacion' : 'Liquidar viaje' }}</button></td></tr>
    </tbody></table></div>
    <p v-if="!loading && !visibleRoutes.length">No hay rutas en este listado.</p>
    <section v-if="selectedRouteId" class="finish-detail"><div class="finish-heading"><h2>{{ selectedLabel || 'Liquidacion seleccionada' }}</h2><button aria-label="Cerrar detalle" title="Cerrar detalle" @click="selectedRouteId = ''"><i class="mdi mdi-close" aria-hidden="true" /></button></div><TransportTripEditor :key="selectedRouteId" :route-id="selectedRouteId" settlement-mode @saved="load" /></section>
  </main>
</template>

<style scoped>
.finish-page { max-width: 1400px; padding: 24px; margin: 0 auto; color: #f3f6fb; }
.finish-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.finish-heading p { color: #a7d6dd; font-size: 13px; margin: 0; } h1 { font-size: 28px; margin: 6px 0 20px; } h2 { font-size: 19px; } a { color: #9fd1ff; }
.finish-filters { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 20px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; min-width: 0; flex: 1 1 200px; }
input, select { width: 100%; min-width: 0; padding: 9px; min-height: 42px; border: 1px solid #a8bcc5; border-radius: 4px; color: #17343d; background: #fff; font: inherit; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border-radius: 4px; border: 1px solid #628692; color: #fff; background: #205e6d; font: inherit; cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
.finish-table { overflow-x: auto; width: 100%; } table { width: 100%; min-width: 950px; border-collapse: collapse; }
th, td { text-align: left; font-size: 13px; padding: 12px 10px; border-bottom: 1px solid #37535f; } th { background: #163341; color: #bad0d9; }
small { display: block; color: #bed0d8; font-size: 11px; margin-top: 5px; overflow-wrap: anywhere; }
.finish-detail { margin-top: 24px; } .finish-error { color: #ffb4bd; }
@media (max-width: 600px) { .finish-page { padding: 16px 12px; } h1 { font-size: 24px; } }
</style>