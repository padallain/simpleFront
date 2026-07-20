<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const mainZones = ref([]);
const soloZones = ref([]);
const customZones = ref([]);
const territoryConfig = ref(null);
const territoryLoaded = ref(false);
const customZoneNameRefs = ref({});

const zoneState = reactive({});
const ruleState = reactive({});

const costoExterno = ref("0");
const porcentajeUtilidad = ref("100");
const vehicleState = reactive({
  unidades: [],
});
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("");
const serverResponse = ref(null);

const allZones = computed(() => [...mainZones.value, ...soloZones.value, ...customZones.value]);
const hasPresetMainZones = computed(() => mainZones.value.length > 0);
const hasPresetSoloZones = computed(() => soloZones.value.length > 0);
const hasAnyZoneRows = computed(() => allZones.value.length > 0);
const canWorkManually = computed(() => territoryLoaded.value || customZones.value.length > 0);

const todayLabel = new Date().toLocaleDateString("es-VE", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dispatchAssignments = computed(() => {
  const response = serverResponse.value;

  if (!response) {
    return [];
  }

  if (Array.isArray(response.plan) || Array.isArray(response.zonas_externo) || Array.isArray(response.zonas_mañana)) {
    const plan = Array.isArray(response.plan) ? response.plan : [];
    const externos = Array.isArray(response.zonas_externo) ? response.zonas_externo : [];
    const manana = Array.isArray(response.zonas_mañana) ? response.zonas_mañana : [];

    return [
      ...plan.map((item) => ({
        vehiculo: item.nombre_vehiculo || item.vehiculo,
        tipo: item.tipo,
        zonas: item.zonas || [],
        peso: item.kg_total,
        valor: item.valor_total_dolares,
        valorFacturado: item.valor_facturado_total_dolares,
        clientes: item.clientes_total,
        cajas: item.cajas_total,
        porcentajeOcupacion: item.porcentaje_ocupacion,
        capacidadKg: item.capacidad_kg,
        motivo: item.motivo,
      })),
      ...externos.map((item) => ({
        vehiculo: "Vehículo externo",
        tipo: "externo",
        zonas: item.zonas || [],
        peso: item.kg_total,
        valor: item.valor_dolares,
        valorFacturado: item.valor_facturado_dolares,
        clientes: item.clientes_total,
        cajas: item.cajas_total,
        costoExterno: item.costo_externo,
        gananciaNeta: item.ganancia_neta_si_externo,
        indicadorFlete: item.indicador_flete_porcentaje,
        motivo: item.razon,
      })),
      ...manana.map((item) => ({
        vehiculo: null,
        tipo: "posponer",
        zonas: item.zonas || [],
        peso: item.kg_total,
        valor: item.valor_dolares,
        valorFacturado: item.valor_facturado_dolares,
        clientes: item.clientes_total,
        cajas: item.cajas_total,
        costoExterno: (response.costo_externo_referencia ?? response.costoExterno ?? Number(costoExterno.value)) || 0,
        gananciaNeta: item.valor_dolares,
        motivo: item.razon,
      })),
    ];
  }

  return Array.isArray(response.asignaciones) ? response.asignaciones : [];
});

const optimizerStrategy = computed(() => serverResponse.value?.estrategia || null);

const summaryCards = computed(() => {
  const resumen = serverResponse.value?.resumen;

  if (!resumen) {
    return [];
  }

  const cards = [
    {
      label: "Vehículos propios",
      value: `${resumen.vehiculosUsados ?? resumen.vehiculos_propios_usados ?? resumen.vehiculos_usados ?? 0}/${resumen.vehiculosHabilitados ?? resumen.vehiculos_propios_habilitados ?? resumen.vehiculos_habilitados ?? 0}`,
      tone: "blue",
    },
    {
      label: "Vehículos fuera",
      value: String((resumen.vehiculosConfigurados ?? resumen.vehiculos_propios_configurados ?? resumen.vehiculos_configurados ?? 0) - (resumen.vehiculosHabilitados ?? resumen.vehiculos_propios_habilitados ?? resumen.vehiculos_habilitados ?? 0)),
      tone: "green",
    },
    { label: "Externos", value: String(resumen.externosRequeridos ?? serverResponse.value?.zonas_externo?.length ?? 0), tone: "gold" },
    { label: "Pospuestas", value: String(resumen.rutasPospuestas ?? serverResponse.value?.zonas_mañana?.length ?? 0), tone: "red" },
    { label: "Clientes despachados", value: String(resumen.totalClientesDespachados ?? resumen.clientes_despachados ?? 0), tone: "slate" },
    { label: "Facturado despachado", value: formatCurrency(resumen.totalFacturadoDespachado ?? resumen.facturado_despachado_hoy ?? 0), tone: "slate" },
    { label: "Ganancia estimada", value: formatCurrency(resumen.totalValorDespachado ?? resumen.valor_despachado_hoy), tone: "green-wide" },
  ];

  if (Number(resumen.totalValorPospuesto ?? resumen.valor_pendiente) > 0) {
    cards.push({
      label: "Ganancia pospuesta",
      value: formatCurrency(resumen.totalValorPospuesto ?? resumen.valor_pendiente),
      tone: "red-wide",
    });
  }

  if (Number(resumen.totalFacturadoPospuesto ?? resumen.facturado_pendiente) > 0) {
    cards.push({
      label: "Facturado pospuesto",
      value: formatCurrency(resumen.totalFacturadoPospuesto ?? resumen.facturado_pendiente),
      tone: "red",
    });
  }

  if (Number(resumen.totalClientesPospuestos ?? resumen.clientes_pendientes) > 0) {
    cards.push({
      label: "Clientes pospuestos",
      value: String(resumen.totalClientesPospuestos ?? resumen.clientes_pendientes ?? 0),
      tone: "red",
    });
  }

  return cards;
});

const activeZonesSummary = computed(() => {
  const response = serverResponse.value;

  if (!response) {
    return "Sin datos";
  }

  if (Array.isArray(response.zonasActivas) && response.zonasActivas.length) {
    return response.zonasActivas.join(", ");
  }

  if (Array.isArray(response.zonas_input) && response.zonas_input.length) {
    return response.zonas_input.map((zone) => zone.nombre).join(", ");
  }

  return "Sin datos";
});

function zoneRowClass(zoneId) {
  return {
    inactive: !zoneState[zoneId].enabled,
  };
}

function normalizeZoneName(value) {
  return String(value || "").trim().toUpperCase();
}

function createCustomZone() {
  const nextIndex = customZones.value.length + 1;
  return {
    id: `CUSTOM_${Date.now()}_${nextIndex}`,
    clientId: `CZ-${Date.now()}-${nextIndex}`,
    nombre: "",
    detalle: "Zona agregada manualmente para este calculo",
    solo: false,
    puedeIrCon: [],
    custom: true,
  };
}

function setCustomZoneNameRef(zoneId, element) {
  if (element) {
    customZoneNameRefs.value[zoneId] = element;
    return;
  }

  delete customZoneNameRefs.value[zoneId];
}

function createRuleState() {
  return {
    priority: "",
    dedicated: false,
    canGroupWith: "",
  };
}

function buildRuleMaps(configZonas) {
  const priorityMap = new Map(
    (configZonas?.prioritarias || []).map((item) => [normalizeZoneName(item?.nombre), Number(item?.peso) || 0]),
  );
  const dedicatedSet = new Set((configZonas?.dedicadas || []).map(normalizeZoneName).filter(Boolean));
  const incompatibleMap = new Map();

  (configZonas?.incompatibles || []).forEach((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return;
    }

    const [left, right] = pair.map(normalizeZoneName);
    if (!left || !right || left === right) {
      return;
    }

    if (!incompatibleMap.has(left)) {
      incompatibleMap.set(left, new Set());
    }

    incompatibleMap.get(left).add(right);
  });

  return { priorityMap, dedicatedSet, incompatibleMap };
}

