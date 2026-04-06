import { Role, User } from '../types';
import { getSupabaseClient } from './supabaseConfig';

// ─── localStorage session helpers ─────────────────────────────────────────
function persist(u: User) {
    try {
        localStorage.setItem('civic_current_user', JSON.stringify(u));
    } catch (e) {
        console.warn('localStorage blocked by browser:', e);
    }
}

function loadCitizensLS(): Record<string, User> {
    try { return JSON.parse(localStorage.getItem('civic_citizens') || '{}'); } catch { return {}; }
}

function saveCitizenLS(u: User) {
    const all = loadCitizensLS();
    all[u.email] = u;
    localStorage.setItem('civic_citizens', JSON.stringify(all));
}

// ─── Called after OTP is verified (by local verify) ────────
export async function loginWithOtp(email: string, name?: string, role: Role = Role.CITIZEN): Promise<User> {
    const lower = email.toLowerCase();
    const sb = getSupabaseClient();

    if (sb) {
        let employeeDbId: string | null = null;

        // Enforce role-based access
        if (role === Role.ADMIN) {
            const { data: adminData } = await sb.from('admins').select('*').eq('email', lower).maybeSingle();
            if (!adminData) {
                throw new Error("You are not authorized as Admin.");
            }
        } else if (role === Role.EMPLOYEE) {
            const { data: empData } = await sb.from('employees').select('*').eq('email', lower).maybeSingle();
            if (!empData) {
                throw new Error("You are not registered as an Employee.");
            }
            // Store employee's DB UUID — used as user.id so complaint filtering works
            employeeDbId = empData.id;
        }

        // Try Supabase users table
        const { data: existing } = await sb.from('users').select('*').eq('email', lower).maybeSingle();
        if (existing) {
            const u: User = {
                // For employees, always use their employee UUID so assignedTo matches
                id: employeeDbId ?? existing.id,
                name: existing.name,
                email: existing.email,
                role,
                langPreference: existing.lang_preference || 'en',
                avatar: existing.avatar,
            };
            // Update role in DB
            await sb.from('users').update({ role, lang_preference: u.langPreference }).eq('email', lower);
            persist(u);
            return u;
        }

        // New user — insert into Supabase
        // For employees use their actual employee UUID so complaints match
        const newUser: User = {
            id: employeeDbId ?? `usr-${Date.now()}`,
            name: name?.trim() || lower.split('@')[0],
            email: lower,
            role,
            langPreference: 'en',
        };
        await sb.from('users').insert({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            lang_preference: newUser.langPreference,
        });
        persist(newUser);
        return newUser;
    }

    // localStorage fallback (when Supabase not configured)
    const citizens = loadCitizensLS();
    let user = citizens[lower];
    if (!user) {
        user = {
            id: `usr-${Date.now()}`,
            name: name?.trim() || lower.split('@')[0],
            email: lower,
            role,
            langPreference: 'en',
        };
    } else {
        user = { ...user, role };
    }
    saveCitizenLS(user);
    persist(user);
    return user;
}

export const signOut = async (): Promise<void> => {
    localStorage.removeItem('civic_current_user');
    // Supabase doesn't hold a server session in our OTP flow — nothing extra needed
};

export const restoreSession = (cb: (u: User | null) => void): (() => void) => {
    try {
        const raw = localStorage.getItem('civic_current_user');
        setTimeout(() => cb(raw ? JSON.parse(raw) : null), 0);
    } catch (e) {
        console.warn('localStorage blocked by browser:', e);
        setTimeout(() => cb(null), 0);
    }
    return () => { };
};

// Keep for backward compat
export function getStaffUser(_email: string): User | null { return null; }
export function getRoleForEmail(_email: string): Role { return Role.CITIZEN; }
