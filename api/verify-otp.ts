import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/verify-otp
 * Body: { email: string, otp: string }
 * Returns: { valid: boolean }
 *
 * Reads OTP from Supabase via REST (no SDK import — avoids bundle issues).
 * Deletes the OTP on successful verification (one-time use).
 */

// ── Supabase REST helpers (no SDK import needed) ──────────────────────────
async function supabaseGetOtp(email: string): Promise<{ otp: string; expires_at: string } | null> {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const res = await fetch(
        `${url}/rest/v1/otp_store?email=eq.${encodeURIComponent(email)}&select=otp,expires_at&limit=1`,
        {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
            },
        }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function supabaseDeleteOtp(email: string): Promise<void> {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    await fetch(`${url}/rest/v1/otp_store?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
        },
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, otp } = req.body as { email?: string; otp?: string };
        if (!email || !otp) {
            return res.status(400).json({ error: 'email and otp are required', valid: false });
        }

        const lower = email.toLowerCase();
        const entry = await supabaseGetOtp(lower);

        if (!entry) return res.status(200).json({ valid: false, reason: 'not_found' });
        if (new Date(entry.expires_at) < new Date()) {
            await supabaseDeleteOtp(lower);
            return res.status(200).json({ valid: false, reason: 'expired' });
        }
        if (entry.otp !== otp.trim()) {
            return res.status(200).json({ valid: false, reason: 'wrong_otp' });
        }

        // Consume — one-time use
        await supabaseDeleteOtp(lower);
        return res.status(200).json({ valid: true });
    } catch (err: any) {
        console.error('[verify-otp] Unhandled error:', err);
        return res.status(500).json({ error: err?.message || 'Internal server error', valid: false });
    }
}
