<template>
  <section class="daily-check-page">
    <div class="daily-check-shell">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="page-kicker">Control diario</p>
          <h2>Reporte Diario del Vehículo</h2>
          <p class="page-subtitle">
            Registra el estado operativo del vehículo, captura incidencias y guarda el reporte con un formato más claro en escritorio y móvil.
          </p>
        </div>
        <RouterLink class="history-link" to="/daily-check-history">
          Ver historial de reportes
        </RouterLink>
        <RouterLink class="history-link" to="/vehicle-maintenance-history">
          Historial de mantenimiento
        </RouterLink>
      </div>

      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">Items revisados</span>
          <strong class="stat-value">{{ totalChecks }}</strong>
        </article>
        <article class="stat-card stat-card-ok">
          <span class="stat-label">Marcados OK</span>
          <strong class="stat-value">{{ okCount }}</strong>
        </article>
        <article class="stat-card stat-card-alert">
          <span class="stat-label">Marcados No OK</span>
          <strong class="stat-value">{{ noOkCount }}</strong>
        </article>
      </div>

      <form @submit.prevent="enviarNovedades" class="form-container">
        <section class="panel-card">
          <div class="panel-header">
            <h3>Datos del vehículo</h3>
          </div>

          <div class="details-grid">
            <div class="field-group">
              <label for="chofer" class="form-label">Nombre del chofer</label>
              <input id="chofer" type="text" v-model="chofer" required />
            </div>
            <div class="field-group">
              <label for="placa" class="form-label">Placa del vehículo</label>
              <input id="placa" type="text" v-model="placa" required />
            </div>
            <div class="field-group">
              <label for="modelo" class="form-label">Modelo</label>
              <input id="modelo" type="text" v-model="modelo" required />
            </div>
            <div class="field-group">
              <label for="anio" class="form-label">Año</label>
              <input id="anio" type="number" v-model="anio" min="1900" max="2100" required />
            </div>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-header">
            <h3>Checklist de inspección</h3>
            <span class="panel-meta">Selecciona una única opción por item</span>
          </div>

          <div class="checklist-grid">
            <article
              v-for="(item, idx) in checklist"
              :key="item.nombre"
              class="check-card"
              :class="{
                'check-card-ok': item.estado === 'OK',
                'check-card-alert': item.estado === 'NO_OK',
              }"
            >
              <div class="check-card-header">
                <span class="check-item-name">{{ item.nombre }}</span>
                <span class="check-status" :class="item.estado ? `status-${item.estado.toLowerCase()}` : 'status-pending'">
                  {{ item.estado || 'Pendiente' }}
                </span>
              </div>

              <div class="toggle-group">
                <label class="toggle-option">
                  <input
                    type="checkbox"
                    :checked="item.estado === 'OK'"
                    @change="setEstado(idx, $event.target.checked ? 'OK' : null)"
                  />
                  <span>OK</span>
                </label>
                <label class="toggle-option toggle-option-alert">
                  <input
                    type="checkbox"
                    :checked="item.estado === 'NO_OK'"
                    @change="setEstado(idx, $event.target.checked ? 'NO_OK' : null)"
                  />
                  <span>No OK</span>
                </label>
              </div>

              <input
                v-if="item.estado === 'NO_OK'"
                type="text"
                v-model="item.comentario"
                class="issue-input"
                placeholder="Describe el problema"
                :required="item.estado === 'NO_OK'"
              />
            </article>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-header">
            <h3>Observaciones adicionales</h3>
          </div>
          <div class="field-group field-group-full">
            <label class="form-label" for="observaciones">Notas</label>
            <textarea id="observaciones" v-model="observaciones" rows="4" placeholder="Agrega detalles relevantes del turno o del vehículo" />
          </div>
        </section>

        <div class="submit-status" aria-live="polite">
          <div v-if="enviando" class="status-card status-card-sending">
            <span class="status-icon status-icon-spinner" aria-hidden="true"></span>
            <div>
              <strong>Enviando reporte...</strong>
              <p>Estamos guardando el chequeo del vehiculo en el sistema.</p>
            </div>
          </div>

          <div v-else-if="ultimoEnvio" class="status-card status-card-success">
            <span class="status-icon status-icon-success" aria-hidden="true">✓</span>
            <div>
              <strong>Reporte enviado correctamente</strong>
              <p>
                {{ ultimoEnvio.chofer }} · {{ ultimoEnvio.placa }} · {{ ultimoEnvio.fecha }}
              </p>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="!todosCompletos || enviando">
            {{ enviando ? "Guardando reporte..." : "Enviar reporte" }}
          </button>
        </div>
      </form>

      <div v-if="errorMensaje" class="feedback-banner feedback-banner-error">
        {{ errorMensaje }}
      </div>
      <div v-if="enviado" class="feedback-banner feedback-banner-success">
        <span class="checkmark">&#10003;</span>
        <span>¡Novedades enviadas!</span>
      </div>

      <div class="mobile-status-stack" aria-live="polite">
        <div v-if="enviando" class="mobile-status-card mobile-status-card-sending">
          <span class="mobile-status-icon mobile-status-icon-spinner" aria-hidden="true"></span>
          <div>
            <strong>Guardando reporte...</strong>
            <p>No cierres la pantalla hasta recibir la confirmacion.</p>
          </div>
        </div>

        <div v-else-if="ultimoEnvio" class="mobile-status-card mobile-status-card-success">
          <span class="mobile-status-icon mobile-status-icon-success" aria-hidden="true">✓</span>
          <div>
            <strong>Reporte guardado</strong>
            <p>{{ ultimoEnvio.chofer }} · {{ ultimoEnvio.placa }} · {{ ultimoEnvio.fecha }}</p>
          </div>
        </div>

        <div v-else-if="errorMensaje" class="mobile-status-card mobile-status-card-error">
          <span class="mobile-status-icon mobile-status-icon-error" aria-hidden="true">!</span>
          <div>
            <strong>No se pudo guardar</strong>
            <p>{{ errorMensaje }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const DAILY_CHECK_API_URL = `${API_BASE_URL}/dailyCheck`;

const chofer = ref("");
const placa = ref("");
const modelo = ref("");
const anio = ref("");

const checklist = ref([
  { nombre: "Luces", estado: null, comentario: "" },
  { nombre: "Frenos", estado: null, comentario: "" },
  { nombre: "Aceite", estado: null, comentario: "" },
  { nombre: "Neumáticos", estado: null, comentario: "" },
  { nombre: "Documentación", estado: null, comentario: "" },
  { nombre: "Agua o refrigerante", estado: null, comentario: "" },
  { nombre: "Batería", estado: null, comentario: "" },
  { nombre: "Aceite de dirección", estado: null, comentario: "" },
  { nombre: "Retrovisores y cristales", estado: null, comentario: "" },
  { nombre: "Líquido de frenos", estado: null, comentario: "" },
]);

const observaciones = ref("");
const enviado = ref(false);
const errorMensaje = ref("");
const enviando = ref(false);
const ultimoEnvio = ref(null);

const totalChecks = computed(() => checklist.value.length);
const okCount = computed(() => checklist.value.filter((item) => item.estado === "OK").length);
const noOkCount = computed(() => checklist.value.filter((item) => item.estado === "NO_OK").length);

function setEstado(idx, estado) {
  checklist.value[idx].estado = estado;

  if (estado !== "NO_OK") {
    checklist.value[idx].comentario = "";
  }
}

function resetFormulario() {
  chofer.value = "";
  placa.value = "";
  modelo.value = "";
  anio.value = "";
  observaciones.value = "";
  checklist.value = checklist.value.map((item) => ({
    ...item,
    estado: null,
    comentario: "",
  }));
}

async function enviarNovedades() {
  enviando.value = true;
  errorMensaje.value = "";
  enviado.value = false;
  ultimoEnvio.value = null;

  try {
    const payload = {
      chofer: chofer.value.trim(),
      placa: placa.value.trim(),
      modelo: modelo.value.trim(),
      anio: Number(anio.value),
      checklist: checklist.value.map((item) => ({
        nombre: item.nombre,
        estado: item.estado,
        comentario: item.comentario.trim(),
      })),
      observaciones: observaciones.value.trim(),
    };

    const response = await fetch(DAILY_CHECK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "No se pudo guardar el reporte diario");
    }

    enviado.value = true;
    ultimoEnvio.value = {
      chofer: payload.chofer,
      placa: payload.placa,
      fecha: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    resetFormulario();
    setTimeout(() => {
      enviado.value = false;
    }, 3000);
  } catch (error) {
    errorMensaje.value = error.message;
  } finally {
    enviando.value = false;
  }
}

const todosCompletos = computed(
  () =>
    chofer.value &&
    placa.value &&
    modelo.value &&
    anio.value &&
    checklist.value.every(
      (item) => item.estado && (item.estado !== "NO_OK" || item.comentario.trim()),
    ),
);
</script>

<style scoped>
.daily-check-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(69, 167, 255, 0.16), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 153, 102, 0.14), transparent 24%),
    linear-gradient(180deg, #09111d 0%, #11213a 50%, #09111d 100%);
}

