<template>
  <div class="login-bg">
    <div class="login-form">
      <div class="logo">
        <img :src="easyMoveLogo" alt="easyMove logo" class="logo-img" />
      </div>
      <el-form>
        <div class="form-row">
          <el-form-item label="Email">
            <el-input v-model="email" placeholder="logtracker@gmail.com" />
          </el-form-item>
          <el-form-item label="username">
            <el-input v-model="username" placeholder="@logtracker123" />
          </el-form-item>
        </div>
        <el-form-item label="Password">
          <el-input v-model="password" type="password" placeholder="12345678" />
        </el-form-item>
        <el-button type="primary" class="register-btn" style="width: 100%;">Register</el-button>
      </el-form>
      <div class="login-links">
        <a href="#">Forgot Password?</a>
        <a href="#" style="float: right;" @click.prevent="goToLogin">Log in</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import easyMoveLogo from '../assets/easyMove.png'

const router = useRouter()
const email = ref('')
const username = ref('')
const password = ref('')

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.login-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: url('../assets/traffic.jpg') center center/cover no-repeat;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 0;
}
.login-form {
  position: relative;
  z-index: 1;
  background: rgba(255,255,255,0.95);
  padding: 2rem;
  border-radius: 16px;
  width: 420px;        /* ancho fijo */
  max-width: 90vw;     /* responsivo en pantallas pequeñas */
  min-width: 320px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logo {
  text-align: center;
  margin-bottom: 2rem;
}
.logo-img {
  width: 300px;
  margin-bottom: 0.5rem;
}
.form-row {
  display: flex;
  gap: 1rem;
}
.register-btn {
  margin-top: 1rem;
  background: #7c3aed;
  border: none;
}
.login-links {
  width: 100%;
  margin-top: 1.5rem;
  font-size: 0.95rem;
  color: #333;
  display: flex;
  justify-content: space-between;
}
.login-links a {
  color: #333;
  text-decoration: none;
}
</style>