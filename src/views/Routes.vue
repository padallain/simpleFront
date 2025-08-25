<script setup>
import { ref } from "vue";
import jsPDF from "jspdf";

const paradaInput = ref("");
const paradas = ref([]);
const serverResponse = ref(null);

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
    } else {
      serverResponse.value = { error: "Error en el servidor" };
    }
  } catch (error) {
    serverResponse.value = { error: error.message };
  }
}
</script>

<template>
  <div>
    <h1>Paradas</h1>
    <el-input
      v-model="paradaInput"
      placeholder="Agregar parada"
      style="width: 200px; margin-right: 8px"
      @keyup.enter="agregarParada"
    />
    <el-button type="primary" @click="agregarParada">Agregar</el-button>
    <el-table :data="paradas" style="width: 400px; margin: 2rem auto">
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
    <el-button type="success" @click="makeRoute" style="margin-top: 1rem"
      >Make route</el-button
    >
    <div v-if="serverResponse" style="margin-top: 2rem">
      <strong>Resumen de la ruta:</strong>
      <el-table
        :data="serverResponse.route"
        style="width: 100%; margin-top: 1rem"
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
      <div
        v-if="serverResponse.notFoundIds && serverResponse.notFoundIds.length"
        style="margin-top: 1rem"
      >
        <strong>IDs no encontrados:</strong>
        <el-table
          :data="serverResponse.notFoundIds.map((id) => ({ id }))"
          style="width: 100%"
        >
          <el-table-column prop="id" label="ID no encontrado" />
        </el-table>
      </div>
      <div
        v-if="
          serverResponse.googleMapsRouteLinks &&
          serverResponse.googleMapsRouteLinks.length
        "
        style="margin-top: 1rem"
      >
        <strong>Ruta en Google Maps:</strong>
        <el-table
          :data="serverResponse.googleMapsRouteLinks.map((link) => ({ link }))"
          style="width: 100%"
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
      <div v-if="serverResponse.openRouteLink" style="margin-top: 1rem">
        <strong>Ruta en OpenRouteService:</strong>
        <a
          :href="serverResponse.openRouteLink"
          target="_blank"
          style="color: #eab308"
          >Ver en OpenRouteService</a
        >
      </div>
      <div v-if="serverResponse.error">
        <h3 style="color: red">Error:</h3>
        <pre>{{ serverResponse.error }}</pre>
      </div>
      <div
        v-if="serverResponse.routeNames && serverResponse.routeNames.length"
        style="margin-top: 2rem"
      >
        <strong>Tabla de paradas para el chofer:</strong>
        <el-button
          type="primary"
          @click="printRoutePDF"
          style="margin-bottom: 1rem"
        >
          Imprimir PDF
        </el-button>
        <el-table :data="routeTable" style="width: 100%; margin-top: 1rem">
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
</template>
