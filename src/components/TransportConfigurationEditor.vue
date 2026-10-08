<script setup>
import { onMounted, ref } from 'vue';
import { transportRequest } from '../services/transportApi';

const emit = defineEmits(['saved']);
const config = ref(null);
const busy = ref(false);
const error = ref('');
const feedback = ref('');
const settingFields = [
  ['targetRatio', 'Meta flete (%)', true], ['yellowFrom', 'Amarillo desde (%)', true],
  ['grossMargin', 'Margen antes del flete (%)', true], ['returnLimit', 'Devolucion maxima (%)', true],
  ['unattendedLimit', 'No atendidos maximo (%)', true], ['fillTarget', 'Llenado minimo (%)', true],
  ['fuelDeviation', 'Desviacion combustible (%)', true], ['maxHours', 'Jornada maxima (h)', false], ['departureHour', 'Hora limite salida', false],
];
const typeFields = [['depreciationMonthly', 'Depreciacion / mes ($)'], ['permitMonthly', 'Permiso / mes ($)'],
  ['driverDaily', 'Chofer / dia ($)'], ['helperDaily', 'Ayudante / dia ($)'], ['workDays', 'Dias laborables / mes'],
  ['fuelLiters', 'Litros de referencia'], ['fuelKm', 'Km de referencia de consumo'], ['fuelPrice', 'Precio combustible ($/l)'],
  ['oilMonthly', 'Aceite / mes ($)'], ['tiresMonthly', 'Neumaticos / mes ($)'], ['maintenanceMonthly', 'Mantenimiento / mes ($)'],
  ['baseKmMonthly', 'Km base / mes'], ['coolingDaily', 'Equipo de frio / dia ($)']];