function ensureZoneState(zones) {
  const activeIds = new Set(zones.map((zone) => zone.id));

  zones.forEach((zone) => {
    if (!zoneState[zone.id]) {
      zoneState[zone.id] = {
        enabled: true,
        peso: "",
        valor: "",
        clientes: "",
      };
    }
  });

  Object.keys(zoneState).forEach((zoneId) => {
    if (!activeIds.has(zoneId)) {
      delete zoneState[zoneId];
    }
  });
}

function ensureRuleState(zones, configZonas = territoryConfig.value) {
  const activeIds = new Set(zones.map((zone) => zone.id));
  const { priorityMap, dedicatedSet } = buildRuleMaps(configZonas);

  zones.forEach((zone) => {
    if (!ruleState[zone.id]) {
      const zoneName = normalizeZoneName(zone.nombre);
      ruleState[zone.id] = createRuleState();
      ruleState[zone.id].priority = priorityMap.get(zoneName) ? String(priorityMap.get(zoneName)) : "";
      ruleState[zone.id].dedicated = dedicatedSet.has(zoneName) || Boolean(zone.solo);
      ruleState[zone.id].canGroupWith = Array.isArray(zone.puedeIrCon) ? zone.puedeIrCon.join(", ") : "";
    }
  });

  Object.keys(ruleState).forEach((zoneId) => {
    if (!activeIds.has(zoneId)) {
      delete ruleState[zoneId];
    }
  });
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
  allZones.value.forEach((zone) => {
    zoneState[zone.id].enabled = true;
    zoneState[zone.id].peso = "";
    zoneState[zone.id].valor = "";
    zoneState[zone.id].clientes = "";
  });

  costoExterno.value = "0";
  porcentajeUtilidad.value = "100";
  clearFleetState();
  customZones.value = [];
  ensureRuleState([...mainZones.value, ...soloZones.value], territoryConfig.value);
  errorMessage.value = "";
  feedbackMessage.value = "";
  serverResponse.value = null;

  if (!territoryLoaded.value) {
    feedbackMessage.value = "Puedes seguir trabajando con zonas manuales aunque la configuración base no haya cargado.";
  }
}

