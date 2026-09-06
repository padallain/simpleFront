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

function installOfflineReloadGuards() {
	const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

	window.addEventListener('keydown', (event) => {
		if (!isOffline()) {
			return
		}

		const key = String(event.key || '').toLowerCase()
		const isReloadShortcut = key === 'f5' || ((event.ctrlKey || event.metaKey) && key === 'r')

		if (isReloadShortcut) {
			event.preventDefault()
		}
	})

	window.addEventListener('beforeunload', (event) => {
		if (!isOffline()) {
			return
		}

		event.preventDefault()
		event.returnValue = ''
	})

	let touchStartY = 0
	window.addEventListener('touchstart', (event) => {
		if (!event.touches || event.touches.length === 0) {
			return
		}

		touchStartY = event.touches[0].clientY
	}, { passive: true })

	window.addEventListener('touchmove', (event) => {
		if (!isOffline()) {
			return
		}

		if (!event.touches || event.touches.length === 0) {
			return
		}

		const touchY = event.touches[0].clientY
		const pullingDown = touchY > touchStartY + 12
		const atTop = (window.scrollY || 0) <= 0

		if (atTop && pullingDown) {
			event.preventDefault()
		}
	}, { passive: false })
}

installApiAuthInterceptor()
installOfflineReloadGuards()

const vuetify = createVuetify()
createApp(App).use(router).use(vuetify).use(ElementPlus).mount('#app')
 
// Registrar el service worker para PWA
if ('serviceWorker' in navigator) {
	const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
	navigator.serviceWorker.register(serviceWorkerUrl)
		.then(reg => console.log('Service Worker registrado:', reg))
		.catch(err => console.error('Error registrando Service Worker:', err));
}