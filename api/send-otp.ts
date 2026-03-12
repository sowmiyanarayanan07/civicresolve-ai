import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/send-otp
 * Body: { email: string, name?: string }
 *
 * - Generates a 6-digit OTP
 * - Stores it in Supabase via REST (no SDK import — avoids bundle issues)
 * - Sends it via EmailJS REST API
 */

const OTP_TTL_MINUTES = 5;

function makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Supabase REST helpers (no SDK import needed) ──────────────────────────
async function supabaseUpsertOtp(email: string, otp: string, expiresAt: string): Promise<void> {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, name } = req.body as { email?: string; name?: string };
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const serviceId = process.env.EMAILJS_SERVICE_ID;
        const templateId = process.env.EMAILJS_TEMPLATE_ID;
        const publicKey = process.env.EMAILJS_PUBLIC_KEY;

        if (!serviceId || !templateId || !publicKey) {
            return res.status(500).json({
                error: 'Email service not configured. Please add EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY to Vercel environment variables.'
            });
        }

        const otp = makeOtp();
        const lower = email.toLowerCase();
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

        // Store OTP in Supabase via raw fetch (no SDK)
        await supabaseUpsertOtp(lower, otp, expiresAt);

        // Send email via EmailJS REST API
        const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
            }),
        });

        if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error('[send-otp] EmailJS error:', errText);
            return res.status(502).json({ error: `EmailJS failed: ${errText}` });
        }

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[send-otp] Unhandled error:', err);
        return res.status(500).json({ error: err?.message || 'Internal server error' });
    }
}
