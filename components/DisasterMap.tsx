import React, { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DisasterResource, ResourceType, ResourceStatus, Location } from '../types';
import {
    getResources, saveResource, updateResource,
    deleteResource, subscribeToResources,
} from '../services/disasterResourceService';
import { calculateDistance } from '../utils/geoUtils';

// ── Resource config ───────────────────────────────────────────────────────────
export const RESOURCE_CONFIG: Record<ResourceType, {
    label: string; icon: string; color: string; statuses: ResourceStatus[];
}> = {
    safe_zone:    { label: 'Safe Zone',     icon: 'fa-shield-heart',       color: '#22c55e', statuses: ['Available','Full'] },
    rescue_point: { label: 'Rescue Point',  icon: 'fa-life-ring',          color: '#3b82f6', statuses: ['Active','Available'] },
    danger_zone:  { label: 'Danger Zone',   icon: 'fa-triangle-exclamation',color: '#dc2626', statuses: ['Unsafe'] },
    food_center:  { label: 'Food Center',   icon: 'fa-bowl-rice',          color: '#f97316', statuses: ['Available','Low','Out of Stock'] },
    water_supply: { label: 'Water Supply',  icon: 'fa-droplet',            color: '#06b6d4', statuses: ['Available','Low','Out of Stock'] },
    medical_camp: { label: 'Medical Camp',  icon: 'fa-kit-medical',        color: '#a855f7', statuses: ['Available','Low'] },
};