function addType() { config.value.vehicleTypes.push({ id: '', name: '', source: 'Dato del usuario', ...Object.fromEntries(typeFields.map(([key]) => [key, null])) }); }
function addCarrier() { config.value.carriers.push({ id: '', name: '', source: 'Dato del usuario', mode: 'fijo', fixed: 0, percentage: 0, minimum: 0, base: 'entregado' }); }
function addVehicle() { config.value.vehicles.push({ id: '', name: '', plate: '', source: 'Dato del usuario', vehicleTypeId: '', capacityKg: null, capacityPackages: null }); }
async function load() {
  try { config.value = (await transportRequest('/configuration')).configuration; }
  catch (failure) { error.value = failure.message; }
}
async function save() {
  busy.value = true; error.value = ''; feedback.value = '';
  try { config.value = (await transportRequest('/configuration', { method: 'PUT', body: JSON.stringify(config.value) })).configuration;
    feedback.value = 'Parametros guardados.'; emit('saved', config.value); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="configuration-editor">
    <p v-if="error" role="alert" class="error-message">{{ error }}</p><p v-if="feedback" role="status">{{ feedback }}</p>
    <form v-if="config" @submit.prevent="save"><fieldset :disabled="busy">
      <h2>Umbrales y margen</h2><div class="config-grid">
        <label v-for="[key, title, percentage] in settingFields" :key="key">{{ title }}<input :value="percentage ? config.settings[key] * 100 : config.settings[key]" type="number" min="0" :max="percentage ? 100 : undefined" step=".01" required @input="config.settings[key] = Number($event.target.value) / (percentage ? 100 : 1)" /></label>
      </div>
      <div class="config-heading"><h2>Tipos de vehiculo</h2><button type="button" @click="addType"><i class="mdi mdi-plus" aria-hidden="true" /> Agregar tipo</button></div>
      <details v-for="(type, index) in config.vehicleTypes" :key="index" open>
        <summary>{{ type.name || 'Nuevo tipo' }}</summary><div class="config-grid">
          <label>Identificador<input v-model="type.id" required /></label><label>Nombre<input v-model="type.name" required /></label>
          <label v-for="[key, title] in typeFields" :key="key">{{ title }}<input v-model.number="type[key]" type="number" min="0" step="any" /></label>
          <label class="wide">Fuente / supuesto<input v-model="type.source" /></label>
        </div>
        <button type="button" class="delete-control" title="Eliminar tipo" @click="config.vehicleTypes.splice(index, 1)"><i class="mdi mdi-delete-outline" aria-hidden="true" /> Eliminar tipo</button>
      </details>
      <div class="config-heading"><h2>Transportistas</h2><button type="button" @click="addCarrier"><i class="mdi mdi-plus" aria-hidden="true" /> Agregar transportista</button></div>
      <section v-for="(carrier, index) in config.carriers" :key="index" class="config-section"><div class="config-grid">
        <label>Identificador<input v-model="carrier.id" required /></label><label>Nombre<input v-model="carrier.name" required /></label>
        <label>Modalidad<select v-model="carrier.mode"><option value="fijo">Fijo por viaje / dia</option><option value="porcentaje">Porcentaje</option></select></label>
        <label>Monto fijo ($)<input v-model.number="carrier.fixed" type="number" min="0" step=".01" required /></label>
        <label>Tarifa (%)<input :value="carrier.percentage * 100" type="number" min="0" max="100" step=".01" required @input="carrier.percentage = Number($event.target.value) / 100" /></label>
        <label>Minimo ($)<input v-model.number="carrier.minimum" type="number" min="0" step=".01" required /></label>
        <label>Base<select v-model="carrier.base"><option value="cargado">Cargado</option><option value="entregado">Entregado</option></select></label>
        <label>Fuente / supuesto<input v-model="carrier.source" /></label>
      </div><button type="button" class="delete-control" @click="config.carriers.splice(index, 1)"><i class="mdi mdi-delete-outline" aria-hidden="true" /> Eliminar transportista</button></section>
      <div class="config-heading"><h2>Vehiculos y capacidades</h2><button type="button" @click="addVehicle"><i class="mdi mdi-plus" aria-hidden="true" /> Agregar vehiculo</button></div>
      <section v-for="(vehicle, index) in config.vehicles" :key="index" class="config-section"><div class="config-grid">
        <label>Identificador<input v-model="vehicle.id" required /></label><label>Nombre<input v-model="vehicle.name" required /></label><label>Placa<input v-model="vehicle.plate" /></label>
        <label>Tipo<select v-model="vehicle.vehicleTypeId" required><option value="">Seleccionar</option><option v-for="type in config.vehicleTypes" :key="type.id" :value="type.id">{{ type.name }}</option></select></label>
        <label>Capacidad kg<input v-model.number="vehicle.capacityKg" type="number" min=".01" step=".01" /></label><label>Capacidad bultos<input v-model.number="vehicle.capacityPackages" type="number" min="1" step="1" /></label>
        <label>Fuente / supuesto<input v-model="vehicle.source" /></label>
      </div><button type="button" class="delete-control" @click="config.vehicles.splice(index, 1)"><i class="mdi mdi-delete-outline" aria-hidden="true" /> Eliminar vehiculo</button></section>
      <button class="save-control" type="submit"><i class="mdi mdi-content-save-outline" aria-hidden="true" /> {{ busy ? 'Guardando...' : 'Guardar parametros' }}</button>
    </fieldset></form>
  </section>
</template>

<style scoped>
.configuration-editor { color: #f3f6fb; } fieldset { padding: 0; border: 0; min-width: 0; }
.config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; min-width: 0; }
input, select { width: 100%; min-width: 0; min-height: 40px; padding: 9px; border: 1px solid #c8b675; border-radius: 4px; background: #fff1bf; color: #283237; font: inherit; }
.wide { grid-column: 1 / -1; } h2 { font-size: 20px; margin: 14px 0; }
.config-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
details, .config-section { padding: 16px 0; border-bottom: 1px solid #36515e; } summary { font-weight: 600; margin-bottom: 12px; cursor: pointer; }
button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 13px; color: #fff; background: #245669; border: 1px solid #668c9c; border-radius: 4px; font: inherit; cursor: pointer; }
.delete-control { margin-top: 12px; color: #ffb9bc; background: transparent; } .save-control { margin-top: 20px; background: #17684e; }
.error-message { color: #ffb3ba; }
</style>