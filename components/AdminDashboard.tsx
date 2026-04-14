import React, { useState } from 'react';
import { Complaint, ComplaintStatus, Language, Priority } from '../types';
import { TRANSLATIONS, MOCK_EMPLOYEES, PRIORITY_COLORS, STATUS_COLORS } from '../constants';
import MapComponent from './MapComponent';
import AnalyticsCharts from './AnalyticsCharts';
import DisasterMap from './DisasterMap';
import { getEmployees, addEmployee as dbAddEmployee, deleteEmployee as dbDeleteEmployee, Employee as DBEmployee, getAvailableEmployees } from '../services/dbService';
import { formatDuration } from '../utils/timeUtils';

interface Props {
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    assignEmployee: (complaintId: string, empId: string) => void;
    adminVerify: (complaintId: string) => void;
    adminReject: (complaintId: string, reason: string) => void;
    clearAllComplaints: () => Promise<void>;
    crisisMode: boolean;
    setCrisisMode: (v: boolean) => void;
    onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ lang, setLang, complaints, assignEmployee, adminVerify, adminReject, clearAllComplaints, crisisMode, setCrisisMode, onLogout }) => {
    const [selected, setSelected] = useState<Complaint | null>(null);
    const [tab, setTab] = useState<'new' | 'verify' | 'all' | 'employees' | 'critical' | 'resolved'>('all');
    const [rejectReason, setRejectReason] = useState('');
    const [crisisView, setCrisisView] = useState<'map' | 'complaints'>('map');
    const t = TRANSLATIONS[lang];

    // Employee Management State
    const [employees, setEmployees] = useState<DBEmployee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [empName, setEmpName] = useState('');
    const [empEmail, setEmpEmail] = useState('');
    const [empPhone, setEmpPhone] = useState('');
    const [empDept, setEmpDept] = useState('');
    const [addingEmp, setAddingEmp] = useState(false);
    const [empError, setEmpError] = useState('');

    // Reassign state (admin override)
    const [showReassign, setShowReassign] = useState(false);
    const [availableEmps, setAvailableEmps] = useState<DBEmployee[]>([]);
    const [loadingAvail, setLoadingAvail] = useState(false);

    React.useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
        } catch (e: any) {
            console.error(e);
            setEmpError(e.message || "Failed to fetch employees");
        } finally {
            setLoadingEmployees(false);
        }
    };

    // Sync selected complaint whenever the complaints list updates (e.g. realtime reassignment)
    React.useEffect(() => {
        if (selected) {
            const updated = complaints.find(c => c.id === selected.id);
            if (updated) setSelected(updated);
        }
    }, [complaints]);

    // When a complaint is selected, load available employees for reassign
    const handleSelectComplaint = async (c: Complaint) => {
        setSelected(c);
        setRejectReason('');
        setShowReassign(false);
        setLoadingAvail(true);
        try {
            // Load all employees available (no active tasks) across all departments
            const avail = await getAvailableEmployees();
            setAvailableEmps(avail);
        } catch (e) {
            console.error('Could not load available employees', e);
            setAvailableEmps([]);
        } finally {
            setLoadingAvail(false);
        }
    };

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empName || !empEmail || !empDept || !empPhone) return;
        setAddingEmp(true);
        setEmpError('');
        try {
            await dbAddEmployee(empName, empEmail, empDept, empPhone);
            setEmpName('');
            setEmpEmail('');
            setEmpPhone('');
            setEmpDept('');
            await fetchEmployees();
        } catch (e: any) {
            console.error(e);
            setEmpError(e.message || "Failed to add employee");
        } finally {
            setAddingEmp(false);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this employee?")) return;
        try {
            await dbDeleteEmployee(id);
            await fetchEmployees();
        } catch (e: any) {
            console.error(e);
            setEmpError(e.message || "Failed to delete employee");
        }
    };

    // Heatmap stats (Masters only)
    const masters = complaints.filter(c => !c.parentId);
    const statsData = [
        { id: 'all', label: t.total, value: masters.length, icon: 'fa-layer-group', bg: 'bg-slate-700', dot: '#6366f1' },
        { id: 'new', label: t.unassigned_stat, value: masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length, icon: 'fa-inbox', bg: 'bg-indigo-800', dot: '#818cf8' },
        { id: 'verify', label: t.verify_pending, value: masters.filter(c => c.status === ComplaintStatus.JOB_COMPLETED).length, icon: 'fa-hourglass-half', bg: 'bg-yellow-700', dot: '#fbbf24' },
        { id: 'critical', label: t.critical, value: masters.filter(c => c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH).length, icon: 'fa-triangle-exclamation', bg: 'bg-red-800', dot: '#f87171' },
        { id: 'resolved', label: t.resolved, value: masters.filter(c => c.status === ComplaintStatus.VERIFIED).length, icon: 'fa-circle-check', bg: 'bg-emerald-800', dot: '#34d399' },
    ];

    const filteredComplaints = masters.filter(c => {
        if (tab === 'new') return !c.assignedTo && c.status !== ComplaintStatus.VERIFIED;
        if (tab === 'verify') return c.status === ComplaintStatus.JOB_COMPLETED;
        if (tab === 'critical') return c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH;
        if (tab === 'resolved') return c.status === ComplaintStatus.VERIFIED;
        return true;
    });

    const mapMarkers = [
        ...masters.map(c => ({ position: c.location, title: `${c.title} (${c.status})`, type: 'complaint' as 'complaint' })),
        ...masters.filter(c => c.employeeLocation).map(c => ({ position: c.employeeLocation!, title: 'Employee', type: 'employee' as 'employee' })),
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
                            <div key={s.label} 
                                onClick={() => setTab(s.id as any)}
                                className={`stat-card cursor-pointer transition-all hover:scale-[1.02] ${tab === s.id ? `ring-2 ring-indigo-400 ${s.bg}/80` : `${s.bg}/40 border border-white/5`}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
                                    <i className={`fas ${s.icon} text-slate-400 text-xs`}></i>
                                </div>
                                <p className="text-3xl font-bold" style={{ color: s.dot }}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Crisis Mode Toggle */}
                    <div className="mb-4">
                        {crisisMode && (
                            <div className="crisis-sidebar-bar mb-2">
                                <i className="fas fa-triangle-exclamation"></i>
                                <span>{t.crisis_mode_on}</span>
                            </div>
                        )}
                        <div
                            className={`crisis-toggle-wrap ${crisisMode ? 'active' : ''}`}
                            onClick={() => {
                                const msg = crisisMode ? t.crisis_deactivate_confirm : t.crisis_toggle_confirm;
                                if (window.confirm(msg)) setCrisisMode(!crisisMode);
                            }}
                        >
                            <div className="flex items-center gap-2 flex-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    crisisMode ? 'bg-red-700/50' : 'bg-slate-700/50'
                                }`}>
                                    <i className={`fas fa-shield-virus text-sm ${crisisMode ? 'text-red-300' : 'text-slate-400'}`}></i>
                                </div>
                                <div>
                                    <p className={`text-xs font-bold ${crisisMode ? 'text-red-300' : 'text-slate-300'}`}>
                                        {t.crisis_mode}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        {crisisMode ? 'Emergency triage active' : 'Tap to activate'}
                                    </p>
                                </div>
                            </div>
                            <label className="crisis-toggle-switch" onClick={e => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={crisisMode}
                                    onChange={() => {
                                        const msg = crisisMode ? t.crisis_deactivate_confirm : t.crisis_toggle_confirm;
                                        if (window.confirm(msg)) setCrisisMode(!crisisMode);
                                    }}
                                />
                                <span className="crisis-toggle-track"></span>
                            </label>
                        </div>
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

                <div className="mt-auto pt-4 space-y-2">
                    {/* Clear All Complaints */}
                    <button
                        onClick={async () => {
                            if (window.confirm('Delete ALL complaints permanently? This cannot be undone.')) {
                                await clearAllComplaints();
                            }
                        }}
                        className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-800/30 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    >
                        <i className="fas fa-trash-can mr-1"></i> Clear All Complaints
                    </button>
                    <button
                        onClick={() => window.location.hash = '#/about'}
                        className="w-full bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-300 border border-indigo-800/30 px-3 py-2 rounded-xl text-sm font-semibold transition-all mb-2"
                    >
                        <i className="fas fa-hand-holding-heart mr-2"></i> About Us
                    </button>
                    <button
                        onClick={() => window.location.hash = '#/community'}
                        className="w-full bg-violet-900/20 hover:bg-violet-900/40 text-violet-300 border border-violet-800/30 px-3 py-2 rounded-xl text-sm font-semibold transition-all mb-2"
                    >
                        <i className="fas fa-people-group mr-2"></i> Community Hub
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} className="lang-toggle flex-1 text-center">
                            <i className="fas fa-language text-xs"></i>
                            {lang === 'en' ? 'தமிழ்' : 'EN'}
                        </button>
                        <button onClick={onLogout} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                            <i className="fas fa-right-from-bracket mr-1"></i> {t.logout}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ---- MAIN CONTENT ---- */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-800" style={{ minHeight: 0 }}>

                {/* Crisis Mode view switcher */}
                {crisisMode && (
                    <div className="flex items-center gap-1 px-4 py-2 bg-zinc-950 border-b border-red-900/40 flex-shrink-0">
                        <button
                            onClick={() => setCrisisView('map')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                crisisView === 'map'
                                    ? 'bg-red-700 text-white shadow-lg shadow-red-900/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <i className="fas fa-map-location-dot"></i> Crisis Map
                        </button>
                        <button
                            onClick={() => setCrisisView('complaints')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                crisisView === 'complaints'
                                    ? 'bg-slate-600 text-white'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <i className="fas fa-list-check"></i> Emergency Complaints
                            <span className="ml-1 bg-red-700 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                {complaints.filter(c => ['Emergency','High'].includes(c.priority)).length}
                            </span>
                        </button>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="crisis-task-badge text-[9px]"><i className="fas fa-circle-dot mr-1 text-[8px]"></i>CRISIS ACTIVE</span>
                        </div>
                    </div>
                )}

                {/* Show DisasterMap when crisis mode + map view */}
                {crisisMode && crisisView === 'map' ? (
                    <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                        <DisasterMap />
                    </div>
                ) : (
                <>
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

                {/* Analytics Charts */}
                <AnalyticsCharts complaints={masters} />

                {/* Complaints + Detail Panel */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                    {/* --- Left: Complaint List --- */}
                    <div className="border-r border-slate-700/50 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex gap-1 p-3 border-b border-slate-700/50 bg-slate-800 flex-wrap">
                            {(['new', 'verify', 'all', 'employees'] as const).map(tb => (
                                <button key={tb} onClick={() => setTab(tb)}
                                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap ${tab === tb ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                                    {tb === 'new' ? t.tabs_new : tb === 'verify' ? t.tabs_verify : tb === 'all' ? t.tabs_all : 'Employees'}
                                    {tb === 'new' && masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length > 0 && (
                                        <span className="ml-1.5 bg-indigo-400 text-[10px] px-1.5 rounded-full">
                                            {masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {tab !== 'employees' ? (
                                <>
                                    {filteredComplaints.length === 0 && (
                                        <div className="text-center py-10 text-slate-500">
                                            <i className="fas fa-inbox text-3xl block mb-2"></i>
                                            <p className="text-sm">{t.no_complaints_here}</p>
                                        </div>
                                    )}
                                    {filteredComplaints.map(c => {
                                        const duplicates = complaints.filter(sub => sub.parentId === c.id);
                                        return (
                                        <div key={c.id}
                                            onClick={() => handleSelectComplaint(c)}
                                            className={`complaint-card bg-slate-700/60 border-slate-600/50 hover:border-indigo-400 cursor-pointer ${selected?.id === c.id ? 'border-indigo-400 bg-indigo-900/30' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 pr-2">
                                                    <p className="font-semibold text-sm text-slate-100 flex items-center flex-wrap gap-2">
                                                        {c.title}
                                                        {duplicates.length > 0 && (
                                                            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-500/50">
                                                                +{duplicates.length} reports
                                                            </span>
                                                        )}
                                                        {c.assignedTo && (
                                                            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/40">
                                                                <i className="fas fa-robot mr-1"></i>AI Assigned
                                                            </span>
                                                        )}
                                                    </p>
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
                                    )})}
                                </>
                            ) : (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-300 px-1">Employee Directory</h3>
                                    {loadingEmployees ? (
                                        <div className="text-center py-10 text-slate-500">
                                            <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                            <p className="text-xs">Loading employees...</p>
                                        </div>
                                    ) : (
                                        (employees.length > 0 ? employees : MOCK_EMPLOYEES).map((emp: any) => {
                                            const activeCount = complaints.filter(c =>
                                                c.assignedTo === emp.id &&
                                                [ComplaintStatus.SUBMITTED, ComplaintStatus.ASSIGNED, ComplaintStatus.ON_THE_WAY,
                                                 ComplaintStatus.REACHED, ComplaintStatus.IN_PROGRESS].includes(c.status as any)
                                            ).length;
                                            const isBusy = activeCount > 0;
                                            return (
                                                <div key={emp.id} className="bg-slate-700/50 p-3 rounded-xl border border-slate-600/50 flex flex-col gap-2 group relative">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                                                {emp.name}
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                                    isBusy
                                                                        ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                                                                        : 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                                                                }`}>
                                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${isBusy ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                                                                    {isBusy ? `Busy (${activeCount} task${activeCount > 1 ? 's' : ''})` : 'Available'}
                                                                </span>
                                                            </p>
                                                            <p className="text-xs text-slate-400 mt-0.5"><i className="fas fa-envelope mr-1"></i> {emp.email}</p>
                                                            {emp.phone && <p className="text-xs text-slate-400 mt-0.5"><i className="fas fa-phone mr-1"></i> {emp.phone}</p>}
                                                        </div>
                                                        <button onClick={() => handleDeleteEmployee(emp.id)} className="w-8 h-8 rounded-lg bg-red-900/30 text-red-400 border border-red-800/30 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center absolute top-3 right-3">
                                                            <i className="fas fa-trash-can text-xs"></i>
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-700/30 uppercase tracking-wider font-semibold">
                                                            {emp.department || emp.specialty}
                                                        </span>
                                                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-600/50">
                                                            <i className="fas fa-clipboard-list mr-1"></i> {activeCount} Active Tasks
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Right: Action Panel --- */}
                    <div className="flex flex-col overflow-hidden bg-slate-800">
                        <div className="p-4 border-b border-slate-700/50">
                            <h2 className="font-bold text-slate-100" style={{ fontFamily: 'Space Grotesk' }}>{t.action_details}</h2>
                        </div>

                        {tab === 'employees' ? (
                            <div className="flex-1 overflow-y-auto p-5">
                                <div className="glass-card p-5 rounded-2xl border border-indigo-500/30 bg-indigo-900/10 w-full mt-4">
                                    <h3 className="text-lg font-bold text-white mb-1"><i className="fas fa-user-plus mr-2 text-indigo-400"></i>Add Employee</h3>
                                    <p className="text-xs text-slate-400 mb-5">Register a new field worker into the system.</p>
                                    
                                    {empError && (
                                        <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-xs text-red-200">
                                            <i className="fas fa-triangle-exclamation mr-1.5"></i>{empError}
                                        </div>
                                    )}

                                    <form onSubmit={handleAddEmployee} className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Full Name</label>
                                            <input type="text" required value={empName} onChange={e => setEmpName(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400 transition-all placeholder-slate-500"
                                                placeholder="e.g. Ramesh Kumar" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Email Address</label>
                                            <input type="email" required value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400 transition-all placeholder-slate-500"
                                                placeholder="worker@civicresolve.in" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone Number</label>
                                            <input type="tel" required value={empPhone} onChange={e => setEmpPhone(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400 transition-all placeholder-slate-500"
                                                placeholder="e.g. 9876543210" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Department / Specialty</label>
                                            <select required value={empDept} onChange={e => setEmpDept(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400 transition-all placeholder-slate-500 appearance-none">
                                                <option value="" disabled>Select Department</option>
                                                <option value="light">Light</option>
                                                <option value="pothole">Pothole</option>
                                                <option value="drainage">Drainage</option>
                                                <option value="water_supply">Water Supply</option>
                                            </select>
                                        </div>
                                        <button type="submit" disabled={addingEmp} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-2">
                                            {addingEmp ? <><i className="fas fa-spinner fa-spin mr-2"></i>Adding...</> : <><i className="fas fa-plus mr-2"></i>Register Employee</>}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ) : selected ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Complaint Info */}
                                <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-indigo-300">{selected.title}</p>
                                        <span className={priorityBadgeClass(selected.priority)}>{selected.priority}</span>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-2">{selected.description}</p>
                                    {selected.status === ComplaintStatus.VERIFIED && selected.resolvedAt ? (
                                        <div className="text-xs text-emerald-400 bg-emerald-900/20 rounded-lg p-2.5 border border-emerald-500/30 flex items-center gap-2">
                                            <i className="fas fa-check-circle text-emerald-500"></i>
                                            <strong>Resolved in:</strong> {formatDuration(selected.resolvedAt - selected.createdAt)}
                                        </div>
                                    ) : selected.aiAnalysis ? (
                                        <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
                                            <p className="mb-2"><i className="fas fa-robot mr-1 text-indigo-400"></i><strong>AI Analysis:</strong> {selected.aiAnalysis.reason}</p>
                                            <div className="flex gap-4">
                                                <span><i className="fas fa-building mr-1"></i> {selected.aiAnalysis.department}</span>
                                                <span className="text-indigo-300 font-semibold"><i className="fas fa-clock mr-1"></i> Est: {selected.aiAnalysis.estimatedTime}</span>
                                            </div>
                                            {selected.aiAnalysis.equipmentNeeded && selected.aiAnalysis.equipmentNeeded.length > 0 && (
                                                <div className="mt-3 pt-2 border-t border-slate-700/50">
                                                    <p className="font-bold text-slate-300 mb-1"><i className="fas fa-toolbox text-amber-500 mr-1"></i> Suggested Resources:</p>
                                                    <ul className="list-disc list-inside text-slate-400 space-y-0.5 ml-1">
                                                        {selected.aiAnalysis.equipmentNeeded.map((eq, i) => (
                                                            <li key={i}>{eq}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                    {selected.image && (
                                        <div className="mt-3">
                                            <p className="text-xs text-slate-400 mb-1">{t.citizen_photo}</p>
                                            <img src={selected.image} className="w-full h-32 object-cover rounded-lg" alt="Report" />
                                        </div>
                                    )}
                                </div>

                                {/* DUPLICATE REPORTS PREVIEW */}
                                {(() => {
                                    const selectedDuplicates = complaints.filter(sub => sub.parentId === selected.id);
                                    if (selectedDuplicates.length > 0) {
                                        return (
                                            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-3 space-y-2 mt-3">
                                                <p className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-2">
                                                    <i className="fas fa-copy text-indigo-400 mr-2"></i> Duplicate Citizen Reports
                                                </p>
                                                {selectedDuplicates.map(dup => (
                                                    <div key={dup.id} className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 flex gap-3">
                                                        {dup.image ? (
                                                            <img src={dup.image} alt="Dup" className="w-14 h-14 object-cover rounded-md border border-slate-600" />
                                                        ) : (
                                                            <div className="w-14 h-14 bg-slate-700 rounded-md border border-slate-600 flex items-center justify-center text-slate-500">
                                                                <i className="fas fa-image"></i>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="font-semibold text-slate-200 text-sm truncate">{dup.title}</p>
                                                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{dup.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

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

                                        {selected.aiVerification && (
                                            <div className={`text-xs p-2.5 rounded-lg border flex items-start gap-2 ${selected.aiVerification.isResolved ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-red-900/40 border-red-500/50 text-red-300'}`}>
                                                <i className={`fas fa-robot mt-0.5 ${selected.aiVerification.isResolved ? 'text-emerald-400' : 'text-red-400'}`}></i>
                                                <div>
                                                    <strong>AI Verification {selected.aiVerification.isResolved ? 'Passed' : 'Failed'}:</strong>
                                                    <p className="opacity-90 mt-0.5">{selected.aiVerification.reason}</p>
                                                </div>
                                            </div>
                                        )}
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

                                {/* ASSIGNED EMPLOYEE DETAILS */}
                                {selected.assignedTo && selected.status !== ComplaintStatus.VERIFIED && (() => {
                                    const assignedEmp = [...employees, ...MOCK_EMPLOYEES].find((e: any) => e.id === selected.assignedTo);
                                    return assignedEmp ? (
                                        <div className="bg-emerald-900/20 border border-emerald-600/30 rounded-xl p-4">
                                            <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-2">
                                                <i className="fas fa-user-check mr-1"></i> Assigned Worker
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                                    {assignedEmp.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-100 text-sm">{assignedEmp.name}</p>
                                                    <p className="text-xs text-slate-400">{assignedEmp.department || (assignedEmp as any).specialty}</p>
                                                    {assignedEmp.email && <p className="text-xs text-slate-500">{assignedEmp.email}</p>}
                                                    {assignedEmp.phone && <p className="text-xs text-slate-500"><i className="fas fa-phone mr-1"></i>{assignedEmp.phone}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400">Assigned to: <code className="text-indigo-300">{selected.assignedTo}</code></p>
                                    );
                                })()}

                                {/* ASSIGN / REASSIGN SECTION */}
                                {selected.status !== ComplaintStatus.VERIFIED && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-slate-200">
                                                {selected.assignedTo ? (
                                                    <><i className="fas fa-arrows-rotate mr-1.5 text-violet-400"></i>Reassign Task (Admin Override)</>
                                                ) : (
                                                    <><i className="fas fa-user-plus mr-1.5 text-emerald-400"></i>{t.assign_employee}</>
                                                )}
                                            </p>
                                            {selected.assignedTo && (
                                                <button
                                                    onClick={() => setShowReassign(r => !r)}
                                                    className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                                                        showReassign
                                                            ? 'bg-violet-600 text-white border-violet-500'
                                                            : 'bg-slate-700 text-violet-300 border-violet-600/50 hover:bg-violet-900/40'
                                                    }`}
                                                >
                                                    {showReassign ? 'Cancel' : 'Reassign'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Show employee list when: not yet assigned, or admin clicked Reassign */}
                                        {(!selected.assignedTo || showReassign) && (
                                            <>
                                                {loadingAvail ? (
                                                    <div className="text-center py-4 text-slate-500 text-xs">
                                                        <i className="fas fa-spinner fa-spin mr-1"></i>Loading available employees...
                                                    </div>
                                                ) : availableEmps.length === 0 ? (
                                                    <div className="text-center py-4 text-slate-500 text-xs bg-slate-700/30 rounded-xl border border-slate-600/40">
                                                        <i className="fas fa-user-clock text-xl block mb-1 text-slate-600"></i>
                                                        All employees are currently busy.<br/>No one available for auto-assignment.
                                                    </div>
                                                ) : (
                                                    availableEmps.map((emp: any) => (
                                                        <button key={emp.id}
                                                            onClick={() => {
                                                                assignEmployee(selected.id, emp.id);
                                                                setSelected(prev => prev ? { ...prev, assignedTo: emp.id, status: ComplaintStatus.ASSIGNED } : null);
                                                                setShowReassign(false);
                                                            }}
                                                            className="w-full flex items-center justify-between bg-slate-700/60 hover:bg-emerald-900/40 border border-slate-600 hover:border-emerald-500/50 px-4 py-3 rounded-xl transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold">
                                                                    {emp.name ? emp.name[0].toUpperCase() : '?'}
                                                                </div>
                                                                <div className="text-left">
                                                                    <p className="font-semibold text-slate-100 text-sm">{emp.name}</p>
                                                                    <p className="text-xs text-slate-400">{emp.department || emp.specialty}</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs bg-emerald-900/60 text-emerald-400 border border-emerald-600/30 px-2 py-1 rounded-full">
                                                                <i className="fas fa-circle-check mr-1"></i>Free
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </>
                                        )}
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
                </>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
