<script setup>
import { computed, reactive, ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const MAIN_ZONES = [
  { id: "SUR", nombre: "SUR", combina: "CENTRO u OESTE", solo: false },
  { id: "CENTRO", nombre: "CENTRO", combina: "NORTE o SUR", solo: false },
  { id: "OESTE", nombre: "OESTE", combina: "NORTE o SUR", solo: false },
  { id: "NORTE", nombre: "NORTE", combina: "CENTRO u OESTE", solo: false },
  { id: "OJEDA", nombre: "OJEDA", combina: "Puede salir sola o con MENEGRANDE y BACHAQUERO", solo: false },
  { id: "MENEGRANDE", nombre: "MENEGRANDE", combina: "Siempre con OJEDA si OJEDA esta activa. No apta para camioneta", solo: false },
  { id: "CABIMAS", nombre: "CABIMAS", combina: "Sale sola", solo: false },
  { id: "BACHAQUERO", nombre: "BACHAQUERO", combina: "Siempre con OJEDA si OJEDA esta activa", solo: false },
];

const SOLO_ZONES = [
  { id: "MACHIQUES", nombre: "MACHIQUES", combina: "", solo: true },
  { id: "PUERTOS", nombre: "PUERTOS", combina: "", solo: true },
  { id: "CONCEPCION", nombre: "CONCEPCIÓN", combina: "", solo: true },
  { id: "MARA", nombre: "MARA", combina: "", solo: true },
];

const ALL_ZONES = [...MAIN_ZONES, ...SOLO_ZONES];
const DEFAULT_VANS = [
  { id: 1, nombre: "Camioneta 1", disponible: true },
  { id: 2, nombre: "Camioneta 2", disponible: true },
  { id: 3, nombre: "Camioneta 3", disponible: true },
];
const DEFAULT_TRUCKS = [
  { id: 1, nombre: "Camión 1", disponible: true },
  { id: 2, nombre: "Camión 2", disponible: true },
  { id: 3, nombre: "Camión 3", disponible: true },
];

const zoneState = reactive(Object.fromEntries(
  ALL_ZONES.map((zone) => [zone.id, {
    enabled: true,
    peso: "",
    valor: "",
    clientes: "",
  }]),
));

const costoExterno = ref("0");
const vehicleState = reactive({
  camionetas: DEFAULT_VANS.map((vehiculo) => ({ ...vehiculo })),
  camiones: DEFAULT_TRUCKS.map((vehiculo) => ({ ...vehiculo })),
});
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("");
const serverResponse = ref(null);

const todayLabel = new Date().toLocaleDateString("es-VE", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const summaryCards = computed(() => {
  const resumen = serverResponse.value?.resumen;

  if (!resumen) {
    return [];
  }

  const cards = [
    { label: "Camionetas", value: `${resumen.camionetasUsadas}/${resumen.camionetasHabilitadas}`, tone: "blue" },
    { label: "Camiones", value: `${resumen.camionesUsados}/${resumen.camionesHabilitados}`, tone: "green" },
    { label: "Camionetas fuera", value: String(resumen.camionetasConfiguradas - resumen.camionetasHabilitadas), tone: "slate" },
    { label: "Camiones fuera", value: String(resumen.camionesConfigurados - resumen.camionesHabilitados), tone: "slate" },
    { label: "Externos", value: String(resumen.externosRequeridos), tone: "gold" },
    { label: "Pospuestas", value: String(resumen.rutasPospuestas), tone: "red" },
    { label: "Clientes despachados", value: String(resumen.totalClientesDespachados || 0), tone: "slate" },
    { label: "Valor despachado", value: formatCurrency(resumen.totalValorDespachado), tone: "green-wide" },
  ];

  if (Number(resumen.totalValorPospuesto) > 0) {
    cards.push({
      label: "Valor pospuesto",
      value: formatCurrency(resumen.totalValorPospuesto),
      tone: "red-wide",
    });
  }

  if (Number(resumen.totalClientesPospuestos) > 0) {
    cards.push({
      label: "Clientes pospuestos",
      value: String(resumen.totalClientesPospuestos || 0),
      tone: "red",
    });
  }

  return cards;
});

const activeZonesSummary = computed(() => serverResponse.value?.zonasActivas?.join(", ") || "Sin datos");

function zoneRowClass(zoneId) {
  return {
    inactive: !zoneState[zoneId].enabled,
  };
}

function onToggle(zoneId) {
  if (!zoneState[zoneId].enabled) {
    zoneState[zoneId].peso = "";
    zoneState[zoneId].valor = "";
    zoneState[zoneId].clientes = "";
  }
}

function onZoneInput(zoneId) {
  const peso = Number(zoneState[zoneId].peso);
  const valor = Number(zoneState[zoneId].valor);
  const clientes = Number(zoneState[zoneId].clientes);

  if (peso > 0 || valor > 0 || clientes > 0) {
    zoneState[zoneId].enabled = true;
  }
}

function resetForm() {
  ALL_ZONES.forEach((zone) => {
    zoneState[zone.id].enabled = true;
    zoneState[zone.id].peso = "";
    zoneState[zone.id].valor = "";
    zoneState[zone.id].clientes = "";
  });

  costoExterno.value = "0";
  vehicleState.camionetas.splice(0, vehicleState.camionetas.length, ...DEFAULT_VANS.map((vehiculo) => ({ ...vehiculo })));
  vehicleState.camiones.splice(0, vehicleState.camiones.length, ...DEFAULT_TRUCKS.map((vehiculo) => ({ ...vehiculo })));
  errorMessage.value = "";
  feedbackMessage.value = "";
  serverResponse.value = null;
}

function buildPayload() {
  const zonas = {};

  ALL_ZONES.forEach((zone) => {
    const state = zoneState[zone.id];

    if (!state.enabled) {
      return;
    }

    const peso = Number(state.peso) || 0;
    const valor = Number(state.valor) || 0;
    const clientes = Number(state.clientes) || 0;

    if (peso > 0 || valor > 0 || clientes > 0) {
      zonas[zone.nombre] = {
        peso,
        valor,
        clientes,
      };
    }
  });

  return {
    zonas,
    costoExterno: Number(costoExterno.value) || 0,
    vehiculos: {
      camionetas: vehicleState.camionetas.map((vehiculo) => ({
        id: vehiculo.id,
        disponible: Boolean(vehiculo.disponible),
      })),
      camiones: vehicleState.camiones.map((vehiculo) => ({
        id: vehiculo.id,
        disponible: Boolean(vehiculo.disponible),
      })),
    },
  };
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString("es-VE", { minimumFractionDigits: 0 })}`;
}

function formatWeight(value) {
  return `${Number(value || 0).toLocaleString("es-VE")} kg`;
}

function assignmentTypeLabel(type) {
  return {
    camioneta: "Camioneta",
    camion: "Camión",
    externo: "Externo",
    posponer: "Posponer",
  }[type] || "Sin tipo";
}

function assignmentTypeIcon(type) {
  return {
    camioneta: "RV",
    camion: "CM",
    externo: "EX",
    posponer: "PP",
  }[type] || "--";
}

function assignmentExtraText(assignment) {
  const details = [];

  if (assignment.motivo) {
    details.push(assignment.motivo);
  }

  if (assignment.tipo === "externo") {
    details.push(`Ganancia neta: ${formatCurrency(assignment.gananciaNeta)}`);
    return details.join(" · ");
  }

  if (assignment.tipo === "posponer") {
    if (Number(assignment.costoExterno) > 0) {
      details.push(`Valor (${formatCurrency(assignment.valor)}) <= costo externo (${formatCurrency(assignment.costoExterno)})`);
      return details.join(" · ");
    }

    details.push("Flota propia excedida y sin costo externo configurado.");
    return details.join(" · ");
  }

  return details.join(" · ");
}

function enabledVehiclesCount(vehicles) {
  return vehicles.filter((vehiculo) => vehiculo.disponible).length;
}

function soloZoneTypeLabel(zoneId) {
  if (zoneId === "MACHIQUES" || zoneId === "MARA") {
    return "Zona independiente / solo camión";
  }

  return "Zona independiente";
}

async function calculateDispatch() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";
  serverResponse.value = null;

  try {
    const payload = buildPayload();

    if (!Object.keys(payload.zonas).length) {
      errorMessage.value = "Carga al menos una zona con peso o valor antes de calcular.";
      return;
    }

    const response = await fetch(`${API_BASE_URL}/dispatch/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.error || "No se pudo calcular el plan de despacho.";
      return;
    }

    serverResponse.value = result;
    feedbackMessage.value = `Plan generado para ${result.zonasActivas.length} zona(s) activa(s).`;
  } catch (error) {
    errorMessage.value = `Error calculando despacho: ${error.message}`;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="dispatch-control-page">
    <div class="dispatch-shell">
      <div class="hero-panel">
        <div>
          <p class="eyebrow">Dispatch Control</p>
          <h1>Planificador de despachos</h1>
          <p class="hero-copy">
            Carga peso, valor y clientes por zona para decidir cómo sale la flota propia, qué rutas van a externo y qué queda pospuesto.
          </p>
        </div>

        <div class="hero-meta">
          <span class="hero-badge">IO v1.0</span>
          <small>{{ todayLabel }}</small>
        </div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <div>
            <strong>Datos de zonas</strong>
            <p>Activa cada zona y carga los kilos, el valor y los clientes a despachar.</p>
          </div>
        </div>

        <div class="section-block">
          <span class="section-label">Zonas principales</span>
          <div class="table-shell">
            <table class="zone-table">
              <thead>
                <tr>
                  <th>Activa</th>
                  <th>Zona</th>
                  <th>Peso (kg)</th>
                  <th>Valor ($)</th>
                  <th>Clientes</th>
                  <th>Combina con</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="zone in MAIN_ZONES" :key="zone.id" :class="zoneRowClass(zone.id)">
                  <td class="center-cell">
                    <input v-model="zoneState[zone.id].enabled" class="toggle" type="checkbox" @change="onToggle(zone.id)" />
                  </td>
                  <td>
                    <div class="zone-name">
                      <span class="zone-dot" />
                      <strong>{{ zone.nombre }}</strong>
                    </div>
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].peso"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 kg"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].valor"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="$0"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].clientes"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 clientes"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td class="hint-cell">{{ zone.combina }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-block">
          <span class="section-label">Zonas independientes</span>
          <div class="table-shell">
            <table class="zone-table">
              <thead>
                <tr>
                  <th>Activa</th>
                  <th>Zona</th>
                  <th>Peso (kg)</th>
                  <th>Valor ($)</th>
                  <th>Clientes</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="zone in SOLO_ZONES" :key="zone.id" :class="zoneRowClass(zone.id)">
                  <td class="center-cell">
                    <input v-model="zoneState[zone.id].enabled" class="toggle" type="checkbox" @change="onToggle(zone.id)" />
                  </td>
                  <td>
                    <div class="zone-name">
                      <span class="zone-dot zone-dot-solo" />
                      <strong>{{ zone.nombre }}</strong>
                    </div>
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].peso"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 kg"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].valor"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="$0"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="zoneState[zone.id].clientes"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 clientes"
                      :disabled="!zoneState[zone.id].enabled"
                      @input="onZoneInput(zone.id)"
                    />
                  </td>
                  <td class="hint-cell">{{ soloZoneTypeLabel(zone.id) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="fleet-grid">
        <article class="fleet-card">
          <span>Camionetas propias</span>
          <strong>{{ enabledVehiclesCount(vehicleState.camionetas) }}/{{ vehicleState.camionetas.length }} habilitadas</strong>
          <small>Capacidad unitaria: 950 kg y 40 clientes</small>
          <div class="vehicle-list">
            <label v-for="vehiculo in vehicleState.camionetas" :key="vehiculo.nombre" class="vehicle-toggle-row">
              <input v-model="vehiculo.disponible" type="checkbox" />
              <span>{{ vehiculo.nombre }}</span>
            </label>
          </div>
        </article>
        <article class="fleet-card">
          <span>Camiones propios</span>
          <strong>{{ enabledVehiclesCount(vehicleState.camiones) }}/{{ vehicleState.camiones.length }} habilitados</strong>
          <small>Capacidad unitaria: 5.000 kg y 30 clientes</small>
          <div class="vehicle-list">
            <label v-for="vehiculo in vehicleState.camiones" :key="vehiculo.nombre" class="vehicle-toggle-row">
              <input v-model="vehiculo.disponible" type="checkbox" />
              <span>{{ vehiculo.nombre }}</span>
            </label>
          </div>
        </article>
        <article class="fleet-card fleet-card-form">
          <label for="costoExterno">Costo vehículo externo ($)</label>
          <input id="costoExterno" v-model="costoExterno" class="zone-input" type="number" min="0" step="500" placeholder="0" />
          <small>Se usa cuando la flota propia no alcanza.</small>
        </article>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" :disabled="loading" @click="calculateDispatch">
          {{ loading ? "Calculando..." : "Calcular plan" }}
        </button>
        <button class="ghost-button" type="button" @click="resetForm">
          Limpiar
        </button>
        <button class="ghost-button" type="button" @click="window.print()">
          Imprimir
        </button>
      </div>

      <p v-if="errorMessage" class="feedback error-text">
        {{ errorMessage }}
      </p>

      <p v-else-if="feedbackMessage" class="feedback success-text">
        {{ feedbackMessage }}
      </p>

      <template v-if="serverResponse">
        <div class="summary-grid">
          <article v-for="card in summaryCards" :key="`${card.label}-${card.value}`" class="summary-card" :class="`summary-card-${card.tone}`">
            <span class="summary-label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </article>
        </div>

        <div class="card">
          <div class="card-title-row">
            <div>
              <strong>Asignaciones de vehículos</strong>
              <p>Resultado del motor de despacho priorizando cobertura, camionetas en zonas flexibles y apoyo de camión cuando hace falta.</p>
            </div>
          </div>

          <div v-if="serverResponse.recomendaciones?.length" class="recommendations-panel">
            <strong>Recomendaciones operativas</strong>
            <ul class="recommendations-list">
              <li v-for="note in serverResponse.recomendaciones" :key="note">{{ note }}</li>
            </ul>
          </div>

          <div class="assignments-list">
            <article v-for="assignment in serverResponse.asignaciones" :key="`${assignment.tipo}-${assignment.vehiculo || 'pendiente'}-${assignment.zonas.join('-')}`" class="assignment-card" :class="`assignment-card-${assignment.tipo}`">
              <div class="assignment-head">
                <div class="assignment-chip">{{ assignmentTypeIcon(assignment.tipo) }}</div>
                <div>
                  <strong>{{ assignment.vehiculo || "Sin asignar" }}</strong>
                  <p>{{ assignmentTypeLabel(assignment.tipo) }}</p>
                </div>
              </div>

              <div class="assignment-zones">
                <span v-for="zone in assignment.zonas" :key="`${assignment.vehiculo}-${zone}`" class="zone-pill" :class="`zone-pill-${assignment.tipo}`">
                  {{ zone }}
                </span>
              </div>

              <div class="assignment-metrics">
                <span>{{ formatWeight(assignment.peso) }}</span>
                <span>{{ assignment.clientes || 0 }} clientes</span>
                <strong>{{ formatCurrency(assignment.valor) }}</strong>
                <small v-if="assignmentExtraText(assignment)">{{ assignmentExtraText(assignment) }}</small>
              </div>
            </article>
          </div>

          <p class="result-footer">
            Generado: <strong>{{ new Date(serverResponse.fecha).toLocaleString("es-VE") }}</strong>
            · Zonas activas: <strong>{{ activeZonesSummary }}</strong>
          </p>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.dispatch-control-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  color: #f3f6fb;
  background:
    radial-gradient(circle at top left, rgba(61, 180, 128, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(255, 176, 59, 0.18), transparent 26%),
    linear-gradient(180deg, #0b1622 0%, #11243a 58%, #0c1724 100%);
}

.dispatch-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #b7ffd9;
}

h1,
p,
strong {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
}

.hero-copy {
  max-width: 720px;
  margin-top: 0.85rem;
  color: rgba(243, 246, 251, 0.74);
}

.hero-meta {
  display: grid;
  gap: 0.55rem;
  justify-items: end;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: #ffd36c;
  color: #132033;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.72rem;
}

.hero-meta small {
  color: rgba(243, 246, 251, 0.7);
}

.card {
  margin-bottom: 1.35rem;
  padding: 1.4rem;
  border-radius: 24px;
  border: 1px solid rgba(185, 225, 255, 0.14);
  background: rgba(7, 16, 27, 0.72);
  box-shadow: 0 24px 56px rgba(3, 10, 22, 0.22);
  backdrop-filter: blur(12px);
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.card-title-row p {
  margin-top: 0.4rem;
  color: rgba(243, 246, 251, 0.68);
}

.section-block + .section-block {
  margin-top: 1.25rem;
}

.section-label {
  display: inline-block;
  margin-bottom: 0.8rem;
  color: #9ee7c4;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.74rem;
  font-weight: 800;
}

.table-shell {
  overflow-x: auto;
}

.zone-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
}

.zone-table th {
  padding: 0 0.85rem 0.8rem;
  color: rgba(243, 246, 251, 0.62);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.73rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.zone-table td {
  padding: 0.9rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.zone-table tbody tr:last-child td {
  border-bottom: none;
}

.zone-table tbody tr.inactive td {
  opacity: 0.4;
}

.center-cell {
  text-align: center;
}

.toggle {
  width: 18px;
  height: 18px;
  accent-color: #4ce5a5;
}

.zone-name {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.zone-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #53b7ff;
}

.zone-dot-solo {
  background: #ffbe55;
}

.zone-input {
  width: 100%;
  min-height: 42px;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(4, 11, 19, 0.78);
  color: #eff6ff;
}

.zone-input:focus {
  outline: none;
  border-color: rgba(159, 232, 193, 0.8);
  box-shadow: 0 0 0 3px rgba(76, 229, 165, 0.12);
}

.zone-input:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.hint-cell {
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.9rem;
}

.fleet-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.fleet-card {
  padding: 1.15rem 1.2rem;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(7, 16, 27, 0.68);
}

.fleet-card span,
.fleet-card label,
.fleet-card small {
  display: block;
}

.fleet-card span,
.fleet-card label {
  color: rgba(243, 246, 251, 0.68);
}

.fleet-card strong {
  display: block;
  margin-top: 0.4rem;
  font-size: 1.55rem;
}

.fleet-card-form small {
  margin-top: 0.45rem;
  color: rgba(243, 246, 251, 0.56);
}

.fleet-card > small {
  margin-top: 0.35rem;
  color: rgba(243, 246, 251, 0.58);
}

.vehicle-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.9rem;
}

.vehicle-toggle-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.vehicle-toggle-row input {
  width: 16px;
  height: 16px;
  accent-color: #4ce5a5;
}

.fleet-card-form .zone-input {
  margin-top: 0.65rem;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: center;
  margin-bottom: 1rem;
}

.primary-button,
.ghost-button {
  min-height: 44px;
  padding: 0.8rem 1.2rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

.primary-button {
  border: none;
  background: linear-gradient(135deg, #61f1b2 0%, #d9ff77 100%);
  color: #112239;
}

.ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(7, 18, 35, 0.52);
  color: #e9f2ff;
}

.primary-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.primary-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.feedback {
  margin: 0 0 1rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  font-weight: 600;
}

.error-text {
  border: 1px solid rgba(255, 111, 97, 0.45);
  background: rgba(255, 111, 97, 0.14);
  color: #ffc2bb;
}

.success-text {
  border: 1px solid rgba(94, 236, 176, 0.4);
  background: rgba(94, 236, 176, 0.14);
  color: #d7ffec;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
  margin-bottom: 1.2rem;
}

.summary-card {
  padding: 1rem 1.05rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 19, 30, 0.72);
}

.summary-card strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 1.75rem;
}

.summary-label {
  color: rgba(243, 246, 251, 0.68);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
}

.summary-card-blue strong { color: #7fd4ff; }
.summary-card-green strong { color: #72f0b7; }
.summary-card-slate strong { color: #c3d4ea; }
.summary-card-gold strong { color: #ffcb74; }
.summary-card-red strong { color: #ff8b86; }
.summary-card-green-wide strong { color: #72f0b7; font-size: 1.35rem; }
.summary-card-red-wide strong { color: #ff8b86; font-size: 1.35rem; }

.assignments-list {
  display: grid;
  gap: 0.9rem;
}

.recommendations-panel {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 19, 30, 0.72);
}

.recommendations-panel strong {
  display: block;
  margin-bottom: 0.65rem;
}

.recommendations-list {
  margin: 0;
  padding-left: 1.1rem;
  color: rgba(243, 246, 251, 0.76);
}

.recommendations-list li + li {
  margin-top: 0.4rem;
}

.assignment-card {
  display: grid;
  grid-template-columns: minmax(180px, 220px) 1fr minmax(150px, 180px);
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.assignment-card-camioneta {
  border-left: 4px solid #53b7ff;
}

.assignment-card-camion {
  border-left: 4px solid #50d98b;
}

.assignment-card-externo {
  border-left: 4px solid #ffbe55;
  background: rgba(255, 190, 85, 0.08);
}

.assignment-card-posponer {
  border-left: 4px solid #ff7d7d;
  background: rgba(255, 125, 125, 0.08);
}

.assignment-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.assignment-head p {
  margin-top: 0.2rem;
  color: rgba(243, 246, 251, 0.64);
  font-size: 0.9rem;
}

.assignment-chip {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.assignment-zones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.zone-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.82rem;
  font-weight: 700;
}

.zone-pill-camioneta {
  border-color: rgba(83, 183, 255, 0.34);
  background: rgba(83, 183, 255, 0.12);
  color: #8cd8ff;
}

.zone-pill-camion {
  border-color: rgba(80, 217, 139, 0.34);
  background: rgba(80, 217, 139, 0.12);
  color: #9af3c3;
}

.zone-pill-externo {
  border-color: rgba(255, 190, 85, 0.34);
  background: rgba(255, 190, 85, 0.12);
  color: #ffd391;
}

.zone-pill-posponer {
  border-color: rgba(255, 125, 125, 0.34);
  background: rgba(255, 125, 125, 0.12);
  color: #ffc1c1;
}

.assignment-metrics {
  text-align: right;
}

.assignment-metrics span,
.assignment-metrics small {
  display: block;
}

.assignment-metrics span {
  color: rgba(243, 246, 251, 0.62);
}

.assignment-metrics strong {
  display: block;
  margin-top: 0.28rem;
  font-size: 1.05rem;
}

.assignment-metrics small {
  margin-top: 0.35rem;
  color: rgba(243, 246, 251, 0.68);
}

.result-footer {
  margin-top: 1rem;
  color: rgba(243, 246, 251, 0.7);
}

@media (max-width: 980px) {
  .fleet-grid {
    grid-template-columns: 1fr;
  }

  .assignment-card {
    grid-template-columns: 1fr;
  }

  .assignment-metrics {
    text-align: left;
  }
}

@media (max-width: 720px) {
  .hero-panel {
    flex-direction: column;
  }

  .hero-meta {
    justify-items: start;
  }

  .card,
  .fleet-card,
  .summary-card,
  .assignment-card {
    border-radius: 18px;
  }
}
</style>