function createVehicle() {
  const nextIndex = vehicleState.unidades.length + 1;

  return {
    id: `VEHICULO_${Date.now()}_${nextIndex}`,
    codigo: `VEHICULO_${nextIndex}`,
    nombre: `Vehículo ${nextIndex}`,
    capacidadKg: "",
    capacidadClientes: "",
    disponible: true,
    canServe: "",
  };
}

function clearFleetState() {
  vehicleState.unidades.splice(0, vehicleState.unidades.length);
}

function addVehicle() {
  vehicleState.unidades.push(createVehicle());
}

function removeVehicle(vehicleId) {
  const list = vehicleState.unidades;
  const index = list.findIndex((vehicle) => String(vehicle.id) === String(vehicleId));
  if (index >= 0) {
    list.splice(index, 1);
  }
}

function addCustomZone() {
  const zone = createCustomZone();
  zoneState[zone.id] = {
    enabled: true,
    peso: "",
    valor: "",
    clientes: "",
  };
  ruleState[zone.id] = createRuleState();
  customZones.value = [...customZones.value, zone];
  feedbackMessage.value = "Zona adicional lista para capturar.";

  nextTick(() => {
    customZoneNameRefs.value[zone.id]?.focus();
  });
}

function removeCustomZone(zoneId) {
  customZones.value = customZones.value.filter((zone) => zone.id !== zoneId);
  delete zoneState[zoneId];
  delete ruleState[zoneId];
  delete customZoneNameRefs.value[zoneId];
}

