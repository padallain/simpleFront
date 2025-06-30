import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index'

import 'element-plus/dist/index.css'
import ElementPlus from 'element-plus'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify()
createApp(App).use(router).use(vuetify).use(ElementPlus).mount('#app')