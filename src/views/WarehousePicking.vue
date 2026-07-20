<script setup>
import { computed, onMounted, ref } from "vue";
import { fetchSession, getAuthState } from "../services/auth";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const sessionUser = ref(getAuthState().user || null);
const numeroPedido = ref("");
const numeroCajas = ref("");

const isSaving = ref(false);
const serverResponse = ref(null);
const lastReceipt = ref(null);

const responsableId = computed(() => {
  const user = sessionUser.value || {};
  return String(user.username || user.email || user.id || "").trim().toUpperCase();
});

const fieldErrors = ref({
  numeroPedido: "",
  numeroCajas: "",
});

function resetFieldErrors() {
  fieldErrors.value = { numeroPedido: "", numeroCajas: "" };
}

function clearFieldError(field) {
  fieldErrors.value = { ...fieldErrors.value, [field]: "" };
}

function validateForm() {
  const errors = [];
  resetFieldErrors();

  if (!responsableId.value.trim()) {
    const msg = "No se encontro la sesion del almacenista. Inicia sesion de nuevo.";
    errors.push(msg);
  }

  if (!numeroPedido.value.trim()) {
    const msg = "Falta el ID del pedido.";
    errors.push(msg);
    fieldErrors.value.numeroPedido = msg;
  }

  const cajasNum = Number(numeroCajas.value);
  if (!numeroCajas.value || !Number.isInteger(cajasNum) || cajasNum < 1) {
    const msg = "El numero de cajas debe ser un entero mayor a 0.";
    errors.push(msg);
    fieldErrors.value.numeroCajas = msg;
  }

  return errors;
}

function resetForm() {
  numeroPedido.value = "";
  numeroCajas.value = "";
  resetFieldErrors();
}

async function loadSessionUser() {
  try {
    const sessionState = await fetchSession();
    sessionUser.value = sessionState.user || null;
  } catch {
    sessionUser.value = null;
  }
}

