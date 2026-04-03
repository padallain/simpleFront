<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const router = useRouter();

const driverId = ref("");
const routeData = ref(null);
const loading = ref(false);
const errorMessage = ref("");
const feedback = ref("");
const updatingKey = ref("");
const openIssueForms = reactive({});
const issueForms = reactive({});

const dispatchedCount = computed(() =>
  Array.isArray(routeData.value?.stops)
    ? routeData.value.stops.filter((stop) => stop.dispatched).length
    : 0,
);

function createIssueItem() {
  return {
    productId: "",
    novelty: "",
    presentationType: "unidad",
    quantity: 1,
  };
}

function getStopKey(stop) {
  return String(stop?.clientId || "");
}

function ensureIssueForm(stop) {
  const stopKey = getStopKey(stop);

  if (!stopKey) {
    return null;
  }

  if (!issueForms[stopKey]) {
    issueForms[stopKey] = {
      orderNumber: "",
      items: [createIssueItem()],
      submitting: false,
      feedback: "",
      error: "",
    };
  }

  return issueForms[stopKey];
}

function resetIssueForm(stop) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  form.orderNumber = "";
  form.items = [createIssueItem()];
  form.submitting = false;
  form.feedback = "";
  form.error = "";
}

function addIssueItem(stop) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  form.items.push(createIssueItem());
}

function removeIssueItem(stop, index) {
  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  if (form.items.length === 1) {
    form.items[0] = createIssueItem();
    return;
  }

  form.items.splice(index, 1);
}

function toggleIssueForm(stop) {
  const stopKey = getStopKey(stop);
  const currentlyOpen = Boolean(openIssueForms[stopKey]);

  if (!currentlyOpen) {
    ensureIssueForm(stop);
  }

  openIssueForms[stopKey] = !currentlyOpen;

  if (!openIssueForms[stopKey]) {
    const form = ensureIssueForm(stop);

    if (form) {
      form.error = "";
      form.feedback = "";
    }
  }
}

async function loadDriverRoute() {
  if (!driverId.value.trim()) {
    errorMessage.value = "Ingresa el ID del chofer.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${driverId.value.trim()}/current`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      routeData.value = null;
      errorMessage.value = result?.message || "No se pudo cargar la ruta del chofer.";
      return;
    }

    routeData.value = result?.route || null;
    Object.keys(openIssueForms).forEach((key) => {
      delete openIssueForms[key];
    });
    Object.keys(issueForms).forEach((key) => {
      delete issueForms[key];
    });
  } catch (error) {
    routeData.value = null;
    errorMessage.value = `Error cargando ruta: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

async function updateDispatch(stop, dispatched) {
  if (!routeData.value?._id) {
    return;
  }

  updatingKey.value = `stop:${stop.clientId}`;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops/${stop.clientId}/dispatch`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dispatched }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo actualizar el despacho.";
      return;
    }

    routeData.value = result?.route || routeData.value;
    feedback.value = dispatched
      ? `Cliente ${stop.clientId} marcado como despachado.`
      : `Cliente ${stop.clientId} marcado como pendiente.`;
  } catch (error) {
    errorMessage.value = `Error actualizando despacho: ${error.message}`;
  } finally {
    updatingKey.value = "";
  }
}

async function resolveMissingClient(item, resolved) {
  if (!routeData.value?._id) {
    return;
  }

  updatingKey.value = `missing:${item.clientId}`;
  errorMessage.value = "";
  feedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/missing/${item.clientId}/resolve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resolved }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      errorMessage.value = result?.message || "No se pudo actualizar el cliente no encontrado.";
      return;
    }

    routeData.value = result?.route || routeData.value;
    feedback.value = resolved
      ? `Cliente no encontrado ${item.clientId} marcado como resuelto.`
      : `Cliente no encontrado ${item.clientId} marcado como pendiente.`;
  } catch (error) {
    errorMessage.value = `Error actualizando cliente no encontrado: ${error.message}`;
  } finally {
    updatingKey.value = "";
  }
}

