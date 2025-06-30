<template>
  <div>
    <video ref="video" autoplay playsinline width="320" height="240"></video>
    <br />
    <button @click="capture">Capturar Foto</button>
    <canvas ref="canvas" width="320" height="240" style="display:none;"></canvas>
    <div v-if="imageData">
      <img :src="imageData" alt="captura" width="320" />
      <button @click="sendToServer">Procesar Factura</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const video = ref(null)
const canvas = ref(null)
const imageData = ref(null)

let stream = null

onMounted(async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: true })
  video.value.srcObject = stream
})

onBeforeUnmount(() => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
})

function capture() {
  const ctx = canvas.value.getContext('2d')
  ctx.drawImage(video.value, 0, 0, canvas.value.width, canvas.value.height)
  imageData.value = canvas.value.toDataURL('image/png')
}

async function sendToServer() {
  // Aquí deberías enviar la imagen a tu backend para procesarla con ML Kit
  // Ejemplo usando fetch:
  const res = await fetch('https://tu-backend.com/procesar-factura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData.value })
  })
  const result = await res.json()
  alert('Datos extraídos: ' + JSON.stringify(result))
}
</script>