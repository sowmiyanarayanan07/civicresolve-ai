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
        aiVerification: row.ai_verification as Complaint['aiVerification'],
        adminComment: row.admin_comment as string | undefined,
        completionImage: row.completion_image as string | undefined,
        feedbackRating: row.feedback_rating as number | undefined,
        feedbackComments: row.feedback_comments as string | undefined,
        createdAt: new Date(row.created_at as string).getTime(),
        resolvedAt: row.resolved_at ? new Date(row.resolved_at as string).getTime() : undefined,
        parentId: row.parent_id as string | undefined,
    };
}

function complaintToRow(c: Complaint): Record<string, unknown> {
    const row: Record<string, unknown> = {
        id: c.id,
        citizen_id: c.citizenId,
        title: c.title,
        description: c.description,
        location: c.location,
        category: c.category,
        priority: c.priority,
        status: c.status,
    };

    if (c.citizenEmail !== undefined) row.citizen_email = c.citizenEmail;
    if (c.image !== undefined) row.image = c.image;
    if (c.employeeLocation !== undefined) row.employee_location = c.employeeLocation;
    if (c.assignedTo !== undefined) row.assigned_to = c.assignedTo;
    if (c.aiAnalysis !== undefined) row.ai_analysis = c.aiAnalysis;
    if (c.aiVerification !== undefined) row.ai_verification = c.aiVerification;
    if (c.adminComment !== undefined) row.admin_comment = c.adminComment;
    if (c.completionImage !== undefined) row.completion_image = c.completionImage;
    if (c.feedbackRating !== undefined) row.feedback_rating = c.feedbackRating;
    if (c.feedbackComments !== undefined) row.feedback_comments = c.feedbackComments;
    if (c.resolvedAt !== undefined) row.resolved_at = c.resolvedAt ? new Date(c.resolvedAt).toISOString() : null;
    if (c.parentId !== undefined) row.parent_id = c.parentId;

    return row;
}

// ─── AVAILABILITY HELPER ─────────────────────────────────────────────────────
// Active statuses: anything that is not completed, verified, or rejected
const ACTIVE_STATUSES: ComplaintStatus[] = [
    ComplaintStatus.SUBMITTED,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.ON_THE_WAY,
    ComplaintStatus.REACHED,
    ComplaintStatus.IN_PROGRESS,
];

/**
 * Re-evaluate an employee's availability based on active task count.
 * Sets availability_status = 'Available' if they have 0 active tasks, else 'Busy'.
 */
async function refreshEmployeeAvailability(sb: ReturnType<typeof getSupabaseClient>, employeeId: string): Promise<void> {
    if (!sb || !employeeId) return;
    const { count } = await sb
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', employeeId)
        .in('status', ACTIVE_STATUSES);

    const newStatus = (count ?? 0) > 0 ? 'Busy' : 'Available';
    await sb.from('employees').update({ availability_status: newStatus }).eq('id', employeeId);
}

/**
 * Returns employees in a department who have ZERO active complaints.
 * Used by AdminDashboard for the reassign UI.
 */
export const getAvailableEmployees = async (department?: string): Promise<Employee[]> => {
    const sb = getSupabaseClient();
    if (!sb) return [];

    let query = sb.from('employees').select('*');
    if (department) query = query.eq('department', department);

    const { data: allEmps, error } = await query.order('name', { ascending: true });
    if (error || !allEmps) return [];

    // For each employee count their active tasks
    const withCounts = await Promise.all(
        allEmps.map(async emp => {
            const { count } = await sb
                .from('complaints')
                .select('id', { count: 'exact', head: true })
                .eq('assigned_to', emp.id)
                .in('status', ACTIVE_STATUSES);
            return { emp, activeCount: count ?? 0 };
        })
    );

    return withCounts
        .filter(({ activeCount }) => activeCount === 0)
        .map(({ emp }) => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            phone: emp.phone,
            availabilityStatus: 'Available',
        }));
};

