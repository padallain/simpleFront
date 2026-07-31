<template>
  <section class="admin-users-page">
    <div class="admin-shell">
      <header class="hero-panel">
        <div>
          <p class="eyebrow">Control administrativo</p>
          <h1>Aprobacion de usuarios y contrasenas</h1>
          <p class="hero-copy">
            Solo administradores pueden aprobar usuarios nuevos, crear cuentas y cambiar contrasenas de forma segura.
          </p>
        </div>
        <button class="primary-button" type="button" :disabled="loading" @click="loadAllData">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
      </header>

      <p v-if="errorMessage" class="feedback error-text">{{ errorMessage }}</p>
      <p v-else-if="feedbackMessage" class="feedback success-text">{{ feedbackMessage }}</p>

      <section class="panel-card">
        <div class="panel-header">
          <h2>Crear usuario nuevo</h2>
          <span>Acceso inmediato aprobado por admin</span>
        </div>

        <form class="form-grid" @submit.prevent="submitCreateUser">
          <label>
            Correo
            <input v-model="createForm.email" type="email" placeholder="usuario@empresa.com" />
          </label>
          <label>
            Usuario
            <input v-model="createForm.username" type="text" placeholder="nombre_usuario" />
          </label>
          <label>
            Contrasena
            <input v-model="createForm.password" type="password" placeholder="Minimo 6 caracteres" />
          </label>
          <label>
            Rol
            <select v-model="createForm.role">
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <div class="form-actions">
            <button class="primary-button" type="submit" :disabled="creatingUser">
              {{ creatingUser ? "Creando..." : "Crear usuario" }}
            </button>
          </div>
        </form>
      </section>

      <section class="panel-card">
        <div class="panel-header">
          <h2>Solicitudes pendientes</h2>
          <span>{{ pendingUsers.length }}</span>
        </div>

        <div v-if="pendingUsers.length" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Creado</th>
                <th>Rol al aprobar</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in pendingUsers" :key="user._id || user.id">
                <td>{{ user.username }}</td>
                <td>{{ user.email }}</td>
                <td>{{ formatDate(user.createdAt) }}</td>
                <td>
                  <select v-model="approvalRoles[user._id || user.id]">
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td class="row-actions">
                  <button
                    class="small-button"
                    type="button"
                    :disabled="approvalLoadingId === (user._id || user.id)"
                    @click="approveUser(user, true)"
                  >
                    Aprobar
                  </button>
                  <button
                    class="small-button danger"
                    type="button"
                    :disabled="approvalLoadingId === (user._id || user.id)"
                    @click="approveUser(user, false)"
                  >
                    Rechazar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-text">No hay usuarios pendientes de aprobacion.</p>
      </section>

      <section class="panel-card">
        <div class="panel-header">
          <h2>Usuarios aprobados</h2>
          <span>{{ approvedUsers.length }}</span>
        </div>

        <div v-if="approvedUsers.length" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Aprobado</th>
                <th>Nueva contrasena</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in approvedUsers" :key="user._id || user.id">
                <td>{{ user.username }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.role === "admin" ? "Administrador" : "Usuario" }}</td>
                <td>{{ formatDate(user.approvedAt) }}</td>
                <td>
                  <input
                    v-model="passwordDrafts[user._id || user.id]"
                    type="password"
                    placeholder="Nueva contrasena"
                  />
                </td>
                <td>
                  <button
                    class="small-button"
                    type="button"
                    :disabled="passwordLoadingId === (user._id || user.id)"
                    @click="changeUserPassword(user)"
                  >
                    Cambiar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-text">No hay usuarios aprobados para mostrar.</p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import {
  approveUserByAdmin,
  createUserByAdmin,
  fetchAdminUsers,
  updateUserPasswordByAdmin,
} from "../services/auth";

const loading = ref(false);
const creatingUser = ref(false);
const approvalLoadingId = ref("");
const passwordLoadingId = ref("");
const errorMessage = ref("");
const feedbackMessage = ref("");
const users = ref([]);
const approvalRoles = reactive({});
const passwordDrafts = reactive({});
const createForm = reactive({
  email: "",
  username: "",
  password: "",
  role: "user",
});

const pendingUsers = computed(() => users.value.filter((user) => user?.isApproved === false));
const approvedUsers = computed(() => users.value.filter((user) => user?.isApproved !== false));

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setUsers(nextUsers) {
  users.value = Array.isArray(nextUsers) ? nextUsers : [];

  users.value.forEach((user) => {
    const userId = user._id || user.id;

    if (!userId) {
      return;
    }

    if (!approvalRoles[userId]) {
      approvalRoles[userId] = user.role === "admin" ? "admin" : "user";
    }

    if (!passwordDrafts[userId]) {
      passwordDrafts[userId] = "";
    }
  });
}

