<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import TransportTripEditor from '../components/TransportTripEditor.vue';
import TransportConfigurationEditor from '../components/TransportConfigurationEditor.vue';
import { transportRequest, downloadTransportExcel, usd, percent } from '../services/transportApi';

const route = useRoute();
const today = new Date(Date.now() - 4 * 3600000);
const monday = new Date(today); monday.setUTCDate(today.getUTCDate() - (today.getUTCDay() + 6) % 7);
const filters = reactive({ from: monday.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10),
  status: 'closed', vehicleId: '', driverId: '', zone: '', routeCode: '', carrierId: '', freightType: '', period: 'week', groupBy: 'vehicleId' });
const configuration = ref(null);
const records = ref([]);
const groups = ref([]);
const tab = ref('trips');
const busy = ref(false);
const error = ref('');
const navigationFeedback = ref('');
const editingRouteId = ref(String(route.query.routeId || ''));
const query = () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
const complete = computed(() => records.value.filter(record => record.metrics.cost !== null && record.metrics.netSales !== null));
const totalCost = computed(() => complete.value.reduce((sum, record) => sum + record.metrics.cost, 0));
const totalSales = computed(() => complete.value.reduce((sum, record) => sum + record.metrics.netSales, 0));
const excess = computed(() => complete.value.reduce((sum, record) => sum + record.metrics.excess, 0));
async function load() {
  busy.value = true; error.value = '';
  try {
    const params = new URLSearchParams(query());
    const [daily, summary] = await Promise.all([transportRequest(`/guides?${params}`), transportRequest(`/aggregates?${params}`)]);
    records.value = daily.records; groups.value = summary.groups;
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
async function openGroupTrips(group) {
  const from = group.period === 'month'
    ? `${group.period}-01`
    : group.period;
  let to = from;
  if (filters.period === 'week') {
    const end = new Date(`${from}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    to = end.toISOString().slice(0, 10);
  } else if (filters.period === 'month') {
    const end = new Date(`${from}T12:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    to = end.toISOString().slice(0, 10);
  }
  filters.from = from;
  filters.to = to;
  filters.status = 'all';
  for (const field of ['vehicleId', 'driverId', 'zone', 'routeCode', 'carrierId', 'freightType']) filters[field] = '';
  if (group.group !== 'Sin dato' && ['vehicleId', 'driverId', 'zone', 'routeCode', 'carrierId', 'freightType'].includes(filters.groupBy)) {
    filters[filters.groupBy] = group.group;
  }
  tab.value = 'trips';
  navigationFeedback.value = `Viajes del grupo ${group.group}, ${from} a ${to}. Los borradores tambien aparecen para completar sus parametros.`;
  await load();
}
async function download() {
  busy.value = true; error.value = '';
  try { await downloadTransportExcel(query()); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
onMounted(async () => {
  try { configuration.value = (await transportRequest('/configuration')).configuration; await load(); }
  catch (failure) { error.value = failure.message; }
});
</script>

<template>
  <main class="transport-page">
    <header class="page-heading"><div><p>PAD Distribucion</p><h1>KPIs de transporte</h1></div><router-link to="/routes"><i class="mdi mdi-map-marker-path" aria-hidden="true" /> Crear ruta</router-link></header>
    <nav class="view-tabs" aria-label="Vistas de transporte"><button v-for="[key, title] in [['trips','Viajes'],['summary','Resumen'],['comparison','Propio vs externo'],['config','Parametros']]" :key="key" :class="{ active: tab === key }" :aria-pressed="tab === key" @click="tab = key">{{ title }}</button></nav>
    <p v-if="error" role="alert" class="error-message">{{ error }}</p>
    <p v-if="navigationFeedback" role="status" class="navigation-feedback">{{ navigationFeedback }}</p>
    <TransportConfigurationEditor v-if="tab === 'config'" @saved="configuration = $event" />
    <template v-else>
      <form class="filter-grid" @submit.prevent="load">
        <label>Desde<input v-model="filters.from" type="date" required /></label><label>Hasta<input v-model="filters.to" type="date" required /></label>
        <label>Vehiculo<select v-model="filters.vehicleId"><option value="">Todos</option><option v-for="vehicle in configuration?.vehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate || vehicle.name }}</option></select></label>
        <label>Chofer (ID)<input v-model="filters.driverId" /></label><label>Zona<input v-model="filters.zone" /></label><label>Ruta comercial<input v-model="filters.routeCode" /></label>
        <label>Transportista<select v-model="filters.carrierId"><option value="">Todos</option><option v-for="carrier in configuration?.carriers" :key="carrier.id" :value="carrier.id">{{ carrier.name }}</option></select></label>
        <label>Tipo flete<select v-model="filters.freightType"><option value="">Todos</option><option value="interno">Interno</option><option value="externo">Externo</option></select></label>
        <label>Estado<select v-model="filters.status"><option value="closed">Cerrados</option><option value="draft">Borradores</option><option value="all">Todos</option></select></label>
        <label>Periodo<select v-model="filters.period"><option value="day">Dia</option><option value="week">Semana (lunes)</option><option value="month">Mes</option></select></label>
        <label>Agrupar por<select v-model="filters.groupBy"><option value="vehicleId">Vehiculo</option><option value="driverId">Chofer</option><option value="zone">Zona</option><option value="routeCode">Ruta</option><option value="carrierId">Transportista</option><option value="freightType">Tipo flete</option></select></label>
        <div class="filter-actions"><button type="submit" :disabled="busy"><i class="mdi mdi-filter-outline" aria-hidden="true" /> Consultar</button><button type="button" :disabled="busy" @click="download"><i class="mdi mdi-file-excel-outline" aria-hidden="true" /> Excel semanal</button></div>
      </form>
      <dl class="overview"><div><dt>Viajes</dt><dd>{{ records.length }}</dd></div><div><dt>Costo</dt><dd>{{ usd(totalCost) }}</dd></div><div><dt>Venta entregada</dt><dd>{{ usd(totalSales) }}</dd></div><div><dt>Flete ponderado</dt><dd>{{ percent(complete.length === records.length && totalSales > 0 ? totalCost / totalSales : null) }}</dd></div><div><dt>Sobrecosto</dt><dd>{{ usd(excess) }}</dd></div><div><dt>Incompletos</dt><dd>{{ records.length - complete.length }}</dd></div></dl>
      <div class="report-table">
        <table v-if="tab === 'trips'"><thead><tr><th>Fecha / guia</th><th>Vehiculo / chofer</th><th>Ruta / zona</th><th>Tipo / transportista</th><th>Venta neta</th><th>Monto viaje</th><th>Flete / venta</th><th>Ganancia estimada</th><th>Sobrecosto</th><th>Estado</th><th></th></tr></thead><tbody><tr v-for="record in records" :key="record.trip._id"><td>{{ record.trip.date }}<small>{{ record.trip.guideNumber }}</small></td><td>{{ record.trip.vehicleName }}<small>{{ record.trip.driverName || record.trip.driverId }}</small></td><td>{{ record.trip.routeCode }}<small>{{ record.trip.zone }}</small></td><td>{{ record.trip.freightType }}<small>{{ record.trip.carrierName }}</small></td><td>{{ usd(record.metrics.netSales) }}</td><td>{{ usd(record.metrics.cost) }}</td><td :class="`semaphore-${record.metrics.semaphore}`">{{ percent(record.metrics.freightRatio) }}<small>{{ record.metrics.semaphore }}</small></td><td>{{ usd(record.metrics.estimatedProfit) }}</td><td>{{ usd(record.metrics.excess) }}</td><td>{{ record.trip.status === 'closed' ? 'Cerrado' : 'Borrador' }}</td><td><button title="Detalle del viaje" aria-label="Detalle del viaje" @click="editingRouteId = record.trip.routeId"><i class="mdi mdi-pencil-outline" aria-hidden="true" /></button></td></tr></tbody></table>
        <table v-else-if="tab === 'summary'"><thead><tr><th>Periodo</th><th>Grupo</th><th>Viajes</th><th>Costo total</th><th>Venta entregada</th><th>Flete ponderado</th><th>Sobrecosto</th><th>Viajes rojos</th><th>Incompletos</th><th>Costo/bulto</th><th>Costo/kg</th><th>Jornada h</th><th></th></tr></thead><tbody><tr v-for="group in groups" :key="`${group.period}-${group.group}`"><td>{{ group.period }}</td><td>{{ group.group }}</td><td>{{ group.trips }}</td><td>{{ usd(group.costTotal) }}</td><td>{{ usd(group.netSalesTotal) }}</td><td>{{ percent(group.weightedRatio) }}</td><td>{{ usd(group.excessTotal) }}</td><td>{{ percent(group.redTripRatio) }}</td><td>{{ group.incompleteTrips }}</td><td>{{ usd(group.averages.costPerDeliveredPackage) }}</td><td>{{ usd(group.averages.costPerDeliveredKg) }}</td><td>{{ group.averages.hours?.toFixed(2) ?? 'Sin dato' }}</td><td><button type="button" :disabled="busy" :aria-label="`Ver viajes de ${group.group}`" @click="openGroupTrips(group)"><i class="mdi mdi-open-in-new" aria-hidden="true" /> Ver viajes</button></td></tr></tbody></table>
        <table v-else><thead><tr><th>Guia / zona</th><th>Transportista</th><th>Costo externo</th><th>Costo propio</th><th>Ahorro con propio</th><th>Preferencia economica</th><th>Equilibrio</th><th>Base</th><th>Minimo supera propio</th></tr></thead><tbody><tr v-for="record in records.filter(item => item.comparison)" :key="record.trip._id"><td>{{ record.trip.guideNumber }}<small>{{ record.trip.zone }}</small></td><td>{{ record.trip.carrierName }}</td><td>{{ usd(record.comparison.externalCost) }}</td><td>{{ usd(record.comparison.internalCost) }}</td><td>{{ usd(record.comparison.saving) }}</td><td>{{ record.comparison.preferred }}</td><td>{{ usd(record.comparison.breakEvenSales) }}</td><td>{{ record.comparison.breakEvenBase }}</td><td>{{ record.comparison.minimumAlwaysHigher ? 'Si' : 'No' }}</td></tr></tbody></table>
      </div>
      <p v-if="!busy && !records.length" class="empty-state">No hay viajes en este periodo.</p>
      <section v-if="editingRouteId" class="trip-detail"><div class="page-heading"><h2>Detalle del viaje</h2><button title="Cerrar detalle" aria-label="Cerrar detalle" @click="editingRouteId = ''"><i class="mdi mdi-close" aria-hidden="true" /></button></div><TransportTripEditor :key="editingRouteId" :route-id="editingRouteId" @saved="load" /></section>
    </template>
  </main>
</template>

<style scoped>
.transport-page { max-width: 1500px; padding: 24px; margin: 0 auto; color: #f3f6fb; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.page-heading p { color: #a7d6dd; font-size: 13px; margin: 0; } h1 { font-size: 28px; margin: 6px 0 18px; } h2 { font-size: 20px; }
a { color: #9fd1ff; } .view-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid #38525f; padding-bottom: 12px; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border-radius: 4px; border: 1px solid #526e7d; color: #eaf7fa; background: #174557; font: inherit; cursor: pointer; }
button:disabled { opacity: .6; cursor: default; } .view-tabs button { background: transparent; } .view-tabs button.active { background: #246b70; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr)); gap: 12px; padding: 20px 0; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; min-width: 0; }
input, select { width: 100%; min-width: 0; min-height: 40px; padding: 8px; background: white; color: #17343d; border: 1px solid #a5bec6; border-radius: 4px; font: inherit; }
.filter-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 16px; padding: 16px 0; margin: 0; border-top: 1px solid #37535f; border-bottom: 1px solid #37535f; }
dt { color: #b8ccd6; font-size: 12px; } dd { font-size: 22px; font-weight: 600; margin: 5px 0; }
.report-table { width: 100%; overflow-x: auto; margin-top: 20px; } table { width: 100%; min-width: 1150px; border-collapse: collapse; }
th, td { text-align: left; padding: 11px 10px; border-bottom: 1px solid #37535f; font-size: 13px; } th { color: #afcbd6; background: #163341; }
small { display: block; font-size: 11px; color: #b2c8d1; margin-top: 5px; overflow-wrap: anywhere; }
.semaphore-rojo { color: #ffb6bb; background: #4c2631; } .semaphore-amarillo { color: #ffe09b; background: #433c25; } .semaphore-verde { color: #9ee3bd; background: #203c33; }
.error-message { color: #ffb6bb; } .empty-state { padding: 24px 0; color: #bed0d8; } .trip-detail { margin-top: 28px; }
.navigation-feedback { color: #9ee3bd; margin: 12px 0; }
@media (max-width: 600px) { .transport-page { padding: 16px 12px; } h1 { font-size: 24px; } }
</style>