function buildZoneConfigPayload() {
  const prioritarias = [];
  const dedicadas = [];
  const incompatibles = [];
  const errors = [];
  const zoneNames = new Set();

  allZones.value.forEach((zone) => {
    const zoneName = normalizeZoneName(zone.nombre);
    if (zoneName) {
      zoneNames.add(zoneName);
    }
  });

  allZones.value.forEach((zone) => {
    const zoneName = normalizeZoneName(zone.nombre);
    const rule = ruleState[zone.id];

    if (!zoneName || !rule) {
      return;
    }

    const priority = Number(rule.priority);
    if (Number.isFinite(priority) && priority > 0) {
      prioritarias.push({ nombre: zoneName, peso: priority });
    }

    if (rule.dedicated) {
      dedicadas.push(zoneName);
    }

    const allowedTargets = String(rule.canGroupWith || "")
      .split(",")
      .map((value) => normalizeZoneName(value))
      .filter(Boolean);

    if (rule.dedicated) {
      zoneNames.forEach((otherZoneName) => {
        if (otherZoneName !== zoneName) {
          incompatibles.push([zoneName, otherZoneName]);
        }
      });
      return;
    }

    allowedTargets.forEach((targetName) => {
      if (targetName === zoneName) {
        errors.push(`La zona ${zoneName} no puede ponerse a si misma en "puede ir con".`);
        return;
      }

      if (!zoneNames.has(targetName)) {
        errors.push(`La zona ${zoneName} referencia ${targetName} en "puede ir con", pero esa zona no existe en el formulario.`);
      }
    });

    if (allowedTargets.length > 0) {
      zoneNames.forEach((otherZoneName) => {
        if (otherZoneName !== zoneName && !allowedTargets.includes(otherZoneName)) {
          incompatibles.push([zoneName, otherZoneName]);
        }
      });
    }
  });

  const uniquePairs = [];
  const seenPairs = new Set();

  incompatibles.forEach(([left, right]) => {
    const key = [left, right].sort().join("::");
    if (!seenPairs.has(key)) {
      seenPairs.add(key);
      uniquePairs.push([left, right]);
    }
  });

  return {
    errors,
    configZonas: {
      prioritarias,
      dedicadas,
      incompatibles: uniquePairs,
    },
  };
}

function buildPayload() {
  const zonas = {};
  const errors = [];

  allZones.value.forEach((zone) => {
    const state = zoneState[zone.id];
    const zoneName = normalizeZoneName(zone.nombre);

    if (!state.enabled) {
      return;
    }

    if (zone.custom && !zoneName && ((Number(state.peso) || 0) > 0 || (Number(state.valor) || 0) > 0 || (Number(state.clientes) || 0) > 0)) {
      errors.push("Las zonas agregadas manualmente deben tener nombre.");
      return;
    }

    if (!zoneName) {
      return;
    }

    const peso = Number(state.peso) || 0;
    const valor = Number(state.valor) || 0;
    const clientes = Number(state.clientes) || 0;

    if (peso > 0 || valor > 0 || clientes > 0) {
      if (zonas[zoneName]) {
        errors.push(`La zona ${zoneName} esta repetida. Usa un nombre unico.`);
        return;
      }

      zonas[zoneName] = {
        id: zone.clientId || zone.id,
        peso,
        valor,
        clientes,
      };
    }
  });

  const zoneConfigPayload = buildZoneConfigPayload();
  errors.push(...zoneConfigPayload.errors);

  const normalizedFleet = {
    unidades: vehicleState.unidades.map((vehiculo) => ({
      id: String(vehiculo.id || "").trim(),
      codigo: String(vehiculo.codigo || vehiculo.id || "").trim(),
      nombre: String(vehiculo.nombre || "").trim(),
      capacidadKg: Number(vehiculo.capacidadKg) || 0,
      capacidadClientes: Number(vehiculo.capacidadClientes) || 0,
      disponible: Boolean(vehiculo.disponible),
      zonasPermitidas: String(vehiculo.canServe || "")
        .split(",")
        .map((value) => normalizeZoneName(value))
        .filter(Boolean),
    })),
  };

  normalizedFleet.unidades.forEach((vehiculo, index) => {
    if (!vehiculo.disponible) {
      return;
    }

    if (!vehiculo.id) {
      errors.push(`El vehículo ${index + 1} debe tener ID.`);
    }

    if (!vehiculo.nombre) {
      errors.push(`El vehículo ${index + 1} debe tener nombre.`);
    }

    if (vehiculo.capacidadKg <= 0) {
      errors.push(`El vehículo ${vehiculo.nombre || index + 1} debe tener capacidad en kg mayor a cero.`);
    }

    if (vehiculo.capacidadClientes <= 0) {
      errors.push(`El vehículo ${vehiculo.nombre || index + 1} debe tener capacidad de clientes mayor a cero.`);
    }
  });

  return {
    zonas,
    errors,
    costoExterno: Number(costoExterno.value) || 0,
    porcentajeUtilidad: Number(porcentajeUtilidad.value) || 0,
    configZonas: zoneConfigPayload.configZonas,
    vehiculos: normalizedFleet,
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
    propio: "Propio",
    externo: "Externo",
    posponer: "Posponer",
  }[type] || "Sin tipo";
}

