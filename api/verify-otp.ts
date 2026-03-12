import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/verify-otp
 * Body: { email: string, otp: string }
 * Returns: { valid: boolean }
 *
 * Verifies OTP from Supabase (shared across serverless instances).
 * Deletes the OTP on successful verification (one-time use).
 */

function getSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_ANON_KEY
        || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, otp } = req.body as { email?: string; otp?: string };
    if (!email || !otp) return res.status(400).json({ error: 'email and otp are required', valid: false });

    const lower = email.toLowerCase();

    // ── Check Supabase store first ────────────────────────────────────────────
    const sb = getSupabase();
    if (sb) {
        const { data, error } = await sb
            .from('otp_store')
            .select('otp, expires_at')
            .eq('email', lower)
            .single();

        if (error || !data) return res.status(200).json({ valid: false, reason: 'not_found' });
        if (new Date(data.expires_at) < new Date()) {
            await sb.from('otp_store').delete().eq('email', lower);
            return res.status(200).json({ valid: false, reason: 'expired' });
        }
        if (data.otp !== otp.trim()) return res.status(200).json({ valid: false, reason: 'wrong_otp' });

        // Consume — one-time use
        await sb.from('otp_store').delete().eq('email', lower);
        return res.status(200).json({ valid: true });
    }

    // ── Fallback: in-process global store (same instance only) ───────────────
    const store: Map<string, { otp: string; expiresAt: number }> =
        (global as any)._civicOtpStore ?? new Map();

    const entry = store.get(lower);
    if (!entry) return res.status(200).json({ valid: false, reason: 'not_found' });
    if (Date.now() > entry.expiresAt) {
        store.delete(lower);
        return res.status(200).json({ valid: false, reason: 'expired' });
    }
    if (entry.otp !== otp.trim()) return res.status(200).json({ valid: false, reason: 'wrong_otp' });

    store.delete(lower);
    return res.status(200).json({ valid: true });
}
