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

        <form class="auth-form" @submit.prevent>
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

          <div class="auth-note">
            Este flujo deja listo el frente para registro. La integracion con el backend puede conectarse despues sin rehacer el diseno.
          </div>

          <button class="auth-submit" type="submit">Crear cuenta</button>
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
import { ref } from "vue";
import { useRouter } from "vue-router";
import easyMoveLogo from "../assets/easyMove.png";

const router = useRouter();
const email = ref("");
const username = ref("");
const password = ref("");

function goToLogin() {
  router.push("/login");
}
</script>