import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/send-otp
 * Body: { email: string, name: string }
 *
 * Generates a 6-digit OTP, stores it server-side in memory (with expiry),
 * and sends it via EmailJS using the server-side private keys.
 */

// In-memory OTP store (per Vercel serverless instance; short-lived is fine for OTPs)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();
const OTP_TTL = 5 * 60 * 1000; // 5 minutes

function makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers — allow Netlify frontend
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
        return res.status(500).json({ error: 'Email service not configured on server.' });
    }

    const otp = makeOtp();
    const lower = email.toLowerCase();
    otpStore.set(lower, { otp, expiresAt: Date.now() + OTP_TTL });

    // Call EmailJS REST API (server-to-server — privateKey not needed for public key flow)
    const emailjsPayload = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
            to_name: name || lower.split('@')[0],
            to_email: lower,
            otp,
            app_name: 'CivicResolve AI',
            expiry: '5 minutes',
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
