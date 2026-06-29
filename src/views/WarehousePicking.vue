<script setup>
import { ref } from "vue";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const responsableId = ref("");
const numeroPedido = ref("");
const numeroCajas = ref("");

const isSaving = ref(false);
const serverResponse = ref(null);

const fieldErrors = ref({
  responsableId: "",
  numeroPedido: "",
  numeroCajas: "",
});

function resetFieldErrors() {
  fieldErrors.value = { responsableId: "", numeroPedido: "", numeroCajas: "" };
}

function clearFieldError(field) {
  fieldErrors.value = { ...fieldErrors.value, [field]: "" };
}

function validateForm() {
  const errors = [];
  resetFieldErrors();

  if (!responsableId.value.trim()) {
    const msg = "Falta el ID del almacenista.";
    errors.push(msg);
    fieldErrors.value.responsableId = msg;
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
  responsableId.value = "";
  numeroPedido.value = "";
  numeroCajas.value = "";
  resetFieldErrors();
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

  try {
    const response = await fetch(`${API_BASE_URL}/picking-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responsableId: responsableId.value.trim(),
        numeroPedido: numeroPedido.value.trim(),
        numeroCajas: Number(numeroCajas.value),
      }),
    });

    const result = await response.json().catch(() => null);

    if (response.ok) {
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
</script>

<template>
  <section class="picking-page">
    <div class="picking-container">
      <div class="page-hero">
        <p class="page-kicker">Almacen</p>
        <h1 class="page-title">Registro de Picking</h1>
        <p class="page-subtitle">
          Registra el pedido que terminaste de picar: tu ID, el numero de pedido y la cantidad de cajas.
        </p>
      </div>

      <div class="form-card">
        <div class="form-grid">
          <div class="form-group">
            <label for="responsableId">ID del almacenista</label>
            <input
              id="responsableId"
              type="text"
              v-model="responsableId"
              :class="{ 'input-error': fieldErrors.responsableId }"
              placeholder="Ej. ALM001"
              autocomplete="off"
              @input="clearFieldError('responsableId')"
            />
            <p v-if="fieldErrors.responsableId" class="field-error">{{ fieldErrors.responsableId }}</p>
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

@media (max-width: 600px) {
  .picking-page {
    padding: 1rem 0.75rem 2rem;
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
}
</style>
