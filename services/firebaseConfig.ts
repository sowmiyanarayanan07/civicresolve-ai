/**
 * Firebase Config — lazy-initialized.
 * Set VITE_FIREBASE_* in .env.local to enable Cloud Firestore & Auth.
 * Without these keys, the app uses localStorage as a local fallback.
 */

// Kept for any legacy imports — always false in production mode
export const IS_DEMO_MODE = false;

let _auth: any = null;
let _db: any = null;
let _initialized = false;

async function init() {
    if (_initialized) return;
    _initialized = true;

    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) return; // No Firebase keys — use localStorage fallback

    try {
        const { initializeApp, getApps } = await import('firebase/app');
        const { getAuth } = await import('firebase/auth');
        const { getFirestore } = await import('firebase/firestore');

        const cfg = {
            apiKey,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };

        const app = getApps().length === 0 ? initializeApp(cfg) : getApps()[0];
        _auth = getAuth(app);
        _db = getFirestore(app);
    } catch (e) {
        console.warn('[Firebase] Init failed — using localStorage fallback.', e);
    }
}

export async function getAuth() { await init(); return _auth; }
export async function getDb() { await init(); return _db; }
