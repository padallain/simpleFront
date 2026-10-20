<script setup>
import { onMounted, ref } from 'vue';
import { API_BASE_URL, parseApiResponse } from '../services/auth';

const selected = defineModel({ default: '' });
const props = defineProps({ disabled: { type: Boolean, default: false } });
const emit = defineEmits(['catalog-updated']);
const companies = ref([]);
const defaultCompanyId = ref('');
const busy = ref(false);
const creating = ref(false);
const companyName = ref('');
const makeDefault = ref(false);
const error = ref('');
const feedback = ref('');

async function request(path = '', options = {}) {
  const response = await fetch(`${API_BASE_URL}/dispatch-companies${path}`, {
    ...options, credentials: 'include', headers: { 'Content-Type': 'application/json' },
  });
  return parseApiResponse(response, 'No se pudieron consultar o guardar las empresas.');
}
function applyCatalog(result) {
  companies.value = result.companies;
  defaultCompanyId.value = result.defaultCompanyId || '';
  if (!selected.value) selected.value = defaultCompanyId.value;
  emit('catalog-updated', result);
}
async function load() {
  busy.value = true; error.value = '';
  try { applyCatalog(await request()); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
async function create() {
  if (!companyName.value.trim() || props.disabled || busy.value) return;
  busy.value = true; error.value = ''; feedback.value = '';
  try {
    const result = await request('', { method: 'POST', body: JSON.stringify({ name: companyName.value.trim(), makeDefault: makeDefault.value }) });
    applyCatalog(result); selected.value = result.company._id;
    companyName.value = ''; makeDefault.value = false; creating.value = false;
    feedback.value = 'Empresa guardada.';
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
async function setDefault() {
  if (!selected.value || props.disabled || busy.value) return;
  busy.value = true; error.value = ''; feedback.value = '';
  try {
    applyCatalog(await request('/default', { method: 'PUT', body: JSON.stringify({ companyId: selected.value }) }));
    feedback.value = 'Empresa predeterminada guardada.';
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="company-picker">
    <div class="company-selector">
      <label for="orderCompany">Empresa de la guia</label>
      <div class="company-controls">
        <select id="orderCompany" v-model="selected" required :disabled="disabled || busy"><option value="">Seleccionar empresa</option><option v-for="company in companies" :key="company._id" :value="company._id">{{ company.name }}{{ company._id === defaultCompanyId ? ' (predeterminada)' : '' }}</option></select>
        <button type="button" title="Agregar empresa" aria-label="Agregar empresa" :disabled="disabled || busy" @click="creating = !creating"><i class="mdi mdi-plus" aria-hidden="true" /></button>
        <button type="button" title="Usar empresa como predeterminada" aria-label="Usar empresa como predeterminada" :disabled="disabled || busy || !selected || selected === defaultCompanyId" @click="setDefault"><i class="mdi mdi-star-outline" aria-hidden="true" /></button>
        <button v-if="error" type="button" title="Recargar empresas" aria-label="Recargar empresas" :disabled="disabled || busy" @click="load"><i class="mdi mdi-refresh" aria-hidden="true" /></button>
      </div>
    </div>
    <form v-if="creating" class="company-create" @submit.prevent="create">
      <label>Nombre de empresa<input v-model="companyName" type="text" maxlength="140" required :disabled="disabled || busy" /></label>
      <label class="company-default"><input v-model="makeDefault" type="checkbox" :disabled="disabled || busy" /> Usar como predeterminada</label>
      <button type="submit" :disabled="disabled || busy"><i class="mdi mdi-content-save-outline" aria-hidden="true" /> Guardar empresa</button>
      <button type="button" title="Cancelar" aria-label="Cancelar empresa" :disabled="busy" @click="creating = false"><i class="mdi mdi-close" aria-hidden="true" /></button>
    </form>
    <p v-if="error" role="alert" class="company-error">{{ error }}</p><p v-if="feedback" role="status" class="company-feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.company-picker { padding-top: 16px; color: #f3f6fb; }
.company-selector { max-width: 650px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; min-width: 0; }
.company-controls { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
select, input[type=text] { width: 100%; min-width: 0; min-height: 44px; padding: 9px 12px; border-radius: 4px; border: 1px solid #a9c1ca; background: #fff; color: #17343d; font: inherit; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 9px 12px; border-radius: 4px; border: 1px solid #5a8491; color: #fff; background: #245e6d; font: inherit; cursor: pointer; flex-shrink: 0; }
.company-controls button { width: 44px; padding: 0; }
.mdi { font-size: 20px; } button:disabled { opacity: .55; cursor: default; }
.company-create { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 14px 0; border-bottom: 1px solid #35505e; }
.company-create > label:first-child { flex: 1 1 250px; }
.company-default { flex-direction: row; align-items: center; min-height: 44px; }
.company-error { color: #ffb4bd; margin: 8px 0; font-size: 13px; } .company-feedback { color: #abebc6; margin: 8px 0; font-size: 13px; }
</style>