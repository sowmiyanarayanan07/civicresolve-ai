import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/send-otp
 * Body: { email: string, name?: string }
 *
 * Generates a 6-digit OTP, stores it in Supabase (persisted across
 * serverless instances), then emails it via EmailJS REST API.
 */

const OTP_TTL_MINUTES = 5;

function makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_ANON_KEY
        || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — same-origin on Vercel, but keep wildcard for local dev
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, name } = req.body as { email?: string; name?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
        return res.status(500).json({ error: 'Email service not configured on server. Add EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY to Vercel environment variables.' });
    }

    const otp = makeOtp();
    const lower = email.toLowerCase();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // ── Persist OTP in Supabase ───────────────────────────────────────────────
    const sb = getSupabase();
    if (sb) {
        await sb.from('otp_store').upsert(
            { email: lower, otp, expires_at: expiresAt },
            { onConflict: 'email' }
        );
    } else {
        // No Supabase configured — fall back to global in-process store
        // (works when send-otp and verify-otp run in the same instance)
        (global as any)._civicOtpStore = (global as any)._civicOtpStore ?? new Map();
        (global as any)._civicOtpStore.set(lower, { otp, expiresAt: Date.now() + OTP_TTL_MINUTES * 60 * 1000 });
    }

    // ── Send email via EmailJS REST API ──────────────────────────────────────
    const emailjsPayload = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
            to_name: name || lower.split('@')[0],
            to_email: lower,
            otp,
            app_name: 'CivicResolve AI',
            expiry: `${OTP_TTL_MINUTES} minutes`,
        },
    };

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailjsPayload),
    });

    if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('[send-otp] EmailJS error:', errText);
        return res.status(502).json({ error: `Failed to send email: ${errText}` });
    }

    return res.status(200).json({ success: true });
}
