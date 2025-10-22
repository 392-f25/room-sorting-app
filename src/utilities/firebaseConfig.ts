import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check (browser-only)
// Provide VITE_RECAPTCHA_SITE_KEY in your environment (site key from Google reCAPTCHA v3).
// If the site key is missing, App Check initialization is skipped so this file still runs in CI/build.
if (typeof window !== "undefined") {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    // Use reCAPTCHA v3 provider. Tokens will be auto-refreshed.
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    // No site key provided — App Check not initialized (useful for build/CI or if you want to
    // initialize App Check only in specific environments).
    // Note: if you plan to enforce App Check in production, make sure this env is present there.
    // For local dev, use a separate dev site key or use App Check debug tokens per Firebase docs.
    // See Firebase docs for "App Check debug tokens" for local testing workflows.
    // (Do NOT add localhost to your production reCAPTCHA key if you want to avoid enabling
    //  localhost-origin App Check tokens for the same key.)
    // eslint-disable-next-line no-console
    console.warn(
      "[firebase] VITE_RECAPTCHA_SITE_KEY is not set — App Check not initialized."
    );
  }
}

// get reference to db service
export const db = getDatabase(app);