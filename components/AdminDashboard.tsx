import React, { useState } from 'react';
import { Complaint, ComplaintStatus, Language, Priority } from '../types';
import { TRANSLATIONS, MOCK_EMPLOYEES } from '../constants';
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

const PRIORITY_DOT: Record<string, string> = {
    Emergency: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e',
};

const AdminDashboard: React.FC<Props> = ({ lang, setLang, complaints, assignEmployee, adminVerify, adminReject, clearAllComplaints, crisisMode, setCrisisMode, onLogout }) => {
    const [selected, setSelected] = useState<Complaint | null>(null);
    const [tab, setTab] = useState<'all' | 'new' | 'verify' | 'critical' | 'resolved' | 'employees'>('all');
    const [rejectReason, setRejectReason] = useState('');
    const [crisisView, setCrisisView] = useState<'map' | 'complaints'>('map');
    const t = TRANSLATIONS[lang];

    const [employees, setEmployees] = useState<DBEmployee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [empName, setEmpName] = useState('');
    const [empEmail, setEmpEmail] = useState('');
    const [empPhone, setEmpPhone] = useState('');
    const [empDept, setEmpDept] = useState('');
    const [addingEmp, setAddingEmp] = useState(false);
    const [empError, setEmpError] = useState('');

    const [showReassign, setShowReassign] = useState(false);
    const [availableEmps, setAvailableEmps] = useState<DBEmployee[]>([]);
    const [loadingAvail, setLoadingAvail] = useState(false);

    React.useEffect(() => { fetchEmployees(); }, []);

    React.useEffect(() => {
        if (selected) {
            const updated = complaints.find(c => c.id === selected.id);
            if (updated) setSelected(updated);
        }
    }, [complaints]);

    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
        } catch (e: any) {
            setEmpError(e.message || 'Failed to fetch employees');
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleSelectComplaint = async (c: Complaint) => {
        setSelected(c);
        setRejectReason('');
        setShowReassign(false);
        setLoadingAvail(true);
        try {
            const avail = await getAvailableEmployees();
            setAvailableEmps(avail);
        } catch {
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
            setEmpName(''); setEmpEmail(''); setEmpPhone(''); setEmpDept('');
            await fetchEmployees();
        } catch (e: any) {
            setEmpError(e.message || 'Failed to add employee');
        } finally {
            setAddingEmp(false);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this employee?')) return;
        try {
            await dbDeleteEmployee(id);
            await fetchEmployees();
        } catch (e: any) {
            setEmpError(e.message || 'Failed to delete employee');
        }
    };

    const masters = complaints.filter(c => !c.parentId);

    const statsData = [
        { id: 'all',      label: t.total,           value: masters.length,                                                                                    icon: 'fa-layer-group',          color: '#818cf8', glow: 'rgba(129,140,248,0.15)' },
        { id: 'new',      label: t.unassigned_stat,  value: masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length,               icon: 'fa-inbox',                color: '#60a5fa', glow: 'rgba(96,165,250,0.15)'  },
        { id: 'verify',   label: t.verify_pending,   value: masters.filter(c => c.status === ComplaintStatus.JOB_COMPLETED).length,                           icon: 'fa-hourglass-half',       color: '#fbbf24', glow: 'rgba(251,191,36,0.15)'  },
        { id: 'critical', label: t.critical,          value: masters.filter(c => c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH).length,   icon: 'fa-triangle-exclamation', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
        { id: 'resolved', label: t.resolved,          value: masters.filter(c => c.status === ComplaintStatus.VERIFIED).length,                               icon: 'fa-circle-check',         color: '#34d399', glow: 'rgba(52,211,153,0.15)'  },
    ];

    const filteredComplaints = masters.filter(c => {
        if (tab === 'new')      return !c.assignedTo && c.status !== ComplaintStatus.VERIFIED;
        if (tab === 'verify')   return c.status === ComplaintStatus.JOB_COMPLETED;
        if (tab === 'critical') return c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH;
        if (tab === 'resolved') return c.status === ComplaintStatus.VERIFIED;
        return true;
    });

    const mapMarkers = [
        ...masters.map(c => ({ position: c.location, title: `${c.title} (${c.status})`, type: 'complaint' as const })),
        ...masters.filter(c => c.employeeLocation).map(c => ({ position: c.employeeLocation!, title: 'Employee', type: 'employee' as const })),
    ];

    const priorityBadgeClass = (p: Priority) => {
        if (p === Priority.EMERGENCY) return 'badge badge-emergency';
        if (p === Priority.HIGH)      return 'badge badge-high';
        if (p === Priority.MEDIUM)    return 'badge badge-medium';
        return 'badge badge-low';
    };

    const statusColor = (s: ComplaintStatus) => {
        if (s === ComplaintStatus.VERIFIED)       return { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', border: 'rgba(52,211,153,0.25)' };
        if (s === ComplaintStatus.JOB_COMPLETED)  return { bg: 'rgba(251,191,36,0.1)',  text: '#fbbf24', border: 'rgba(251,191,36,0.25)' };
        if (s === ComplaintStatus.REJECTED)       return { bg: 'rgba(248,113,113,0.1)', text: '#f87171', border: 'rgba(248,113,113,0.25)' };
        if (s === ComplaintStatus.IN_PROGRESS)    return { bg: 'rgba(129,140,248,0.1)', text: '#818cf8', border: 'rgba(129,140,248,0.25)' };
        if (s === ComplaintStatus.ASSIGNED)       return { bg: 'rgba(96,165,250,0.1)',  text: '#60a5fa', border: 'rgba(96,165,250,0.25)' };
        return { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' };
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#0d1117', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', height: '100vh' }}>

            {/* ══════ SIDEBAR ══════ */}
            <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#010409', borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>

                {/* Logo */}
                <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 12px rgba(99,102,241,0.4)' }}>
                            <i className="fas fa-shield-halved" style={{ fontSize: 14, color: '#fff' }}></i>
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>{t.civic_admin}</p>
                            <p style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{t.system_admin}</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ padding: '12px 10px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, paddingLeft: 4 }}>Overview</p>
                    {statsData.map(s => (
                        <button key={s.id} onClick={() => setTab(s.id as any)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 2,
                                borderRadius: 8, border: `1px solid ${tab === s.id ? s.color + '40' : 'transparent'}`,
                                background: tab === s.id ? s.glow : 'transparent',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: s.glow, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className={`fas ${s.icon}`} style={{ fontSize: 11, color: s.color }}></i>
                            </div>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: tab === s.id ? '#e2e8f0' : '#94a3b8', textAlign: 'left' }}>{s.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                        </button>
                    ))}
                </div>

                {/* Priority Legend */}
                <div style={{ padding: '12px 14px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>{t.priority_legend}</p>
                    {[{ label: 'Emergency', color: '#ef4444' }, { label: 'High', color: '#f97316' }, { label: 'Medium', color: '#eab308' }, { label: 'Low', color: '#22c55e' }].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }}></span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{l.label}</span>
                        </div>
                    ))}
                </div>

                {/* Crisis Mode */}
                <div style={{ padding: '10px 10px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => { if (window.confirm(crisisMode ? t.crisis_deactivate_confirm : t.crisis_toggle_confirm)) setCrisisMode(!crisisMode); }}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${crisisMode ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`,
                            background: crisisMode ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                            transition: 'all 0.2s',
                        }}>
                        {crisisMode && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }}></span>}
                        <i className="fas fa-shield-virus" style={{ fontSize: 12, color: crisisMode ? '#f87171' : '#6b7280' }}></i>
                        <span style={{ fontSize: 12, fontWeight: 600, color: crisisMode ? '#fca5a5' : '#94a3b8', flex: 1, textAlign: 'left' }}>
                            {crisisMode ? 'Crisis ON' : t.crisis_mode}
                        </span>
                        <div style={{ width: 30, height: 16, borderRadius: 8, background: crisisMode ? '#ef4444' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'all 0.2s' }}>
                            <div style={{ position: 'absolute', top: 2, left: crisisMode ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                        </div>
                    </button>
                </div>

                {/* Bottom actions */}
                <div style={{ padding: '10px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => window.location.hash = '#/community'}
                        style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.06)', color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                        <i className="fas fa-people-group" style={{ marginRight: 6 }}></i>Community Hub
                    </button>
                    <button onClick={() => window.location.hash = '#/about'}
                        style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                        <i className="fas fa-hand-holding-heart" style={{ marginRight: 6 }}></i>About Us
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                            style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                            <i className="fas fa-language" style={{ marginRight: 4 }}></i>{lang === 'en' ? 'தமிழ்' : 'EN'}
                        </button>
                        <button onClick={onLogout}
                            style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                            <i className="fas fa-right-from-bracket" style={{ marginRight: 4 }}></i>{t.logout}
                        </button>
                    </div>
                    <button onClick={async () => { if (window.confirm('Delete ALL complaints permanently? This cannot be undone.')) await clearAllComplaints(); }}
                        style={{ padding: '6px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.15)', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                        <i className="fas fa-trash-can" style={{ marginRight: 4 }}></i>Clear All Complaints
                    </button>
                </div>
            </aside>

            {/* ══════ MAIN ══════ */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Crisis banner */}
                {crisisMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }}></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.3px' }}>CRISIS MODE ACTIVE — Emergency Triage Enabled</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            {(['map', 'complaints'] as const).map(v => (
                                <button key={v} onClick={() => setCrisisView(v)}
                                    style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: crisisView === v ? '#ef4444' : 'rgba(239,68,68,0.08)', color: crisisView === v ? '#fff' : '#f87171' }}>
                                    {v === 'map' ? <><i className="fas fa-map-location-dot" style={{ marginRight: 4 }}></i>Crisis Map</> : <><i className="fas fa-list-check" style={{ marginRight: 4 }}></i>Emergency List</>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {crisisMode && crisisView === 'map' ? (
                    <div style={{ flex: 1, overflow: 'hidden' }}><DisasterMap /></div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

                        {/* Map + Charts row */}
                        <div style={{ display: 'flex', height: 210, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                                <MapComponent center={{ lat: 12.9716, lng: 80.2433 }} markers={mapMarkers} zoom={12} />
                                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 400, background: 'rgba(1,4,9,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 11px' }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t.live_map}</p>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f87171', marginRight: 4 }}></span>{t.complaint_label}</span>
                                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399', marginRight: 4 }}></span>{t.employee_label}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: '#010409' }}>
                                <AnalyticsCharts complaints={masters} />
                            </div>
                        </div>

                        {/* Content: List + Detail */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                            {/* ── COMPLAINT LIST ── */}
                            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: '#010409' }}>
                                {/* Tab bar */}
                                <div style={{ display: 'flex', gap: 2, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, flexWrap: 'wrap' }}>
                                    {(['new', 'verify', 'all', 'employees'] as const).map(tb => {
                                        const active = tab === tb;
                                        const label = tb === 'new' ? t.tabs_new : tb === 'verify' ? t.tabs_verify : tb === 'all' ? t.tabs_all : 'Workers';
                                        const badge = tb === 'new' ? masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length : undefined;
                                        return (
                                            <button key={tb} onClick={() => setTab(tb)} style={{
                                                flex: '1 1 auto', padding: '5px 6px', fontSize: 11, fontWeight: 700, borderRadius: 7,
                                                border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.05)'}`,
                                                background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.02)',
                                                color: active ? '#a5b4fc' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s',
                                            }}>
                                                {label}
                                                {badge !== undefined && badge > 0 && (
                                                    <span style={{ marginLeft: 4, background: '#6366f1', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10 }}>{badge}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* List body */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                                    {tab !== 'employees' ? (
                                        <>
                                            {filteredComplaints.length === 0 && (
                                                <div style={{ textAlign: 'center', paddingTop: 48, color: '#374151' }}>
                                                    <i className="fas fa-inbox" style={{ fontSize: 28, display: 'block', marginBottom: 8 }}></i>
                                                    <p style={{ fontSize: 13 }}>{t.no_complaints_here}</p>
                                                </div>
                                            )}
                                            {filteredComplaints.map(c => {
                                                const dups = complaints.filter(sub => sub.parentId === c.id);
                                                const isSelected = selected?.id === c.id;
                                                const sc = statusColor(c.status);
                                                return (
                                                    <div key={c.id} onClick={() => handleSelectComplaint(c)}
                                                        style={{
                                                            padding: '10px 11px', borderRadius: 10, marginBottom: 5, cursor: 'pointer', transition: 'all 0.15s',
                                                            border: `1px solid ${isSelected ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.055)'}`,
                                                            background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                                                        }}>
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[c.priority] ?? '#94a3b8', flexShrink: 0, marginTop: 4 }}></span>
                                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', flex: 1, lineHeight: 1.35 }}>{c.title}</p>
                                                            {dups.length > 0 && (
                                                                <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: 8, padding: '1px 6px', flexShrink: 0, fontWeight: 700 }}>+{dups.length}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 15 }}>
                                                            <span style={{ fontSize: 11, color: '#6b7280' }}>{c.category}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                                                                {c.status === ComplaintStatus.JOB_COMPLETED ? 'Review' : c.status === ComplaintStatus.VERIFIED ? 'Resolved' : c.assignedTo ? 'Assigned' : 'Pending'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        /* Employee list */
                                        <div>
                                            <p style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, paddingLeft: 2 }}>Field Workers</p>
                                            {loadingEmployees ? (
                                                <div style={{ textAlign: 'center', paddingTop: 40, color: '#4b5563' }}>
                                                    <i className="fas fa-spinner fa-spin" style={{ fontSize: 20, marginBottom: 6 }}></i>
                                                    <p style={{ fontSize: 12 }}>Loading...</p>
                                                </div>
                                            ) : (employees.length > 0 ? employees : MOCK_EMPLOYEES).map((emp: any) => {
                                                const activeCount = complaints.filter(c =>
                                                    c.assignedTo === emp.id &&
                                                    [ComplaintStatus.SUBMITTED, ComplaintStatus.ASSIGNED, ComplaintStatus.ON_THE_WAY, ComplaintStatus.REACHED, ComplaintStatus.IN_PROGRESS].includes(c.status as any)
                                                ).length;
                                                const busy = activeCount > 0;
                                                return (
                                                    <div key={emp.id} style={{ padding: '10px 11px', borderRadius: 10, marginBottom: 5, border: '1px solid rgba(255,255,255,0.055)', background: 'rgba(255,255,255,0.02)', position: 'relative' }}
                                                        className="group">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: busy ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)', border: `1.5px solid ${busy ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: busy ? '#f87171' : '#34d399', flexShrink: 0 }}>
                                                                {emp.name?.[0]?.toUpperCase()}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 1 }}>{emp.name}</p>
                                                                <p style={{ fontSize: 10, color: '#6b7280' }}>{emp.department || emp.specialty}</p>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: busy ? '#f87171' : '#34d399', background: busy ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', padding: '2px 7px', borderRadius: 8 }}>
                                                                    {busy ? `${activeCount} task${activeCount > 1 ? 's' : ''}` : 'Free'}
                                                                </span>
                                                                <button onClick={() => handleDeleteEmployee(emp.id)}
                                                                    style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                                                                    <i className="fas fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── DETAIL / ACTION PANEL ── */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d1117', minWidth: 0 }}>
                                {/* Panel header */}
                                <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: '#010409', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{tab === 'employees' ? 'Register Field Worker' : selected ? selected.title : t.action_details}</p>
                                    {selected && tab !== 'employees' && (
                                        <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>

                                {tab === 'employees' ? (
                                    /* ── ADD EMPLOYEE FORM ── */
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                                        <div style={{ maxWidth: 560, margin: '0 auto', background: '#010409', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: 24 }}>
                                            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                                                <i className="fas fa-user-plus" style={{ marginRight: 8, color: '#6366f1' }}></i>Add New Worker
                                            </p>
                                            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Register a new field worker into the system.</p>

                                            {empError && (
                                                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#fca5a5' }}>
                                                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{empError}
                                                </div>
                                            )}

                                            <form onSubmit={handleAddEmployee}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                                    {[
                                                        { label: 'Full Name', value: empName, setter: setEmpName, type: 'text', ph: 'e.g. Ramesh Kumar' },
                                                        { label: 'Email Address', value: empEmail, setter: setEmpEmail, type: 'email', ph: 'worker@civicresolve.in' },
                                                        { label: 'Phone Number', value: empPhone, setter: setEmpPhone, type: 'tel', ph: '9876543210' },
                                                    ].map(f => (
                                                        <div key={f.label}>
                                                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{f.label}</label>
                                                            <input type={f.type} required value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.ph}
                                                                style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 11px', fontSize: 12, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
                                                        </div>
                                                    ))}
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Department</label>
                                                        <select required value={empDept} onChange={e => setEmpDept(e.target.value)}
                                                            style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 11px', fontSize: 12, color: empDept ? '#e2e8f0' : '#4b5563', outline: 'none', boxSizing: 'border-box' }}>
                                                            <option value="" disabled>Select Department</option>
                                                            <option value="light">Light</option>
                                                            <option value="pothole">Pothole</option>
                                                            <option value="drainage">Drainage</option>
                                                            <option value="water_supply">Water Supply</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={addingEmp}
                                                    style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: addingEmp ? 'not-allowed' : 'pointer', opacity: addingEmp ? 0.65 : 1 }}>
                                                    {addingEmp ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Adding...</> : <><i className="fas fa-plus" style={{ marginRight: 6 }}></i>Register Employee</>}
                                                </button>
                                            </form>
                                        </div>
                                    </div>

                                ) : selected ? (
                                    /* ── COMPLAINT DETAIL ── */
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
                                        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

                                            {/* Title / category */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_DOT[selected.priority] ?? '#94a3b8', flexShrink: 0, marginTop: 5 }}></span>
                                                <div style={{ flex: 1 }}>
                                                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', margin: 0, lineHeight: 1.3 }}>{selected.title}</h2>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                        <span style={{ fontSize: 12, color: '#6b7280' }}>{selected.category}</span>
                                                        <span className={`badge badge-${selected.priority.toLowerCase() === 'emergency' ? 'emergency' : selected.priority.toLowerCase() === 'high' ? 'high' : selected.priority.toLowerCase() === 'medium' ? 'medium' : 'low'}`}>{selected.priority}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description + image */}
                                            <div style={{ display: 'flex', gap: 14 }}>
                                                <div style={{ flex: 1, background: '#010409', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
                                                    <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{selected.description}</p>

                                                    {selected.status === ComplaintStatus.VERIFIED && selected.resolvedAt && (
                                                        <div style={{ marginTop: 10, padding: '7px 11px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 7, fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                                                            <i className="fas fa-check-circle" style={{ marginRight: 5 }}></i>Resolved in {formatDuration(selected.resolvedAt - selected.createdAt)}
                                                        </div>
                                                    )}

                                                    {selected.aiAnalysis && (
                                                        <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }}>
                                                            <p style={{ fontSize: 11, color: '#818cf8', marginBottom: 6, fontWeight: 700 }}><i className="fas fa-robot" style={{ marginRight: 5 }}></i>AI Analysis</p>
                                                            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7 }}>{selected.aiAnalysis.reason}</p>
                                                            <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                                                                <span style={{ color: '#6b7280' }}><i className="fas fa-building" style={{ marginRight: 4 }}></i>{selected.aiAnalysis.department}</span>
                                                                <span style={{ color: '#818cf8', fontWeight: 600 }}><i className="fas fa-clock" style={{ marginRight: 4 }}></i>{selected.aiAnalysis.estimatedTime}</span>
                                                            </div>
                                                            {selected.aiAnalysis.equipmentNeeded && selected.aiAnalysis.equipmentNeeded.length > 0 && (
                                                                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                    {selected.aiAnalysis.equipmentNeeded.map((eq, i) => (
                                                                        <span key={i} style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderRadius: 5, padding: '2px 7px', border: '1px solid rgba(255,255,255,0.07)' }}>{eq}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {selected.image && (
                                                    <div style={{ flexShrink: 0 }}>
                                                        <a href={selected.image} target="_blank" rel="noopener noreferrer">
                                                            <img src={selected.image} alt="Report" style={{ width: 160, height: 130, objectFit: 'cover', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', display: 'block', cursor: 'pointer' }} />
                                                        </a>
                                                        <p style={{ fontSize: 10, color: '#4b5563', marginTop: 4, textAlign: 'center' }}>{t.citizen_photo} ↗</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Duplicates */}
                                            {(() => {
                                                const dups = complaints.filter(sub => sub.parentId === selected.id);
                                                if (!dups.length) return null;
                                                return (
                                                    <div style={{ background: '#010409', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '11px 13px' }}>
                                                        <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                                            <i className="fas fa-copy" style={{ marginRight: 5, color: '#818cf8' }}></i>Duplicate Reports ({dups.length})
                                                        </p>
                                                        {dups.map(dup => (
                                                            <div key={dup.id} style={{ display: 'flex', gap: 9, padding: '7px 9px', background: 'rgba(255,255,255,0.02)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.04)', marginBottom: 5 }}>
                                                                {dup.image
                                                                    ? <img src={dup.image} alt="Dup" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                                                    : <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.04)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', flexShrink: 0 }}><i className="fas fa-image"></i></div>
                                                                }
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dup.title}</p>
                                                                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{dup.description?.slice(0, 80)}{dup.description?.length > 80 ? '…' : ''}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}

                                            {/* VERIFY panel */}
                                            {selected.status === ComplaintStatus.JOB_COMPLETED && (
                                                <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 12, padding: 16 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>
                                                        <i className="fas fa-clipboard-check" style={{ marginRight: 7 }}></i>{t.verification_required}
                                                    </p>

                                                    <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                                                        <div style={{ flex: 1 }}>
                                                            {selected.aiVerification && (
                                                                <div style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${selected.aiVerification.isResolved ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`, background: selected.aiVerification.isResolved ? 'rgba(52,211,153,0.07)' : 'rgba(239,68,68,0.07)', marginBottom: 9 }}>
                                                                    <p style={{ fontSize: 11, fontWeight: 700, color: selected.aiVerification.isResolved ? '#34d399' : '#f87171', marginBottom: 3 }}>
                                                                        <i className="fas fa-robot" style={{ marginRight: 5 }}></i>AI {selected.aiVerification.isResolved ? '✓ Passed' : '✗ Failed'}
                                                                    </p>
                                                                    <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{selected.aiVerification.reason}</p>
                                                                </div>
                                                            )}
                                                            <p style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                                                                <i className="fas fa-info-circle" style={{ marginRight: 5, color: '#818cf8' }}></i>
                                                                Review the employee's proof photo before approving.
                                                            </p>
                                                        </div>
                                                        {selected.completionImage ? (
                                                            <div style={{ flexShrink: 0 }}>
                                                                <a href={selected.completionImage} target="_blank" rel="noopener noreferrer">
                                                                    <img src={selected.completionImage} alt="Proof" style={{ width: 130, height: 105, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(52,211,153,0.25)', display: 'block' }} />
                                                                </a>
                                                                <p style={{ fontSize: 10, color: '#4b5563', marginTop: 3, textAlign: 'center' }}>{t.employee_proof} ↗</p>
                                                            </div>
                                                        ) : (
                                                            <div style={{ width: 130, height: 105, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0, flexDirection: 'column', gap: 5 }}>
                                                                <i className="fas fa-image-slash" style={{ fontSize: 18 }}></i>
                                                                <span style={{ fontSize: 10 }}>{t.no_image_proof}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 10 }}>
                                                        <button onClick={() => { adminVerify(selected.id); setSelected(null); }}
                                                            style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>
                                                            <i className="fas fa-check-circle" style={{ marginRight: 7 }}></i>{t.verify_resolve}
                                                        </button>
                                                        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                                                            <input type="text" placeholder={t.rejection_reason} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                                                style={{ flex: 1, background: '#010409', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '11px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none', minWidth: 0 }} />
                                                            <button onClick={() => { if (rejectReason) { adminReject(selected.id, rejectReason); setSelected(null); } }}
                                                                style={{ padding: '11px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.3)', whiteSpace: 'nowrap' }}>
                                                                {t.reject}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Assigned employee */}
                                            {selected.assignedTo && selected.status !== ComplaintStatus.VERIFIED && (() => {
                                                const emp = [...employees, ...MOCK_EMPLOYEES].find((e: any) => e.id === selected.assignedTo);
                                                if (!emp) return <p style={{ fontSize: 11, color: '#6b7280' }}>Assigned to: <code style={{ color: '#818cf8' }}>{selected.assignedTo}</code></p>;
                                                return (
                                                    <div style={{ background: '#010409', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                                                            {emp.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ fontSize: 10, color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                                                                <i className="fas fa-user-check" style={{ marginRight: 4 }}></i>Assigned Worker
                                                            </p>
                                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{emp.name}</p>
                                                            <p style={{ fontSize: 11, color: '#6b7280' }}>{emp.department || (emp as any).specialty} {emp.phone && `· ${emp.phone}`}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Assign / Reassign */}
                                            {selected.status !== ComplaintStatus.VERIFIED && (
                                                <div style={{ background: '#010409', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                                            {selected.assignedTo
                                                                ? <><i className="fas fa-arrows-rotate" style={{ marginRight: 6, color: '#a78bfa' }}></i>Reassign (Admin Override)</>
                                                                : <><i className="fas fa-user-plus" style={{ marginRight: 6, color: '#34d399' }}></i>{t.assign_employee}</>}
                                                        </p>
                                                        {selected.assignedTo && (
                                                            <button onClick={() => setShowReassign(r => !r)}
                                                                style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${showReassign ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)'}`, background: showReassign ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.06)', color: '#a78bfa', cursor: 'pointer' }}>
                                                                {showReassign ? 'Cancel' : 'Reassign'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {(!selected.assignedTo || showReassign) && (
                                                        loadingAvail ? (
                                                            <div style={{ textAlign: 'center', padding: '14px', color: '#6b7280', fontSize: 12 }}>
                                                                <i className="fas fa-spinner fa-spin" style={{ marginRight: 5 }}></i>Loading available employees...
                                                            </div>
                                                        ) : availableEmps.length === 0 ? (
                                                            <div style={{ textAlign: 'center', padding: '14px', color: '#6b7280', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                                                <i className="fas fa-user-clock" style={{ fontSize: 18, display: 'block', marginBottom: 5, color: '#374151' }}></i>
                                                                All employees are currently busy.
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                                {availableEmps.map((emp: any) => (
                                                                    <button key={emp.id}
                                                                        onClick={() => { assignEmployee(selected.id, emp.id); setSelected(prev => prev ? { ...prev, assignedTo: emp.id, status: ComplaintStatus.ASSIGNED } : null); setShowReassign(false); }}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.18)', background: 'rgba(52,211,153,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                                                                            {emp.name?.[0]?.toUpperCase()}
                                                                        </div>
                                                                        <div style={{ flex: 1 }}>
                                                                            <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{emp.name}</p>
                                                                            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{emp.department || emp.specialty}</p>
                                                                        </div>
                                                                        <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700, background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 8 }}>
                                                                            <i className="fas fa-circle-check" style={{ marginRight: 3 }}></i>Free
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}

                                            {/* Verified success */}
                                            {selected.status === ComplaintStatus.VERIFIED && (
                                                <div style={{ textAlign: 'center', padding: '22px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 10, color: '#34d399', fontWeight: 700 }}>
                                                    <i className="fas fa-circle-check" style={{ fontSize: 26, display: 'block', marginBottom: 7 }}></i>
                                                    {t.verified_msg}
                                                </div>
                                            )}

                                        </div>
                                    </div>

                                ) : (
                                    /* Empty state */
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: '#1f2937' }}>
                                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="fas fa-hand-pointer" style={{ fontSize: 22 }}></i>
                                        </div>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{t.select_complaint_action}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.13); }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
