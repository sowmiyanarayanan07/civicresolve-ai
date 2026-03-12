import React, { useState } from 'react';
import { Complaint, ComplaintStatus, Language, Priority } from '../types';
import { TRANSLATIONS, MOCK_EMPLOYEES, PRIORITY_COLORS, STATUS_COLORS } from '../constants';
import MapComponent from './MapComponent';

interface Props {
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    assignEmployee: (complaintId: string, empId: string) => void;
    adminVerify: (complaintId: string) => void;
    adminReject: (complaintId: string, reason: string) => void;
    onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ lang, setLang, complaints, assignEmployee, adminVerify, adminReject, onLogout }) => {
    const [selected, setSelected] = useState<Complaint | null>(null);
    const [tab, setTab] = useState<'new' | 'verify' | 'all'>('new');
    const [rejectReason, setRejectReason] = useState('');
    const t = TRANSLATIONS[lang];

    // Heatmap stats
    const statsData = [
        { label: t.total, value: complaints.length, icon: 'fa-layer-group', bg: 'bg-slate-700', dot: '#6366f1' },
        { label: t.unassigned_stat, value: complaints.filter(c => !c.assignedTo).length, icon: 'fa-inbox', bg: 'bg-indigo-800', dot: '#818cf8' },
        { label: t.verify_pending, value: complaints.filter(c => c.status === ComplaintStatus.JOB_COMPLETED).length, icon: 'fa-hourglass-half', bg: 'bg-yellow-700', dot: '#fbbf24' },
        { label: t.critical, value: complaints.filter(c => c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH).length, icon: 'fa-triangle-exclamation', bg: 'bg-red-800', dot: '#f87171' },
        { label: t.resolved, value: complaints.filter(c => c.status === ComplaintStatus.VERIFIED).length, icon: 'fa-circle-check', bg: 'bg-emerald-800', dot: '#34d399' },
    ];

    const filteredComplaints = complaints.filter(c => {
        if (tab === 'new') return !c.assignedTo && c.status !== ComplaintStatus.VERIFIED;
        if (tab === 'verify') return c.status === ComplaintStatus.JOB_COMPLETED;
        return true;
    });

    const mapMarkers = [
        ...complaints.map(c => ({ position: c.location, title: `${c.title} (${c.status})`, type: 'complaint' as 'complaint' })),
        ...complaints.filter(c => c.employeeLocation).map(c => ({ position: c.employeeLocation!, title: 'Employee', type: 'employee' as 'employee' })),
    ];

    const priorityBadgeClass = (p: Priority) => {
        if (p === Priority.EMERGENCY) return 'badge badge-emergency';
        if (p === Priority.HIGH) return 'badge badge-high';
        if (p === Priority.MEDIUM) return 'badge badge-medium';
        return 'badge badge-low';
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row text-white">
            {/* ---- SIDEBAR ---- */}
            <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-700/50 p-5 flex flex-col">
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-shield-halved text-white"></i>
                        </div>
                        <div>
                            <h1 className="font-bold text-white leading-tight" style={{ fontFamily: 'Space Grotesk' }}>{t.civic_admin}</h1>
                            <p className="text-xs text-slate-400">{t.system_admin}</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2 mb-4">
                        {statsData.map(s => (
                            <div key={s.label} className={`stat-card ${s.bg}/40 border border-white/5`}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
                                    <i className={`fas ${s.icon} text-slate-400 text-xs`}></i>
                                </div>
                                <p className="text-3xl font-bold" style={{ color: s.dot }}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Heatmap Legend */}
                    <div className="rounded-xl border border-slate-700/50 p-3 bg-slate-800/50">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{t.priority_legend}</p>
                        {[
                            { label: 'Emergency', color: '#ef4444' },
                            { label: 'High', color: '#f97316' },
                            { label: 'Medium', color: '#eab308' },
                            { label: 'Low', color: '#22c55e' },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-2 mb-1.5">
                                <span className="heatmap-dot" style={{ background: l.color }}></span>
                                <span className="text-xs text-slate-300">{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto pt-4 flex gap-2">
                    <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} className="lang-toggle flex-1 text-center">
                        <i className="fas fa-language text-xs"></i>
                        {lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>
                    <button onClick={onLogout} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                        <i className="fas fa-right-from-bracket mr-1"></i> {t.logout}
                    </button>
                </div>
            </aside>

            {/* ---- MAIN CONTENT ---- */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-800">
                {/* Live Map */}
                <div className="h-56 md:h-72 relative border-b border-slate-700/50 flex-shrink-0">
                    <MapComponent center={{ lat: 12.9716, lng: 80.2433 }} markers={mapMarkers} zoom={12} />
                    <div className="absolute top-3 left-3 z-[400] glass-card px-3 py-2">
                        <p className="text-xs font-bold text-white mb-1">{t.live_map}</p>
                        <div className="flex items-center gap-3 text-[11px] text-white/80">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"></span>{t.complaint_label}</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span>{t.employee_label}</span>
                        </div>
                    </div>
                </div>

                {/* Complaints + Detail Panel */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                    {/* --- Left: Complaint List --- */}
                    <div className="border-r border-slate-700/50 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex gap-1 p-3 border-b border-slate-700/50 bg-slate-800">
                            {(['new', 'verify', 'all'] as const).map(tb => (
                                <button key={tb} onClick={() => setTab(tb)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${tab === tb ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                                    {tb === 'new' ? t.tabs_new : tb === 'verify' ? t.tabs_verify : t.tabs_all}
                                    {tb === 'new' && complaints.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length > 0 && (
                                        <span className="ml-1.5 bg-indigo-400 text-[10px] px-1.5 rounded-full">
                                            {complaints.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredComplaints.length === 0 && (
                                <div className="text-center py-10 text-slate-500">
                                    <i className="fas fa-inbox text-3xl block mb-2"></i>
                                    <p className="text-sm">{t.no_complaints_here}</p>
                                </div>
                            )}
                            {filteredComplaints.map(c => (
                                <div key={c.id}
                                    onClick={() => { setSelected(c); setRejectReason(''); }}
                                    className={`complaint-card bg-slate-700/60 border-slate-600/50 hover:border-indigo-400 cursor-pointer ${selected?.id === c.id ? 'border-indigo-400 bg-indigo-900/30' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-2">
                                            <p className="font-semibold text-sm text-slate-100">{c.title}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{c.category}</p>
                                        </div>
                                        <span className={priorityBadgeClass(c.priority)}>{c.priority}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-[11px] text-slate-500">{c.status}</p>
                                        {c.status === ComplaintStatus.JOB_COMPLETED && (
                                            <span className="badge badge-medium text-[10px]">{t.verify_badge}</span>
                                        )}
                                        {c.assignedTo && <span className="text-[11px] text-emerald-400"><i className="fas fa-user-check mr-1"></i>{t.assigned_badge}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- Right: Action Panel --- */}
                    <div className="flex flex-col overflow-hidden bg-slate-800">
                        <div className="p-4 border-b border-slate-700/50">
                            <h2 className="font-bold text-slate-100" style={{ fontFamily: 'Space Grotesk' }}>{t.action_details}</h2>
                        </div>

                        {selected ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Complaint Info */}
                                <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-indigo-300">{selected.title}</p>
                                        <span className={priorityBadgeClass(selected.priority)}>{selected.priority}</span>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-2">{selected.description}</p>
                                    {selected.aiAnalysis && (
                                        <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-2.5 border border-slate-600/30">
                                            <i className="fas fa-robot mr-1 text-indigo-400"></i>
                                            <strong>AI:</strong> {selected.aiAnalysis.reason} · <em>{selected.aiAnalysis.department}</em> · {selected.aiAnalysis.estimatedTime}
                                        </div>
                                    )}
                                    {selected.image && (
                                        <div className="mt-3">
                                            <p className="text-xs text-slate-400 mb-1">{t.citizen_photo}</p>
                                            <img src={selected.image} className="w-full h-32 object-cover rounded-lg" alt="Report" />
                                        </div>
                                    )}
                                </div>

                                {/* VERIFY SECTION */}
                                {selected.status === ComplaintStatus.JOB_COMPLETED && (
                                    <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                                        <h3 className="font-bold text-emerald-300 flex items-center gap-2">
                                            <i className="fas fa-clipboard-check"></i> {t.verification_required}
                                        </h3>
                                        <div>
                                            <p className="text-xs text-slate-400 mb-1">{t.employee_proof}</p>
                                            {selected.completionImage
                                                ? <img src={selected.completionImage} className="w-full h-40 object-contain bg-black rounded-lg" alt="Proof" />
                                                : <p className="text-red-400 text-xs">{t.no_image_proof}</p>}
                                        </div>
                                        <button onClick={() => { adminVerify(selected.id); setSelected(null); }}
                                            className="btn-primary btn-success">
                                            <i className="fas fa-check-circle mr-2"></i> {t.verify_resolve}
                                        </button>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder={t.rejection_reason}
                                                className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm p-2 rounded-lg placeholder-slate-500 focus:outline-none focus:border-red-400"
                                                value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                            <button onClick={() => { if (rejectReason) { adminReject(selected.id, rejectReason); setSelected(null); } }}
                                                className="bg-red-600 hover:bg-red-700 text-white px-4 rounded-lg font-bold text-sm transition-all">
                                                {t.reject}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ASSIGN SECTION */}
                                {!selected.assignedTo && selected.status !== ComplaintStatus.VERIFIED && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold text-slate-200">{t.assign_employee}</p>
                                        {MOCK_EMPLOYEES.map(emp => (
                                            <button key={emp.id}
                                                onClick={() => { assignEmployee(selected.id, emp.id); setSelected(null); }}
                                                className="w-full flex items-center justify-between bg-slate-700/60 hover:bg-emerald-900/40 border border-slate-600 hover:border-emerald-500/50 px-4 py-3 rounded-xl transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold">
                                                        {emp.name[0]}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-semibold text-slate-100 text-sm">{emp.name}</p>
                                                        <p className="text-xs text-slate-400">{emp.specialty}</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs bg-emerald-900/60 text-emerald-400 border border-emerald-600/30 px-2 py-1 rounded-full">{t.available}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selected.status === ComplaintStatus.VERIFIED && (
                                    <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-xl text-center text-emerald-300 font-bold">
                                        <i className="fas fa-circle-check text-2xl mb-2 block text-emerald-400"></i>
                                        {t.verified_msg}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-3">
                                <i className="fas fa-hand-pointer text-4xl text-slate-600"></i>
                                <p className="text-sm">{t.select_complaint_action}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
