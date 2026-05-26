import { createScriptIdDiv, teleportStyle } from '@/src/util/script';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import Panel from './Panel.vue';

export function initPanel() {
  const app = createApp(Panel).use(getActivePinia() ?? createPinia());

  const $app = createScriptIdDiv();
  $('#extensions_settings2').append($app);
  app.mount($app[0]);

  const { destroy: destroyStyle } = teleportStyle();

  return () => {
    app.unmount();
    $app.remove();
    destroyStyle();
  };
}
