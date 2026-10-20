<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { transportRequest, downloadTripReport, usd, percent } from '../services/transportApi';

const props = defineProps({ routeId: { type: String, default: '' }, loadedAmount: { type: Number, default: 0 },
  loadedKg: { type: Number, default: 0 }, plannedStops: { type: Number, default: 0 }, settlementMode: { type: Boolean, default: false },
  planningMode: { type: Boolean, default: false } });
const emit = defineEmits(['saved']);
const formRef = ref(null);
const configuration = ref(null);
const busy = ref(false);
const error = ref('');
const feedback = ref('');
const metrics = ref(null);
const comparison = ref(null);
const metricMode = ref('');
const sourceAmount = ref(null);
const updatedAt = ref(null);
const closed = ref(false);
const hydrating = ref(false);
const orders = ref([]);
const issueReports = ref([]);
const routeState = ref('active');
const form = reactive({ date: new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10),
  vehicleId: '', freightType: 'interno', zone: '', routeCode: '', helperName: '', carrierId: '',
  comparisonVehicleTypeId: 'camion', returnedAmount: null, loadedKg: null, deliveredKg: null,
  loadedPackages: null, deliveredPackages: null, capacityKg: null, capacityPackages: null,
  plannedStops: null, attendedStops: null, km: null, fuelLiters: null, allowances: 0,
  estimatedKm: null, estimatedAllowances: 0,
  costOverrides: { enabled: false, fixedDaily: null, variablePerKm: null, coolingDaily: 0, theoreticalKmPerLiter: null },
  departureAt: '', returnAt: '', status: 'draft', notes: '', deliveryOutcome: '', returns: [],
  tariff: { mode: 'fijo', fixed: 0, percentage: 0, minimum: 0, base: 'entregado' } });
const amount = computed(() => props.planningMode ? props.loadedAmount : sourceAmount.value ?? props.loadedAmount);
const numericFields = [
  ['returnedAmount', 'Monto devuelto ($)', '.01'], ['km', 'Km recorridos reales', '.01'],
  ['allowances', 'Viaticos / comidas ($)', '.01'], ['loadedKg', 'Kg cargados', '.01'],
  ['deliveredKg', 'Kg entregados', '.01'], ['loadedPackages', 'Bultos cargados', '1'],
  ['deliveredPackages', 'Bultos entregados', '1'], ['capacityKg', 'Capacidad (kg)', '.01'],
  ['capacityPackages', 'Capacidad (bultos)', '1'], ['plannedStops', 'Paradas planificadas', '1'], ['attendedStops', 'Paradas atendidas', '1'],
];
const visibleNumericFields = computed(() => props.planningMode
  ? [['estimatedKm', 'Km estimados (opcional)', '.01'], ['estimatedAllowances', 'Viaticos presupuestados ($)', '.01'],
    ...numericFields.filter(([key]) => ['loadedKg', 'loadedPackages', 'capacityKg', 'capacityPackages', 'plannedStops'].includes(key))]
  : numericFields);
const planningKeys = ['date', 'vehicleId', 'freightType', 'zone', 'routeCode', 'helperName', 'carrierId', 'tariff',
  'comparisonVehicleTypeId', 'loadedKg', 'loadedPackages', 'capacityKg', 'capacityPackages', 'plannedStops',
  'estimatedKm', 'estimatedAllowances', 'costOverrides', 'notes'];
