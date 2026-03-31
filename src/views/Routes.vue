<script setup>
import { ref , watch } from "vue";
import jsPDF from "jspdf";

const paradaInput = ref("");
const paradas = ref([]);
const serverResponse = ref(null);
const routeTable = ref([]);

watch(
  () => serverResponse.value?.routeNames,
  (names) => {
    if (names && names.length) {
      routeTable.value = names.map((name, idx) => ({
        orden: idx + 1,
        nombre: name,
        novedad: "",
      }));
    } else {
      routeTable.value = [];
    }
  }
);

function printRoutePDF() {
  if (
    !serverResponse.value ||
    !serverResponse.value.routeNames ||
    serverResponse.value.routeNames.length === 0
  ) {
    return;
  }
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Tabla de paradas para el chofer", 10, 10);

  // Encabezados
  doc.setFontSize(12);
  doc.text("Orden", 10, 20);
  doc.text("Nombre de la parada", 40, 20);

  // Filas
  serverResponse.value.routeNames.forEach((name, idx) => {
    doc.text(String(idx + 1), 10, 30 + idx * 10);
    doc.text(name, 40, 30 + idx * 10);
  });

  doc.save("paradas_chofer.pdf");
}

async function agregarParada() {
  const clientId = paradaInput.value.trim();
  if (clientId !== "") {
    let name = "";
    try {
      const response = await fetch(
        `https://testingclient.onrender.com/getClient/${clientId}`
      );
      if (response.ok) {
        const data = await response.json();
        name = data.nombre || ""; // Ajusta según la estructura de tu backend
      } else {
        name = "No encontrado";
      }
    } catch (e) {
      name = "Error";
    }
    paradas.value.push({ parada: clientId, name });
    paradaInput.value = "";
  }
}

function eliminarParada(idx) {
  paradas.value.splice(idx, 1);
}

async function makeRoute() {
  try {
    const response = await fetch(
      "https://testingclient.onrender.com/makeRoute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: paradas.value.map((p) => p.parada) }),
      }
    );
    if (response.ok) {
      serverResponse.value = await response.json();
      // Un solo log con todos los clientes y sus links
      if (serverResponse.value.route) {
        const resumen = serverResponse.value.route
          .map(cliente => `${cliente.nombre}: ${cliente.googleMapsLink}`)
          .join(" \n ");
        console.log("Clientes y links:\n", resumen);
      }
    } else {
      serverResponse.value = { error: "Error en el servidor" };
    }
  } catch (error) {
    serverResponse.value = { error: error.message };
  }
}
</script>

