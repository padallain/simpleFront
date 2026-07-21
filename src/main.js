import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index'
import { installApiAuthInterceptor } from './services/auth'

import 'element-plus/dist/index.css'
import ElementPlus from 'element-plus'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'

console.log('[main] bootstrapping app', {
	pathname: window.location.pathname,
	hash: window.location.hash,
	href: window.location.href,
})

installApiAuthInterceptor()

const vuetify = createVuetify()
createApp(App).use(router).use(vuetify).use(ElementPlus).mount('#app')
 
// Registrar el service worker para PWA
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js')
			.then(reg => console.log('Service Worker registrado:', reg))
			.catch(err => console.error('Error registrando Service Worker:', err));
	});
}