/**
 * OTP Service
 * - If VITE_VERCEL_API_URL is set: calls the secure Vercel backend API
 *   (OTP is generated & stored server-side, never exposed to browser)
 * - Fallback: calls EmailJS directly from the browser (legacy mode)
 */

const OTP_STORE_KEY = 'civic_otp_store';
const OTP_TTL = 5 * 60 * 1000;

interface OtpEntry { otp: string; expiresAt: number; }

// ─── Local store helpers (used in legacy / fallback mode) ─────────────────
function storeOtpLocally(email: string, otp: string) {
    const store: Record<string, OtpEntry> = readLocalStore();
    store[email.toLowerCase()] = { otp, expiresAt: Date.now() + OTP_TTL };
    localStorage.setItem(OTP_STORE_KEY, JSON.stringify(store));
}

function readLocalStore(): Record<string, OtpEntry> {
    try { return JSON.parse(localStorage.getItem(OTP_STORE_KEY) || '{}'); } catch { return {}; }
}

function makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── SEND OTP ─────────────────────────────────────────────────────────────
export async function sendOtp(email: string, name: string = 'User'): Promise<void> {
    // If VITE_VERCEL_API_URL is set (separate backend), use it.
    // Otherwise call /api/... relative to current origin (same Vercel project).
    const apiBase = import.meta.env.VITE_VERCEL_API_URL || '';

    const res = await fetch(`${apiBase}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
            const body = await res.json();
            msg = body.error || msg;
        } catch {
            try { msg = await res.text() || msg; } catch { /* ignore */ }
        }
        throw new Error(msg);
    }
}

// ─── VERIFY OTP ───────────────────────────────────────────────────────────
export async function verifyOtpAsync(email: string, entered: string): Promise<boolean> {
    const apiBase = import.meta.env.VITE_VERCEL_API_URL || '';

    const res = await fetch(`${apiBase}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: entered }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.valid === true;
}

// Sync version (kept for fallback mode / backward compat)
export function verifyOtp(email: string, entered: string): boolean {
    const store = readLocalStore();
    const entry = store[email.toLowerCase()];
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        delete store[email.toLowerCase()];
        localStorage.setItem(OTP_STORE_KEY, JSON.stringify(store));
        return false;
    }
    if (entry.otp !== entered.trim()) return false;
    delete store[email.toLowerCase()];
    localStorage.setItem(OTP_STORE_KEY, JSON.stringify(store));
    return true;
}