const STATUS_COLORS: Record<ResourceStatus, string> = {
    Available:     'bg-emerald-900/60 text-emerald-300 border-emerald-600/40',
    Active:        'bg-blue-900/60 text-blue-300 border-blue-600/40',
    Low:           'bg-amber-900/60 text-amber-300 border-amber-600/40',
    Full:          'bg-slate-700/60 text-slate-300 border-slate-500/40',
    'Out of Stock':'bg-red-900/60 text-red-300 border-red-600/40',
    Unsafe:        'bg-red-900/80 text-red-200 border-red-500/60',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeResourceMarker(type: ResourceType, isPulsing = false): HTMLDivElement {
    const cfg = RESOURCE_CONFIG[type];
    const el = document.createElement('div');
    el.style.cssText = `
        width:34px; height:34px; border-radius:50%;
        background:${cfg.color}; border:3px solid #fff;
        box-shadow:0 2px 10px rgba(0,0,0,0.40);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; position:relative;
        ${isPulsing ? 'animation:danger-pulse-map 1.6s ease-in-out infinite;' : ''}
    `;
    const icon = document.createElement('i');
    icon.className = `fas ${cfg.icon}`;
    icon.style.cssText = 'color:#fff; font-size:13px;';
    el.appendChild(icon);
    return el;
}

// ── Main Component ────────────────────────────────────────────────────────────
const DisasterMap: React.FC = () => {
    const [resources, setResources] = useState<DisasterResource[]>([]);
    const [filterType, setFilterType] = useState<ResourceType | 'all'>('all');
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [pendingLoc, setPendingLoc] = useState<Location | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState<{
        name: string; type: ResourceType; status: ResourceStatus;
        description: string; capacity: string;
    }>({ name: '', type: 'safe_zone', status: 'Available', description: '', capacity: '' });

    // Map refs
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const clickMarkerRef = useRef<maplibregl.Marker | null>(null);

    // Subscribe to resources
    useEffect(() => {
        const unsub = subscribeToResources(setResources);
        return unsub;
    }, []);

    // Init map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [80.2433, 12.9716],
            zoom: 12,
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Click to set pending location
        map.on('click', (e) => {
            const loc: Location = { lat: e.lngLat.lat, lng: e.lngLat.lng };
            setPendingLoc(loc);
            setShowAddPanel(true);
            // Move or create the pending marker
            if (clickMarkerRef.current) {
                clickMarkerRef.current.setLngLat([loc.lng, loc.lat]);
            } else {
                const el = document.createElement('div');
                el.style.cssText = `
                    width:20px; height:20px; border-radius:50%;
                    background:#f59e0b; border:3px solid #fff;
                    box-shadow:0 2px 8px rgba(0,0,0,0.40);
                    animation:crisis-blink 0.8s ease-in-out infinite;
                `;
                clickMarkerRef.current = new maplibregl.Marker({ element: el })
                    .setLngLat([loc.lng, loc.lat])
                    .addTo(map);
            }
        });

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
            markersRef.current.clear();
            clickMarkerRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync resource markers to map
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const visible = filterType === 'all' ? resources : resources.filter(r => r.type === filterType);
        const visibleIds = new Set(visible.map(r => r.id));

        // Remove old markers not in visible set
        markersRef.current.forEach((marker, id) => {
            if (!visibleIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
        });

        // Add / update markers
        visible.forEach(r => {
            if (markersRef.current.has(r.id)) {
                markersRef.current.get(r.id)!.setLngLat([r.location.lng, r.location.lat]);
                return;
            }
            const cfg = RESOURCE_CONFIG[r.type];
            const el = makeResourceMarker(r.type, r.type === 'danger_zone');
            const popup = new maplibregl.Popup({ offset: 20, closeButton: false })
                .setHTML(`<div style="font-family:Inter,sans-serif;padding:4px 2px;">
                    <strong style="font-size:13px">${r.name}</strong>
                    <span style="display:block;font-size:11px;color:${cfg.color};font-weight:700;margin-top:2px;">${cfg.label}</span>
                    <span style="display:block;font-size:11px;color:#64748b;margin-top:1px;">${r.status}</span>
                    ${r.description ? `<span style="display:block;font-size:11px;color:#94a3b8;margin-top:3px;">${r.description}</span>` : ''}
                </div>`);
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([r.location.lng, r.location.lat])
                .setPopup(popup)
                .addTo(map);
            markersRef.current.set(r.id, marker);
        });
    }, [resources, filterType]);

    // Prefill form when editing
    useEffect(() => {
        if (editingId) {
            const r = resources.find(x => x.id === editingId);
            if (r) {
                setForm({ name: r.name, type: r.type, status: r.status, description: r.description || '', capacity: String(r.capacity || '') });
                setPendingLoc(r.location);
                setShowAddPanel(true);
            }
        }
    }, [editingId]);

    const handleSave = useCallback(() => {
        if (!form.name.trim() || !pendingLoc) return;
        const statuses = RESOURCE_CONFIG[form.type].statuses;
        const effectiveStatus = statuses.includes(form.status) ? form.status : statuses[0];
        if (editingId) {
            updateResource(editingId, {
                name: form.name.trim(), type: form.type, status: effectiveStatus,
                description: form.description.trim() || undefined,
                capacity: form.capacity ? Number(form.capacity) : undefined,
                location: pendingLoc,
            });
        } else {
            const r: DisasterResource = {
                id: `DR-${Date.now()}`,
                name: form.name.trim(), type: form.type, status: effectiveStatus,
                description: form.description.trim() || undefined,
                capacity: form.capacity ? Number(form.capacity) : undefined,
                location: pendingLoc,
                createdAt: Date.now(), updatedAt: Date.now(),
            };
            saveResource(r);
        }
        setResources(getResources());
        resetForm();
    }, [form, pendingLoc, editingId]);

    const resetForm = () => {
        setShowAddPanel(false);
        setPendingLoc(null);
        setEditingId(null);
        setForm({ name: '', type: 'safe_zone', status: 'Available', description: '', capacity: '' });
        if (clickMarkerRef.current) { clickMarkerRef.current.remove(); clickMarkerRef.current = null; }
    };

    const handleDelete = (id: string) => {
        if (!window.confirm('Remove this resource from the crisis map?')) return;
        deleteResource(id);
        const m = markersRef.current.get(id);
        if (m) { m.remove(); markersRef.current.delete(id); }
        setResources(getResources());
    };

    const handleStatusChange = (id: string, status: ResourceStatus) => {
        updateResource(id, { status });
        setResources(getResources());
        // Re-render markers
        const r = getResources().find(x => x.id === id);
        if (r && mapRef.current) {
            const m = markersRef.current.get(id);
            if (m) m.getPopup()?.setHTML(`<div style="font-family:Inter,sans-serif;padding:4px 2px;">
                <strong style="font-size:13px">${r.name}</strong>
                <span style="display:block;font-size:11px;color:${RESOURCE_CONFIG[r.type].color};font-weight:700;margin-top:2px;">${RESOURCE_CONFIG[r.type].label}</span>
                <span style="display:block;font-size:11px;color:#64748b;margin-top:1px;">${status}</span>
            </div>`);
        }
    };

    const filteredResources = filterType === 'all' ? resources : resources.filter(r => r.type === filterType);
    const statuses = RESOURCE_CONFIG[form.type].statuses;

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
            {/* Style injection for map animation */}
            <style>{`
                @keyframes danger-pulse-map {
                    0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
                    50%      { box-shadow: 0 0 0 10px rgba(220,38,38,0.35); }
                }
            `}</style>

            {/* ── Header bar ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-red-900/40 bg-zinc-950 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-700/50 flex items-center justify-center">
                        <i className="fas fa-map-location-dot text-red-300 text-xs"></i>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-200" style={{ fontFamily: 'Space Grotesk' }}>Crisis Resource Map</p>
                        <p className="text-[10px] text-slate-500">{resources.length} locations active — click map to add</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowAddPanel(p => !p); setEditingId(null); }}
                        className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                    >
                        <i className={`fas ${showAddPanel && !editingId ? 'fa-xmark' : 'fa-plus'}`}></i>
                        {showAddPanel && !editingId ? 'Cancel' : 'Add Location'}
                    </button>
                </div>
            </div>

            {/* ── Main split: map + sidebar ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Map */}
                <div className="flex-1 relative min-w-0">
                    <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

                    {/* Map legend overlay */}
                    <div className="absolute bottom-4 right-4 z-[400] bg-zinc-950/90 backdrop-blur rounded-xl border border-slate-700/50 p-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Legend</p>
                        {(Object.entries(RESOURCE_CONFIG) as [ResourceType, typeof RESOURCE_CONFIG[ResourceType]][]).map(([type, cfg]) => (
                            <div key={type} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.color }}></span>
                                <span className="text-[11px] text-slate-300">{cfg.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Click hint when panel is open */}
                    {showAddPanel && !pendingLoc && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-amber-900/90 backdrop-blur border border-amber-500/50 rounded-xl px-4 py-2 text-xs text-amber-200 font-semibold pointer-events-none">
                            <i className="fas fa-map-pin mr-2 text-amber-400"></i>
                            Click on the map to set the location
                        </div>
                    )}
                </div>

                {/* ── Right panel: Add/Edit form + resource list ── */}
                <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-700/50 bg-zinc-950 overflow-hidden">

                    {/* Add / Edit form */}
                    {showAddPanel && (
                        <div className="p-4 border-b border-slate-700/40 space-y-3 flex-shrink-0 bg-slate-900/60">
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                {editingId ? '✏️ Edit Location' : '📍 New Resource Location'}
                            </p>

                            {/* Name */}
                            <input
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 transition-all placeholder-slate-500"
                                placeholder="Location name…"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />

                            {/* Type */}
                            <select
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 appearance-none"
                                value={form.type}
                                onChange={e => {
                                    const t = e.target.value as ResourceType;
                                    setForm(f => ({ ...f, type: t, status: RESOURCE_CONFIG[t].statuses[0] }));
                                }}
                            >
                                {(Object.entries(RESOURCE_CONFIG) as [ResourceType, typeof RESOURCE_CONFIG[ResourceType]][]).map(([type, cfg]) => (
                                    <option key={type} value={type}>{cfg.label}</option>
                                ))}
                            </select>

                            {/* Status */}
                            <select
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 appearance-none"
                                value={form.status}
                                onChange={e => setForm(f => ({ ...f, status: e.target.value as ResourceStatus }))}
                            >
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            {/* Description */}
                            <textarea
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 resize-none placeholder-slate-500"
                                placeholder="Details (optional)…"
                                rows={2}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />

                            {/* Capacity */}
                            {(form.type === 'safe_zone' || form.type === 'food_center' || form.type === 'medical_camp') && (
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 placeholder-slate-500"
                                    placeholder="Capacity (persons)"
                                    value={form.capacity}
                                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                                />
                            )}

                            {/* Location indicator */}
                            <div className={`flex items-center gap-2 text-xs rounded-lg p-2 border ${pendingLoc ? 'bg-emerald-900/30 border-emerald-600/30 text-emerald-300' : 'bg-amber-900/20 border-amber-600/20 text-amber-300'}`}>
                                <i className={`fas ${pendingLoc ? 'fa-circle-check' : 'fa-map-pin'}`}></i>
                                {pendingLoc
                                    ? `📍 ${pendingLoc.lat.toFixed(4)}, ${pendingLoc.lng.toFixed(4)}`
                                    : 'Click map to pin location'
                                }
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={!form.name.trim() || !pendingLoc}
                                    className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2 rounded-lg transition-all"
                                >
                                    <i className="fas fa-check mr-1"></i>{editingId ? 'Update' : 'Save Location'}
                                </button>
                                <button onClick={resetForm} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-all">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter bar */}
                    <div className="flex gap-1 p-2 border-b border-slate-700/40 flex-wrap flex-shrink-0 bg-zinc-950">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${filterType === 'all' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >All</button>
                        {(Object.entries(RESOURCE_CONFIG) as [ResourceType, typeof RESOURCE_CONFIG[ResourceType]][]).map(([type, cfg]) => (
                            <button key={type}
                                onClick={() => setFilterType(type)}
                                className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${filterType === type ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                style={filterType === type ? { background: cfg.color + '70', border: `1px solid ${cfg.color}60` } : {}}
                            >
                                <i className={`fas ${cfg.icon} mr-1`}></i>{cfg.label}
                            </button>
                        ))}
                    </div>

                    {/* Resource list */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {filteredResources.length === 0 ? (
                            <div className="text-center py-12 text-slate-600">
                                <i className="fas fa-map-marked-alt text-3xl block mb-2"></i>
                                <p className="text-xs">{filterType === 'all' ? 'Click the map to add the first resource' : 'No locations of this type'}</p>
                            </div>
                        ) : filteredResources.map(r => {
                            const cfg = RESOURCE_CONFIG[r.type];
                            return (
                                <div key={r.id} className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600 transition-all group">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ background: cfg.color + '30', border: `1px solid ${cfg.color}50` }}>
                                            <i className={`fas ${cfg.icon} text-sm`} style={{ color: cfg.color }}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-100 truncate">{r.name}</p>
                                            <p className="text-[10px] font-semibold mb-1" style={{ color: cfg.color }}>{cfg.label}</p>
                                            {r.description && <p className="text-[11px] text-slate-400 line-clamp-1">{r.description}</p>}
                                            {r.capacity && <p className="text-[10px] text-slate-500 mt-0.5"><i className="fas fa-users mr-1"></i>Cap: {r.capacity}</p>}

                                            {/* Inline status select */}
                                            <select
                                                value={r.status}
                                                onChange={e => handleStatusChange(r.id, e.target.value as ResourceStatus)}
                                                className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer appearance-none ${STATUS_COLORS[r.status]}`}
                                                style={{ background: 'transparent' }}
                                            >
                                                {cfg.statuses.map(s => <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingId(r.id); }}
                                                className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-all"
                                                title="Edit"
                                            ><i className="fas fa-pen text-[10px]"></i></button>
                                            <button
                                                onClick={() => { mapRef.current?.flyTo({ center: [r.location.lng, r.location.lat], zoom: 15 }); }}
                                                className="w-7 h-7 bg-slate-700 hover:bg-blue-700 rounded-lg flex items-center justify-center text-slate-300 transition-all"
                                                title="Fly to"
                                            ><i className="fas fa-location-dot text-[10px]"></i></button>
                                            <button
                                                onClick={() => handleDelete(r.id)}
                                                className="w-7 h-7 bg-slate-700 hover:bg-red-700 rounded-lg flex items-center justify-center text-slate-300 transition-all"
                                                title="Delete"
                                            ><i className="fas fa-trash-can text-[10px]"></i></button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-1.5">
                                        <i className="fas fa-map-marker-alt mr-1"></i>
                                        {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary footer */}
                    {resources.length > 0 && (
                        <div className="p-3 border-t border-slate-700/40 flex-shrink-0 bg-zinc-950">
                            <div className="grid grid-cols-3 gap-1 text-center">
                                {[
                                    { label: 'Safe Zones', count: resources.filter(r => r.type === 'safe_zone' && r.status === 'Available').length, color: '#22c55e' },
                                    { label: 'Danger', count: resources.filter(r => r.type === 'danger_zone').length, color: '#dc2626' },
                                    { label: 'Medical', count: resources.filter(r => r.type === 'medical_camp').length, color: '#a855f7' },
                                ].map(s => (
                                    <div key={s.label} className="bg-slate-800/60 rounded-lg p-1.5">
                                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.count}</p>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DisasterMap;
