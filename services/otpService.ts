/** 
 * OTP Service — Browser-native approach
 * (Deploy Trigger: v1.0.1)
 */
/**
 * OTP Service — Browser-native approach
 *
 * Flow:
 * 1. Browser generates OTP
 * 2. Browser stores OTP in Supabase (otp_store table) via REST
 * 3. Browser sends email via EmailJS (designed for browser use)
 * 4. User enters OTP → browser calls /api/verify-otp (reads from Supabase)
 */

import emailjs from '@emailjs/browser';

const OTP_TTL_MINUTES = 5;

function makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Supabase REST (browser-side, no SDK needed) ────────────────────────────
function getSupabaseConfig() {
    return {
        url: import.meta.env.VITE_SUPABASE_URL as string,
        key: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    };
}

async function supabaseStoreOtp(email: string, otp: string): Promise<void> {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return;

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    await fetch(`${url}/rest/v1/otp_store`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ email, otp, expires_at: expiresAt }),
    });
}

// ── SEND OTP ─────────────────────────────────────────────────────────────
export async function sendOtp(email: string, name: string = 'User'): Promise<void> {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
        const missing = [];
        if (!serviceId) missing.push('VITE_EMAILJS_SERVICE_ID');
        if (!templateId) missing.push('VITE_EMAILJS_TEMPLATE_ID');
        if (!publicKey) missing.push('VITE_EMAILJS_PUBLIC_KEY');
        throw new Error(`EmailJS not configured. Missing: ${missing.join(', ')}. Please add them to Vercel Environment Variables.`);
    }

    const otp = makeOtp();
    const lower = email.toLowerCase();

    // 1. Store OTP in Supabase first (so API can verify it later)
    await supabaseStoreOtp(lower, otp);

    // 2. Send email from browser via EmailJS (this is what EmailJS is built for)
    try {
        await emailjs.send(
            serviceId,
            templateId,
            {
                to_name: name || lower.split('@')[0],
                to_email: lower,
                otp,
                app_name: 'CivicResolve AI',
                expiry: `${OTP_TTL_MINUTES} minutes`,
            },
            publicKey
        );
    } catch (err: any) {
        const msg = err?.text ?? (err instanceof Error ? err.message : String(err));
        throw new Error(`Failed to send OTP email: ${msg}`);
    }
}

// ── VERIFY OTP ───────────────────────────────────────────────────────────
export async function verifyOtpAsync(email: string, entered: string): Promise<boolean> {
    // Call Vercel API which reads & validates from Supabase
    const apiBase = import.meta.env.VITE_VERCEL_API_URL || '';

    try {
        const res = await fetch(`${apiBase}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.toLowerCase(), otp: entered }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        return json.valid === true;
    } catch {
        return false;
    }
}

// Kept for backward compat
export function verifyOtp(_email: string, _entered: string): boolean {
    return false;
}