.daily-check-shell {
  max-width: 1180px;
  margin: 0 auto;
  color: #f4f7fb;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1.5rem;
}

.page-header-copy {
  max-width: 760px;
}

.page-kicker {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.1rem);
}

.page-subtitle {
  margin: 0.9rem 0 0;
  color: rgba(244, 247, 251, 0.74);
}

.history-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 1rem;
  border-radius: 999px;
  background: rgba(231, 240, 255, 0.92);
  color: #0b57d0;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card,
.panel-card,
.feedback-banner {
  border-radius: 24px;
  background: rgba(8, 17, 31, 0.68);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.stat-card {
  padding: 1rem 1.2rem;
}

.stat-card-ok {
  border-color: rgba(46, 204, 113, 0.25);
}

.stat-card-alert {
  border-color: rgba(255, 153, 102, 0.28);
}

.stat-label {
  display: block;
  color: rgba(244, 247, 251, 0.68);
}

.stat-value {
  display: block;
  margin-top: 0.4rem;
  font-size: 2rem;
}

.form-container {
  display: grid;
  gap: 1rem;
}

.panel-card {
  padding: 1.2rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.panel-header h3 {
  margin: 0;
}

.panel-meta {
  color: rgba(244, 247, 251, 0.68);
  font-size: 0.92rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group-full {
  width: 100%;
}

.form-label {
  font-weight: 500;
  color: #f4f7fb;
}

button {
  min-height: 52px;
  padding: 0.9rem 1.5rem;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: white;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
}

input[type="text"],
input[type="number"],
textarea {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 0.9rem 1rem;
  color: #1f2937;
}

.checklist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.check-card {
  padding: 1rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.12);
}

.check-card-ok {
  border-color: rgba(46, 204, 113, 0.28);
}

.check-card-alert {
  border-color: rgba(255, 153, 102, 0.3);
}

.check-card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.9rem;
}

.check-item-name {
  font-weight: 700;
}

.check-status {
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

.status-pending {
  background: rgba(148, 163, 184, 0.2);
  color: #dbe4f0;
}

.status-ok {
  background: rgba(46, 204, 113, 0.18);
  color: #7df0a9;
}

.status-no_ok {
  background: rgba(255, 153, 102, 0.18);
  color: #ffc39d;
}

.toggle-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.toggle-option {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.toggle-option-alert {
  background: rgba(255, 153, 102, 0.08);
}

.issue-input {
  margin-top: 0.9rem;
}


.form-actions {
  display: flex;
  justify-content: flex-end;
}

.submit-status {
  min-height: 0;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(8, 17, 31, 0.72);
  animation: fadeInScale 0.24s ease;
}

.status-card strong {
  display: block;
  color: #f4f7fb;
}

.status-card p {
  margin: 0.25rem 0 0;
  color: rgba(244, 247, 251, 0.72);
}

.status-card-sending {
  border-color: rgba(69, 167, 255, 0.3);
}

.status-card-success {
  border-color: rgba(46, 204, 113, 0.24);
  background: rgba(18, 44, 31, 0.78);
}

.status-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-icon-spinner {
  border: 3px solid rgba(69, 167, 255, 0.18);
  border-top-color: #45a7ff;
  animation: spin 0.9s linear infinite;
}

.status-icon-success {
  background: rgba(46, 204, 113, 0.18);
  color: #7df0a9;
  font-size: 1.3rem;
  font-weight: 800;
  box-shadow: 0 0 0 10px rgba(46, 204, 113, 0.08);
}

.feedback-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1.2rem;
  margin-top: 1rem;
}

.feedback-banner-success {
  color: #7df0a9;
}

.feedback-banner-error {
  color: #ffb4b4;
  font-weight: 600;
}

.checkmark {
  display: inline-block;
  font-size: 2rem;
  animation: pop 0.4s;
}

.mobile-status-stack {
  display: none;
}

@keyframes pop {
  0% { transform: scale(0.2); opacity: 0; }
  80% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); }
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.95);}
  to { opacity: 1; transform: scale(1);}
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .stats-grid,
  .details-grid,
  .checklist-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .daily-check-page {
    padding: 1rem 0.75rem 6.5rem;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .history-link,
  .form-actions button {
    width: 100%;
  }

  .panel-header,
  .check-card-header,
  .toggle-group {
    flex-direction: column;
    align-items: stretch;
  }

  .toggle-option {
    justify-content: center;
  }

  .form-actions {
    justify-content: stretch;
  }

  .submit-status,
  .feedback-banner {
    display: none;
  }

  .mobile-status-stack {
    display: block;
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 300;
    pointer-events: none;
  }

  .mobile-status-card {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.95rem 1rem;
    border-radius: 20px;
    border: 1px solid rgba(159, 209, 255, 0.16);
    background: rgba(6, 16, 29, 0.94);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    animation: slideUpFade 0.24s ease;
  }

  .mobile-status-card strong {
    display: block;
    color: #f4f7fb;
  }

  .mobile-status-card p {
    margin: 0.2rem 0 0;
    color: rgba(244, 247, 251, 0.78);
    font-size: 0.92rem;
  }

  .mobile-status-card-sending {
    border-color: rgba(69, 167, 255, 0.28);
  }

  .mobile-status-card-success {
    border-color: rgba(46, 204, 113, 0.26);
    background: rgba(12, 36, 27, 0.95);
  }

  .mobile-status-card-error {
    border-color: rgba(248, 113, 113, 0.26);
    background: rgba(68, 22, 22, 0.95);
  }

  .mobile-status-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mobile-status-icon-spinner {
    border: 3px solid rgba(69, 167, 255, 0.16);
    border-top-color: #45a7ff;
    animation: spin 0.9s linear infinite;
  }

  .mobile-status-icon-success {
    background: rgba(46, 204, 113, 0.16);
    color: #7df0a9;
    font-size: 1.1rem;
    font-weight: 800;
  }

  .mobile-status-icon-error {
    background: rgba(248, 113, 113, 0.18);
    color: #ffb4b4;
    font-size: 1rem;
    font-weight: 800;
  }
}
</style>

