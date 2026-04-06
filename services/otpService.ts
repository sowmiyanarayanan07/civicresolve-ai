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
        throw new Error('Supabase configuration is missing. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.');
    }

    // Validate that the key is a proper JWT (must start with "eyJ")
    // Supabase publishable keys (sb_publishable_...) are NOT valid for REST API calls
    if (!key.startsWith('eyJ')) {
        const errMsg =
            'Invalid Supabase anon key format.\n\n' +
            'Your VITE_SUPABASE_ANON_KEY appears to be a "publishable key" (starts with sb_publishable_...) ' +
            'which is NOT supported by the Supabase REST API.\n\n' +
            'Fix: Go to your Supabase project → Settings → API → copy the "anon / public" JWT key ' +
            '(it starts with "eyJ...") and update VITE_SUPABASE_ANON_KEY in your .env.local file.';
        console.error(errMsg);
        throw new Error(errMsg);
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
            if (res.status === 401) {
                throw new Error(`Supabase authentication failed (401). Your anon key may be wrong or expired. Please check VITE_SUPABASE_ANON_KEY in your .env.local file.`);
            }
            throw new Error(`Connection Error (${res.status}): Could not save OTP state. Please ensure the 'otp_store' table exists in Supabase.`);
        }
    } catch (err: any) {
        console.error('Error in supabaseStoreOtp:', err);
        // Re-wrap a bare "Failed to fetch" with a more helpful message
        if (err?.message === 'Failed to fetch') {
            throw new Error(
                'Network error: Could not reach Supabase.\n\n' +
                'Please check:\n' +
                '1. Your VITE_SUPABASE_URL is correct in .env.local\n' +
                '2. You are connected to the internet\n' +
                '3. The Supabase project is not paused'
            );
        }
        throw err;
    }
}

export async function sendOtp(email: string, name: string = 'User'): Promise<void> {
    // Always use these direct credentials as requested
    const serviceId = 'service_y622gxc';
    const templateId = 'template_fyn9g89';
    const publicKey = 'jkxFbxcK9UIAHHtaO';

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
