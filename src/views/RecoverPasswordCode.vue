<template>
  <section class="auth-page">
    <div class="auth-layout">
      <aside class="auth-hero">
        <div class="auth-brand">
          <span class="auth-brand-mark">MR</span>
          <div class="auth-brand-copy">
            <span class="auth-brand-name">MakeRoute</span>
            <span class="auth-brand-tag">Validacion de recuperacion</span>
          </div>
        </div>

        <div class="auth-hero-copy">
          <span class="auth-kicker">Paso 2 de 3</span>
          <h1>Valida el codigo numerico enviado a tu correo.</h1>
          <p>
            Introduce el codigo temporal de 6 digitos para habilitar el cambio de contrasena.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Correo</span>
            <strong>{{ recoveryEmail || "Pendiente de solicitud" }}</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Vigencia</span>
            <strong>15 minutos</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Siguiente paso</span>
            <strong>Nueva contrasena segura</strong>
          </div>
        </div>
      </aside>

      <div class="auth-panel">
        <div class="auth-panel-header">
          <img :src="easyMoveLogo" alt="Easy Move" />
          <h2>Confirmar codigo</h2>
          <p>Escribe el codigo de recuperacion para continuar con el restablecimiento.</p>
        </div>

        <form class="auth-form" @submit.prevent="submitCodeVerification">
          <div class="auth-field">
            <label for="recovery-code">Codigo numerico</label>
            <input id="recovery-code" v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code" :disabled="isSubmitting" />
          </div>

          <p v-if="statusMessage" class="auth-status" :class="statusClass">{{ statusMessage }}</p>

          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Validando codigo..." : "Continuar" }}
          </button>
        </form>

        <p class="auth-switch">
          No recibiste el codigo?
          <a href="#" @click.prevent="goToRequestStep">Solicitar otro</a>
        </p>

        <p class="auth-switch">
          Recordaste tu acceso?
          <a href="#" @click.prevent="goToLogin">Volver a iniciar sesion</a>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";
import { getPasswordRecoveryContext, setPasswordRecoveryContext, verifyPasswordResetCode } from "../services/auth";

const router = useRouter();
const code = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");
const recoveryEmail = ref("");

const statusMessage = computed(() => errorMessage.value || infoMessage.value);
const statusClass = computed(() => (errorMessage.value ? "auth-status-error" : "auth-status-info"));

onMounted(() => {
  const context = getPasswordRecoveryContext();

  if (!context?.email) {
    router.replace("/recover-password");
    return;
  }

  recoveryEmail.value = context.email;
  code.value = context.code || "";
  infoMessage.value = "Introduce el codigo que llego a tu correo corporativo.";
});

async function submitCodeVerification() {
  errorMessage.value = "";
  infoMessage.value = "";

  if (!recoveryEmail.value || !code.value.trim()) {
    errorMessage.value = "Debes ingresar el codigo de recuperacion.";
    return;
  }

  isSubmitting.value = true;

  try {
    const result = await verifyPasswordResetCode({
      email: recoveryEmail.value,
      code: code.value.trim(),
    });

    setPasswordRecoveryContext({
      email: recoveryEmail.value,
      code: code.value.trim(),
      verified: true,
    });
    infoMessage.value = result?.message || "Codigo validado correctamente.";
    window.setTimeout(() => {
      router.push("/recover-password/new-password");
    }, 500);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo validar el codigo.";
  } finally {
    isSubmitting.value = false;
  }
}

function goToRequestStep() {
  router.push("/recover-password");
}

function goToLogin() {
  router.push("/login");
}
</script>