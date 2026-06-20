import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AVGContainer from './components/AVGContainer.vue';

$(() => {
    const app = createApp(AVGContainer);
    app.use(createPinia());
    
    const appRoot = document.getElementById('app');
    if (appRoot) {
        app.mount(appRoot);
        console.log("[sandbox_AVG] Vue app mounted successfully.");
    } else {
        console.error("[sandbox_AVG] Root element #app not found!");
    }

    $(window).on('pagehide', () => {
        app.unmount();
        console.log("[sandbox_AVG] Vue app unmounted.");
    });
});
