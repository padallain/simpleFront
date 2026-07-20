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

        <form class="auth-form" @submit.prevent>
          <div class="auth-field">
            <label for="login-email">Correo electronico</label>
            <input id="login-email" v-model="email" type="email" placeholder="operaciones@empresa.com" autocomplete="email" />
          </div>

          <div class="auth-field">
            <label for="login-password">Contrasena</label>
            <input id="login-password" v-model="password" type="password" placeholder="Ingresa tu contrasena" autocomplete="current-password" />
          </div>

          <div class="auth-inline-row">
            <label class="auth-check">
              <input v-model="rememberSession" type="checkbox" />
              <span>Mantener sesion abierta</span>
            </label>

            <a href="#" class="auth-link" @click.prevent="goToRecover">Recuperar contrasena</a>
          </div>

          <button class="auth-submit" type="submit">Entrar al sistema</button>
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
import { ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";

const router = useRouter();
const email = ref("");
const password = ref("");
const rememberSession = ref(true);

function goToSign() {
  router.push("/signup");
}

function goToRecover() {
  router.push("/recover-password");
}
</script>