// ─── ADD ──────────────────────────────────────────────────────────────────
export const addComplaint = async (complaint: Complaint): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet(); list.unshift(complaint); lsSet(list); lsNotify(); return;
    }

    // ── Smart Auto-Assignment: availability-aware, round-robin ────────────
    if (complaint.aiAnalysis?.department) {
        const dept = complaint.aiAnalysis.department;

        // Fetch ALL employees in this department
        const { data: allEmps } = await sb
            .from('employees')
            .select('id')
            .eq('department', dept);

        if (allEmps && allEmps.length > 0) {
            // For each employee, count their currently active (non-finished) complaints
            const availability = await Promise.all(
                allEmps.map(async emp => {
                    const { count } = await sb
                        .from('complaints')
                        .select('id', { count: 'exact', head: true })
                        .eq('assigned_to', emp.id)
                        .in('status', ACTIVE_STATUSES);
                    return { id: emp.id, activeCount: count ?? 0 };
                })
            );

            // Pick first employee with zero active tasks
            const freeEmployee = availability.find(e => e.activeCount === 0);

            if (freeEmployee) {
                complaint.assignedTo = freeEmployee.id;
                complaint.status = ComplaintStatus.ASSIGNED;
                // Mark employee as Busy immediately
                await sb.from('employees')
                    .update({ availability_status: 'Busy' })
                    .eq('id', freeEmployee.id);
            }
            // If no free employee found → complaint stays Submitted (unassigned)
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
    if (fields.aiVerification !== undefined) updates.ai_verification = fields.aiVerification;
    if (fields.feedbackRating !== undefined) updates.feedback_rating = fields.feedbackRating;
    if (fields.feedbackComments !== undefined) updates.feedback_comments = fields.feedbackComments;
    if (fields.resolvedAt !== undefined) updates.resolved_at = new Date(fields.resolvedAt).toISOString();
    if (fields.parentId !== undefined) updates.parent_id = fields.parentId;

    // ── Fetch current complaint for employee side-effects ─────────────────
    // We need the current assignedTo to refresh availability after status changes
    let currentEmployeeId: string | undefined;
    const needsAvailabilityRefresh =
        fields.status === ComplaintStatus.JOB_COMPLETED ||
        fields.status === ComplaintStatus.VERIFIED ||
        fields.status === ComplaintStatus.REJECTED;

    if (needsAvailabilityRefresh) {
        const { data: current } = await sb.from('complaints').select('assigned_to').eq('id', id).maybeSingle();
        currentEmployeeId = current?.assigned_to ?? undefined;
    }

    // ── If reassigning (new employee), mark old employee Available, new one Busy ─
    if (fields.assignedTo !== undefined) {
        const { data: current } = await sb.from('complaints').select('assigned_to').eq('id', id).maybeSingle();
        const oldEmpId = current?.assigned_to ?? undefined;
        // Mark new employee Busy
        await sb.from('employees').update({ availability_status: 'Busy' }).eq('id', fields.assignedTo);
        // Refresh old employee's availability (they may now be free)
        if (oldEmpId && oldEmpId !== fields.assignedTo) {
            // We pass a temporarily modified view: the current complaint won't be active for old emp after update
            const { count } = await sb
                .from('complaints')
                .select('id', { count: 'exact', head: true })
                .eq('assigned_to', oldEmpId)
                .in('status', ACTIVE_STATUSES)
                .neq('id', id); // exclude this complaint since it's being reassigned
            const newStatus = (count ?? 0) > 0 ? 'Busy' : 'Available';
            await sb.from('employees').update({ availability_status: newStatus }).eq('id', oldEmpId);
        }
    }

    const { error } = await sb.from('complaints').update(updates).eq('id', id);
    if (error) throw new Error(`[Supabase] updateComplaint: ${error.message}`);

    // ── Refresh employee availability after completion / verification / rejection ─
    if (needsAvailabilityRefresh && currentEmployeeId) {
        await refreshEmployeeAvailability(sb, currentEmployeeId);
    }
};

// ─── UPDATE USER AVATAR ───────────────────────────────────────────────────
export const updateUserAvatar = async (userId: string, avatarData: string): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) return; // Fallback to localStorage happens in App.tsx via setUser
    const { error } = await sb.from('users').update({ avatar: avatarData }).eq('id', userId);
    if (error) throw new Error(`[Supabase] updateUserAvatar: ${error.message}`);
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

// ─── CRISIS MODE (Real-time via Supabase app_settings) ──────────────────
/**
 * Subscribe to the crisis_mode setting in real-time.
 * Calls `callback(true/false)` immediately and on every change.
 * Returns an unsubscribe function.
 */
export const subscribeToCrisisMode = (callback: (active: boolean) => void): (() => void) => {
    const sb = getSupabaseClient();
    if (!sb) {
        // Fallback: read once from localStorage
        try { callback(localStorage.getItem('civic_crisis_mode') === 'true'); } catch { callback(false); }
        return () => {};
    }

    // Fetch current value immediately
    sb.from('app_settings')
        .select('value')
        .eq('key', 'crisis_mode')
        .maybeSingle()
        .then(({ data }) => {
            callback(data?.value === 'true');
        });

    // Subscribe to realtime changes
    const channel = sb
        .channel('crisis-mode-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.crisis_mode' },
            (payload: { new: Record<string, unknown> }) => {
                callback((payload.new as { value?: string })?.value === 'true');
            }
        )
        .subscribe();

    return () => { sb.removeChannel(channel); };
};

/**
 * Persist the crisis mode value to Supabase (upsert).
 * Also mirrors to localStorage as a fast-path for same-session reads.
 */
export const setCrisisModeDB = async (active: boolean): Promise<void> => {
    try { localStorage.setItem('civic_crisis_mode', String(active)); } catch {}
    const sb = getSupabaseClient();
    if (!sb) return;
    const { error } = await sb
        .from('app_settings')
        .upsert({ key: 'crisis_mode', value: String(active) }, { onConflict: 'key' });
    if (error) console.error('[Supabase] setCrisisModeDB:', error.message);
};

// ─── ADMIN: CLEAR ALL COMPLAINTS ─────────────────────────────────────────
export const deleteAllComplaints = async (): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        lsSet([]);
        lsNotify();
        return;
    }
    const { error } = await sb.from('complaints').delete().neq('id', '');
    if (error) throw new Error(`[Supabase] deleteAllComplaints: ${error.message}`);
};