<template>
  <section class="routes-page">
    <div class="routes-shell">
      <div class="routes-hero">
        <div>
          <p class="routes-kicker">Planeacion de ruta</p>
          <h1>Paradas del chofer</h1>
          <p class="routes-copy">Agrega clientes, genera la ruta y revisa los enlaces de navegación desde una interfaz adaptable.</p>
        </div>
      </div>

      <div class="routes-card routes-controls">
        <div class="input-row">
          <el-input
            v-model="paradaInput"
            placeholder="Agregar parada"
            class="route-input"
            @keyup.enter="agregarParada"
          />
          <el-button type="primary" class="route-action-button" @click="agregarParada">Agregar</el-button>
        </div>
      </div>

      <div class="routes-card">
        <div class="table-wrapper">
          <el-table :data="paradas" class="responsive-table">
      <el-table-column type="index" label="#" width="50" />
      <el-table-column prop="parada" label="Parada" />
      <el-table-column prop="name" label="Name" width="150" />
      <el-table-column label="Acciones" width="100">
        <template #default="scope">
          <el-button
            type="danger"
            size="small"
            @click="eliminarParada(scope.$index)"
            >Eliminar</el-button
          >
        </template>
      </el-table-column>
          </el-table>
        </div>

        <el-button type="success" class="route-submit-button" @click="makeRoute"
          >Make route</el-button
        >
      </div>

      <div v-if="serverResponse" class="routes-results">
        <div class="routes-card">
          <strong>Resumen de la ruta:</strong>
          <div class="table-wrapper">
            <el-table
              :data="serverResponse.route"
              class="responsive-table result-table"
            >
        <el-table-column prop="id" label="ID" width="150" />
        <el-table-column prop="nombre" label="Nombre" />
        <el-table-column label="Latitud">
          <template #default="scope">
            {{ scope.row.location.latitude }}
          </template>
        </el-table-column>
        <el-table-column label="Longitud">
          <template #default="scope">
            {{ scope.row.location.longitude }}
          </template>
        </el-table-column>
        <el-table-column label="Google Maps">
          <template #default="scope">
            <a
              :href="scope.row.googleMapsLink"
              target="_blank"
              style="color: #646cff"
              >Ver ubicación</a
            >
          </template>
        </el-table-column>
            </el-table>
          </div>
        </div>

        <div
          v-if="serverResponse.notFoundIds && serverResponse.notFoundIds.length"
          class="routes-card"
        >
          <strong>IDs no encontrados:</strong>
          <div class="table-wrapper">
            <el-table
              :data="serverResponse.notFoundIds.map((id) => ({ id }))"
              class="responsive-table"
            >
          <el-table-column prop="id" label="ID no encontrado" />
            </el-table>
          </div>
        </div>

        <div
          v-if="
            serverResponse.googleMapsRouteLinks &&
            serverResponse.googleMapsRouteLinks.length
          "
          class="routes-card"
        >
          <strong>Ruta en Google Maps:</strong>
          <div class="table-wrapper">
            <el-table
              :data="serverResponse.googleMapsRouteLinks.map((link) => ({ link }))"
              class="responsive-table"
            >
          <el-table-column label="Ruta">
            <template #default="scope">
              <a :href="scope.row.link" target="_blank" style="color: #16a34a"
                >Ver ruta</a
              >
            </template>
          </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-if="serverResponse.openRouteLink" class="routes-card link-card">
          <strong>Ruta en OpenRouteService:</strong>
          <a
            :href="serverResponse.openRouteLink"
            target="_blank"
            class="ors-link"
            >Ver en OpenRouteService</a
          >
        </div>

        <div v-if="serverResponse.error" class="routes-card error-card">
          <h3>Error:</h3>
          <pre>{{ serverResponse.error }}</pre>
        </div>

        <div
          v-if="serverResponse.routeNames && serverResponse.routeNames.length"
          class="routes-card"
        >
          <div class="driver-table-header">
            <strong>Tabla de paradas para el chofer:</strong>
            <el-button
              type="primary"
              @click="printRoutePDF"
            >
              Imprimir PDF
            </el-button>
          </div>
          <div class="table-wrapper">
            <el-table :data="routeTable" class="responsive-table result-table">
          <el-table-column prop="orden" label="Orden" width="80" />
          <el-table-column prop="nombre" label="Nombre de la parada" />
          <el-table-column label="Novedades" width="200">
            <template #default="scope">
              <el-input
                v-model="scope.row.novedad"
                placeholder="Escriba aquí..."
              />
            </template>
          </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.routes-page {
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(69, 167, 255, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(22, 163, 74, 0.16), transparent 26%),
    linear-gradient(180deg, #08111f 0%, #11213d 50%, #09121f 100%);
}

.routes-shell {
  max-width: 1180px;
  margin: 0 auto;
  color: #f3f6fb;
}

.routes-hero {
  margin-bottom: 1.5rem;
}

.routes-kicker {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

.routes-copy {
  max-width: 720px;
  color: rgba(243, 246, 251, 0.76);
}

.routes-card {
  margin-top: 1rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(8, 17, 31, 0.68);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.routes-controls {
  margin-top: 0;
}

.input-row {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.route-input {
  flex: 1 1 auto;
}

.route-action-button,
.route-submit-button {
  min-height: 46px;
}

.route-submit-button {
  margin-top: 1rem;
}

.routes-results {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin-top: 1rem;
}

.responsive-table {
  min-width: 640px;
}

.result-table {
  min-width: 760px;
}

.link-card,
.error-card {
  text-align: left;
}

.ors-link {
  display: inline-flex;
  margin-top: 0.75rem;
  color: #f8ca5b;
}

.error-card h3,
.error-card pre {
  margin: 0;
}

.error-card pre {
  margin-top: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.driver-table-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .routes-page {
    padding: 1rem 0.75rem 2rem;
  }

  .input-row,
  .driver-table-header {
    flex-direction: column;
    align-items: stretch;
  }

  .route-action-button,
  .route-submit-button {
    width: 100%;
  }
}
</style>