async function registrarPicking() {
  const errors = validateForm();

  if (errors.length > 0) {
    serverResponse.value = {
      type: "error",
      title: "Revisa el formulario",
      message: "Corrige los campos marcados antes de registrar.",
      details: errors,
    };
    return;
  }

  isSaving.value = true;
  serverResponse.value = null;
  lastReceipt.value = null;

  try {
    const payload = {
      numeroPedido: numeroPedido.value.trim(),
      numeroCajas: Number(numeroCajas.value),
    };

    const response = await fetch(`${API_BASE_URL}/picking-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (response.ok) {
      lastReceipt.value = {
        responsableId: String(result?.pickingReport?.responsableId || responsableId.value).trim(),
        numeroPedido: payload.numeroPedido,
        numeroCajas: payload.numeroCajas,
        time: new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      serverResponse.value = {
        type: "success",
        title: "Picking registrado",
        message: result?.message || "El picking se guardo correctamente.",
      };
      resetForm();
    } else if (response.status === 409) {
      serverResponse.value = {
        type: "error",
        title: "Pedido duplicado",
        message: result?.message || "Ese numero de pedido ya fue registrado.",
      };
    } else {
      serverResponse.value = {
        type: "error",
        title: "No se pudo registrar",
        message: result?.message || "Ocurrio un error al guardar el picking.",
      };
    }
  } catch {
    serverResponse.value = {
      type: "error",
      title: "Sin conexion con el servidor",
      message: "No fue posible comunicarse con el servidor. Intenta de nuevo.",
    };
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  loadSessionUser();
});
</script>

<template>
  <section class="picking-page">
    <div class="picking-container">
      <div class="page-hero">
        <p class="page-kicker">Almacen</p>
        <h1 class="page-title">Registro de Picking</h1>
        <p class="page-subtitle">
          Registra el pedido que terminaste de picar. El almacenista se toma directamente de la sesion iniciada.
        </p>
      </div>

      <div class="form-card">
        <div class="submission-strip" aria-live="polite">
          <div v-if="isSaving" class="submission-strip-card submission-strip-pending">
            <span class="submission-orbit" aria-hidden="true"></span>
            <div>
              <strong>Registrando picking...</strong>
              <p>Estamos guardando tu reporte en el servidor.</p>
            </div>
          </div>

          <div v-else-if="lastReceipt" class="submission-strip-card submission-strip-success">
            <span class="submission-check" aria-hidden="true">✓</span>
            <div>
              <strong>Reporte confirmado</strong>
              <p>Pedido {{ lastReceipt.numeroPedido }} · {{ lastReceipt.numeroCajas }} cajas · {{ lastReceipt.time }}</p>
            </div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group form-group-full">
            <label>Almacenista en sesion</label>
            <div class="session-pill" :class="{ 'session-pill-error': !responsableId }">
              {{ responsableId || 'Sesion no disponible' }}
            </div>
          </div>

          <div class="form-group">
            <label for="numeroPedido">ID del pedido</label>
            <input
              id="numeroPedido"
              type="text"
              v-model="numeroPedido"
              :class="{ 'input-error': fieldErrors.numeroPedido }"
              placeholder="Ej. PED-2024-001"
              autocomplete="off"
              @input="clearFieldError('numeroPedido')"
            />
            <p v-if="fieldErrors.numeroPedido" class="field-error">{{ fieldErrors.numeroPedido }}</p>
          </div>

          <div class="form-group form-group-full">
            <label for="numeroCajas">Numero de cajas</label>
            <input
              id="numeroCajas"
              type="number"
              inputmode="numeric"
              v-model="numeroCajas"
              :class="{ 'input-error': fieldErrors.numeroCajas }"
              placeholder="Ej. 12"
              min="1"
              @input="clearFieldError('numeroCajas')"
            />
            <p v-if="fieldErrors.numeroCajas" class="field-error">{{ fieldErrors.numeroCajas }}</p>
          </div>
        </div>

        <div class="button-group">
          <button class="save-btn" :disabled="isSaving" @click="registrarPicking">
            {{ isSaving ? "Registrando..." : "Registrar picking" }}
          </button>
          <button class="clear-btn" :disabled="isSaving" @click="resetForm">
            Limpiar
          </button>
        </div>
      </div>

      <div
        v-if="serverResponse"
        :class="['response-card', `response-card-${serverResponse.type}`]"
      >
        <strong>{{ serverResponse.title }}</strong>
        <p class="response-message">{{ serverResponse.message }}</p>
        <ul v-if="serverResponse.details?.length" class="response-list">
          <li v-for="detail in serverResponse.details" :key="detail">{{ detail }}</li>
        </ul>
      </div>

      <div class="mobile-status-stack" aria-live="polite">
        <div v-if="isSaving" class="mobile-status-card mobile-status-card-sending">
          <span class="mobile-status-icon mobile-status-icon-spinner" aria-hidden="true"></span>
          <div>
            <strong>Registrando picking...</strong>
            <p>No cierres la pantalla hasta ver la confirmacion.</p>
          </div>
        </div>

        <div v-else-if="lastReceipt" class="mobile-status-card mobile-status-card-success">
          <span class="mobile-status-icon mobile-status-icon-success" aria-hidden="true">✓</span>
          <div>
            <strong>Picking guardado</strong>
            <p>Pedido {{ lastReceipt.numeroPedido }} · {{ lastReceipt.numeroCajas }} cajas · {{ lastReceipt.time }}</p>
          </div>
        </div>

        <div v-else-if="serverResponse?.type === 'error'" class="mobile-status-card mobile-status-card-error">
          <span class="mobile-status-icon mobile-status-icon-error" aria-hidden="true">!</span>
          <div>
            <strong>{{ serverResponse.title }}</strong>
            <p>{{ serverResponse.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.picking-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(87, 140, 255, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(124, 58, 237, 0.16), transparent 28%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.session-pill {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(15, 23, 42, 0.55);
  color: #fff7ed;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.session-pill-error {
  border-color: rgba(248, 113, 113, 0.55);
}

.picking-container {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
}

.page-hero {
  margin-bottom: 1.5rem;
}

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
  font-size: clamp(1.8rem, 5vw, 2.8rem);
}

.page-subtitle {
  max-width: 560px;
  margin: 0.9rem auto 0;
  color: rgba(243, 246, 251, 0.76);
}

.form-card,
.response-card {
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.form-card {
  padding: 1.5rem;
}

.submission-strip {
  margin-bottom: 1rem;
}

.submission-strip-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  border: 1px solid rgba(159, 209, 255, 0.18);
  animation: slideUpFade 0.24s ease;
}

.submission-strip-card strong {
  display: block;
  color: #f3f6fb;
}

.submission-strip-card p {
  margin: 0.2rem 0 0;
  color: rgba(243, 246, 251, 0.72);
}

.submission-strip-pending {
  background: rgba(14, 37, 66, 0.7);
  border-color: rgba(69, 167, 255, 0.28);
}

.submission-strip-success {
  background: rgba(19, 47, 33, 0.72);
  border-color: rgba(42, 181, 125, 0.28);
}

.submission-orbit,
.submission-check {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.submission-orbit {
  border: 3px solid rgba(159, 209, 255, 0.18);
  border-top-color: #45a7ff;
  animation: spin 0.9s linear infinite;
}

.submission-check {
  background: rgba(42, 181, 125, 0.18);
  color: #8df0b4;
  font-size: 1.25rem;
  font-weight: 800;
  box-shadow: 0 0 0 10px rgba(42, 181, 125, 0.08);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.form-group-full {
  grid-column: 1 / -1;
}

label {
  margin-bottom: 0.3rem;
  font-weight: 500;
  color: #f3f6fb;
}

input {
  padding: 0.85rem 1rem;
  width: 100%;
  color: #333;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-sizing: border-box;
  font-size: 1rem;
}

.input-error {
  border-color: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.16);
}

.field-error {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  color: #ffb4b4;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.25rem;
}

button {
  min-height: 50px;
  padding: 0.85rem 1.8rem;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 16px;
  border: none;
  font-weight: 600;
  transition: background 0.2s, opacity 0.2s;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.save-btn {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
}

.save-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d95f5 0%, #0a4cb8 100%);
}

.clear-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #cde4ff;
  border: 1px solid rgba(159, 209, 255, 0.22);
}

.clear-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}

.response-card {
  margin-top: 1rem;
  padding: 1rem 1.2rem;
  text-align: left;
}

.response-message {
  margin: 0.5rem 0 0;
  line-height: 1.5;
}

.response-list {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
}

.response-card-success {
  color: #8df0b4;
  border-color: rgba(42, 181, 125, 0.28);
  background: rgba(22, 52, 36, 0.45);
}

.response-card-error {
  color: #ffb4b4;
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(86, 26, 26, 0.45);
}

.mobile-status-stack {
  display: none;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .picking-page {
    padding: 1rem 0.75rem 6.5rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group-full {
    grid-column: 1;
  }

  .button-group {
    flex-direction: column;
  }

  button {
    width: 100%;
  }

  .submission-strip,
  .response-card {
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
    background: rgba(7, 19, 34, 0.95);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    animation: slideUpFade 0.24s ease;
  }

  .mobile-status-card strong {
    display: block;
    color: #f3f6fb;
  }

  .mobile-status-card p {
    margin: 0.2rem 0 0;
    color: rgba(243, 246, 251, 0.78);
    font-size: 0.92rem;
  }

  .mobile-status-card-sending {
    border-color: rgba(69, 167, 255, 0.28);
  }

  .mobile-status-card-success {
    border-color: rgba(42, 181, 125, 0.28);
    background: rgba(19, 47, 33, 0.95);
  }

  .mobile-status-card-error {
    border-color: rgba(248, 113, 113, 0.28);
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
    background: rgba(42, 181, 125, 0.18);
    color: #8df0b4;
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
