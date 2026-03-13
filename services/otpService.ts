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
    // Try process.env (injected by Vite define) then import.meta.env
    const url = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || import.meta.env.VITE_SUPABASE_URL;
    const key = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY;
    return { url: url as string, key: key as string };
}

async function supabaseStoreOtp(email: string, otp: string): Promise<void> {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
        console.error('Supabase config missing in browser');
        return;
    }

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    try {
        const res = await fetch(`${url}/rest/v1/otp_store`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify({ email: email.toLowerCase(), otp, expires_at: expiresAt }),
        });
        
        if (!res.ok) {
            const body = await res.text();
            console.error('Failed to store OTP in Supabase:', res.status, body);
            throw new Error(`Connection Error: Could not save OTP state. Please ensure the 'otp_store' table exists in Supabase.`);
        }
    } catch (err: any) {
        console.error('Error in supabaseStoreOtp:', err);
        throw err;
    }
}

// ── SEND OTP ─────────────────────────────────────────────────────────────
export async function sendOtp(email: string, name: string = 'User'): Promise<void> {
    // 1. Try process.env (Vite define)
    // 2. Try import.meta.env (Vite native)
    // 3. Fallback to hardcoded strings to guarantee delivery
    const serviceId = (typeof process !== 'undefined' && process.env?.VITE_EMAILJS_SERVICE_ID) 
        || (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID 
        || 'service_on7vb7p';

    const templateId = (typeof process !== 'undefined' && process.env?.VITE_EMAILJS_TEMPLATE_ID) 
        || (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID 
        || 'template_fjx647h';

    const publicKey = (typeof process !== 'undefined' && process.env?.VITE_EMAILJS_PUBLIC_KEY) 
        || (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY 
        || 'cSWmq888t26hiykHV';

    console.log('--- EmailJS Diagnostics ---');
    console.log('Service ID:', serviceId);
    console.log('Template ID:', templateId);
    console.log('Public Key length:', publicKey?.length);
    console.log('---------------------------');

    if (!serviceId || !templateId || !publicKey) {
        throw new Error(`EmailJS config missing! S:${!!serviceId} T:${!!templateId} P:${!!publicKey}`);
    }

    const otp = makeOtp();
    const lower = email.toLowerCase();

    // 1. Store OTP in Supabase first (so API can verify it later)
    await supabaseStoreOtp(lower, otp);

    // 2. Send email from browser via EmailJS
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
            {
                publicKey: publicKey
            }
        );
    } catch (err: any) {
        const msg = err?.text ?? (err instanceof Error ? err.message : String(err));
        throw new Error(`Failed to send OTP email: ${msg}`);
    }
}

// ── VERIFY OTP ───────────────────────────────────────────────────────────
export async function verifyOtpAsync(email: string, entered: string): Promise<{ valid: boolean; reason?: string }> {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
        return { valid: false, reason: 'config_missing' };
    }

    try {
        const lower = email.toLowerCase();
        const res = await fetch(
            `${url}/rest/v1/otp_store?email=eq.${encodeURIComponent(lower)}&select=otp,expires_at&limit=1`,
            {
                method: 'GET',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            }
        );

        if (!res.ok) return { valid: false, reason: 'server_error' };
        
        const rows = await res.json();
        const entry = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        if (!entry) {
            return { valid: false, reason: 'not_found' };
        }

        const now = new Date();
        const expiry = new Date(entry.expires_at);

        // Delete function
        const deleteOtp = async () => {
            await fetch(`${url}/rest/v1/otp_store?email=eq.${encodeURIComponent(lower)}`, {
                method: 'DELETE',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });
        };

        if (expiry < now) {
            await deleteOtp();
            return { valid: false, reason: 'expired' };
        }

        if (entry.otp.trim() !== entered.trim()) {
            return { valid: false, reason: 'wrong_otp' };
        }

        await deleteOtp();
        return { valid: true };
    } catch (err: any) {
        return { valid: false, reason: 'connection_error' };
    }
}

// Kept for backward compat
export function verifyOtp(_email: string, _entered: string): boolean {
    return false;
}
