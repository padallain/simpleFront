<script setup>
import { computed, ref } from "vue";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const adminKey = ref("");
const clientId = ref("");
const clientData = ref(null);
const feedback = ref("");
const errorMessage = ref("");
const loading = ref(false);
const deleting = ref(false);

const canSearch = computed(() => clientId.value.trim().length > 0);
const canDelete = computed(() => clientId.value.trim().length > 0 && adminKey.value.trim().length > 0);

async function searchClient() {
  if (!canSearch.value) {
    errorMessage.value = "Ingresa el ID del cliente.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${clientId.value.trim()}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      clientData.value = null;
      errorMessage.value = result?.message || "No se pudo consultar el cliente.";
      return;
    }

    clientData.value = result;
  } catch (error) {
    clientData.value = null;
    errorMessage.value = `Error consultando cliente: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function deleteClient() {
  if (!canDelete.value) {
    errorMessage.value = "Ingresa la clave de administrador y el ID del cliente.";
    return;
  }

  const confirmed = window.confirm(
    `Se eliminará el cliente con ID ${clientId.value.trim()} por ubicación incorrecta. ¿Deseas continuar?`,
  );

  if (!confirmed) {
    return;
  }

  deleting.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/deleteClient/${clientId.value.trim()}`, {
      method: "DELETE",
      headers: {
        "x-admin-delete-key": adminKey.value.trim(),
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo eliminar el cliente.";
      return;
    }

    feedback.value = `Cliente con ID ${clientId.value.trim()} eliminado correctamente.`;
    clientData.value = null;
    clientId.value = "";
  } catch (error) {
    errorMessage.value = `Error eliminando cliente: ${error.message}`;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section class="cleanup-page">
    <div class="cleanup-shell">
      <div class="cleanup-hero">
        <p class="cleanup-kicker">Ruta interna</p>
        <h1>Limpieza de clientes mal ubicados</h1>
        <p class="cleanup-copy">
          Esta pantalla no está enlazada en la navegación pública. Requiere el ID del cliente y la clave de administración del backend.
        </p>
      </div>

      <div class="cleanup-card">
        <div class="cleanup-grid">
          <div class="field-group">
            <label for="adminKey">Clave de administrador</label>
            <input id="adminKey" v-model="adminKey" type="password" placeholder="Ingresa la clave interna" />
          </div>
          <div class="field-group">
            <label for="clientId">ID del cliente</label>
            <input id="clientId" v-model="clientId" type="text" placeholder="Ej. 1042" />
          </div>
        </div>

        <div class="cleanup-actions">
          <button class="secondary-button" :disabled="loading || !canSearch" @click="searchClient">
            {{ loading ? "Consultando..." : "Consultar cliente" }}
          </button>
          <button class="danger-button" :disabled="deleting || !canDelete" @click="deleteClient">
            {{ deleting ? "Eliminando..." : "Eliminar cliente" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="feedback-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="feedback-card feedback-success">{{ feedback }}</div>

      <div v-if="clientData" class="cleanup-card result-card">
        <strong>Cliente encontrado</strong>
        <pre>{{ JSON.stringify(clientData, null, 2) }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cleanup-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(255, 153, 102, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(69, 167, 255, 0.14), transparent 30%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.cleanup-shell {
  max-width: 880px;
  margin: 0 auto;
  color: #f3f6fb;
}

.cleanup-hero {
  margin-bottom: 1.25rem;
}

.cleanup-kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #ffbf9f;
}

.cleanup-hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.8rem);
}

.cleanup-copy {
  max-width: 680px;
  margin-top: 0.8rem;
  color: rgba(243, 246, 251, 0.78);
}

.cleanup-card,
.feedback-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.cleanup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-group label {
  font-weight: 600;
}

.field-group input {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.cleanup-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.cleanup-actions button {
  min-height: 46px;
  padding: 0.8rem 1.1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
}

.secondary-button {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.danger-button {
  background: linear-gradient(135deg, #ff8b66 0%, #d9485f 100%);
}

.cleanup-actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.feedback-error {
  color: #ffb4b4;
}

.feedback-success {
  color: #8df0b4;
}

.result-card pre {
  margin: 0.8rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .cleanup-page {
    padding: 1rem 0.75rem 2rem;
  }

  .cleanup-grid {
    grid-template-columns: 1fr;
  }

  .cleanup-actions {
    flex-direction: column;
  }
}
</style>