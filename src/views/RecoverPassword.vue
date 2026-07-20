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
            Deja preparado el frente para que el usuario solicite un reinicio de contrasena con una experiencia consistente.
          </p>
        </div>

        <div class="auth-points">
          <div class="auth-point">
            <span class="auth-point-label">Solicitud</span>
            <strong>Envio de correo de recuperacion</strong>
          </div>
          <div class="auth-point">
            <span class="auth-point-label">Validacion</span>
            <strong>Cuenta vinculada al equipo</strong>
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
          <p>Ingresa tu correo y deja lista la solicitud de recuperacion.</p>
        </div>

        <form class="auth-form" @submit.prevent="showConfirmation = true">
          <div class="auth-field">
            <label for="recover-email">Correo electronico</label>
            <input id="recover-email" v-model="email" type="email" placeholder="operaciones@empresa.com" autocomplete="email" />
          </div>

          <div v-if="showConfirmation" class="auth-note">
            Si el correo existe en el sistema, aqui podras mostrar el mensaje de envio del enlace de recuperacion.
          </div>

          <button class="auth-submit" type="submit">Enviar solicitud</button>
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
import { ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";

const router = useRouter();
const email = ref("");
const showConfirmation = ref(false);

function goToLogin() {
  router.push("/login");
}
</script>