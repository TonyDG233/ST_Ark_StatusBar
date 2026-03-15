import { createApp } from 'vue';
<<<<<<< HEAD
import app from './app.vue';

$(() => {
  createApp(app).mount('#app');
=======
import App from './App.vue';

$(() => {
  const app = createApp(App).use(createPinia());
  app.mount('#app');
  $(window).on('pagehide', () => app.unmount());
>>>>>>> a29fe33091e38cf7a506efd6e481bac35ed6d521
});
