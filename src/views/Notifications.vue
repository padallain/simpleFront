<template>
  <section class="notifications-page">
    <div class="notifications-shell">
      <header class="hero-panel">
        <div>
          <p class="eyebrow">Centro de comunicaciones</p>
          <h1>Notificaciones</h1>
          <p class="hero-copy">
            Revisa el historial de alertas y reportes enviados a los administradores del sistema.
          </p>
        </div>
        <button class="primary-button" type="button" @click="refreshNotifications">
          {{ refreshing ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </header>

      <div class="stats-grid">
        <article class="stat-card accent-blue">
          <span class="stat-label">Total</span>
          <strong>{{ notifications.length }}</strong>
        </article>
        <article class="stat-card accent-green">
          <span class="stat-label">Enviadas</span>
          <strong>{{ sentCount }}</strong>
        </article>
        <article class="stat-card accent-orange">
          <span class="stat-label">Pendientes</span>
          <strong>{{ pendingCount }}</strong>
        </article>
      </div>

      <section class="panel-card">
        <div class="panel-header">
          <h2>Ultimas notificaciones</h2>
          <span>{{ notifications.length }} registros</span>
        </div>

        <div v-if="notifications.length" class="notification-list">
          <article v-for="item in notifications" :key="item.id" class="notification-item" :class="`status-${item.status}`">
            <div class="notification-topline">
              <span class="notification-badge" :class="`badge-${item.type}`">{{ item.typeLabel }}</span>
              <span class="notification-status" :class="`status-${item.status}`">
                {{ item.status === 'sent' ? 'Enviada' : 'Pendiente' }}
              </span>
            </div>

            <h3>{{ item.subject }}</h3>
            <p class="notification-summary">{{ item.summary }}</p>

            <div class="notification-meta">
              <span>{{ item.sentAt }}</span>
              <span>{{ item.recipients.length }} destinatarios</span>
            </div>

            <div class="notification-detail" v-if="item.detail.length">
              <ul>
                <li v-for="(entry, index) in item.detail" :key="`${item.id}-${index}`">
                  {{ entry }}
                </li>
              </ul>
            </div>
          </article>
        </div>

        <p v-else class="empty-text">Todavia no hay notificaciones para mostrar.</p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const refreshing = ref(false)

const notifications = ref([
  {
    id: 1,
    type: 'report',
    typeLabel: 'Reporte',
    subject: 'Reporte de ayer: chequeo diario de camiones',
    summary: 'Resumen del dia anterior con choferes que no registraron su chequeo.',
    sentAt: 'Ayer 12:00 hs',
    status: 'sent',
    recipients: ['admin@empresa.com', 'manager@empresa.com'],
    detail: [
      'Choferes con reporte: 11/15',
      'Choferes sin reporte: 4',
      'Faltantes: Luis Torres, Diego Silva, Mateo Ruiz, Bruno Vega',
      'Fecha de referencia: 25/09/2026',
    ],
  },
  {
    id: 2,
    type: 'morning',
    typeLabel: 'Recordatorio',
    subject: 'Recordatorio matutino: chequeo diario de operacion',
    summary: 'Se le recuerda a los choferes cerrar el chequeo diario antes del mediodia.',
    sentAt: '08:00 hs',
    status: 'sent',
    recipients: ['admin@empresa.com'],
    detail: [
      'Hora programada: 08:00',
      'Resumen del dia: cierre antes del mediodia',
      'Destinatarios: administradores',
    ],
  },
  {
    id: 3,
    type: 'report',
    typeLabel: 'Reporte',
    subject: 'Reporte diario: chequeo de camiones',
    summary: 'Se envio el resumen del estado del chequeo con los choferes pendientes.',
    sentAt: '12:00 hs',
    status: 'pending',
    recipients: ['admin@empresa.com'],
    detail: [
      'Choferes con reporte: 4/6',
      'Choferes pendientes: 2',
      'Estado: esperando envio',
    ],
  },
])

const sentCount = computed(() => notifications.value.filter((item) => item.status === 'sent').length)
const pendingCount = computed(() => notifications.value.filter((item) => item.status === 'pending').length)

function refreshNotifications() {
  refreshing.value = true

  window.setTimeout(() => {
    refreshing.value = false
  }, 600)
}
</script>

<style scoped>
.notifications-page {
  min-height: calc(100vh - 56px);
  padding: 1.5rem;
  background: linear-gradient(180deg, #09141f 0%, #0c1726 100%);
  color: #edf4ff;
}

.notifications-shell {
  max-width: 1100px;
  margin: 0 auto;
}

.hero-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem;
  border: 1px solid rgba(140, 174, 255, 0.18);
  border-radius: 18px;
  background: rgba(15, 24, 38, 0.9);
  box-shadow: 0 12px 28px rgba(9, 18, 30, 0.32);
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #88b7ff;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

h1 {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
}

.hero-copy {
  margin: 0.4rem 0 0;
  max-width: 760px;
  color: #b7c6de;
  line-height: 1.5;
}

.primary-button {
  border: none;
  border-radius: 12px;
  padding: 0.9rem 1.2rem;
  background: linear-gradient(135deg, #3ea2ff 0%, #5f6bff 100%);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.primary-button:hover {
  transform: translateY(-1px);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid rgba(164, 192, 255, 0.12);
  background: rgba(13, 22, 32, 0.9);
}

.stat-card strong {
  font-size: 2rem;
  line-height: 1;
}

.accent-blue { border-top: 3px solid #5aa9ff; }
.accent-green { border-top: 3px solid #39d98a; }
.accent-orange { border-top: 3px solid #ffb454; }

.stat-label {
  color: #a7bdd9;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.panel-card {
  background: rgba(13, 22, 32, 0.9);
  border: 1px solid rgba(140, 174, 255, 0.14);
  border-radius: 18px;
  padding: 1.2rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.panel-header span {
  color: #9fb5d7;
  font-size: 0.85rem;
}

.notification-list {
  display: grid;
  gap: 1rem;
}

.notification-item {
  background: rgba(16, 30, 42, 0.9);
  border: 1px solid rgba(173, 201, 255, 0.12);
  border-radius: 16px;
  padding: 1rem 1.1rem;
}

.notification-item.status-pending {
  border-left: 4px solid #ffb454;
}

.notification-item.status-sent {
  border-left: 4px solid #39d98a;
}

.notification-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.34rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-morning {
  background: rgba(152, 120, 255, 0.15);
  color: #d7c7ff;
}

.badge-report {
  background: rgba(90, 169, 255, 0.15);
  color: #b8d7ff;
}

.notification-status {
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.3rem 0.6rem;
}

.notification-status.status-sent {
  background: rgba(57, 217, 138, 0.18);
  color: #8ef0bc;
}

.notification-status.status-pending {
  background: rgba(255, 180, 84, 0.18);
  color: #ffd69a;
}

.notification-item h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.notification-summary {
  margin: 0 0 0.75rem;
  color: #c4d3ee;
  line-height: 1.5;
}

.notification-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  color: #8ca4cb;
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
}

.notification-detail {
  background: rgba(7, 15, 22, 0.7);
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(192, 211, 255, 0.08);
}

.notification-detail ul {
  margin: 0;
  padding-left: 1.2rem;
  color: #dfeaff;
  line-height: 1.7;
}

.empty-text {
  margin: 0;
  padding: 1rem 0 0.25rem;
  color: #9bb1d2;
}

@media (max-width: 760px) {
  .notifications-page {
    padding: 1rem;
  }

  .hero-panel,
  .panel-header,
  .notification-topline {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
