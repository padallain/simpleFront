<script setup>
import { ref } from "vue";

const paradaInput = ref("");
const paradas = ref([]);
const serverResponse = ref(null);

async function agregarParada() {
  const clientId = paradaInput.value.trim();
  if (clientId !== "") {
    let name = "";
    try {
      const response = await fetch(`https://testingclient.onrender.com/getClient/${clientId}`);
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
    const response = await fetch("http://testingclient.onrender.com/makeRoute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: paradas.value.map(p => p.parada) }),
    });
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
    <el-table :data="paradas" style="width: 400px; margin: 2rem auto;">
      <el-table-column type="index" label="#" width="50" />
      <el-table-column prop="parada" label="Parada" />
      <el-table-column prop="name" label="Name" width="150"/>
      <el-table-column label="Acciones" width="100">
        <template #default="scope">
          <el-button type="danger" size="small" @click="eliminarParada(scope.$index)">Eliminar</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button type="success" @click="makeRoute" style="margin-top: 1rem;">Make route</el-button>
    <div v-if="serverResponse" style="margin-top: 2rem;">
      <strong>Respuesta del servidor:</strong>
      <pre>{{ serverResponse }}</pre>
    </div>
  </div>
</template>