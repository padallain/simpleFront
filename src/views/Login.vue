<template>
  <section class="auth-page">
    <div class="auth-layout">
      <aside class="auth-hero">
        <div class="auth-brand">
          <span class="auth-brand-mark">MR</span>
          <div class="auth-brand-copy">
            <span class="auth-brand-name">MakeRoute</span>
            <span class="auth-brand-tag">Logistica y control operativo</span>
          </div>
        </div>

        <div class="auth-hero-copy">
          <span class="auth-kicker">Acceso del equipo</span>
          <h1>Ingresa y sigue operando sin perder el ritmo.</h1>
          <p>
            Accede a tus rutas, chequeos y paneles con la misma identidad visual del resto de la plataforma.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Rutas</span>
            <strong>Planeacion y seguimiento</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Operaciones</span>
            <strong>Despacho y chequeos diarios</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Acceso</span>
            <strong>Seguro y rapido para el equipo</strong>
          </div>
        </div>
      </aside>

      <div class="auth-panel">
        <div class="auth-panel-header">
          <img :src="easyMoveLogo" alt="Easy Move" />
          <h2>Iniciar sesion</h2>
          <p>Usa tu correo corporativo para entrar al panel de MakeRoute.</p>
        </div>

        <form class="auth-form" @submit.prevent="submitLogin">
          <div class="auth-field">
            <label for="login-email">Correo electronico</label>
            <input id="login-email" v-model="email" type="email" placeholder="operaciones@empresa.com" autocomplete="email" />
          </div>

          <div class="auth-field">
            <label for="login-password">Contrasena</label>
            <input id="login-password" v-model="password" type="password" placeholder="Ingresa tu contrasena" autocomplete="current-password" />
          </div>

          <div class="auth-inline-row auth-inline-row-single">
            <a href="#" class="auth-link" @click.prevent="goToRecover">Recuperar contrasena</a>
          </div>

          <p v-if="statusMessage" class="auth-status" :class="statusClass">{{ statusMessage }}</p>

          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Validando acceso..." : "Entrar al sistema" }}
          </button>
        </form>

        <p class="auth-switch">
          Aun no tienes cuenta?
          <a href="#" @click.prevent="goToSign">Crear cuenta</a>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";
import { consumeRedirectReason, loginWithSession } from "../services/auth";

const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");

const statusMessage = computed(() => errorMessage.value || infoMessage.value);
const statusClass = computed(() => (errorMessage.value ? "auth-status-error" : "auth-status-info"));

function resolveRedirectTarget() {
  const redirectQuery = route.query.redirect;
  return typeof redirectQuery === "string" && redirectQuery.startsWith("/") ? redirectQuery : "/";
}

async function submitLogin() {
  errorMessage.value = "";
  infoMessage.value = "";

  if (!email.value.trim() || !password.value) {
    errorMessage.value = "Debes ingresar correo y contrasena.";
    return;
  }

  isSubmitting.value = true;

  try {
    await loginWithSession({
      email: email.value.trim(),
      password: password.value,
    });

    await router.replace(resolveRedirectTarget());
  } catch (error) {
    errorMessage.value = error.message || "No se pudo iniciar sesion.";
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  const reasonFromQuery = typeof route.query.reason === "string" ? route.query.reason : "";
  const reason = reasonFromQuery || consumeRedirectReason();

  if (reason === "signed-out") {
    infoMessage.value = "La sesion se cerro correctamente.";
    return;
  }

  if (reason === "signup-success") {
    infoMessage.value = "Cuenta creada. Inicia sesion con tus credenciales.";
    return;
  }

  if (reason === "session-expired") {
    infoMessage.value = "Tu sesion expiro despues de 24 horas. Debes autenticarte otra vez.";
    return;
  }

  if (reason === "auth-required") {
    infoMessage.value = "Inicia sesion para continuar.";
  }
});

function goToSign() {
  router.push("/signup");
}

function goToRecover() {
  router.push("/recover-password");
}
</script>