function assignmentTypeIcon(type) {
  return {
    propio: "VP",
    externo: "EX",
    posponer: "PP",
  }[type] || "--";
}

function assignmentExtraText(assignment) {
  const details = [];

  if (assignment.motivo) {
    details.push(assignment.motivo);
  }

  if (Number(assignment.valorFacturado) > 0) {
    details.push(`Facturado: ${formatCurrency(assignment.valorFacturado)}`);
  }

  if (Number(assignment.porcentajeOcupacion) > 0) {
    details.push(`Ocupación: ${assignment.porcentajeOcupacion}%`);
  }

  if (assignment.tipo === "externo") {
    if (Number(assignment.indicadorFlete) > 0) {
      details.push(`Flete: ${assignment.indicadorFlete}% del valor`);
    }
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

async function loadDispatchConfig() {
  errorMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/dispatch/config`);
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.territory) {
      throw new Error(result?.error || "No se pudo cargar la configuración del territorio.");
    }

    // El front opera solo con zonas manuales para evitar territorio fijo en la UI.
    mainZones.value = [];
    soloZones.value = [];
    territoryConfig.value = result.territory.configZonas || null;
    ensureZoneState([...mainZones.value, ...soloZones.value]);
    ensureRuleState([...mainZones.value, ...soloZones.value], territoryConfig.value);
    territoryLoaded.value = true;
  } catch (error) {
    territoryLoaded.value = false;
    feedbackMessage.value = "No se pudo cargar la configuración base del territorio. Puedes agregar zonas manuales y definir sus condiciones desde el frontend.";
    errorMessage.value = "";
  }
}

async function calculateDispatch() {
  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";
  serverResponse.value = null;

  try {
    const payload = buildPayload();

    if (payload.errors.length) {
      errorMessage.value = payload.errors[0];
      return;
    }

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
    const activeCount = Array.isArray(result.zonasActivas)
      ? result.zonasActivas.length
      : Array.isArray(result.zonas_input)
        ? result.zonas_input.length
        : 0;
    feedbackMessage.value = `Plan generado para ${activeCount} zona(s) activa(s).`;
  } catch (error) {
    errorMessage.value = `Error calculando despacho: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDispatchConfig();
});
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

        <div v-if="hasPresetMainZones" class="section-block">
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
                <tr v-for="zone in mainZones" :key="zone.id" :class="zoneRowClass(zone.id)">
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

        <div v-if="hasPresetSoloZones" class="section-block">
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
                <tr v-for="zone in soloZones" :key="zone.id" :class="zoneRowClass(zone.id)">
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
                  <td class="hint-cell">{{ zone.detalle || "Zona independiente" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-block">
          <div class="section-header-inline">
            <span class="section-label">Zonas del cálculo</span>
            <button class="mini-button" type="button" @click="addCustomZone">
              Agregar zona
            </button>
          </div>

          <div v-if="customZones.length" class="table-shell">
            <table class="zone-table">
              <thead>
                <tr>
                  <th>Activa</th>
                  <th>ID</th>
                  <th>Zona</th>
                  <th>Peso (kg)</th>
                  <th>Valor ($)</th>
                  <th>Clientes</th>
                  <th>Detalle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="zone in customZones" :key="zone.id" :class="zoneRowClass(zone.id)">
                  <td class="center-cell">
                    <input v-model="zoneState[zone.id].enabled" class="toggle" type="checkbox" @change="onToggle(zone.id)" />
                  </td>
                  <td>
                    <input
                      v-model="zone.clientId"
                      class="zone-input"
                      type="text"
                      placeholder="ID de la zona"
                    />
                  </td>
                  <td>
                    <input
                      v-model="zone.nombre"
                      :ref="(element) => setCustomZoneNameRef(zone.id, element)"
                      class="zone-input"
                      type="text"
                      placeholder="Nombre de la zona"
                    />
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
                  <td class="hint-cell">{{ zone.detalle }}</td>
                  <td class="center-cell">
                    <button class="remove-zone-button" type="button" @click="removeCustomZone(zone.id)">
                      Quitar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="empty-custom-zones">
            No hay zonas precargadas. Agrega aquí las zonas que quieras usar en este cálculo.
          </p>
        </div>

        <div class="section-block">
          <div class="card-title-row card-title-row-tight">
            <div>
              <strong>Condiciones del optimizador</strong>
              <p>Define prioridad, salida en solitario y zonas que pueden ir juntas.</p>
            </div>
          </div>

          <div class="table-shell">
            <table class="zone-table rules-table">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Prioridad</th>
                  <th>Sale sola</th>
                  <th>Puede ir con</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="zone in allZones" :key="`rule-${zone.id}`">
                  <td>
                    <div class="zone-name">
                      <span class="zone-dot" :class="{ 'zone-dot-solo': zone.solo || zone.custom }" />
                      <div>
                        <strong>{{ zone.nombre || 'Zona nueva' }}</strong>
                        <p class="rule-zone-note">ID: {{ zone.clientId || zone.id }} · {{ zone.custom ? 'Configuracion manual para esta corrida' : (zone.combina || zone.detalle || 'Configuracion base') }}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      v-model="ruleState[zone.id].priority"
                      class="zone-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </td>
                  <td class="center-cell">
                    <input v-model="ruleState[zone.id].dedicated" class="toggle" type="checkbox" />
                  </td>
                  <td>
                    <input
                      v-model="ruleState[zone.id].canGroupWith"
                      class="zone-input"
                      type="text"
                      placeholder="Ej. ZONA_A, ZONA_B"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="fleet-grid">
        <article class="fleet-card">
          <div class="fleet-card-head">
            <div>
              <span>Vehículos propios</span>
              <strong>{{ enabledVehiclesCount(vehicleState.unidades) }}/{{ vehicleState.unidades.length }} habilitados</strong>
              <small>Agrega manualmente cada vehículo, su capacidad y las zonas que puede atender.</small>
            </div>
            <button class="mini-button" type="button" @click="addVehicle">Agregar</button>
          </div>
          <div class="vehicle-list">
            <p v-if="!vehicleState.unidades.length" class="empty-custom-zones">
              No hay vehículos cargados. Agrégalos manualmente para esta corrida.
            </p>
            <div v-for="vehiculo in vehicleState.unidades" :key="vehiculo.id" class="vehicle-editor">
              <div class="vehicle-editor-row">
                <input v-model="vehiculo.id" class="zone-input" type="text" placeholder="ID" />
                <input v-model="vehiculo.nombre" class="zone-input" type="text" placeholder="Nombre" />
              </div>
              <div class="vehicle-editor-row vehicle-editor-row-compact">
                <input v-model="vehiculo.capacidadKg" class="zone-input" type="number" min="0" step="1" placeholder="Cap. kg" />
                <input v-model="vehiculo.capacidadClientes" class="zone-input" type="number" min="0" step="1" placeholder="Cap. clientes" />
              </div>
              <div class="vehicle-editor-row">
                <input v-model="vehiculo.canServe" class="zone-input" type="text" placeholder="Zonas permitidas, ej. ZONA_A, ZONA_B" />
                <input v-model="vehiculo.codigo" class="zone-input" type="text" placeholder="Código interno" />
              </div>
              <div class="vehicle-toggle-actions">
                <label class="vehicle-toggle-row">
                  <input v-model="vehiculo.disponible" type="checkbox" />
                  <span>Disponible</span>
                </label>
                <button class="remove-zone-button" type="button" @click="removeVehicle(vehiculo.id)">Quitar</button>
              </div>
            </div>
          </div>
        </article>
        <article class="fleet-card fleet-card-form">
          <label for="costoExterno">Costo vehículo externo ($)</label>
          <input id="costoExterno" v-model="costoExterno" class="zone-input" type="number" min="0" step="500" placeholder="0" />
          <small>Se usa cuando la flota propia no alcanza.</small>
          <label for="porcentajeUtilidad" style="margin-top: 1rem;">% utilidad sobre facturado</label>
          <input id="porcentajeUtilidad" v-model="porcentajeUtilidad" class="zone-input" type="number" min="0" max="100" step="0.1" placeholder="100" />
          <small>El optimizador usará este porcentaje del monto facturado como ganancia estimada.</small>
        </article>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" :disabled="loading || !canWorkManually" @click="calculateDispatch">
          {{ loading ? "Calculando..." : "Calcular plan" }}
        </button>
        <button class="ghost-button" type="button" :disabled="!hasAnyZoneRows" @click="resetForm">
          Limpiar
        </button>
        <button class="ghost-button" type="button" @click="window.print()">
          Imprimir
        </button>
      </div>

      <p v-if="!territoryLoaded && !feedbackMessage && !errorMessage" class="feedback success-text">
        Cargando configuración de territorio...
      </p>

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
              <p>Resultado del optimizador desacoplado: flota propia, externos y rutas pospuestas usando el contrato nuevo del backend.</p>
            </div>
          </div>

          <div v-if="optimizerStrategy" class="strategy-grid">
            <article class="strategy-card">
              <span class="strategy-label">Motor</span>
              <strong>{{ optimizerStrategy.busqueda_completa ? "Búsqueda completa" : "Búsqueda parcial" }}</strong>
              <p>{{ optimizerStrategy.criterio }}</p>
            </article>
            <article class="strategy-card">
              <span class="strategy-label">Combinaciones evaluadas</span>
              <strong>{{ Number(optimizerStrategy.combinaciones_evaluadas || 0).toLocaleString('es-VE') }}</strong>
              <p>Prioridad pospuesta: {{ optimizerStrategy.prioridad_pospuesta || 0 }}</p>
            </article>
            <article class="strategy-card">
              <span class="strategy-label">Valor neto óptimo</span>
              <strong>{{ formatCurrency(optimizerStrategy.valor_neto_optimo) }}</strong>
              <p>Zonas atendidas hoy: {{ optimizerStrategy.zonas_atendidas_hoy?.length || 0 }}</p>
            </article>
          </div>

          <div v-if="serverResponse.recomendaciones?.length" class="recommendations-panel">
            <strong>Recomendaciones operativas</strong>
            <ul class="recommendations-list">
              <li v-for="note in serverResponse.recomendaciones" :key="note">{{ note }}</li>
            </ul>
          </div>

          <div class="assignments-list">
            <article v-for="assignment in dispatchAssignments" :key="`${assignment.tipo}-${assignment.vehiculo || 'pendiente'}-${assignment.zonas.join('-')}`" class="assignment-card" :class="`assignment-card-${assignment.tipo}`">
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

.card-title-row-tight {
  margin-bottom: 0.8rem;
}

.section-block + .section-block {
  margin-top: 1.25rem;
}

.section-header-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
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

.rules-table {
  min-width: 980px;
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

.rule-zone-note {
  margin-top: 0.2rem;
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.84rem;
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

.mini-button,
.remove-zone-button {
  min-height: 36px;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.mini-button {
  border: 1px solid rgba(97, 241, 178, 0.34);
  background: rgba(97, 241, 178, 0.1);
  color: #baf9d9;
}

.remove-zone-button {
  border: 1px solid rgba(255, 125, 125, 0.24);
  background: rgba(255, 125, 125, 0.08);
  color: #ffc1c1;
}

.empty-custom-zones {
  padding: 1rem 1.1rem;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  color: rgba(243, 246, 251, 0.68);
  background: rgba(255, 255, 255, 0.03);
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

.fleet-card-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
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

.vehicle-editor {
  padding: 0.75rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.vehicle-editor-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1.4fr);
  gap: 0.65rem;
}

.vehicle-editor-row + .vehicle-editor-row {
  margin-top: 0.65rem;
}

.vehicle-editor-row-compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.vehicle-toggle-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.75rem;
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

.strategy-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.strategy-card {
  padding: 1rem 1.05rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 19, 30, 0.72);
}

.strategy-label {
  display: block;
  color: rgba(243, 246, 251, 0.68);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
}

.strategy-card strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 1.2rem;
}

.strategy-card p {
  margin-top: 0.45rem;
  color: rgba(243, 246, 251, 0.72);
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

.assignment-card-propio {
  border-left: 4px solid #53b7ff;
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

.zone-pill-propio {
  border-color: rgba(83, 183, 255, 0.34);
  background: rgba(83, 183, 255, 0.12);
  color: #8cd8ff;
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

  .strategy-grid {
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

  .section-header-inline {
    flex-direction: column;
    align-items: stretch;
  }

  .fleet-card-head,
  .vehicle-toggle-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .vehicle-editor-row,
  .vehicle-editor-row-compact {
    grid-template-columns: 1fr;
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