/**
 * DB Service — replaces firestoreService.ts
 * Uses Supabase (PostgreSQL + Realtime) when configured,
 * falls back to localStorage for local dev / demo mode.
 */
import { Complaint, Location, ComplaintStatus } from '../types';
import { getSupabaseClient } from './supabaseConfig';

// ─── localStorage fallback ─────────────────────────────────────────────────
const LS_KEY = 'civic_complaints';

function lsGet(): Complaint[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(c: Complaint[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
}

const lsListeners: Array<(c: Complaint[]) => void> = [];
function lsNotify() { const c = lsGet(); lsListeners.forEach(fn => fn(c)); }

// ─── Helpers: map DB row ↔ Complaint ─────────────────────────────────────
function rowToComplaint(row: Record<string, unknown>): Complaint {
    return {
        id: row.id as string,
        citizenId: row.citizen_id as string,
        citizenEmail: row.citizen_email as string | undefined,
        title: row.title as string,
        description: row.description as string,
        image: row.image as string | undefined,
        location: row.location as Location,
        employeeLocation: row.employee_location as Location | undefined,
        category: row.category as string,
        priority: row.priority as Complaint['priority'],
        status: row.status as Complaint['status'],
        assignedTo: row.assigned_to as string | undefined,
        aiAnalysis: row.ai_analysis as Complaint['aiAnalysis'],
        adminComment: row.admin_comment as string | undefined,
        completionImage: row.completion_image as string | undefined,
        createdAt: new Date(row.created_at as string).getTime(),
    };
}

function complaintToRow(c: Complaint): Record<string, unknown> {
    return {
        id: c.id,
        citizen_id: c.citizenId,
        citizen_email: c.citizenEmail,
        title: c.title,
        description: c.description,
        image: c.image ?? null,
        location: c.location,
        employee_location: c.employeeLocation ?? null,
        category: c.category,
        priority: c.priority,
        status: c.status,
        assigned_to: c.assignedTo ?? null,
        ai_analysis: c.aiAnalysis ?? null,
        admin_comment: c.adminComment ?? null,
        completion_image: c.completionImage ?? null,
    };
}

// ─── ADD ──────────────────────────────────────────────────────────────────
export const addComplaint = async (complaint: Complaint): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet(); list.unshift(complaint); lsSet(list); lsNotify(); return;
    }

    // Auto-Assignment Logic Based on AI Department
    if (complaint.aiAnalysis?.department) {
        const { data: empData } = await sb
            .from('employees')
            .select('id')
            .eq('department', complaint.aiAnalysis.department)
            .eq('availability_status', 'Available')
            .limit(1)
            .maybeSingle();

        if (empData) {
            complaint.assignedTo = empData.id;
            complaint.status = ComplaintStatus.ASSIGNED;
        }
    }

    const { error } = await sb.from('complaints').insert(complaintToRow(complaint));
    if (error) throw new Error(`[Supabase] addComplaint: ${error.message}`);
};

// ─── UPDATE ───────────────────────────────────────────────────────────────
export const updateComplaint = async (id: string, fields: Partial<Complaint>): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet();
        const i = list.findIndex(c => c.id === id);
        if (i !== -1) list[i] = { ...list[i], ...fields };
        lsSet(list); lsNotify(); return;
    }

    // Map camelCase fields to snake_case columns
    const updates: Record<string, unknown> = {};
    if (fields.status !== undefined) updates.status = fields.status;
    if (fields.assignedTo !== undefined) updates.assigned_to = fields.assignedTo;
    if (fields.adminComment !== undefined) updates.admin_comment = fields.adminComment;
    if (fields.completionImage !== undefined) updates.completion_image = fields.completionImage;
    if (fields.employeeLocation !== undefined) updates.employee_location = fields.employeeLocation;
    if (fields.aiAnalysis !== undefined) updates.ai_analysis = fields.aiAnalysis;

    const { error } = await sb.from('complaints').update(updates).eq('id', id);
    if (error) throw new Error(`[Supabase] updateComplaint: ${error.message}`);
};

// ─── SUBSCRIBE (Realtime) ─────────────────────────────────────────────────
export const subscribeToComplaints = (callback: (c: Complaint[]) => void): (() => void) => {
    const sb = getSupabaseClient();
    if (!sb) {
        lsListeners.push(callback);
        callback(lsGet());
        return () => {
            const i = lsListeners.indexOf(callback);
            if (i !== -1) lsListeners.splice(i, 1);
        };
    }

    // Fetch initial data
    sb.from('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) console.error('[Supabase] fetch complaints:', error.message);
            else callback((data || []).map(rowToComplaint));
        });

    // Subscribe to realtime changes
    const channel = sb
        .channel('complaints-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' },
            async () => {
                // Re-fetch all on any change for simplicity
                const { data } = await sb.from('complaints').select('*').order('created_at', { ascending: false });
                callback((data || []).map(rowToComplaint));
            }
        )
        .subscribe();

    return () => { sb.removeChannel(channel); };
};

// ─── TRACKING LOG ─────────────────────────────────────────────────────────
export interface TrackingLog { complaintId: string; employeeId: string; coords: Location; timestamp: number; }
export const addTrackingLog = async (log: TrackingLog): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) return;
    const { error } = await sb.from('tracking_logs').insert({
        complaint_id: log.complaintId,
        employee_id: log.employeeId,
        coords: log.coords,
        timestamp: new Date(log.timestamp).toISOString(),
    });
    if (error) console.error('[Supabase] addTrackingLog:', error.message);
};

// ─── ADMIN: EMPLOYEE MANAGEMENT ──────────────────────────────────────────
export interface Employee {
    id: string;
    name: string;
    email: string;
    department: string;
    phone?: string;
    availabilityStatus?: string;
}

export const getEmployees = async (): Promise<Employee[]> => {
    const sb = getSupabaseClient();
    if (!sb) return [];
    
    const { data, error } = await sb.from('employees').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('[Supabase] getEmployees:', error.message);
        return [];
    }
    
    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        phone: row.phone,
        availabilityStatus: row.availability_status
    }));
};

export const addEmployee = async (name: string, email: string, department: string, phone?: string): Promise<Employee> => {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Supabase required for Admin panel");
    
    const { data, error } = await sb.from('employees').insert({
        name, email, department, phone, availability_status: 'Available'
    }).select().single();
    
    if (error) throw new Error(error.message);
    
    return {
        id: data.id,
        name: data.name,
        email: data.email,
        department: data.department,
        phone: data.phone,
        availabilityStatus: data.availability_status
    };
};

export const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Supabase required for Admin panel");
    
    const { error } = await sb.from('employees').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteEmployee = async (id: string): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Supabase required for Admin panel");
    
    const { error } = await sb.from('employees').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