async function loadAllData() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await fetchAdminUsers();
    setUsers(result?.users || []);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo cargar la administracion de usuarios.";
  } finally {
    loading.value = false;
  }
}

async function submitCreateUser() {
  errorMessage.value = "";
  feedbackMessage.value = "";

  const email = String(createForm.email || "").trim();
  const username = String(createForm.username || "").trim();
  const password = String(createForm.password || "");
  const role = createForm.role === "admin" ? "admin" : "user";

  if (!email || !username || !password) {
    errorMessage.value = "Completa correo, usuario y contrasena.";
    return;
  }

  creatingUser.value = true;

  try {
    await createUserByAdmin({
      email,
      username,
      password,
      role,
    });

    createForm.email = "";
    createForm.username = "";
    createForm.password = "";
    createForm.role = "user";
    feedbackMessage.value = "Usuario creado correctamente.";
    await loadAllData();
  } catch (error) {
    errorMessage.value = error.message || "No se pudo crear el usuario.";
  } finally {
    creatingUser.value = false;
  }
}

async function approveUser(user, isApproved) {
  const userId = String(user?._id || user?.id || "");

  if (!userId) {
    return;
  }

  approvalLoadingId.value = userId;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    await approveUserByAdmin({
      userId,
      isApproved,
      role: approvalRoles[userId] === "admin" ? "admin" : "user",
    });
    feedbackMessage.value = isApproved
      ? "Usuario aprobado correctamente."
      : "Usuario marcado como no aprobado.";
    await loadAllData();
  } catch (error) {
    errorMessage.value = error.message || "No se pudo actualizar la aprobacion.";
  } finally {
    approvalLoadingId.value = "";
  }
}

async function changeUserPassword(user) {
  const userId = String(user?._id || user?.id || "");
  const newPassword = String(passwordDrafts[userId] || "");

  if (!userId) {
    return;
  }

  if (!newPassword) {
    errorMessage.value = "Debes escribir la nueva contrasena.";
    return;
  }

  passwordLoadingId.value = userId;
  errorMessage.value = "";
  feedbackMessage.value = "";

  try {
    await updateUserPasswordByAdmin({ userId, newPassword });
    passwordDrafts[userId] = "";
    feedbackMessage.value = `Contrasena actualizada para ${user.username}.`;
  } catch (error) {
    errorMessage.value = error.message || "No se pudo cambiar la contrasena.";
  } finally {
    passwordLoadingId.value = "";
  }
}

onMounted(() => {
  loadAllData();
});
</script>

<style scoped>
.admin-users-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2.5rem;
  background:
    radial-gradient(circle at 10% 8%, rgba(69, 167, 255, 0.24), transparent 24%),
    radial-gradient(circle at 88% 12%, rgba(34, 197, 94, 0.2), transparent 24%),
    linear-gradient(180deg, #08111d 0%, #0f213a 55%, #091221 100%);
  color: #f3f6fb;
}

.admin-shell {
  max-width: 1260px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.hero-panel,
.panel-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 18, 32, 0.7);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.2);
}

.hero-panel {
  padding: 1.2rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  color: #9fd1ff;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-top: 0.35rem;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
}

.hero-copy {
  margin-top: 0.7rem;
  max-width: 700px;
  color: rgba(243, 246, 251, 0.72);
}

.panel-card {
  padding: 1rem;
  display: grid;
  gap: 0.85rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.panel-header span {
  color: rgba(243, 246, 251, 0.74);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
}

.form-grid label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.86rem;
  color: rgba(243, 246, 251, 0.82);
}

.form-grid input,
.form-grid select,
table input,
table select {
  width: 100%;
  min-height: 40px;
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.95);
  color: #15253f;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.primary-button,
.small-button {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
}

.primary-button {
  min-height: 42px;
  padding: 0.55rem 0.95rem;
  color: #fff;
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
}

.small-button {
  min-height: 36px;
  padding: 0.45rem 0.72rem;
  color: #08111d;
  background: linear-gradient(135deg, #ffd59a 0%, #ffb34d 100%);
}

.small-button.danger {
  color: #fee2e2;
  background: rgba(185, 28, 28, 0.58);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.small-button:disabled,
.primary-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.feedback {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
}

.error-text {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.32);
}

.success-text {
  color: #bbf7d0;
  background: rgba(21, 128, 61, 0.3);
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;
}

th,
td {
  text-align: left;
  padding: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

th {
  color: #9fd1ff;
  font-size: 0.84rem;
  font-weight: 700;
}

td {
  color: rgba(243, 246, 251, 0.92);
  font-size: 0.9rem;
}

.row-actions {
  display: flex;
  gap: 0.45rem;
}

.empty-text {
  color: rgba(243, 246, 251, 0.74);
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .hero-panel,
  .panel-header,
  .row-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .primary-button,
  .small-button {
    width: 100%;
  }
}
</style>
