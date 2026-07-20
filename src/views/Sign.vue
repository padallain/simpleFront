<template>
  <section class="auth-page">
    <div class="auth-layout">
      <aside class="auth-hero">
        <div class="auth-brand">
          <span class="auth-brand-mark">MR</span>
          <div class="auth-brand-copy">
            <span class="auth-brand-name">MakeRoute</span>
            <span class="auth-brand-tag">Alta de usuarios operativos</span>
          </div>
        </div>

        <div class="auth-hero-copy">
          <span class="auth-kicker">Registro</span>
          <h1>Crea una cuenta alineada con el panel principal.</h1>
          <p>
            Prepara el acceso para choferes, despacho o coordinacion con una pantalla mas consistente y clara.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Perfil</span>
            <strong>Datos basicos del usuario</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Equipo</span>
            <strong>Acceso para operaciones y control</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Continuidad</span>
            <strong>Misma experiencia visual del sistema</strong>
          </div>
        </div>
      </aside>

      <div class="auth-panel">
        <div class="auth-panel-header">
          <img :src="easyMoveLogo" alt="Easy Move" />
          <h2>Registrarse</h2>
          <p>Completa los datos iniciales para generar tu acceso a MakeRoute.</p>
        </div>

        <form class="auth-form" @submit.prevent="submitSignup">
          <div class="auth-field-group">
            <div class="auth-field">
              <label for="signup-email">Correo electronico</label>
              <input id="signup-email" v-model="email" type="email" placeholder="equipo@empresa.com" autocomplete="email" />
            </div>

            <div class="auth-field">
              <label for="signup-username">Usuario</label>
              <input id="signup-username" v-model="username" type="text" placeholder="coordinacion_rutas" autocomplete="username" />
            </div>
          </div>

          <div class="auth-field">
            <label for="signup-password">Contrasena</label>
            <input id="signup-password" v-model="password" type="password" placeholder="Crea una contrasena segura" autocomplete="new-password" />
          </div>

          <p v-if="statusMessage" class="auth-status" :class="statusClass">{{ statusMessage }}</p>

          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Creando cuenta..." : "Crear cuenta" }}
          </button>
        </form>

        <p class="auth-switch">
          Ya tienes una cuenta?
          <a href="#" @click.prevent="goToLogin">Iniciar sesion</a>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";
import { registerUser } from "../services/auth";

const router = useRouter();
const email = ref("");
const username = ref("");
const password = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");

const statusMessage = computed(() => errorMessage.value || infoMessage.value);
const statusClass = computed(() => (errorMessage.value ? "auth-status-error" : "auth-status-info"));

async function submitSignup() {
  errorMessage.value = "";
  infoMessage.value = "";

  if (!email.value.trim() || !username.value.trim() || !password.value) {
    errorMessage.value = "Debes completar correo, usuario y contrasena.";
    return;
  }

  isSubmitting.value = true;

  try {
    await registerUser({
      email: email.value.trim(),
      username: username.value.trim(),
      password: password.value,
    });

    await router.push({
      path: "/login",
      query: { reason: "signup-success" },
    });
  } catch (error) {
    errorMessage.value = error.message || "No se pudo crear la cuenta.";
  } finally {
    isSubmitting.value = false;
  }
}

function goToLogin() {
  router.push("/login");
}
</script>