function openClientRegistration(clientId) {
  window.open(`/?clientId=${encodeURIComponent(clientId)}`, "_blank", "noopener,noreferrer");
}

function openRouteIssueSummary() {
  if (!routeData.value?._id) {
    return;
  }

  router.push(`/driver-route/${routeData.value._id}/issues-summary`);
}

async function submitDispatchIssue(stop) {
  if (!routeData.value?._id) {
    return;
  }

  const form = ensureIssueForm(stop);

  if (!form) {
    return;
  }

  const payload = {
    orderNumber: form.orderNumber.trim(),
    items: form.items.map((item) => ({
      productId: item.productId.trim(),
      novelty: item.novelty.trim(),
      presentationType: item.presentationType,
      quantity: Number(item.quantity),
    })),
  };

  if (!payload.orderNumber) {
    form.error = "Completa el numero de pedido.";
    form.feedback = "";
    return;
  }

  const hasInvalidItem = payload.items.some((item) => {
    if (!item.productId || !item.novelty) {
      return true;
    }

    if (!["caja", "unidad"].includes(item.presentationType)) {
      return true;
    }

    return !Number.isInteger(item.quantity) || item.quantity < 1;
  });

  if (hasInvalidItem) {
    form.error = "Cada producto debe tener ID, novedad, tipo caja o unidad y cantidad valida.";
    form.feedback = "";
    return;
  }

  form.submitting = true;
  form.error = "";
  form.feedback = "";

  try {
    const response = await fetch(`${API_BASE_URL}/driver-routes/${routeData.value._id}/stops/${stop.clientId}/issues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      form.error = result?.message || "No se pudo guardar la novedad del despacho.";
      return;
    }

    const successMessage = `Novedad registrada con folio ${result?.reportId || "generado"}.`;
    feedback.value = `Se registro una novedad para el cliente ${stop.clientId}.`;
    resetIssueForm(stop);
    ensureIssueForm(stop).feedback = successMessage;
  } catch (error) {
    form.error = `Error guardando novedad: ${error.message}`;
  } finally {
    ensureIssueForm(stop).submitting = false;
  }
}
</script>

<template>
  <section class="driver-page">
    <div class="driver-shell">
      <div class="driver-hero">
        <p class="driver-kicker">Ruta del chofer</p>
        <h1>Consulta tu ruta asignada</h1>
        <p class="driver-copy">Ingresa tu ID para ver la ruta actual, los clientes despachados y los clientes que faltan por registrar.</p>
      </div>

      <div class="driver-card">
        <div class="driver-search-row">
          <input v-model="driverId" type="text" placeholder="Ingresa tu ID de chofer" class="driver-input" @keyup.enter="loadDriverRoute" />
          <button class="driver-button" :disabled="loading" @click="loadDriverRoute">
            {{ loading ? "Buscando..." : "Ver mi ruta" }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="driver-card feedback-error">{{ errorMessage }}</div>
      <div v-if="feedback" class="driver-card feedback-success">{{ feedback }}</div>

      <div v-if="routeData" class="driver-results">
        <div class="driver-card summary-card">
          <div class="summary-header">
            <div class="summary-grid">
            <span><strong>Ruta:</strong> {{ routeData.routeLabel }}</span>
            <span><strong>Chofer:</strong> {{ routeData.driverId }}</span>
            <span><strong>Estado:</strong> {{ routeData.status }}</span>
            <span><strong>Clientes unicos:</strong> {{ routeData.uniqueClientCount }}</span>
            <span><strong>Peso total:</strong> {{ routeData.totalWeight }}</span>
            <span><strong>Despachados:</strong> {{ dispatchedCount }} / {{ routeData.stops.length }}</span>
            </div>
            <button class="secondary-button" type="button" @click="openRouteIssueSummary">
              Ver resumen de novedades
            </button>
          </div>
        </div>

        <div v-if="routeData.missingClients?.length" class="driver-card missing-card">
          <strong>Clientes no encontrados</strong>
          <div class="missing-list">
            <article v-for="item in routeData.missingClients" :key="item.clientId" class="missing-item">
              <div>
                <p><strong>ID:</strong> {{ item.clientId }}</p>
                <p><strong>Estado:</strong> {{ item.resolved ? "Resuelto" : "Pendiente por registrar" }}</p>
              </div>
              <div class="missing-actions">
                <button class="secondary-button" @click="openClientRegistration(item.clientId)">
                  Registrar cliente
                </button>
                <button
                  class="ghost-button"
                  :disabled="updatingKey === `missing:${item.clientId}`"
                  @click="resolveMissingClient(item, !item.resolved)"
                >
                  {{ item.resolved ? "Marcar pendiente" : "Marcar resuelto" }}
                </button>
              </div>
            </article>
          </div>
        </div>

        <div class="driver-card">
          <div class="section-heading">
            <strong>Paradas asignadas</strong>
            <span>Abajo de cada cliente puedes registrar una novedad del despacho.</span>
          </div>
          <div class="stops-list">
            <article v-for="stop in routeData.stops" :key="stop.clientId" :class="['stop-item', stop.dispatched ? 'stop-item-done' : '']">
              <div class="stop-main">
                <div>
                  <p class="stop-order">{{ stop.order }}. {{ stop.nombre }}</p>
                  <p>ID {{ stop.clientId }}</p>
                </div>
                <div class="stop-actions">
                  <a :href="stop.googleMapsLink" target="_blank" rel="noreferrer">Abrir mapa</a>
                  <button
                    class="secondary-button"
                    type="button"
                    @click="toggleIssueForm(stop)"
                  >
                    {{ openIssueForms[stop.clientId] ? "Ocultar novedad" : "Reportar novedad" }}
                  </button>
                  <button
                    class="driver-button"
                    :disabled="updatingKey === `stop:${stop.clientId}`"
                    @click="updateDispatch(stop, !stop.dispatched)"
                  >
                    {{ stop.dispatched ? "Marcar pendiente" : "Marcar despachado" }}
                  </button>
                </div>
              </div>

              <form
                v-if="openIssueForms[stop.clientId]"
                class="issue-form"
                @submit.prevent="submitDispatchIssue(stop)"
              >
                <div class="issue-grid">
                  <label class="field-group field-group-full">
                    <span>Numero de pedido</span>
                    <input v-model="ensureIssueForm(stop).orderNumber" type="text" placeholder="Ej. PED-10294" />
                  </label>
                </div>

                <div class="issue-items-list">
                  <article
                    v-for="(item, index) in ensureIssueForm(stop).items"
                    :key="`${stop.clientId}-issue-${index}`"
                    class="issue-item-card"
                  >
                    <div class="issue-item-head">
                      <strong>Producto con novedad {{ index + 1 }}</strong>
                      <button class="ghost-button" type="button" @click="removeIssueItem(stop, index)">
                        {{ ensureIssueForm(stop).items.length === 1 ? "Limpiar producto" : "Quitar producto" }}
                      </button>
                    </div>

                    <div class="issue-grid">
                      <label class="field-group">
                        <span>ID del producto</span>
                        <input v-model="item.productId" type="text" placeholder="Ej. SKU-445" />
                      </label>
                      <label class="field-group">
                        <span>Presentacion</span>
                        <select v-model="item.presentationType">
                          <option value="unidad">Unidad</option>
                          <option value="caja">Caja</option>
                        </select>
                      </label>
                      <label class="field-group">
                        <span>Cantidad afectada</span>
                        <input v-model.number="item.quantity" type="number" min="1" step="1" />
                      </label>
                      <label class="field-group field-group-full">
                        <span>Cual es la novedad</span>
                        <textarea
                          v-model="item.novelty"
                          rows="3"
                          placeholder="Ej. Llegaron 2 unidades golpeadas o faltaba 1 caja del producto."
                        />
                      </label>
                    </div>
                  </article>
                </div>

                <p v-if="ensureIssueForm(stop).error" class="inline-feedback inline-feedback-error">
                  {{ ensureIssueForm(stop).error }}
                </p>
                <p v-if="ensureIssueForm(stop).feedback" class="inline-feedback inline-feedback-success">
                  {{ ensureIssueForm(stop).feedback }}
                </p>

                <div class="issue-actions">
                  <button class="secondary-button" type="button" @click="addIssueItem(stop)">
                    Agregar otro producto
                  </button>
                  <button class="ghost-button" type="button" @click="resetIssueForm(stop)">
                    Limpiar
                  </button>
                  <button class="driver-button" type="submit" :disabled="ensureIssueForm(stop).submitting">
                    {{ ensureIssueForm(stop).submitting ? "Guardando..." : "Guardar novedad" }}
                  </button>
                </div>
              </form>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.driver-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(71, 157, 255, 0.2), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 196, 120, 0.18), transparent 30%),
    linear-gradient(180deg, #08111d 0%, #10213c 52%, #08111d 100%);
}

.driver-shell {
  max-width: 1040px;
  margin: 0 auto;
  color: #f3f6fb;
}

.driver-hero {
  margin-bottom: 1.25rem;
}

.driver-kicker {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.driver-copy {
  max-width: 720px;
  color: rgba(243, 246, 251, 0.78);
}

.driver-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.72);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

.driver-search-row,
.summary-grid,
.summary-header,
.stop-main,
.missing-actions,
.section-heading,
.issue-actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.section-heading {
  justify-content: space-between;
  align-items: center;
}

.summary-header {
  justify-content: space-between;
  align-items: flex-start;
}

.section-heading span {
  color: rgba(243, 246, 251, 0.72);
  font-size: 0.92rem;
}

.driver-input {
  flex: 1 1 320px;
  min-height: 46px;
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.driver-button,
.secondary-button,
.ghost-button {
  min-height: 44px;
  padding: 0.8rem 1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
}

.driver-button {
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.secondary-button {
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.ghost-button {
  color: #d7e8ff;
  background: rgba(69, 167, 255, 0.16);
  border: 1px solid rgba(69, 167, 255, 0.32);
}

.driver-results,
.stops-list,
.missing-list {
  display: grid;
  gap: 1rem;
}

.missing-card {
  border-color: rgba(248, 202, 91, 0.26);
  background: rgba(70, 52, 11, 0.22);
}

.missing-item,
.stop-item {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stop-item-done {
  border-color: rgba(141, 240, 180, 0.3);
  background: rgba(141, 240, 180, 0.08);
}

.stop-order {
  margin: 0;
  font-weight: 700;
}

.stop-main {
  align-items: center;
  justify-content: space-between;
}

.stop-actions {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  flex-wrap: wrap;
}

.issue-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.issue-items-list {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.85rem;
}

.issue-item-card {
  padding: 0.9rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.issue-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.issue-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.field-group {
  display: grid;
  gap: 0.4rem;
}

.field-group span {
  font-size: 0.9rem;
  color: rgba(243, 246, 251, 0.86);
}

.field-group input,
.field-group select,
.field-group textarea {
  width: 100%;
  min-height: 44px;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
}

.field-group textarea {
  min-height: 96px;
  resize: vertical;
}

.field-group-full {
  grid-column: 1 / -1;
}

.inline-feedback {
  margin: 0.8rem 0 0;
  font-weight: 600;
}

.inline-feedback-error {
  color: #ffb4b4;
}

.inline-feedback-success {
  color: #8df0b4;
}

.issue-actions {
  margin-top: 0.85rem;
  justify-content: flex-end;
}

.stop-actions a {
  color: #ffd59a;
  font-weight: 600;
}

.feedback-error {
  color: #ffb4b4;
}

.feedback-success {
  color: #8df0b4;
}

@media (max-width: 720px) {
  .driver-page {
    padding: 1rem 0.75rem 2rem;
  }

  .stop-main,
  .driver-search-row,
  .summary-header,
  .section-heading,
  .issue-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .issue-grid {
    grid-template-columns: 1fr;
  }
}
</style>