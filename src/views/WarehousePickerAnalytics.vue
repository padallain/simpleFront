<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import jsPDF from "jspdf";
import { RouterLink } from "vue-router";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const ADMIN_VIEW_KEY = "4321";

const adminKeyInput = ref("");
const selectedDate = ref(getTodayValue());
const fromDate = ref(getTodayValue());
const toDate = ref(getTodayValue());
const useRange = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const feedbackMessage = ref("Ingresa la clave administrativa para habilitar el resumen.");
const overview = ref(createEmptyOverview());
const ranking = ref([]);
const reports = ref([]);
const orderLookup = ref("");
const orderLookupLoading = ref(false);
const orderLookupError = ref("");
const orderLookupFeedback = ref("");
const selectedOrderReport = ref(null);
const errorReportSubmitting = ref(false);
const errorReportForm = reactive({
  tipoError: "",
  descripcion: "",
});

const isUnlocked = computed(() => adminKeyInput.value.trim() === ADMIN_VIEW_KEY);
const topWorker = computed(() => overview.value.responsableConMasPicking || null);
const topErrorWorker = computed(() => overview.value.responsableConMasErrores || null);

function createEmptyOverview() {
  return {
    totalPedidos: 0,
    totalCajas: 0,
    totalErrores: 0,
    responsablesActivos: 0,
    responsableConMasPicking: null,
    responsableConMasErrores: null,
  };
}

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatInteger(value) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return parsed.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resetData() {
  overview.value = createEmptyOverview();
  ranking.value = [];
  reports.value = [];
}

function resetOrderLookup() {
  selectedOrderReport.value = null;
  orderLookupError.value = "";
  orderLookupFeedback.value = "";
  errorReportForm.tipoError = "";
  errorReportForm.descripcion = "";
}

function buildSummaryQuery() {
  const params = new URLSearchParams();

  if (useRange.value) {
    params.set("desde", fromDate.value);
    params.set("hasta", toDate.value);
  } else {
    params.set("fecha", selectedDate.value);
  }

  return params.toString();
}

function getFilterLabel() {
  return useRange.value
    ? `Periodo: ${fromDate.value} a ${toDate.value}`
    : `Fecha: ${selectedDate.value}`;
}

function createPdfDocument(title) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(getFilterLabel(), 14, 25);
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 14, 31);
  return doc;
}

function ensurePdfPageSpace(doc, currentY, requiredHeight = 10) {
  if (currentY + requiredHeight <= 282) {
    return currentY;
  }

  doc.addPage();
  return 18;
}

function addPdfSectionTitle(doc, text, currentY) {
  const nextY = ensurePdfPageSpace(doc, currentY, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text, 14, nextY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return nextY + 7;
}

function addPdfTextRow(doc, label, value, currentY) {
  const nextY = ensurePdfPageSpace(doc, currentY, 8);
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, 14, nextY);
  doc.setFont("helvetica", "normal");
  doc.text(String(value), 58, nextY);
  return nextY + 6;
}

