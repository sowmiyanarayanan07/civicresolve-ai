// @ts-check

const OTP_TTL_MINUTES = 5;

function makeOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function supabaseUpsertOtp(email, otp, expiresAt) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const res = await fetch(`${url}/rest/v1/otp_store`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ email, otp, expires_at: expiresAt }),
    });
    if (!res.ok) {
        const t = await res.text();
        console.error('[send-otp] Supabase upsert error:', t);
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const email = body?.email;
        const name = body?.name;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const serviceId = process.env.VITE_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID;
        const templateId = process.env.VITE_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
        const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY;

        if (!serviceId || !templateId || !publicKey) {
            return res.status(500).json({
                error: 'Email service not configured. Add EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY to Vercel environment variables.'
            });
        }

        const otp = makeOtp();
        const lower = email.toLowerCase();
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

        await supabaseUpsertOtp(lower, otp, expiresAt);

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
    } catch (err) {
        console.error('[send-otp] Unhandled error:', err);
        return res.status(500).json({ error: err?.message || 'Internal server error' });
    }
}
