import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/verify-otp
 * Body: { email: string, otp: string }
 * Returns: { valid: boolean }
 *
 * Verifies OTP against the server-side in-memory store set by /api/send-otp.
 * OTP is consumed (deleted) on first successful use.
 */

// Shared in-memory store — same Map instance within the same Vercel function instance
// Note: Vercel may spin up multiple instances; for production scale, swap with
// Supabase table or Vercel KV. For MVP this works fine as OTPs are short-lived.
declare global {
    // eslint-disable-next-line no-var
    var _civicOtpStore: Map<string, { otp: string; expiresAt: number }> | undefined;
}
// Reuse across hot-reloads in dev
global._civicOtpStore = global._civicOtpStore ?? new Map();
const otpStore = global._civicOtpStore;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, otp } = req.body as { email?: string; otp?: string };
    if (!email || !otp) return res.status(400).json({ error: 'email and otp are required', valid: false });

    const lower = email.toLowerCase();
    const entry = otpStore.get(lower);

    if (!entry) return res.status(200).json({ valid: false, reason: 'not_found' });
    if (Date.now() > entry.expiresAt) {
        otpStore.delete(lower);
        return res.status(200).json({ valid: false, reason: 'expired' });
    }
    if (entry.otp !== otp.trim()) return res.status(200).json({ valid: false, reason: 'wrong_otp' });

    // Consume — one-time use
    otpStore.delete(lower);
    return res.status(200).json({ valid: true });
}