const overrideFields = [
  ['fixedDaily', 'Costo fijo diario del viaje ($)', '.0001'],
  ['variablePerKm', 'Costo variable por km ($)', '.000001'],
  ['coolingDaily', 'Equipo de frio por dia ($)', '.01'],
  ['theoreticalKmPerLiter', 'Rendimiento teorico de este viaje (km/l)', '.01'],
];
const supportMetrics = [
  ['minimumSales', 'Venta minima', 'usd'], ['gap', 'Brecha', 'usd'], ['excess', 'Sobrecosto', 'usd'],
  ['profitMargin', 'Margen restante', 'percent'], ['fillKg', 'Llenado kg', 'percent'], ['fillPackages', 'Llenado bultos', 'percent'],
  ['ticketPerStop', 'Ticket por parada', 'usd'], ['costPerDeliveredPackage', 'Costo por bulto entregado', 'usd'],
  ['costPerDeliveredKg', 'Costo por kg entregado', 'usd'], ['returnRatio', 'Devoluciones', 'percent'],
  ['unattendedRatio', 'Clientes no atendidos', 'percent'], ['hours', 'Jornada (h)', 'number'],
  ['kmPerStop', 'Km por parada', 'number'], ['realCostPerKm', 'Costo real por km', 'usd'],
  ['fuelYield', 'Km/l cargado', 'number'], ['theoreticalFuelYield', 'Km/l teorico', 'number'], ['allowances', 'Viaticos', 'usd'],
];
const display = (value, kind) => kind === 'usd' ? usd(value) : kind === 'percent' ? percent(value)
  : value == null ? 'Sin dato' : Number(value).toLocaleString('es-VE', { maximumFractionDigits: 2 });

watch(() => form.carrierId, id => {
  if (closed.value || hydrating.value) return;
  const carrier = configuration.value?.carriers.find(item => item.id === id);
  if (carrier) form.tariff = { mode: carrier.mode, fixed: carrier.fixed, percentage: carrier.percentage, minimum: carrier.minimum, base: carrier.base };
});
watch(() => form.vehicleId, id => {
  if (closed.value || hydrating.value) return;
  const vehicle = configuration.value?.vehicles.find(item => item.id === id);
  if (vehicle) { form.capacityKg = vehicle.capacityKg; form.capacityPackages = vehicle.capacityPackages; }
  if (vehicle && form.costOverrides.enabled) loadTripCostDefaults();
});

function loadTripCostDefaults() {
  const vehicle = configuration.value?.vehicles.find(item => item.id === form.vehicleId);
  const type = configuration.value?.vehicleTypes.find(item => item.id === vehicle?.vehicleTypeId);
  const required = ['depreciationMonthly', 'permitMonthly', 'driverDaily', 'helperDaily', 'workDays', 'fuelLiters',
    'fuelKm', 'fuelPrice', 'oilMonthly', 'tiresMonthly', 'maintenanceMonthly', 'baseKmMonthly'];
  if (!type || required.some(key => type[key] == null || type[key] === '' || !Number.isFinite(Number(type[key]))) || Number(type.workDays) <= 0
    || Number(type.fuelKm) <= 0 || Number(type.baseKmMonthly) <= 0) {
    return false;
  }
  const fixedMonthly = Number(type.depreciationMonthly) + Number(type.permitMonthly)
    + (Number(type.driverDaily) + Number(type.helperDaily)) * Number(type.workDays);
  const variableMonthly = (Number(type.fuelLiters) / Number(type.fuelKm)) * Number(type.baseKmMonthly) * Number(type.fuelPrice)
    + Number(type.oilMonthly) + Number(type.tiresMonthly) + Number(type.maintenanceMonthly);
  Object.assign(form.costOverrides, {
    fixedDaily: Number((fixedMonthly / Number(type.workDays)).toFixed(4)),
    variablePerKm: Number((variableMonthly / Number(type.baseKmMonthly)).toFixed(6)),
    coolingDaily: Number(type.coolingDaily) || 0,
    theoreticalKmPerLiter: Number((Number(type.fuelKm) / Number(type.fuelLiters)).toFixed(4)),
  });
  return true;
}

function toggleTripCostOverrides() {
  error.value = '';
  if (!form.costOverrides.enabled) return;
  if (!form.vehicleId) {
    form.costOverrides.enabled = false;
    error.value = 'Selecciona primero el vehiculo para cargar los costos base que ajustaras.';
    return;
  }
  if (!loadTripCostDefaults()) {
    form.costOverrides.enabled = false;
    error.value = 'El tipo de vehiculo no tiene costos base completos. Completa sus parametros antes de personalizar este viaje.';
  }
}
const localTimestamp = value => value ? new Date(new Date(value).getTime() - 4 * 3600000).toISOString().slice(0, 16) : '';
const apiTimestamp = value => value ? new Date(`${value}-04:00`).toISOString() : null;

