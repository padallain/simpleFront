<template>
  <section class="auth-page">
    <div class="auth-layout">
      <aside class="auth-hero">
        <div class="auth-brand">
          <span class="auth-brand-mark">MR</span>
          <div class="auth-brand-copy">
            <span class="auth-brand-name">MakeRoute</span>
            <span class="auth-brand-tag">Nueva contrasena</span>
          </div>
        </div>

        <div class="auth-hero-copy">
          <span class="auth-kicker">Paso 3 de 3</span>
          <h1>Configura tu nueva contrasena.</h1>
          <p>
            El codigo ya fue validado. Define una nueva clave para recuperar el acceso al sistema.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Cuenta</span>
            <strong>{{ recoveryEmail || "Pendiente" }}</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Seguridad</span>
            <strong>Minimo 6 caracteres</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Resultado</span>
            <strong>Acceso restablecido</strong>
          </div>
        </div>
      </aside>

      <div class="auth-panel">
        <div class="auth-panel-header">
          <img :src="easyMoveLogo" alt="Easy Move" />
          <h2>Nueva contrasena</h2>
          <p>Escribe y confirma la nueva clave que usaras para iniciar sesion.</p>
        </div>

        <form class="auth-form" @submit.prevent="submitPasswordReset">
          <div class="auth-field">
            <label for="new-password">Nueva contrasena</label>
            <input id="new-password" v-model="newPassword" type="password" placeholder="Minimo 6 caracteres" autocomplete="new-password" :disabled="isSubmitting" />
          </div>

          <div class="auth-field">
            <label for="confirm-new-password">Confirmar contrasena</label>
            <input id="confirm-new-password" v-model="confirmPassword" type="password" placeholder="Repite la nueva contrasena" autocomplete="new-password" :disabled="isSubmitting" />
          </div>

          <p v-if="statusMessage" class="auth-status" :class="statusClass">{{ statusMessage }}</p>

          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Actualizando contrasena..." : "Guardar nueva contrasena" }}
          </button>
        </form>

        <p class="auth-switch">
          Necesitas revisar el codigo otra vez?
          <a href="#" @click.prevent="goToCodeStep">Volver al codigo</a>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";
import { clearPasswordRecoveryContext, getPasswordRecoveryContext, resetPasswordWithCode } from "../services/auth";

const router = useRouter();
const recoveryEmail = ref("");
const recoveryCode = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");

const statusMessage = computed(() => errorMessage.value || infoMessage.value);
const statusClass = computed(() => (errorMessage.value ? "auth-status-error" : "auth-status-info"));

onMounted(() => {
  const context = getPasswordRecoveryContext();

  if (!context?.email || !context?.code || !context?.verified) {
    router.replace("/recover-password");
    return;
  }

  recoveryEmail.value = context.email;
  recoveryCode.value = context.code;
});

async function submitPasswordReset() {
  errorMessage.value = "";
  infoMessage.value = "";

  if (!newPassword.value || !confirmPassword.value) {
    errorMessage.value = "Debes completar la nueva contrasena y su confirmacion.";
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "La confirmacion de contrasena no coincide.";
    return;
  }

  isSubmitting.value = true;

  try {
    const result = await resetPasswordWithCode({
      email: recoveryEmail.value,
      code: recoveryCode.value,
      newPassword: newPassword.value,
    });

    clearPasswordRecoveryContext();
    infoMessage.value = result?.message || "Contrasena actualizada correctamente.";
    window.setTimeout(() => {
      router.push({ path: "/login", query: { reason: "password-reset-success" } });
    }, 900);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo actualizar la contrasena.";
  } finally {
    isSubmitting.value = false;
  }
}

function goToCodeStep() {
  router.push("/recover-password/code");
}
</script>