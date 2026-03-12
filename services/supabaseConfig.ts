/**
 * Supabase Config — replaces firebaseConfig.ts
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 * Without these keys, the app falls back to localStorage.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    if (!_client) {
        _client = createClient(url, key);
    }
    return _client;
}

// Keep IS_DEMO_MODE export for backward compat
export const IS_DEMO_MODE = false;
