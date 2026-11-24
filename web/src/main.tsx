import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { mundaAi } from './ai/mundaAi';
import { firebase, firebaseConfigured } from './data/firebase';
import { session } from './data/session';
import { settings } from './data/settings';
import { prefs } from './data/prefs';
import { refreshWeather } from './data/weather';
import { language } from './i18n';
import { syncProcessor } from './sync/syncProcessor';
import { Shell } from './ui/Shell';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-700.css';
import './ui/styles.css';
import './ui/refined.css';

function NotConfigured() {
  return (
    <main className="setup-note">
      <h1>Munda needs its Firebase settings</h1>
      <p>Copy <code>web/.env.example</code> to <code>web/.env.local</code>, fill in your Firebase web app config, then restart the dev server.</p>
    </main>
  );
}

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
  void import('./dev/designPreview').then(({ startDesignPreview }) => startDesignPreview(root));
} else if (firebaseConfigured) {
  firebase();
  settings.refresh();
  session.start();
  syncProcessor.start();
  void mundaAi.refreshLocalStatus();
  registerSW({ immediate: true });
  document.documentElement.lang = language.value;
  void refreshWeather();
  window.addEventListener('online', () => void refreshWeather());
  // A newly typed area can stand in for blocked location.
  let place = prefs.value.place;
  prefs.subscribe(() => { if (prefs.value.place !== place) { place = prefs.value.place; void refreshWeather(true); } });
  root.render(<StrictMode><Shell /></StrictMode>);
} else {
  root.render(<StrictMode><NotConfigured /></StrictMode>);
}
