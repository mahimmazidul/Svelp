import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const bal_app = mount(App, {
  target: document.getElementById('app') as HTMLElement
});

export default bal_app;
