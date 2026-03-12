// @ts-check

async function supabaseGetOtp(email) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('[verify-otp] Supabase config missing');
        return null;
    }

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

async function supabaseDeleteOtp(email) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    await fetch(`${url}/rest/v1/otp_store?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
        },
    });
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
        const otp = body?.otp;

        if (!email || !otp) {
            return res.status(400).json({ error: 'email and otp are required', valid: false });
        }

        const lower = email.toLowerCase();
        const entry = await supabaseGetOtp(lower);

        if (!entry) {
            console.log('[verify-otp] No OTP entry found for:', lower);
            return res.status(200).json({ valid: false, reason: 'not_found' });
        }
        
        const now = new Date();
        const expiry = new Date(entry.expires_at);
        
        if (expiry < now) {
            console.log('[verify-otp] OTP expired for:', lower, 'Expired at:', entry.expires_at, 'Current server time:', now.toISOString());
            await supabaseDeleteOtp(lower);
            return res.status(200).json({ valid: false, reason: 'expired' });
        }
        
        if (entry.otp.trim() !== otp.trim()) {
            console.log('[verify-otp] Wrong OTP for:', lower, 'Expected:', entry.otp, 'Got:', otp);
            return res.status(200).json({ valid: false, reason: 'wrong_otp' });
        }

        console.log('[verify-otp] Success for:', lower);
        await supabaseDeleteOtp(lower);
        return res.status(200).json({ valid: true });
    } catch (err) {
        console.error('[verify-otp] Unhandled error:', err);
        return res.status(500).json({ error: err?.message || 'Internal server error', valid: false });
    }
}