function downloadSummaryPdf() {
  if (!ranking.value.length && !reports.value.length) {
    errorMessage.value = "Primero carga un resumen de picking para descargar el PDF.";
    feedbackMessage.value = "";
    return;
  }

  const doc = createPdfDocument("Reporte de picking");
  let currentY = 40;

  currentY = addPdfSectionTitle(doc, "Resumen general", currentY);
  currentY = addPdfTextRow(doc, "Pedidos picados", formatInteger(overview.value.totalPedidos), currentY);
  currentY = addPdfTextRow(doc, "Cajas movidas", formatInteger(overview.value.totalCajas), currentY);
  currentY = addPdfTextRow(doc, "Almacenistas activos", formatInteger(overview.value.responsablesActivos), currentY);
  currentY = addPdfTextRow(doc, "Errores reportados", formatInteger(overview.value.totalErrores), currentY);

  if (topWorker.value) {
    currentY += 3;
    currentY = addPdfSectionTitle(doc, "Top picking", currentY);
    currentY = addPdfTextRow(doc, "Responsable", topWorker.value.responsableId, currentY);
    currentY = addPdfTextRow(doc, "Pedidos", formatInteger(topWorker.value.totalPedidos), currentY);
    currentY = addPdfTextRow(doc, "Cajas", formatInteger(topWorker.value.totalCajas), currentY);
  }

  if (topErrorWorker.value) {
    currentY += 3;
    currentY = addPdfSectionTitle(doc, "Mayor numero de errores", currentY);
    currentY = addPdfTextRow(doc, "Responsable", topErrorWorker.value.responsableId, currentY);
    currentY = addPdfTextRow(doc, "Errores", formatInteger(topErrorWorker.value.totalErrores), currentY);
  }

  currentY += 3;
  currentY = addPdfSectionTitle(doc, "Ranking por almacenista", currentY);
  ranking.value.forEach((worker, index) => {
    currentY = ensurePdfPageSpace(doc, currentY, 14);
    doc.setFont("helvetica", "bold");
    doc.text(`#${index + 1} ${worker.responsableId}`, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(`Pedidos: ${formatInteger(worker.totalPedidos)} | Cajas: ${formatInteger(worker.totalCajas)} | Errores: ${formatInteger(worker.totalErrores)}`, 20, currentY + 5);
    currentY += 11;
  });

  currentY += 3;
  currentY = addPdfSectionTitle(doc, "Detalle de pedidos procesados", currentY);
  reports.value.forEach((report) => {
    currentY = ensurePdfPageSpace(doc, currentY, 14);
    doc.setFont("helvetica", "bold");
    doc.text(`${report.numeroPedido}`, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatDate(report.fechaHoraRegistro)} | ${report.responsableId} | ${formatInteger(report.numeroCajas)} cajas`, 20, currentY + 5);
    currentY += 11;
  });

  doc.save(`picking_resumen_${useRange.value ? `${fromDate.value}_${toDate.value}` : selectedDate.value}.pdf`);
}

function downloadOrderPdf() {
  if (!selectedOrderReport.value) {
    orderLookupError.value = "Primero busca un pedido para descargar su reporte en PDF.";
    orderLookupFeedback.value = "";
    return;
  }

  const doc = createPdfDocument(`Reporte de picking - Pedido ${selectedOrderReport.value.numeroPedido}`);
  let currentY = 40;

  currentY = addPdfSectionTitle(doc, "Detalle del pedido", currentY);
  currentY = addPdfTextRow(doc, "Pedido", selectedOrderReport.value.numeroPedido, currentY);
  currentY = addPdfTextRow(doc, "Responsable del picking", selectedOrderReport.value.responsableId, currentY);
  currentY = addPdfTextRow(doc, "Cajas registradas", formatInteger(selectedOrderReport.value.numeroCajas), currentY);
  currentY = addPdfTextRow(doc, "Fecha de registro", formatDate(selectedOrderReport.value.fechaHoraRegistro), currentY);
  currentY = addPdfTextRow(doc, "Errores reportados", formatInteger(selectedOrderReport.value.totalErrores), currentY);

  currentY += 4;
  currentY = addPdfSectionTitle(doc, "Observacion", currentY);
  const observationLines = doc.splitTextToSize(
    `Este reporte identifica quien realizo el picking del pedido ${selectedOrderReport.value.numeroPedido} y cuantos errores acumula hasta el momento.`,
    180,
  );
  doc.text(observationLines, 14, currentY);

  doc.save(`picking_pedido_${selectedOrderReport.value.numeroPedido}.pdf`);
}

async function loadWarehouseAnalytics() {
  if (!isUnlocked.value) {
    errorMessage.value = "Debes ingresar la clave administrativa correcta para ver el resumen.";
    feedbackMessage.value = "";
    resetData();
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/picking-reports/summary?${buildSummaryQuery()}`, {
      headers: {
        "x-admin-delete-key": adminKeyInput.value.trim(),
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      resetData();
      if (response.status === 403) {
        errorMessage.value = "Clave incorrecta. Verifica la clave administrativa.";
      } else if (response.status === 404) {
        errorMessage.value = "Endpoint no encontrado. Verifica que el servidor este actualizado.";
      } else {
        errorMessage.value = result?.message || `Error del servidor (${response.status}). Intenta de nuevo.`;
      }
      return;
    }

    overview.value = result?.resumen || createEmptyOverview();
    ranking.value = Array.isArray(result?.ranking) ? result.ranking : [];
    reports.value = Array.isArray(result?.reportes) ? result.reportes : [];
    feedbackMessage.value = ranking.value.length
      ? `Se cargaron ${ranking.value.length} almacenistas para el periodo seleccionado.`
      : "No hay registros de picking para el periodo consultado.";
  } catch (error) {
    resetData();
    errorMessage.value = `Error cargando resumen: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

watch(isUnlocked, (unlocked) => {
  if (unlocked) {
    loadWarehouseAnalytics();
  } else {
    resetData();
    resetOrderLookup();
    feedbackMessage.value = "Ingresa la clave administrativa para habilitar el resumen.";
    errorMessage.value = "";
  }
});

async function searchPickingByOrder() {
  const numeroPedido = orderLookup.value.trim().toUpperCase();

  if (!isUnlocked.value) {
    orderLookupError.value = "Debes ingresar la clave administrativa correcta para buscar pedidos.";
    orderLookupFeedback.value = "";
    return;
  }

  if (!numeroPedido) {
    orderLookupError.value = "Ingresa el ID del pedido para buscar quien hizo el picking.";
    orderLookupFeedback.value = "";
    return;
  }

  orderLookupLoading.value = true;
  orderLookupError.value = "";
  orderLookupFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/picking-reports/order/${encodeURIComponent(numeroPedido)}`, {
      headers: {
        "x-admin-delete-key": adminKeyInput.value.trim(),
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      selectedOrderReport.value = null;
      orderLookupError.value = result?.message || "No se pudo buscar el pedido.";
      return;
    }

    selectedOrderReport.value = result?.report || null;
    orderLookupFeedback.value = selectedOrderReport.value
      ? `Pedido ${selectedOrderReport.value.numeroPedido} encontrado.`
      : "No se encontro informacion del pedido.";
  } catch (error) {
    selectedOrderReport.value = null;
    orderLookupError.value = `Error buscando pedido: ${error.message}`;
  } finally {
    orderLookupLoading.value = false;
  }
}

async function submitPickingErrorReport() {
  if (!selectedOrderReport.value?.numeroPedido) {
    orderLookupError.value = "Primero busca un pedido valido.";
    orderLookupFeedback.value = "";
    return;
  }

  if (!errorReportForm.tipoError.trim() || !errorReportForm.descripcion.trim()) {
    orderLookupError.value = "Debes indicar el tipo de error y una descripcion.";
    orderLookupFeedback.value = "";
    return;
  }

  errorReportSubmitting.value = true;
  orderLookupError.value = "";
  orderLookupFeedback.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/internal/admin/picking-reports/order/${encodeURIComponent(selectedOrderReport.value.numeroPedido)}/errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-delete-key": adminKeyInput.value.trim(),
      },
      body: JSON.stringify({
        tipoError: errorReportForm.tipoError.trim(),
        descripcion: errorReportForm.descripcion.trim(),
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      orderLookupError.value = result?.message || "No se pudo guardar el reporte de error.";
      return;
    }

    selectedOrderReport.value = {
      ...selectedOrderReport.value,
      totalErrores: Number(selectedOrderReport.value.totalErrores || 0) + 1,
    };
    orderLookupFeedback.value = `Error reportado para el pedido ${selectedOrderReport.value.numeroPedido}.`;
    errorReportForm.tipoError = "";
    errorReportForm.descripcion = "";
    await loadWarehouseAnalytics();
  } catch (error) {
    orderLookupError.value = `Error guardando reporte: ${error.message}`;
  } finally {
    errorReportSubmitting.value = false;
  }
}

onMounted(() => {
  resetData();
  resetOrderLookup();
});
</script>

<template>
  <section class="analytics-page picker-page">
    <div class="analytics-shell">
      <div class="analytics-hero">
        <div>
          <p class="eyebrow">Productividad de almacen</p>
          <h1>Resumen de almacenistas</h1>
          <p class="hero-copy">
            Consulta quien hizo mas picking, cuantas cajas movio y cuantos pedidos proceso por dia o por rango.
            Esta vista requiere clave administrativa para habilitarse.
          </p>
        </div>

        <div class="hero-actions picker-actions">
          <label class="month-field admin-field">
            <span>Clave administrativa</span>
            <input v-model="adminKeyInput" type="password" placeholder="Clave de acceso" autocomplete="current-password" />
          </label>
          <label class="toggle-field">
            <input v-model="useRange" type="checkbox" />
            <span>Consultar por rango</span>
          </label>
          <button class="primary-button" type="button" :disabled="loading" @click="loadWarehouseAnalytics">
            {{ loading ? "Actualizando..." : "Cargar resumen" }}
          </button>
          <button class="secondary-button" type="button" :disabled="loading || (!ranking.length && !reports.length)" @click="downloadSummaryPdf">
            Descargar resumen PDF
          </button>
          <RouterLink class="secondary-link" to="/driver-analytics">
            Analisis choferes
          </RouterLink>
        </div>
      </div>

      <div class="filter-card panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Filtro</p>
            <h2>{{ useRange ? "Periodo de consulta" : "Dia de consulta" }}</h2>
          </div>
          <span class="panel-badge">Acceso restringido</span>
        </div>

        <div class="filter-grid" v-if="useRange">
          <label class="month-field">
            <span>Desde</span>
            <input v-model="fromDate" type="date" />
          </label>
          <label class="month-field">
            <span>Hasta</span>
            <input v-model="toDate" type="date" />
          </label>
        </div>

        <div class="filter-grid" v-else>
          <label class="month-field single-field">
            <span>Fecha</span>
            <input v-model="selectedDate" type="date" />
          </label>
        </div>
      </div>

      <section class="panel table-panel order-lookup-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Control de errores</p>
            <h2>Buscar picking por pedido</h2>
          </div>
          <span class="panel-badge">Trazabilidad</span>
        </div>

        <div class="lookup-row">
          <label class="month-field lookup-field">
            <span>ID del pedido</span>
            <input v-model="orderLookup" type="text" placeholder="Ej: PED-001234" @keyup.enter="searchPickingByOrder" />
          </label>
          <button class="primary-button lookup-button" type="button" :disabled="orderLookupLoading" @click="searchPickingByOrder">
            {{ orderLookupLoading ? "Buscando..." : "Buscar pedido" }}
          </button>
        </div>

        <p v-if="orderLookupError" class="feedback error-text">
          {{ orderLookupError }}
        </p>

        <p v-else-if="orderLookupFeedback" class="feedback success-text">
          {{ orderLookupFeedback }}
        </p>

        <div v-if="selectedOrderReport" class="lookup-result-card">
          <div class="lookup-result-grid">
            <div>
              <span>Pedido</span>
              <strong>{{ selectedOrderReport.numeroPedido }}</strong>
            </div>
            <div>
              <span>Responsable del picking</span>
              <strong>{{ selectedOrderReport.responsableId }}</strong>
            </div>
            <div>
              <span>Cajas</span>
              <strong>{{ formatInteger(selectedOrderReport.numeroCajas) }}</strong>
            </div>
            <div>
              <span>Errores reportados</span>
              <strong>{{ formatInteger(selectedOrderReport.totalErrores) }}</strong>
            </div>
          </div>

          <form class="lookup-report-form" @submit.prevent="submitPickingErrorReport">
            <div class="lookup-report-grid">
              <label class="month-field">
                <span>Tipo de error</span>
                <select v-model="errorReportForm.tipoError">
                  <option value="">Selecciona una opcion</option>
                  <option value="producto incorrecto">Producto incorrecto</option>
                  <option value="faltante">Faltante</option>
                  <option value="sobrante">Sobrante</option>
                  <option value="cantidad incorrecta">Cantidad incorrecta</option>
                  <option value="otro">Otro</option>
                </select>
              </label>

              <label class="month-field lookup-report-description">
                <span>Descripcion del error</span>
                <textarea v-model="errorReportForm.descripcion" rows="4" placeholder="Explica que error se encontro en el picking"></textarea>
              </label>
            </div>

            <div class="lookup-actions">
              <button class="primary-button" type="submit" :disabled="errorReportSubmitting">
                {{ errorReportSubmitting ? "Guardando..." : "Reportar error" }}
              </button>
              <button class="secondary-button" type="button" @click="downloadOrderPdf">
                Descargar pedido PDF
              </button>
            </div>
          </form>
        </div>
      </section>

      <div class="summary-grid">
        <article class="summary-card accent-orange">
          <span class="summary-label">Pedidos picados</span>
          <strong>{{ formatInteger(overview.totalPedidos) }}</strong>
          <small>Total del periodo</small>
        </article>
        <article class="summary-card accent-sky">
          <span class="summary-label">Cajas movidas</span>
          <strong>{{ formatInteger(overview.totalCajas) }}</strong>
          <small>Volumen de picking registrado</small>
        </article>
        <article class="summary-card accent-green">
          <span class="summary-label">Almacenistas activos</span>
          <strong>{{ formatInteger(overview.responsablesActivos) }}</strong>
          <small>Responsables con picking en el periodo</small>
        </article>
        <article class="summary-card accent-rose">
          <span class="summary-label">Errores reportados</span>
          <strong>{{ formatInteger(overview.totalErrores) }}</strong>
          <small>{{ topErrorWorker ? `${topErrorWorker.responsableId} lidera con ${formatInteger(topErrorWorker.totalErrores)} errores` : "Sin errores reportados" }}</small>
        </article>
      </div>

      <p v-if="errorMessage" class="feedback error-text">
        {{ errorMessage }}
      </p>

      <p v-else-if="feedbackMessage" class="feedback success-text">
        {{ feedbackMessage }}
      </p>

      <div class="analytics-layout">
        <section class="panel spotlight-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Responsable destacado</p>
              <h2>Mayor rendimiento</h2>
            </div>
            <span class="panel-badge">Picking</span>
          </div>

          <div v-if="topWorker" class="spotlight-grid picker-spotlight-grid">
            <div class="spotlight-main">
              <p class="spotlight-rank">Top del periodo</p>
              <h3>{{ topWorker.responsableId }}</h3>
              <p class="spotlight-id">Almacenista con mayor picking registrado</p>

              <div class="spotlight-metrics">
                <div>
                  <span>Pedidos</span>
                  <strong>{{ formatInteger(topWorker.totalPedidos) }}</strong>
                </div>
                <div>
                  <span>Cajas</span>
                  <strong>{{ formatInteger(topWorker.totalCajas) }}</strong>
                </div>
              </div>
            </div>

            <div class="kpi-stack">
              <article class="kpi-card">
                <span>Participacion en pedidos</span>
                <strong>{{ overview.totalPedidos ? Math.round((topWorker.totalPedidos / overview.totalPedidos) * 100) : 0 }}%</strong>
                <small>Sobre el total del periodo</small>
              </article>
              <article class="kpi-card">
                <span>Participacion en cajas</span>
                <strong>{{ overview.totalCajas ? Math.round((topWorker.totalCajas / overview.totalCajas) * 100) : 0 }}%</strong>
                <small>Volumen movido por el top</small>
              </article>
              <article class="kpi-card">
                <span>Mas errores reportados</span>
                <strong>{{ topErrorWorker?.responsableId || "Sin datos" }}</strong>
                <small>{{ topErrorWorker ? `${formatInteger(topErrorWorker.totalErrores)} errores asociados` : "Sin errores en el periodo" }}</small>
              </article>
            </div>
          </div>

          <div v-else class="empty-panel">
            No hay datos del periodo seleccionado o la vista sigue bloqueada por clave.
          </div>
        </section>

        <section class="panel table-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Comparativo</p>
              <h2>Ranking por almacenista</h2>
            </div>
            <span class="panel-badge">{{ ranking.length }} registros</span>
          </div>

          <div v-if="ranking.length" class="driver-grid">
            <article v-for="(worker, index) in ranking" :key="worker.responsableId" class="driver-card">
              <div class="driver-card-header">
                <div>
                  <p class="driver-rank">#{{ index + 1 }}</p>
                  <h3>{{ worker.responsableId }}</h3>
                  <span class="driver-id">Almacenista</span>
                </div>
                <div class="driver-status-group">
                  <span class="status-chip">{{ formatInteger(worker.totalPedidos) }} pedidos</span>
                  <span class="status-chip status-chip-alt">{{ formatInteger(worker.totalCajas) }} cajas</span>
                  <span class="status-chip status-chip-error">{{ formatInteger(worker.totalErrores) }} errores</span>
                </div>
              </div>

              <div class="driver-metrics-grid picker-metrics-grid">
                <div>
                  <span>Pedidos</span>
                  <strong>{{ formatInteger(worker.totalPedidos) }}</strong>
                </div>
                <div>
                  <span>Cajas</span>
                  <strong>{{ formatInteger(worker.totalCajas) }}</strong>
                </div>
                <div>
                  <span>Errores</span>
                  <strong>{{ formatInteger(worker.totalErrores) }}</strong>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-panel">
            No hay almacenistas para mostrar en este periodo.
          </div>
        </section>
      </div>

      <section class="panel table-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Detalle</p>
            <h2>Pedidos procesados</h2>
          </div>
          <span class="panel-badge">{{ reports.length }} pedidos</span>
        </div>

        <div v-if="reports.length" class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Pedido</th>
                <th>Cajas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="report in reports" :key="report._id">
                <td>{{ formatDate(report.fechaHoraRegistro) }}</td>
                <td>{{ report.responsableId }}</td>
                <td>{{ report.numeroPedido }}</td>
                <td>{{ formatInteger(report.numeroCajas) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-panel">
          No hay pedidos de picking para este filtro.
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.analytics-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  color: #fff7ed;
  background:
    radial-gradient(circle at top left, rgba(255, 160, 72, 0.24), transparent 28%),
    radial-gradient(circle at 85% 10%, rgba(42, 157, 143, 0.2), transparent 22%),
    linear-gradient(180deg, #21100f 0%, #341916 38%, #101c20 100%);
}

.picker-page {
  background:
    radial-gradient(circle at top left, rgba(34, 197, 94, 0.2), transparent 24%),
    radial-gradient(circle at 88% 12%, rgba(56, 189, 248, 0.18), transparent 24%),
    linear-gradient(180deg, #10241f 0%, #132f2c 40%, #101c20 100%);
}

.analytics-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.analytics-hero,
.panel-header,
.driver-card-header,
.summary-grid,
.analytics-layout,
.spotlight-grid,
.spotlight-metrics,
.kpi-stack,
.hero-actions,
.filter-grid,
.driver-grid {
  display: flex;
}

.analytics-hero,
.panel-header,
.driver-card-header {
  justify-content: space-between;
  gap: 1rem;
}

.analytics-hero {
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.eyebrow,
.panel-kicker,
.driver-rank,
.spotlight-rank {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
}

.hero-copy,
.feedback,
.spotlight-id,
.driver-id,
.empty-panel,
.report-table {
  color: rgba(255, 247, 237, 0.82);
}

.hero-copy {
  max-width: 720px;
  line-height: 1.6;
}

.hero-actions {
  flex-direction: column;
  align-items: stretch;
  min-width: 260px;
}

.picker-actions {
  min-width: 320px;
}

.month-field,
.toggle-field {
  display: grid;
  gap: 0.45rem;
  color: rgba(255, 247, 237, 0.86);
}

.toggle-field {
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.65rem;
}

input[type="month"],
input[type="date"],
input[type="password"],
input[type="text"],
select,
textarea {
  min-height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.55);
  color: #fff7ed;
  padding: 0.8rem 0.9rem;
}

textarea {
  min-height: 110px;
  resize: vertical;
}

.primary-button,
.secondary-link,
.secondary-button {
  min-height: 46px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  text-decoration: none;
}

.primary-button {
  border: none;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  cursor: pointer;
}

.secondary-link,
.secondary-button {
  background: rgba(255, 255, 255, 0.08);
  color: #fff7ed;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.secondary-button {
  cursor: pointer;
}

.panel,
.summary-card,
.driver-card,
.kpi-card,
.filter-card {
  background: rgba(15, 23, 42, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(18px);
}

.panel,
.filter-card {
  border-radius: 28px;
  padding: 1.4rem;
}

.summary-grid {
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.summary-card {
  flex: 1 1 220px;
  border-radius: 22px;
  padding: 1.25rem;
}

.summary-label,
.summary-card small,
.kpi-card small,
.driver-card span,
.spotlight-metrics span,
.report-table th {
  color: rgba(255, 247, 237, 0.7);
}

.summary-card strong,
.kpi-card strong,
.spotlight-metrics strong,
.driver-metrics-grid strong {
  display: block;
  font-size: 1.65rem;
  color: #fff7ed;
}

.accent-orange { box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.3); }
.accent-sky { box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.3); }
.accent-green { box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.3); }
.accent-rose { box-shadow: inset 0 0 0 1px rgba(244, 114, 182, 0.3); }

.feedback { margin: 0 0 1rem; }
.error-text { color: #fecaca; }
.success-text { color: #bbf7d0; }

.analytics-layout {
  gap: 1rem;
  align-items: stretch;
  margin-bottom: 1rem;
}

.spotlight-panel,
.table-panel {
  flex: 1 1 0;
}

.panel-badge,
.status-chip {
  border-radius: 999px;
  padding: 0.42rem 0.8rem;
  background: rgba(255, 255, 255, 0.08);
}

.spotlight-grid {
  gap: 1rem;
  align-items: stretch;
}

.picker-spotlight-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
}

.spotlight-main {
  border-radius: 20px;
  padding: 1.15rem;
  background: rgba(255, 255, 255, 0.06);
}

.spotlight-main h3,
.driver-card h3,
.panel h2,
.analytics-hero h1 {
  margin: 0.25rem 0;
}

.spotlight-metrics {
  gap: 1rem;
  flex-wrap: wrap;
}

.spotlight-metrics > div,
.driver-metrics-grid > div {
  flex: 1 1 140px;
}

.kpi-stack {
  flex-direction: column;
  gap: 0.9rem;
}

.kpi-card,
.driver-card {
  border-radius: 20px;
  padding: 1rem;
}

.driver-grid {
  flex-direction: column;
  gap: 0.9rem;
}

.driver-status-group {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.status-chip-alt {
  background: rgba(56, 189, 248, 0.16);
}

.status-chip-error {
  background: rgba(244, 114, 182, 0.18);
}

.driver-metrics-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.picker-metrics-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.order-lookup-panel {
  margin-bottom: 1rem;
}

.lookup-row,
.lookup-actions {
  display: flex;
  gap: 0.9rem;
  align-items: end;
  flex-wrap: wrap;
}

.lookup-field {
  flex: 1 1 320px;
}

.lookup-button {
  min-width: 180px;
}

.lookup-result-card {
  margin-top: 1rem;
  border-radius: 20px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
}

.lookup-result-grid,
.lookup-report-grid {
  display: grid;
  gap: 1rem;
}

.lookup-result-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.lookup-result-grid span {
  color: rgba(255, 247, 237, 0.7);
}

.lookup-result-grid strong {
  display: block;
  margin-top: 0.35rem;
}

.lookup-report-form {
  margin-top: 1rem;
}

.lookup-report-grid {
  grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
}

.lookup-report-description {
  min-width: 0;
}

.empty-panel {
  padding: 1.1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.filter-card {
  margin-bottom: 1rem;
}

.filter-grid {
  gap: 1rem;
}

.filter-grid > label {
  flex: 1 1 0;
}

.single-field {
  max-width: 260px;
}

.report-table-wrap {
  overflow: auto;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
}

.report-table th,
.report-table td {
  padding: 0.85rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

@media (max-width: 960px) {
  .analytics-hero,
  .analytics-layout,
  .spotlight-grid,
  .picker-spotlight-grid,
  .filter-grid {
    display: grid;
  }

  .picker-actions {
    min-width: 0;
  }

  .lookup-result-grid,
  .lookup-report-grid,
  .picker-metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>