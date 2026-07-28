<template>
  <section class="auth-page">
    <div class="auth-layout">
      <aside class="auth-hero">
        <div class="auth-brand">
          <span class="auth-brand-mark">MR</span>
          <div class="auth-brand-copy">
            <span class="auth-brand-name">MakeRoute</span>
            <span class="auth-brand-tag">Recuperacion de acceso</span>
          </div>
        </div>

        <div class="auth-hero-copy">
          <span class="auth-kicker">Soporte de acceso</span>
          <h1>Recupera tu contrasena sin salir del flujo operativo.</h1>
          <p>
            Solicita un codigo numerico por correo y restablece tu acceso desde esta misma pantalla.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Solicitud</span>
            <strong>Codigo numerico por correo</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Validacion</span>
            <strong>Codigo temporal de 6 digitos</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Retorno</span>
            <strong>Reingreso rapido a la plataforma</strong>
          </div>
        </div>
      </aside>

      <div class="auth-panel">
        <div class="auth-panel-header">
          <img :src="easyMoveLogo" alt="Easy Move" />
          <h2>Recuperar contrasena</h2>
          <p>Ingresa tu correo para recibir el codigo numerico de recuperacion.</p>
        </div>

        <form class="auth-form" @submit.prevent="submitRequestCode">
          <div class="auth-field">
            <label for="recover-email">Correo electronico</label>
            <input id="recover-email" v-model="email" type="email" placeholder="operaciones@empresa.com" autocomplete="email" :disabled="isRequesting" />
          </div>

          <p v-if="statusMessage" class="auth-status" :class="statusClass">{{ statusMessage }}</p>
          <p v-if="developmentCode" class="auth-status auth-status-info">Codigo temporal de desarrollo: {{ developmentCode }}</p>

          <button class="auth-submit" type="submit" :disabled="isRequesting">
            {{ isRequesting ? "Enviando codigo..." : "Continuar" }}
          </button>
        </form>

        <p class="auth-switch">
          Recordaste tu acceso?
          <a href="#" @click.prevent="goToLogin">Volver a iniciar sesion</a>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";
import { requestPasswordResetCode, setPasswordRecoveryContext } from "../services/auth";

const router = useRouter();
const email = ref("");
const isRequesting = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");
const developmentCode = ref("");

const statusMessage = computed(() => errorMessage.value || infoMessage.value);
const statusClass = computed(() => (errorMessage.value ? "auth-status-error" : "auth-status-info"));

async function submitRequestCode() {
  errorMessage.value = "";
  infoMessage.value = "";
  developmentCode.value = "";

  if (!email.value.trim()) {
    errorMessage.value = "Debes indicar el correo de la cuenta.";
    return;
  }

  isRequesting.value = true;

  try {
    const result = await requestPasswordResetCode(email.value.trim());
    const resolvedDevelopmentCode = String(result?.devRecoveryCode || "").trim();
    developmentCode.value = resolvedDevelopmentCode;
    setPasswordRecoveryContext({
      email: email.value.trim(),
      code: resolvedDevelopmentCode,
      verified: false,
    });
    infoMessage.value = result?.message || "Revisa tu correo para ver el codigo de recuperacion.";
    window.setTimeout(() => {
      router.push("/recover-password/code");
    }, 600);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo enviar el codigo de recuperacion.";
  } finally {
    isRequesting.value = false;
  }
}

function goToLogin() {
  router.push("/login");
}
</script>
