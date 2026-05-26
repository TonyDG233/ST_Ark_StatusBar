import { createPinia } from 'pinia';
import { createApp } from 'vue';
import '../ARK_STATUSBAR/styles/tailwind.scss';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
