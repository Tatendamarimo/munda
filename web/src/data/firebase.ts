import { appleAI, isNativeIOS } from '../ai/appleNative';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, initializeAuth, browserLocalPersistence, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

/**
 * Firebase bootstrap. Order matters: App Check must be initialised before any AI Logic call
 * (AI Logic enforces App Check), and Firestore's persistent cache must be configured before
 * first use.
 */

const env = import.meta.env;

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

declare global {
  // eslint-disable-next-line no-var
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  ai: AI;
}

let services: FirebaseServices | null = null;

export function firebase(): FirebaseServices {
  if (services) return services;
  if (!firebaseConfigured) throw new Error('Firebase is not configured. Copy web/.env.example to web/.env.local.');

  const app = initializeApp(config);

  if (env.DEV && !isNativeIOS()) {
    // Local development: prints a debug token in the console. Register it in
    // Firebase console > App Check > Apps > Manage debug tokens. Never ship this.
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const siteKey = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (isNativeIOS()) {
    // Native App Attest / DeviceCheck, not reCAPTCHA inside a local WebView.
    initializeAppCheck(app, {
      provider: new CustomProvider({ getToken: () => appleAI.appCheckToken() }),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (siteKey) {
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  } else {
    console.warn('App Check site key missing (VITE_RECAPTCHA_ENTERPRISE_SITE_KEY); AI Logic calls will be rejected.');
  }

  const db = initializeFirestore(app, {
    // Offline-first: observations and queued writes live in IndexedDB until signal returns.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  // Email/password and anonymous auth do not need a cross-origin OAuth iframe in WKWebView.
  // Use persistent app-local storage explicitly instead of the browser redirect resolver.
  const auth = isNativeIOS() ? initializeAuth(app, { persistence: browserLocalPersistence }) : getAuth(app);
  if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
    // Local testing against `firebase emulators:start` (auth + firestore). AI Logic has no emulator.
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  services = { app, auth, db, ai: getAI(app, { backend: new GoogleAIBackend() }) };
  return services;
}
