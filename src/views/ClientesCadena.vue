<script setup>
import { ref } from "vue";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

// --- Búsqueda de cadena ---
const buscarId = ref("");
const buscando = ref(false);
const cadenaEncontrada = ref(null);
const buscarError = ref("");

// --- Registro de nueva sede ---
const nuevaSucursal = ref("");
const nuevaLatitud = ref("");
const nuevaLongitud = ref("");
const guardando = ref(false);
const registroFeedback = ref(null);

// --- Registro de cliente nuevo (no cadena) ---
const nuevoId = ref("");
const nuevoNombre = ref("");
const nuevaSucursalNuevo = ref("");
const nuevoLat = ref("");
const nuevoLon = ref("");
const nuevoStart = ref("08:00:00");
const nuevoEnd = ref("17:00:00");
const guardandoNuevo = ref(false);
const nuevoFeedback = ref(null);

function resetRegistro() {
  nuevaSucursal.value = "";
  nuevaLatitud.value = "";
  nuevaLongitud.value = "";
  registroFeedback.value = null;
}

async function buscarCadena() {
  const id = buscarId.value.trim();
  if (!id) {
    buscarError.value = "Ingresa un ID para buscar.";
    return;
  }

  buscando.value = true;
  buscarError.value = "";
  cadenaEncontrada.value = null;
  resetRegistro();

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${id}/sedes`);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      buscarError.value = data?.message || "Cliente no encontrado.";
      return;
    }

    cadenaEncontrada.value = data;
  } catch {
    buscarError.value = "No se pudo conectar con el servidor.";
  } finally {
    buscando.value = false;
  }
}

async function registrarSede() {
  if (!cadenaEncontrada.value) return;

  const sucursal = nuevaSucursal.value.trim();
  const lat = Number(nuevaLatitud.value);
  const lon = Number(nuevaLongitud.value);

  if (!sucursal) {
    registroFeedback.value = { type: "error", message: "Escribe el nombre de la sede (ej. 'Sede Norte')." };
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    registroFeedback.value = { type: "error", message: "Latitud y longitud deben ser numeros validos." };
    return;
  }

  guardando.value = true;
  registroFeedback.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/registerClient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cadenaEncontrada.value.id,
        nombre: cadenaEncontrada.value.nombre,
        sucursal,
        latitude: lat,
        longitude: lon,
        start: "08:00:00",
        end: "17:00:00",
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      registroFeedback.value = { type: "success", message: `Sede "${sucursal}" registrada correctamente.` };
      resetRegistro();
      await buscarCadena();
    } else {
      registroFeedback.value = { type: "error", message: data?.message || "No se pudo registrar la sede." };
    }
  } catch {
    registroFeedback.value = { type: "error", message: "Error de conexion con el servidor." };
  } finally {
    guardando.value = false;
  }
}

async function registrarNuevoCliente() {
  const id = nuevoId.value.trim();
  const nombre = nuevoNombre.value.trim();
  const sucursal = nuevaSucursalNuevo.value.trim();
  const lat = Number(nuevoLat.value);
  const lon = Number(nuevoLon.value);

  if (!id || !nombre || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    nuevoFeedback.value = { type: "error", message: "ID, nombre, latitud y longitud son obligatorios." };
    return;
  }

  guardandoNuevo.value = true;
  nuevoFeedback.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/registerClient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        nombre,
        sucursal,
        latitude: lat,
        longitude: lon,
        start: nuevoStart.value || "08:00:00",
        end: nuevoEnd.value || "17:00:00",
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      nuevoFeedback.value = { type: "success", message: `Cliente "${nombre}" registrado correctamente.` };
      nuevoId.value = "";
      nuevoNombre.value = "";
      nuevaSucursalNuevo.value = "";
      nuevoLat.value = "";
      nuevoLon.value = "";
    } else {
      nuevoFeedback.value = { type: "error", message: data?.message || "No se pudo registrar el cliente." };
    }
  } catch {
    nuevoFeedback.value = { type: "error", message: "Error de conexion con el servidor." };
  } finally {
    guardandoNuevo.value = false;
  }
}

function mapsLink(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}
</script>

<template>
  <section class="cadena-page">
    <div class="cadena-shell">
      <div class="page-hero">
        <p class="page-kicker">Clientes especiales</p>
        <h1 class="page-title">Gestion de cadenas y sedes</h1>
        <p class="page-subtitle">
          Administra clientes que tienen el mismo ID pero distintas ubicaciones (cadenas, franquicias, sucursales).
          Busca el ID del cliente para ver sus sedes o agregar una nueva.
        </p>
      </div>

      <!-- Búsqueda de cadena existente -->
      <div class="section-card">
        <h2 class="section-title">Buscar cadena por ID</h2>
        <p class="section-desc">Ingresa el ID del cliente para ver todas sus sedes registradas y agregar una nueva.</p>

        <div class="search-row">
          <input
            v-model="buscarId"
            type="text"
            placeholder="ID del cliente (ej. J-12345678-9)"
            class="field-input"
            @keyup.enter="buscarCadena"
          />
          <button class="btn-primary" :disabled="buscando" @click="buscarCadena">
            {{ buscando ? "Buscando..." : "Buscar" }}
          </button>
        </div>

        <p v-if="buscarError" class="feedback-error">{{ buscarError }}</p>

        <div v-if="cadenaEncontrada" class="cadena-result">
          <div class="cadena-header">
            <div>
              <p class="cadena-kicker">{{ cadenaEncontrada.esCadena ? "Cliente cadena" : "Cliente individual" }}</p>
              <h3>{{ cadenaEncontrada.nombre }}</h3>
              <p class="cadena-id">ID: {{ cadenaEncontrada.id }} · {{ cadenaEncontrada.totalSedes }} sede(s) registrada(s)</p>
            </div>
          </div>

          <div class="sedes-grid">
            <article
              v-for="sede in cadenaEncontrada.sedes"
              :key="sede.sucursal || '_principal'"
              class="sede-card"
            >
              <div class="sede-card-header">
                <strong>{{ sede.sucursal || 'Sede principal' }}</strong>
                <a
                  v-if="sede.location"
                  :href="mapsLink(sede.location.latitude, sede.location.longitude)"
                  target="_blank"
                  class="maps-chip"
                >Ver mapa</a>
              </div>
              <p class="sede-coords">
                {{ sede.location?.latitude }}, {{ sede.location?.longitude }}
              </p>
            </article>
          </div>

          <!-- Agregar nueva sede a esta cadena -->
          <div class="add-sede-form">
            <h4>Agregar nueva sede a {{ cadenaEncontrada.nombre }}</h4>
            <div class="form-grid-3">
              <div class="field-group">
                <label>Nombre de la sede</label>
                <input v-model="nuevaSucursal" type="text" class="field-input" placeholder="Ej. Sede Norte" />
              </div>
              <div class="field-group">
                <label>Latitud</label>
                <input v-model="nuevaLatitud" type="number" step="any" class="field-input" placeholder="10.578..." />
              </div>
              <div class="field-group">
                <label>Longitud</label>
                <input v-model="nuevaLongitud" type="number" step="any" class="field-input" placeholder="-71.673..." />
              </div>
            </div>
            <button class="btn-primary" :disabled="guardando" @click="registrarSede">
              {{ guardando ? "Registrando..." : "Registrar sede" }}
            </button>
            <div v-if="registroFeedback" :class="['feedback-box', `feedback-${registroFeedback.type}`]">
              {{ registroFeedback.message }}
            </div>
          </div>
        </div>
      </div>

      <!-- Registro de cliente nuevo (con o sin sucursal) -->
      <div class="section-card">
        <h2 class="section-title">Registrar cliente nuevo</h2>
        <p class="section-desc">
          Para un cliente normal deja el campo "Sede" en blanco. Para registrar la primera sede de una cadena nueva, escribe el nombre de la sede.
        </p>

        <div class="form-grid-2">
          <div class="field-group">
            <label>ID del cliente *</label>
            <input v-model="nuevoId" type="text" class="field-input" placeholder="Ej. J-12345678-9" />
          </div>
          <div class="field-group">
            <label>Nombre del cliente *</label>
            <input v-model="nuevoNombre" type="text" class="field-input" placeholder="Ej. FARMATODO" />
          </div>
          <div class="field-group">
            <label>Sede (dejar vacío si no es cadena)</label>
            <input v-model="nuevaSucursalNuevo" type="text" class="field-input" placeholder="Ej. Sede Centro" />
          </div>
          <div class="field-group">
            <label>Latitud *</label>
            <input v-model="nuevoLat" type="number" step="any" class="field-input" placeholder="10.578..." />
          </div>
          <div class="field-group">
            <label>Longitud *</label>
            <input v-model="nuevoLon" type="number" step="any" class="field-input" placeholder="-71.673..." />
          </div>
          <div class="field-group">
            <label>Hora inicio atención</label>
            <input v-model="nuevoStart" type="text" class="field-input" placeholder="08:00:00" />
          </div>
          <div class="field-group">
            <label>Hora fin atención</label>
            <input v-model="nuevoEnd" type="text" class="field-input" placeholder="17:00:00" />
          </div>
        </div>

        <button class="btn-primary" :disabled="guardandoNuevo" @click="registrarNuevoCliente">
          {{ guardandoNuevo ? "Registrando..." : "Registrar cliente" }}
        </button>

        <div v-if="nuevoFeedback" :class="['feedback-box', `feedback-${nuevoFeedback.type}`]">
          {{ nuevoFeedback.message }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cadena-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(87, 140, 255, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(124, 58, 237, 0.16), transparent 28%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.cadena-shell {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  gap: 1.5rem;
}

.page-hero { margin-bottom: 0.5rem; }

.page-kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.page-title {
  margin: 0;
  color: #f3f6fb;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.page-subtitle {
  max-width: 720px;
  margin: 0.9rem 0 0;
  color: rgba(243, 246, 251, 0.76);
}

.section-card {
  padding: 1.5rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
  display: grid;
  gap: 1rem;
}

.section-title {
  margin: 0;
  color: #f3f6fb;
  font-size: 1.25rem;
}

.section-desc {
  margin: 0;
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.95rem;
}

.search-row {
  display: flex;
  gap: 0.8rem;
  align-items: stretch;
  flex-wrap: wrap;
}

.field-input {
  padding: 0.8rem 1rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
}

.search-row .field-input {
  flex: 1 1 220px;
  width: auto;
}

.btn-primary {
  min-height: 46px;
  padding: 0.8rem 1.5rem;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d95f5 0%, #0a4cb8 100%);
}

.feedback-error { color: #ffb4b4; margin: 0; }

.cadena-result {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.18);
}

.cadena-kicker {
  margin: 0 0 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.75rem;
  color: #9fd1ff;
}

.cadena-header h3 { margin: 0; color: #f3f6fb; }

.cadena-id {
  margin: 0.3rem 0 0;
  color: rgba(243, 246, 251, 0.65);
  font-size: 0.9rem;
}

.sedes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.sede-card {
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.16);
}

.sede-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  color: #f3f6fb;
}

.maps-chip {
  font-size: 0.78rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(69, 167, 255, 0.18);
  color: #9fd1ff;
  text-decoration: none;
  white-space: nowrap;
}

.sede-coords {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  color: rgba(243, 246, 251, 0.55);
}

.add-sede-form {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 16px;
  border: 1px dashed rgba(69, 167, 255, 0.3);
  background: rgba(69, 167, 255, 0.05);
}

.add-sede-form h4 {
  margin: 0;
  color: #9fd1ff;
  font-size: 1rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  color: rgba(243, 246, 251, 0.85);
  font-size: 0.9rem;
  font-weight: 500;
}

.feedback-box {
  padding: 0.85rem 1rem;
  border-radius: 14px;
  font-size: 0.95rem;
}

.feedback-success {
  color: #8df0b4;
  background: rgba(22, 52, 36, 0.5);
  border: 1px solid rgba(42, 181, 125, 0.3);
}

.feedback-error {
  color: #ffb4b4;
  background: rgba(86, 26, 26, 0.45);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

@media (max-width: 640px) {
  .form-grid-2,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }

  .search-row {
    flex-direction: column;
  }
}
</style>