async function loadTrip(id) {
  if (!id) return;
  try {
    const result = await transportRequest(`/guides/${id}`);
    orders.value = result.trip?.status === 'closed' ? result.trip.guideSnapshot?.orders || [] : result.route?.loadGuide?.orders || result.trip?.guideSnapshot?.orders || [];
    issueReports.value = result.issues || [];
    routeState.value = result.route?.status || 'active';
    sourceAmount.value = result.trip?.loadedAmount ?? result.route?.loadGuide?.totalAmount ?? null;
    if (result.trip) {
      hydrating.value = true;
      closed.value = result.trip.status === 'closed';
      if (closed.value && result.trip.configurationSnapshot) configuration.value = result.trip.configurationSnapshot;
      Object.assign(form, result.trip, {
        tariff: { mode: 'fijo', fixed: 0, percentage: 0, minimum: 0, base: 'entregado', ...(result.trip.tariff || {}) },
        costOverrides: { enabled: false, fixedDaily: null, variablePerKm: null, coolingDaily: 0, theoreticalKmPerLiter: null,
          ...(result.trip.costOverrides || {}) },
        departureAt: localTimestamp(result.trip.departureAt), returnAt: localTimestamp(result.trip.returnAt),
      });
      updatedAt.value = result.trip.updatedAt;
      if (!props.planningMode || closed.value) {
        metrics.value = result.metrics; comparison.value = result.comparison; metricMode.value = 'Viaje';
      }
      await nextTick();
      hydrating.value = false;
    } else {
      updatedAt.value = null;
      closed.value = false;
      if (form.loadedKg == null && result.route?.totalWeight > 0) form.loadedKg = result.route.totalWeight;
      if (form.plannedStops == null) form.plannedStops = result.route?.originalStops?.length || result.route?.stops?.length || null;
    }
  } catch (failure) { error.value = failure.message; }
}
watch(() => props.routeId, loadTrip);
onMounted(async () => {
  try {
    configuration.value = (await transportRequest('/configuration')).configuration;
    if (props.loadedKg > 0) form.loadedKg = props.loadedKg;
    if (props.plannedStops > 0) form.plannedStops = props.plannedStops;
    await loadTrip(props.routeId);
  } catch (failure) { error.value = failure.message; }
});
function validate() {
  if (busy.value) return false;
  if (!configuration.value) {
    error.value = 'No se pudo cargar la configuracion de transporte. Recarga la pantalla o vuelve a intentarlo.';
    return false;
  }
  if (!props.planningMode && !configuration.value.vehicles?.length) {
    error.value = 'No hay vehiculos registrados. Agrega la placa y el tipo en KPIs de transporte > Parametros > Vehiculos.';
    return false;
  }
  if (!formRef.value?.reportValidity()) {
    const invalidField = formRef.value?.querySelector(':invalid');
    const label = invalidField?.closest('label');
    const labelText = [...(label?.childNodes || [])]
      .find(node => node.nodeType === Node.TEXT_NODE)?.textContent?.trim();
    const fieldName = invalidField?.getAttribute('aria-label') || labelText || 'el campo resaltado';
    error.value = `Falta completar ${fieldName}. En km, viaticos o devolucion escribe 0 si no aplica.`;
    invalidField?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    invalidField?.focus?.();
    return false;
  }
  error.value = '';
  return true;
}
async function saveForRoute(id = props.routeId) {
  if (!id) { error.value = 'No se encontro el folio de la ruta.'; return false; }
  if (!validate()) return false;
  busy.value = true; error.value = ''; feedback.value = '';
  try {
    const payload = props.planningMode
      ? { ...Object.fromEntries(planningKeys.map(key => [key, form[key]])), status: 'draft', updatedAt: updatedAt.value }
      : { ...form, ...(props.settlementMode ? { status: 'draft' } : {}), updatedAt: updatedAt.value,
        departureAt: apiTimestamp(form.departureAt), returnAt: apiTimestamp(form.returnAt) };
    const result = await transportRequest(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    updatedAt.value = result.trip.updatedAt; sourceAmount.value = result.trip.loadedAmount;
    closed.value = result.trip.status === 'closed';
    if (!props.planningMode) { metrics.value = result.metrics; comparison.value = result.comparison; metricMode.value = 'Viaje'; }
    feedback.value = closed.value ? 'Viaje cerrado.' : props.planningMode ? 'Planificacion del viaje guardada.' : 'Datos del viaje guardados.';
    form.status = result.trip.status;
    emit('saved', result);
    return true;
  } catch (failure) { error.value = failure.message; return false; }
  finally { busy.value = false; }
}
function chooseOutcome(event) {
  const outcome = event.target.value;
  if (outcome !== 'con_devoluciones' && (form.returns.length || Number(form.returnedAmount) > 0)
    && !window.confirm('Esta opcion elimina las devoluciones del borrador. Deseas continuar?')) {
    event.target.value = form.deliveryOutcome;
    return;
  }
  form.deliveryOutcome = outcome;
  if (outcome !== 'con_devoluciones') { form.returns = []; form.returnedAmount = 0; }
  if (outcome === 'sin_novedad') confirmFullDelivery();
}
function confirmFullDelivery() {
  form.attendedStops = form.plannedStops;
  form.deliveredKg = form.loadedKg;
  form.deliveredPackages = form.loadedPackages;
}
watch(() => [form.loadedKg, form.loadedPackages, form.plannedStops], () => {
  if (form.deliveryOutcome === 'sin_novedad' && !hydrating.value && !closed.value) confirmFullDelivery();
});
watch(() => form.returns, items => {
  if (props.settlementMode && form.deliveryOutcome === 'con_devoluciones' && !hydrating.value && !closed.value) {
    form.returnedAmount = items.reduce((sum, item) => sum + Math.round((Number(item.amount) || 0) * 100), 0) / 100;
  }
}, { deep: true });
function selectReturnOrder(item, index) {
  const order = orders.value[Number(index)];
  Object.assign(item, { orderIndex: Number(index), orderNumber: order?.orderNumber, clientId: order?.clientId, sucursal: order?.sucursal || '' });
  item.companyName = order?.companyName || order?.company || '';
}
function addReturn() {
  const item = { productCode: '', amount: null, kg: null, packages: null, reason: '' };
  selectReturnOrder(item, 0);
  form.returns.push(item);
}
async function finish() {
  if (!props.routeId) { error.value = 'No se encontro el folio de la ruta que se va a liquidar.'; return; }
  if (!closed.value && !validate()) return;
  if (!window.confirm('Se liquidara el viaje y se terminara la ruta. La liquidacion cerrada no se podra editar. Deseas continuar?')) return;
  busy.value = true; error.value = ''; feedback.value = '';
  try {
    const payload = closed.value ? {} : { ...form, updatedAt: updatedAt.value,
      departureAt: apiTimestamp(form.departureAt), returnAt: apiTimestamp(form.returnAt) };
    const result = await transportRequest(`/trips/${props.routeId}/finish`, { method: 'POST', body: JSON.stringify(payload) });
    updatedAt.value = result.trip.updatedAt; closed.value = true; form.status = 'closed';
    metrics.value = result.metrics; comparison.value = result.comparison; metricMode.value = 'Liquidacion';
    routeState.value = result.route.status; feedback.value = 'Viaje liquidado y ruta terminada.';
    emit('saved', result);
  } catch (failure) {
    if (failure.status === 404 || failure.status === 405) {
      error.value = 'El servidor conectado no tiene el endpoint para liquidar viajes. Publica o reinicia el backend actualizado en Render.';
    } else if (failure.status === 401) error.value = 'La sesion vencio. Inicia sesion de nuevo para liquidar el viaje.';
    else if (failure.status === 403) error.value = 'Tu usuario no tiene permisos de administrador para liquidar el viaje.';
    else error.value = failure.message;
    await loadTrip(props.routeId);
  }
  finally { busy.value = false; }
}
async function download(format) {
  busy.value = true; error.value = '';
  try { await downloadTripReport(props.routeId, format); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
async function plan() {
  if (!validate()) return;
  const estimatedKm = props.planningMode ? form.estimatedKm : form.km;
  if (estimatedKm == null || estimatedKm === '') { error.value = 'Indica los km estimados para calcular la estimacion.'; return; }
  busy.value = true; error.value = '';
  try {
    const result = await transportRequest('/planning', { method: 'POST', body: JSON.stringify({
      vehicleId: form.vehicleId, carrierId: form.carrierId, freightType: form.freightType, km: estimatedKm,
      loadedAmount: amount.value, allowances: props.planningMode ? form.estimatedAllowances : form.allowances,
      comparisonVehicleTypeId: form.comparisonVehicleTypeId,
      tariff: form.freightType === 'externo' ? form.tariff : null,
      costOverrides: form.freightType === 'interno' ? form.costOverrides : null,
    }) });
    metrics.value = result.metrics; comparison.value = result.comparison; metricMode.value = 'Estimacion';
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
defineExpose({ validate, saveForRoute });
</script>

<template>
  <section class="transport-editor">
    <div class="editor-heading"><h2>{{ settlementMode ? 'Liquidacion del viaje' : planningMode ? 'Planificacion del transporte' : 'Transporte del viaje' }}</h2><router-link to="/transport-kpis"><i class="mdi mdi-chart-box-outline" aria-hidden="true" /> KPIs y parametros</router-link></div>
    <router-link v-if="planningMode && routeId" :to="{ path: '/finish-routes', query: { routeId } }"><i class="mdi mdi-clipboard-check-outline" aria-hidden="true" /> Completar datos reales en Terminar ruta</router-link>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="feedback" class="feedback-message" role="status">{{ feedback }}</p>
    <p v-if="settlementMode && configuration && !configuration.vehicles?.length" class="setup-warning" role="status">Configura primero el vehiculo en <router-link to="/transport-kpis">KPIs de transporte → Parametros → Vehiculos</router-link>. Sin un vehiculo registrado no se puede calcular el flete ni liquidar el viaje.</p>
    <p v-if="settlementMode && !closed" class="settlement-hint">Para cerrar se requiere resultado de entrega, vehiculo, km reales, viaticos (0 si no hubo), paradas atendidas y horarios de salida y regreso.</p>
    <details v-if="orders.length" class="delivery-details"><summary>Pedidos de la guia ({{ orders.length }})</summary><div class="returns-scroll"><table><thead><tr><th>Empresa</th><th>Documento</th><th>Cliente / sede</th><th>Fecha</th><th>Cargado ($)</th></tr></thead><tbody><tr v-for="(order, index) in orders" :key="index"><td>{{ order.companyName || order.company || 'Sin empresa registrada' }}</td><td>{{ order.orderNumber }}</td><td>{{ order.clientName || order.clientId }} {{ order.sucursal }}</td><td>{{ order.date }}</td><td>{{ usd(order.total) }}</td></tr></tbody></table></div></details>
    <details v-if="issueReports.length" class="delivery-details"><summary>Incidencias reportadas ({{ issueReports.length }})</summary><article v-for="(issue, index) in issueReports" :key="issue._id || index"><strong>{{ issue.orderNumber }} - {{ issue.clientName || issue.clientId }}</strong><p v-for="(item, itemIndex) in issue.items" :key="itemIndex">{{ item.productId }}: {{ item.novelty }} ({{ item.quantity }} {{ item.presentationType }})</p></article></details>
    <form ref="formRef" @submit.prevent="saveForRoute()">
      <fieldset :disabled="busy || closed"><legend>{{ closed ? 'Viaje cerrado' : planningMode ? 'Antes de salir' : 'Datos del viaje' }}</legend>
        <section v-if="settlementMode" class="delivery-details">
          <label>Resultado de la entrega<select :value="form.deliveryOutcome" :required="!closed" @change="chooseOutcome"><option value="">{{ closed ? 'No declarado en el viaje anterior' : 'Seleccionar resultado' }}</option><option value="sin_novedad">Entregado sin novedad</option><option value="con_devoluciones">Con devoluciones / rechazos</option><option value="con_novedades">Otras novedades, sin devolucion</option></select></label>
          <template v-if="form.deliveryOutcome === 'con_devoluciones'">
            <div class="returns-scroll"><table><thead><tr><th>Pedido</th><th>Codigo del producto</th><th>Monto ($)</th><th>Kg</th><th>Bultos</th><th>Motivo</th><th></th></tr></thead><tbody><tr v-for="(item, index) in form.returns" :key="index">
              <td><select :value="item.orderIndex" aria-label="Pedido devuelto" required @change="selectReturnOrder(item, $event.target.value)"><option v-for="(order, orderIndex) in orders" :key="orderIndex" :value="orderIndex">{{ order.companyName || order.company || 'Sin empresa registrada' }} - {{ order.orderNumber }} - {{ order.clientName || order.clientId }}</option></select></td>
              <td><input v-model="item.productCode" type="text" maxlength="100" required aria-label="Codigo del producto devuelto" placeholder="Ej. HBL-900" /></td>
              <td><input v-model.number="item.amount" type="number" min=".01" step=".01" required aria-label="Monto de la devolucion" /></td>
              <td><input v-model.number="item.kg" type="number" min="0" step=".01" aria-label="Kg devueltos" /></td>
              <td><input v-model.number="item.packages" type="number" min="0" step="1" aria-label="Bultos devueltos" /></td>
              <td><input v-model="item.reason" required aria-label="Motivo de la devolucion" /></td>
              <td><button type="button" title="Eliminar devolucion" aria-label="Eliminar devolucion" @click="form.returns.splice(index, 1)"><i class="mdi mdi-delete-outline" aria-hidden="true" /></button></td>
            </tr></tbody></table></div>
            <button type="button" :disabled="!orders.length" @click="addReturn"><i class="mdi mdi-plus" aria-hidden="true" /> Agregar devolucion</button>
            <p>Total devuelto: <strong>{{ usd(form.returnedAmount) }}</strong></p>
          </template>
        </section>
        <div class="transport-fields">
          <label>Fecha del viaje<input v-model="form.date" type="date" required /></label>
          <label>Vehiculo<select v-model="form.vehicleId" required><option value="">Seleccionar</option><option v-for="vehicle in configuration?.vehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate || vehicle.name }}</option></select></label>
          <label>Tipo de flete<select v-model="form.freightType"><option value="interno">Interno</option><option value="externo">Externo</option></select></label>
          <label>Zona<input v-model="form.zone" list="transport-zones" required /><datalist id="transport-zones"><option v-for="zone in ['Maracaibo', 'Cabimas', 'Ciudad Ojeda', 'Machiques', 'Otras']" :key="zone">{{ zone }}</option></datalist></label>
          <label>Ruta comercial<input v-model="form.routeCode" required /></label>
          <label>Ayudante<input v-model="form.helperName" /></label>
          <label>Monto cargado ($)<input :value="amount.toFixed(2)" readonly /></label>
          <template v-if="form.freightType === 'externo'">
            <label>Transportista<select v-model="form.carrierId" required><option value="">Seleccionar</option><option v-for="carrier in configuration?.carriers" :key="carrier.id" :value="carrier.id">{{ carrier.name }}</option></select></label>
            <label>Modalidad tarifa<select v-model="form.tariff.mode"><option value="fijo">Fijo por viaje / dia</option><option value="porcentaje">Porcentaje</option></select></label>
            <label v-if="form.tariff.mode === 'fijo'">Monto del viaje ($)<input v-model.number="form.tariff.fixed" type="number" min="0" step=".01" required /></label>
            <template v-else>
              <label>Porcentaje de tarifa (%)<input :value="form.tariff.percentage * 100" type="number" min="0" max="100" step=".01" required @input="form.tariff.percentage = Number($event.target.value) / 100" /></label>
              <label>Minimo por viaje ($)<input v-model.number="form.tariff.minimum" type="number" min="0" step=".01" required /></label>
              <label>Base del porcentaje<select v-model="form.tariff.base"><option value="cargado">Cargado</option><option value="entregado">Entregado</option></select></label>
            </template>
            <label>Tipo propio para comparar<select v-model="form.comparisonVehicleTypeId"><option value="">Sin comparacion</option><option v-for="type in configuration?.vehicleTypes" :key="type.id" :value="type.id">{{ type.name }}</option></select></label>
          </template>
          <label v-if="form.freightType === 'interno'" class="wide trip-override-toggle">
            <span><input v-model="form.costOverrides.enabled" type="checkbox" :disabled="busy || closed" @change="toggleTripCostOverrides" /> Ajustar parametros de costo solo para este viaje</span>
          </label>
          <div v-if="form.freightType === 'interno' && form.costOverrides.enabled" class="wide trip-override-fields">
            <p>Estos valores reemplazan el costo base del vehiculo solamente en esta guia; no modifican los parametros generales ni otros viajes.</p>
            <label v-for="[key, title, step] in overrideFields" :key="key">{{ title }}<input v-model.number="form.costOverrides[key]" type="number" min="0" :step="step" required :disabled="busy || closed" /></label>
          </div>
          <label v-for="[key, title, step] in visibleNumericFields" :key="key">{{ title }}<input v-model.number="form[key]" type="number" min="0" :step="step" :readonly="settlementMode && key === 'returnedAmount' && !!form.deliveryOutcome" :required="settlementMode && ['km', 'allowances', 'plannedStops', 'attendedStops'].includes(key)" /></label>
          <template v-if="!planningMode">
            <label v-if="form.freightType === 'interno'">Litros de combustible cargados<input v-model.number="form.fuelLiters" type="number" min="0" step=".01" /></label>
            <label>Salida (Caracas)<input v-model="form.departureAt" type="datetime-local" :required="settlementMode" /></label>
            <label>Regreso (Caracas)<input v-model="form.returnAt" type="datetime-local" :required="settlementMode" /></label>
          </template>
          <label v-if="!settlementMode && !planningMode">Estado<select v-model="form.status"><option value="draft">Borrador</option><option value="closed">Cerrar viaje</option></select></label>
          <label class="wide">Observaciones<textarea v-model="form.notes" rows="2" /></label>
        </div>
        <div class="transport-actions"><button v-if="!settlementMode" type="button" @click="plan"><i class="mdi mdi-calculator" aria-hidden="true" /> Estimar viaje</button><button v-if="routeId && !closed" type="submit"><i class="mdi mdi-content-save-outline" aria-hidden="true" /> {{ settlementMode ? 'Guardar borrador y calcular' : planningMode ? 'Guardar planificacion' : 'Guardar viaje' }}</button></div>
      </fieldset>
    </form>
    <div v-if="routeId" class="transport-actions">
      <button v-if="settlementMode && (!closed || routeState !== 'completed')" type="button" :disabled="busy" @click="finish"><i class="mdi mdi-check-circle-outline" aria-hidden="true" /> {{ closed ? 'Terminar ruta' : 'Liquidar y terminar ruta' }}</button>
      <button v-if="updatedAt" type="button" :disabled="busy" @click="download('xlsx')"><i class="mdi mdi-file-excel-outline" aria-hidden="true" /> Descargar viaje completo</button>
      <button v-if="updatedAt" type="button" :disabled="busy" @click="download('json')"><i class="mdi mdi-code-json" aria-hidden="true" /> Respaldo JSON</button>
    </div>
    <section v-if="metrics" class="trip-results" :class="`state-${metrics.semaphore}`">
      <div class="editor-heading"><h3>{{ metricMode }}</h3><strong class="state-label">{{ metrics.semaphore }}</strong></div>
      <dl class="headline-metrics"><div><dt>{{ metricMode === 'Estimacion' ? 'Costo previsto' : 'Monto del viaje' }}</dt><dd>{{ usd(metrics.cost) }}</dd></div><div><dt>{{ metricMode === 'Estimacion' ? 'Flete / venta prevista' : 'Flete / venta' }}</dt><dd>{{ percent(metrics.freightRatio) }}</dd></div><div><dt>Ganancia estimada</dt><dd>{{ usd(metrics.estimatedProfit) }}</dd></div><div><dt>{{ metricMode === 'Estimacion' ? 'Venta prevista' : 'Venta entregada' }}</dt><dd>{{ usd(metrics.netSales) }}</dd></div></dl>
      <dl class="support-metrics"><div v-for="[key, title, kind] in (planningMode && metricMode === 'Estimacion' ? supportMetrics.filter(([key]) => ['minimumSales', 'gap', 'profitMargin'].includes(key)) : supportMetrics)" :key="key"><dt>{{ title }}</dt><dd>{{ display(metrics[key], kind) }}</dd></div></dl>
      <p v-for="alert in metrics.alerts" :key="alert" class="trip-alert">{{ alert }}</p>
      <dl v-if="comparison" class="support-metrics"><div><dt>Costo propio comparable</dt><dd>{{ usd(comparison.internalCost) }}</dd></div><div><dt>Ahorro con propio</dt><dd>{{ usd(comparison.saving) }}</dd></div><div><dt>Preferencia economica</dt><dd>{{ comparison.preferred }}</dd></div><div><dt>Equilibrio sobre {{ comparison.breakEvenBase }}</dt><dd>{{ usd(comparison.breakEvenSales) }}</dd></div></dl>
    </section>
  </section>
</template>

<style scoped>
.transport-editor { color: #f3f6fb; padding: 20px 0; border-top: 1px solid #35505e; }
.editor-heading, .transport-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
h2 { font-size: 20px; margin: 0 0 12px; } h3 { font-size: 17px; margin: 0; }
a { color: #9fd1ff; }
fieldset { padding: 0; border: 0; min-width: 0; } legend { font-size: 13px; margin: 10px 0; color: #c3d5df; }
.transport-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; min-width: 0; }
input, select, textarea { width: 100%; min-width: 0; min-height: 42px; padding: 9px; border: 1px solid #a8bcc5; border-radius: 4px; color: #162d36; background: #fff; font: inherit; }
.wide { grid-column: 1 / -1; }
.transport-actions { justify-content: flex-start; margin-top: 16px; }
button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; background: #1e6776; color: #fff; border: 1px solid #699ca6; border-radius: 4px; font: inherit; cursor: pointer; }
.error-message { color: #ffb3ba; } .feedback-message { color: #a9edc5; }
.setup-warning { padding: 12px; border-left: 4px solid #e7bb54; background: #463d28; color: #fff0bc; }
.setup-warning a { color: #fff0bc; text-decoration: underline; }
.settlement-hint { color: #d3e3e9; font-size: 13px; }
.trip-results { margin-top: 20px; padding-top: 14px; border-top: 3px solid #88a6b4; }
.state-rojo { border-color: #ef6775; } .state-amarillo { border-color: #e8c566; } .state-verde { border-color: #70d3a1; }
.state-label { text-transform: capitalize; }
.headline-metrics, .support-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr)); gap: 16px; }
dt { font-size: 12px; color: #bfd0d9; } dd { margin: 5px 0 0; font-size: 15px; } .headline-metrics dd { font-size: 22px; font-weight: 700; }
.trip-alert { margin: 7px 0; font-size: 13px; color: #f4d58b; }
.delivery-details { padding: 12px 0; border-bottom: 1px solid #35505e; margin-bottom: 14px; }
.delivery-details summary { cursor: pointer; padding: 8px 0; }
.returns-scroll { overflow-x: auto; width: 100%; margin: 12px 0; }
.returns-scroll table { border-collapse: collapse; min-width: 760px; width: 100%; }
.returns-scroll th, .returns-scroll td { padding: 8px; text-align: left; border-bottom: 1px solid #35505e; font-size: 13px; }
.returns-scroll th:first-child { min-width: 200px; }
.returns-scroll input { min-width: 100px; }
button:disabled { opacity: .55; cursor: default; }
.trip-override-toggle { margin-top: 8px; }
.trip-override-toggle > span { display: flex; align-items: center; gap: 9px; }
.trip-override-toggle input { width: 18px; min-height: 18px; height: 18px; accent-color: #54c49a; }
.trip-override-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 12px; padding: 14px; border: 1px solid #c2aa68; border-radius: 4px; background: #393624; }
.trip-override-fields p { grid-column: 1 / -1; margin: 0; color: #f6e7bd; font-size: 13px; }
</style>