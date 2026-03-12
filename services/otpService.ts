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
    const apiBase = import.meta.env.VITE_VERCEL_API_URL;

    if (apiBase) {
        // Use secure Vercel backend — OTP generated & emailed server-side
        const res = await fetch(`${apiBase}/api/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Server error ${res.status}`);
        }
        return;
    }

    // ── Fallback: direct EmailJS from browser ──────────────────────────
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
        throw new Error(
            'Email service not configured. Add VITE_VERCEL_API_URL (recommended) or EmailJS keys to .env.local.'
        );
    }

    const otp = makeOtp();
    storeOtpLocally(email, otp);

    const emailjs = await import('@emailjs/browser');
    try {
        await emailjs.send(serviceId, templateId,
            { to_name: name, to_email: email, otp, app_name: 'CivicResolve AI', expiry: '5 minutes' },
            publicKey
        );
    } catch (err: unknown) {
        const msg = (err as { text?: string })?.text ?? (err instanceof Error ? err.message : String(err));
        throw new Error(`EmailJS error: ${msg}`);
    }
}

// ─── VERIFY OTP ───────────────────────────────────────────────────────────
export async function verifyOtpAsync(email: string, entered: string): Promise<boolean> {
    const apiBase = import.meta.env.VITE_VERCEL_API_URL;

    if (apiBase) {
        const res = await fetch(`${apiBase}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp: entered }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        return json.valid === true;
    }

    // ── Fallback: verify locally ──────────────────────────────────────
    return verifyOtp(email, entered);
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
