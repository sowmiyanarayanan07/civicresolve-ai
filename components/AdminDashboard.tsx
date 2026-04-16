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

    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
        } catch (e: any) {
            setEmpError(e.message || "Failed to fetch employees");
        } finally {
            setLoadingEmployees(false);
        }
    };

    React.useEffect(() => {
        if (selected) {
            const updated = complaints.find(c => c.id === selected.id);
            if (updated) setSelected(updated);
        }
    }, [complaints]);

    const handleSelectComplaint = async (c: Complaint) => {
        setSelected(c);
        setRejectReason('');
        setShowReassign(false);
        setLoadingAvail(true);
        try {
            const avail = await getAvailableEmployees();
            setAvailableEmps(avail);
        } catch (e) {
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
            setEmpError(e.message || "Failed to delete employee");
        }
    };

    const masters = complaints.filter(c => !c.parentId);

    const statsData = [
        { id: 'all', label: t.total, value: masters.length, icon: 'fa-layer-group', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
        { id: 'new', label: t.unassigned_stat, value: masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length, icon: 'fa-inbox', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
        { id: 'verify', label: t.verify_pending, value: masters.filter(c => c.status === ComplaintStatus.JOB_COMPLETED).length, icon: 'fa-hourglass-half', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
        { id: 'critical', label: t.critical, value: masters.filter(c => c.priority === Priority.EMERGENCY || c.priority === Priority.HIGH).length, icon: 'fa-triangle-exclamation', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
        { id: 'resolved', label: t.resolved, value: masters.filter(c => c.status === ComplaintStatus.VERIFIED).length, icon: 'fa-circle-check', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
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

    const priorityDot = (p: Priority) => {
        if (p === Priority.EMERGENCY) return '#ef4444';
        if (p === Priority.HIGH) return '#f97316';
        if (p === Priority.MEDIUM) return '#eab308';
        return '#22c55e';
    };

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0d1117', color: '#e2e8f0', fontFamily: "'DM Sans', system-ui, sans-serif", overflow: 'hidden' }}>

            {/* ── TOP HEADER BAR ── */}
            <header style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px',
                height: 56, background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0, zIndex: 50,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-shield-halved" style={{ fontSize: 14, color: '#fff' }}></i>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.3px' }}>{t.civic_admin}</span>
                    <span style={{ fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px' }}>{t.system_admin}</span>
                </div>

                {/* Stat Pills */}
                <div style={{ display: 'flex', gap: 6, marginLeft: 16, flex: 1, overflowX: 'auto' }}>
                    {statsData.map(s => (
                        <button key={s.id} onClick={() => setTab(s.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: `1px solid ${tab === s.id ? s.border : 'rgba(255,255,255,0.07)'}`,
                                background: tab === s.id ? s.bg : 'rgba(255,255,255,0.03)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                                color: tab === s.id ? s.color : '#94a3b8', fontSize: 12, fontWeight: 600,
                            }}>
                            <i className={`fas ${s.icon}`} style={{ fontSize: 11, color: s.color }}></i>
                            {s.label}
                            <span style={{ background: tab === s.id ? s.color : 'rgba(255,255,255,0.1)', color: tab === s.id ? '#fff' : '#94a3b8', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{s.value}</span>
                        </button>
                    ))}
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Crisis toggle compact */}
                    <button onClick={() => { if (window.confirm(crisisMode ? t.crisis_deactivate_confirm : t.crisis_toggle_confirm)) setCrisisMode(!crisisMode); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8,
                            border: `1px solid ${crisisMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                            background: crisisMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                            color: crisisMode ? '#f87171' : '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                        }}>
                        {crisisMode && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }}></span>}
                        <i className="fas fa-shield-virus" style={{ fontSize: 12 }}></i>
                        {crisisMode ? 'Crisis ON' : t.crisis_mode}
                    </button>

                    <button onClick={() => window.location.hash = '#/about'}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <i className="fas fa-hand-holding-heart" style={{ marginRight: 4 }}></i>About
                    </button>
                    <button onClick={() => window.location.hash = '#/community'}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <i className="fas fa-people-group" style={{ marginRight: 4 }}></i>Community
                    </button>
                    <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <i className="fas fa-language" style={{ marginRight: 4 }}></i>{lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>
                    <button onClick={onLogout}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <i className="fas fa-right-from-bracket" style={{ marginRight: 4 }}></i>{t.logout}
                    </button>
                </div>
            </header>

            {/* ── CRISIS MODE BANNER ── */}
            {crisisMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)', flexShrink: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Crisis Mode Active — Emergency Triage Enabled</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {(['map', 'complaints'] as const).map(v => (
                            <button key={v} onClick={() => setCrisisView(v)}
                                style={{
                                    padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                    background: crisisView === v ? '#ef4444' : 'rgba(239,68,68,0.1)', color: crisisView === v ? '#fff' : '#f87171'
                                }}>
                                {v === 'map' ? <><i className="fas fa-map-location-dot" style={{ marginRight: 4 }}></i>Crisis Map</> : <><i className="fas fa-list-check" style={{ marginRight: 4 }}></i>Emergency List</>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── MAIN BODY ── */}
            {crisisMode && crisisView === 'map' ? (
                <div style={{ flex: 1, overflow: 'hidden' }}><DisasterMap /></div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    {/* ── MAP + ANALYTICS ROW ── */}
                    <div style={{ display: 'flex', height: 190, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {/* Map */}
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            <MapComponent center={{ lat: 12.9716, lng: 80.2433 }} markers={mapMarkers} zoom={12} />
                            <div style={{
                                position: 'absolute', top: 10, left: 10, zIndex: 400,
                                background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px',
                            }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t.live_map}</p>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                                    <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f87171', marginRight: 4 }}></span>{t.complaint_label}</span>
                                    <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#34d399', marginRight: 4 }}></span>{t.employee_label}</span>
                                </div>
                            </div>
                            {/* Priority legend overlay */}
                            <div style={{
                                position: 'absolute', bottom: 10, left: 10, zIndex: 400,
                                background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px',
                                display: 'flex', gap: 10,
                            }}>
                                {[{ label: 'Emergency', color: '#ef4444' }, { label: 'High', color: '#f97316' }, { label: 'Medium', color: '#eab308' }, { label: 'Low', color: '#22c55e' }].map(l => (
                                    <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }}></span>{l.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Analytics strip */}
                        <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: '#161b22' }}>
                            <AnalyticsCharts complaints={masters} />
                        </div>
                    </div>

                    {/* ── THREE-PANEL CONTENT AREA ── */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                        {/* PANEL 1: COMPLAINT LIST */}
                        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#161b22', overflow: 'hidden' }}>
                            {/* Tab row */}
                            <div style={{ display: 'flex', gap: 2, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: '#0d1117' }}>
                                {(['new', 'verify', 'all', 'employees'] as const).map(tb => {
                                    const active = tab === tb;
                                    const label = tb === 'new' ? t.tabs_new : tb === 'verify' ? t.tabs_verify : tb === 'all' ? t.tabs_all : 'Workers';
                                    const badge = tb === 'new' ? masters.filter(c => !c.assignedTo && c.status !== ComplaintStatus.VERIFIED).length : undefined;
                                    return (
                                        <button key={tb} onClick={() => setTab(tb)} style={{
                                            flex: 1, padding: '5px 4px', fontSize: 11, fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                            background: active ? '#6366f1' : 'rgba(255,255,255,0.04)', color: active ? '#fff' : '#6b7280',
                                        }}>
                                            {label}
                                            {badge !== undefined && badge > 0 && (
                                                <span style={{ marginLeft: 4, background: active ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10 }}>{badge}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* List body */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                                {tab !== 'employees' ? (
                                    <>
                                        {filteredComplaints.length === 0 && (
                                            <div style={{ textAlign: 'center', paddingTop: 48, color: '#4b5563' }}>
                                                <i className="fas fa-inbox" style={{ fontSize: 28, display: 'block', marginBottom: 8 }}></i>
                                                <p style={{ fontSize: 13 }}>{t.no_complaints_here}</p>
                                            </div>
                                        )}
                                        {filteredComplaints.map(c => {
                                            const duplicates = complaints.filter(sub => sub.parentId === c.id);
                                            const isSelected = selected?.id === c.id;
                                            return (
                                                <div key={c.id} onClick={() => handleSelectComplaint(c)}
                                                    style={{
                                                        padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                                                        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                                        background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.025)',
                                                    }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: priorityDot(c.priority), flexShrink: 0 }}></span>
                                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                                                        </div>
                                                        {duplicates.length > 0 && (
                                                            <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: 10, padding: '2px 6px', flexShrink: 0 }}>+{duplicates.length}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: 11, color: '#6b7280' }}>{c.category}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            {c.assignedTo && <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}><i className="fas fa-user-check" style={{ marginRight: 3 }}></i>Assigned</span>}
                                                            {c.status === ComplaintStatus.JOB_COMPLETED && <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>Review</span>}
                                                            {c.status === ComplaintStatus.VERIFIED && <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}><i className="fas fa-circle-check" style={{ marginRight: 3 }}></i>Done</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <div style={{ paddingTop: 4 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, padding: '0 2px' }}>Field Workers</p>
                                        {loadingEmployees ? (
                                            <div style={{ textAlign: 'center', paddingTop: 40, color: '#4b5563' }}>
                                                <i className="fas fa-spinner fa-spin" style={{ fontSize: 22, display: 'block', marginBottom: 6 }}></i>
                                                <p style={{ fontSize: 12 }}>Loading...</p>
                                            </div>
                                        ) : (
                                            (employees.length > 0 ? employees : MOCK_EMPLOYEES).map((emp: any) => {
                                                const activeCount = complaints.filter(c =>
                                                    c.assignedTo === emp.id &&
                                                    [ComplaintStatus.SUBMITTED, ComplaintStatus.ASSIGNED, ComplaintStatus.ON_THE_WAY, ComplaintStatus.REACHED, ComplaintStatus.IN_PROGRESS].includes(c.status as any)
                                                ).length;
                                                const busy = activeCount > 0;
                                                return (
                                                    <div key={emp.id} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)', position: 'relative' }}
                                                        className="group">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: busy ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)', border: `1.5px solid ${busy ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: busy ? '#f87171' : '#34d399', flexShrink: 0 }}>
                                                                {emp.name?.[0]?.toUpperCase()}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 1 }}>{emp.name}</p>
                                                                <p style={{ fontSize: 11, color: '#6b7280' }}>{emp.department || emp.specialty}</p>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: busy ? '#f87171' : '#34d399', background: busy ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', padding: '2px 7px', borderRadius: 10 }}>
                                                                    {busy ? `${activeCount} task${activeCount > 1 ? 's' : ''}` : 'Free'}
                                                                </span>
                                                                <button onClick={() => handleDeleteEmployee(emp.id)}
                                                                    style={{ padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                                                                    <i className="fas fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bottom action */}
                            <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <button onClick={async () => { if (window.confirm('Delete ALL complaints permanently? This cannot be undone.')) await clearAllComplaints(); }}
                                    style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                    <i className="fas fa-trash-can" style={{ marginRight: 5 }}></i> Clear All Complaints
                                </button>
                            </div>
                        </div>

                        {/* PANEL 2: ACTION / DETAIL */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d1117' }}>
                            {tab === 'employees' ? (
                                /* ── ADD EMPLOYEE FORM ── */
                                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                                    <div style={{ maxWidth: 640, margin: '0 auto', background: '#161b22', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 28 }}>
                                        <div style={{ marginBottom: 20 }}>
                                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                                                <i className="fas fa-user-plus" style={{ marginRight: 8, color: '#6366f1' }}></i>Register Field Worker
                                            </h3>
                                            <p style={{ fontSize: 13, color: '#6b7280' }}>Add a new field worker to the crisis management system.</p>
                                        </div>

                                        {empError && (
                                            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
                                                <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{empError}
                                            </div>
                                        )}

                                        <form onSubmit={handleAddEmployee}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                                {[
                                                    { label: 'Full Name', value: empName, setter: setEmpName, type: 'text', ph: 'e.g. Ramesh Kumar' },
                                                    { label: 'Email Address', value: empEmail, setter: setEmpEmail, type: 'email', ph: 'worker@civicresolve.in' },
                                                    { label: 'Phone Number', value: empPhone, setter: setEmpPhone, type: 'tel', ph: '9876543210' },
                                                ].map(f => (
                                                    <div key={f.label}>
                                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{f.label}</label>
                                                        <input type={f.type} required value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.ph}
                                                            style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
                                                    </div>
                                                ))}
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Department</label>
                                                    <select required value={empDept} onChange={e => setEmpDept(e.target.value)}
                                                        style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: empDept ? '#e2e8f0' : '#4b5563', outline: 'none', boxSizing: 'border-box' }}>
                                                        <option value="" disabled>Select Department</option>
                                                        <option value="light">Light</option>
                                                        <option value="pothole">Pothole</option>
                                                        <option value="drainage">Drainage</option>
                                                        <option value="water_supply">Water Supply</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button type="submit" disabled={addingEmp}
                                                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: addingEmp ? 'not-allowed' : 'pointer', opacity: addingEmp ? 0.6 : 1 }}>
                                                {addingEmp ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Adding...</> : <><i className="fas fa-plus" style={{ marginRight: 6 }}></i>Register Employee</>}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : selected ? (
                                /* ── COMPLAINT DETAIL ── */
                                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                                    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                                        {/* Header row */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: priorityDot(selected.priority), flexShrink: 0 }}></span>
                                                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{selected.title}</h2>
                                                    <span className={priorityBadgeClass(selected.priority)}>{selected.priority}</span>
                                                </div>
                                                <p style={{ fontSize: 13, color: '#6b7280', marginLeft: 18 }}>{selected.category}</p>
                                            </div>
                                        </div>

                                        {/* Description + image row */}
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{ flex: 1, background: '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                                                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{selected.description}</p>
                                                {selected.aiAnalysis && (
                                                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
                                                        <p style={{ fontSize: 12, color: '#818cf8', marginBottom: 6, fontWeight: 600 }}><i className="fas fa-robot" style={{ marginRight: 5 }}></i>AI Analysis</p>
                                                        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{selected.aiAnalysis.reason}</p>
                                                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                                                            <span style={{ color: '#6b7280' }}><i className="fas fa-building" style={{ marginRight: 4 }}></i>{selected.aiAnalysis.department}</span>
                                                            <span style={{ color: '#818cf8', fontWeight: 600 }}><i className="fas fa-clock" style={{ marginRight: 4 }}></i>{selected.aiAnalysis.estimatedTime}</span>
                                                        </div>
                                                        {selected.aiAnalysis.equipmentNeeded && selected.aiAnalysis.equipmentNeeded.length > 0 && (
                                                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                {selected.aiAnalysis.equipmentNeeded.map((eq, i) => (
                                                                    <span key={i} style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.08)' }}>{eq}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {selected.status === ComplaintStatus.VERIFIED && selected.resolvedAt && (
                                                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 8, fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                                                        <i className="fas fa-check-circle" style={{ marginRight: 5 }}></i>Resolved in {formatDuration(selected.resolvedAt - selected.createdAt)}
                                                    </div>
                                                )}
                                            </div>
                                            {selected.image && (
                                                <a href={selected.image} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, display: 'block' }}>
                                                    <img src={selected.image} alt="Report"
                                                        style={{ width: 180, height: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }} />
                                                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>{t.citizen_photo}</p>
                                                </a>
                                            )}
                                        </div>

                                        {/* Duplicates */}
                                        {(() => {
                                            const dups = complaints.filter(sub => sub.parentId === selected.id);
                                            if (!dups.length) return null;
                                            return (
                                                <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                                        <i className="fas fa-copy" style={{ marginRight: 5, color: '#818cf8' }}></i>Duplicate Reports ({dups.length})
                                                    </p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {dups.map(dup => (
                                                            <div key={dup.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.025)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                {dup.image ? <img src={dup.image} alt="Dup" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}><i className="fas fa-image"></i></div>}
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dup.title}</p>
                                                                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{dup.description}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Verification section */}
                                        {selected.status === ComplaintStatus.JOB_COMPLETED && (
                                            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '16px' }}>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>
                                                    <i className="fas fa-clipboard-check" style={{ marginRight: 6 }}></i>{t.verification_required}
                                                </p>
                                                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                                                    <div style={{ flex: 1 }}>
                                                        {selected.aiVerification && (
                                                            <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${selected.aiVerification.isResolved ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`, background: selected.aiVerification.isResolved ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)', marginBottom: 10 }}>
                                                                <p style={{ fontSize: 12, fontWeight: 700, color: selected.aiVerification.isResolved ? '#34d399' : '#f87171', marginBottom: 4 }}>
                                                                    <i className="fas fa-robot" style={{ marginRight: 5 }}></i>AI Verification {selected.aiVerification.isResolved ? 'Passed' : 'Failed'}
                                                                </p>
                                                                <p style={{ fontSize: 12, color: '#94a3b8' }}>{selected.aiVerification.reason}</p>
                                                            </div>
                                                        )}
                                                        <p style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
                                                            <i className="fas fa-info-circle" style={{ marginRight: 5, color: '#818cf8' }}></i>
                                                            Review the employee proof photo before approving.
                                                        </p>
                                                    </div>
                                                    {selected.completionImage ? (
                                                        <a href={selected.completionImage} target="_blank" rel="noopener noreferrer">
                                                            <img src={selected.completionImage} alt="Proof"
                                                                style={{ width: 140, height: 110, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', flexShrink: 0 }} />
                                                            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 3, textAlign: 'center' }}>{t.employee_proof}</p>
                                                        </a>
                                                    ) : (
                                                        <div style={{ width: 140, height: 110, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0, flexDirection: 'column', gap: 4 }}>
                                                            <i className="fas fa-image-slash" style={{ fontSize: 18 }}></i>
                                                            <span style={{ fontSize: 11 }}>{t.no_image_proof}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <button onClick={() => { adminVerify(selected.id); setSelected(null); }}
                                                        style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                                        <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i>{t.verify_resolve}
                                                    </button>
                                                    <input type="text" placeholder={t.rejection_reason} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                                        style={{ flex: 1, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none' }} />
                                                    <button onClick={() => { if (rejectReason) { adminReject(selected.id, rejectReason); setSelected(null); } }}
                                                        style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                                        {t.reject}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Assigned employee */}
                                        {selected.assignedTo && selected.status !== ComplaintStatus.VERIFIED && (() => {
                                            const emp = [...employees, ...MOCK_EMPLOYEES].find((e: any) => e.id === selected.assignedTo);
                                            if (!emp) return null;
                                            return (
                                                <div style={{ background: '#161b22', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', border: '1.5px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                                                        {emp.name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontSize: 11, color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
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
                                            <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                                        {selected.assignedTo ? <><i className="fas fa-arrows-rotate" style={{ marginRight: 5, color: '#a78bfa' }}></i>Reassign (Admin Override)</> : <><i className="fas fa-user-plus" style={{ marginRight: 5, color: '#34d399' }}></i>{t.assign_employee}</>}
                                                    </p>
                                                    {selected.assignedTo && (
                                                        <button onClick={() => setShowReassign(r => !r)}
                                                            style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${showReassign ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.25)'}`, background: showReassign ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer' }}>
                                                            {showReassign ? 'Cancel' : 'Reassign'}
                                                        </button>
                                                    )}
                                                </div>
                                                {(!selected.assignedTo || showReassign) && (
                                                    loadingAvail ? (
                                                        <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: 12 }}>
                                                            <i className="fas fa-spinner fa-spin" style={{ marginRight: 5 }}></i>Loading available employees...
                                                        </div>
                                                    ) : availableEmps.length === 0 ? (
                                                        <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <i className="fas fa-user-clock" style={{ fontSize: 20, display: 'block', marginBottom: 6, color: '#4b5563' }}></i>
                                                            All employees are currently busy.
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {availableEmps.map((emp: any) => (
                                                                <button key={emp.id}
                                                                    onClick={() => { assignEmployee(selected.id, emp.id); setSelected(prev => prev ? { ...prev, assignedTo: emp.id, status: ComplaintStatus.ASSIGNED } : null); setShowReassign(false); }}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                                                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                                                                        {emp.name?.[0]?.toUpperCase()}
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{emp.name}</p>
                                                                        <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{emp.department || emp.specialty}</p>
                                                                    </div>
                                                                    <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                                                                        <i className="fas fa-circle-check" style={{ marginRight: 4 }}></i>Free
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {selected.status === ComplaintStatus.VERIFIED && (
                                            <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, color: '#34d399', fontWeight: 700 }}>
                                                <i className="fas fa-circle-check" style={{ fontSize: 24, display: 'block', marginBottom: 6 }}></i>
                                                {t.verified_msg}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Empty state */
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: '#374151' }}>
                                    <i className="fas fa-hand-pointer" style={{ fontSize: 36 }}></i>
                                    <p style={{ fontSize: 13, fontWeight: 500 }}>{t.select_complaint_action}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
