/**
 * Disaster Resource Service
 * Pure localStorage CRUD — no DB/Supabase needed.
 * Stores all crisis resource locations under 'civic_disaster_resources'.
 */
import { DisasterResource } from '../types';

const LS_KEY = 'civic_disaster_resources';

function lsGet(): DisasterResource[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(r: DisasterResource[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(r));
}

export const getResources = (): DisasterResource[] => lsGet();

export const saveResource = (r: DisasterResource): void => {
    const list = lsGet();
    const idx = list.findIndex(x => x.id === r.id);
    if (idx !== -1) list[idx] = r;
    else list.unshift(r);
    lsSet(list);
};

export const updateResource = (id: string, fields: Partial<DisasterResource>): void => {
    const list = lsGet();
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...fields, updatedAt: Date.now() };
        lsSet(list);
    }
};

export const deleteResource = (id: string): void => {
    lsSet(lsGet().filter(r => r.id !== id));
};

/** Subscribe via polling — calls cb whenever storage changes, returns unsubscribe fn */
export const subscribeToResources = (cb: (r: DisasterResource[]) => void): (() => void) => {
    cb(lsGet());
    const id = window.setInterval(() => cb(lsGet()), 2000);
    const onStorage = (e: StorageEvent) => {
        if (e.key === LS_KEY) cb(lsGet());
    };
    window.addEventListener('storage', onStorage);
    return () => {
        clearInterval(id);
        window.removeEventListener('storage', onStorage);
    };
};
