import { Complaint, Location } from '../types';
import { getDb } from './firebaseConfig';

// ─── localStorage fallback (when Firebase not configured) ─────────────────
const LS_KEY = 'civic_complaints';

function lsGet(): Complaint[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(c: Complaint[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
}

// Simple in-process listener for localStorage mode
const lsListeners: Array<(c: Complaint[]) => void> = [];
function lsNotify() { const c = lsGet(); lsListeners.forEach(fn => fn(c)); }

// ─── ADD ──────────────────────────────────────────────────────────────────
export const addComplaint = async (complaint: Complaint): Promise<void> => {
    const db = await getDb();
    if (!db) {
        const list = lsGet(); list.unshift(complaint); lsSet(list); lsNotify(); return;
    }
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    await addDoc(collection(db, 'complaints'), { ...complaint, createdAt: Timestamp.now() });
};

// ─── UPDATE ───────────────────────────────────────────────────────────────
export const updateComplaint = async (id: string, fields: Partial<Complaint>): Promise<void> => {
    const db = await getDb();
    if (!db) {
        const list = lsGet();
        const i = list.findIndex(c => c.id === id);
        if (i !== -1) list[i] = { ...list[i], ...fields };
        lsSet(list); lsNotify(); return;
    }
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'complaints', id), fields as Record<string, unknown>);
};

// ─── SUBSCRIBE ────────────────────────────────────────────────────────────
export const subscribeToComplaints = (callback: (c: Complaint[]) => void): (() => void) => {
    let unsubscribe = () => { };

    (async () => {
        const db = await getDb();
        if (!db) {
            lsListeners.push(callback);
            callback(lsGet());
            return;
        }
        const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
        const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
        unsubscribe = onSnapshot(q, snap => {
            callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Complaint)));
        });
    })();

    return () => {
        unsubscribe();
        const i = lsListeners.indexOf(callback);
        if (i !== -1) lsListeners.splice(i, 1);
    };
};

// ─── TRACKING LOG ─────────────────────────────────────────────────────────
export interface TrackingLog { complaintId: string; employeeId: string; coords: Location; timestamp: number; }
export const addTrackingLog = async (log: TrackingLog): Promise<void> => {
    const db = await getDb();
    if (!db) return;
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    await addDoc(collection(db, 'trackingLogs'), { ...log, timestamp: Timestamp.now() });
};
