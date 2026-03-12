import React, { useState, useEffect } from 'react';
import { Complaint, ComplaintStatus, Language, Location, Priority } from '../types';
import { TRANSLATIONS } from '../constants';
import MapComponent from './MapComponent';

interface Props {
    user: { id: string; name: string };
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    updateStatus: (id: string, status: ComplaintStatus) => void;
    updateLocation: (id: string, loc: Location) => void;
    completeTask: (id: string, proofImage: string) => void;
    onLogout: () => void;
}

const EmployeeDashboard: React.FC<Props> = ({ user, lang, setLang, complaints, updateStatus, updateLocation, completeTask, onLogout }) => {
    const [activeTask, setActiveTask] = useState<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<Location>({ lat: 12.975, lng: 80.25 });
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [taskStatus, setTaskStatus] = useState<ComplaintStatus | null>(null);
    const t = TRANSLATIONS[lang];

    // Online/Offline detection
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, []);

    // GPS tracking simulation when task is active
    useEffect(() => {
        if (!activeTask) return;
        const task = complaints.find(c => c.id === activeTask);
        if (!task) return;

        // Try real GPS first, then simulate
        let watchId: number | null = null;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                pos => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setCurrentLocation(loc);
                    updateLocation(activeTask, loc);
                },
                () => {
                    // Fallback: simulate movement toward task
                    const interval = setInterval(() => {
                        setCurrentLocation(prev => {
                            const newLoc = {
                                lat: prev.lat + (task.location.lat - prev.lat) * 0.12,
                                lng: prev.lng + (task.location.lng - prev.lng) * 0.12,
                            };
                            updateLocation(activeTask, newLoc);
                            return newLoc;
                        });
                    }, 2500);
                    return () => clearInterval(interval);
                },
                { enableHighAccuracy: true }
            );
        }
        return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
    }, [activeTask]);

    const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onloadend = () => setProofImage(reader.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const submitCompletion = () => {
        if (activeTask && proofImage) {
            completeTask(activeTask, proofImage);
            setActiveTask(null);
            setProofImage(null);
            setTaskStatus(null);
        }
    };

    const statusSteps: ComplaintStatus[] = [ComplaintStatus.ON_THE_WAY, ComplaintStatus.REACHED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.JOB_COMPLETED];
    const getProgressPct = (s: ComplaintStatus | null) => {
        if (!s) return 0;
        const idx = statusSteps.indexOf(s);
        return idx === -1 ? 0 : Math.round(((idx + 1) / statusSteps.length) * 100);
    };

    const assignedComplaints = complaints.filter(c =>
        c.status !== ComplaintStatus.VERIFIED
    );

    const activeComplaint = complaints.find(c => c.id === activeTask);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
            {/* Offline Banner */}
            {!isOnline && <div className="offline-banner">{t.offline_banner}</div>}

            {/* Header */}
            <header className="dash-header dash-header-employee">
                <div>
                    <h1 style={{ fontFamily: 'Space Grotesk' }}>
                        <i className="fas fa-hard-hat mr-2 text-emerald-300"></i>{t.workforce_app}
                    </h1>
                    <p className="text-xs text-emerald-200 mt-0.5">{user.name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} className="lang-toggle">
                        <i className="fas fa-language text-xs"></i>
                        {lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>
                    <button onClick={onLogout} className="text-white/80 hover:text-white text-sm">
                        <i className="fas fa-right-from-bracket"></i>
                    </button>
                </div>
            </header>

            {activeTask && activeComplaint ? (
                /* ---- ACTIVE TASK VIEW ---- */
                <div className="flex flex-col h-[calc(100dvh-64px)]">
                    {/* Map */}
                    <div className="flex-1 relative min-h-0">
                        <MapComponent center={currentLocation} zoom={15}
                            markers={[
                                { position: currentLocation, title: 'Me', type: 'employee' },
                                { position: activeComplaint.location, title: 'Job Site', type: 'complaint' },
                            ]} />
                        {/* Live GPS badge */}
                        <div className="absolute top-3 left-3 z-[400] gps-badge">
                            <span className="gps-dot"></span> {t.live_gps_on}
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="bg-white border-t border-slate-100 p-4 space-y-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] overflow-y-auto max-h-[55vh]">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800" style={{ fontFamily: 'Space Grotesk' }}>{activeComplaint.title}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{activeComplaint.category}</p>
                            </div>
                            <span className="badge badge-high">{activeComplaint.priority}</span>
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                <span>{t.task_progress}</span>
                                <span>{getProgressPct(taskStatus)}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${getProgressPct(taskStatus)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                {[t.on_way, t.reached, t.working, t.done].map(s => <span key={s}>{s}</span>)}
                            </div>
                        </div>

                        {/* Navigate Button */}
                        <a href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${activeComplaint.location.lat},${activeComplaint.location.lng}&travelmode=driving`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all text-sm">
                            <i className="fas fa-diamond-turn-right"></i> {t.navigate}
                        </a>

                        {/* Status Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: t.mark_reached, status: ComplaintStatus.REACHED, color: 'bg-orange-500' },
                                { label: t.in_progress_btn, status: ComplaintStatus.IN_PROGRESS, color: 'bg-yellow-500' },
                            ].map(btn => (
                                <button key={btn.status}
                                    onClick={() => { updateStatus(activeTask, btn.status); setTaskStatus(btn.status); }}
                                    className={`${btn.color} text-white py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all`}>
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Proof Upload */}
                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2">{t.proof_completion}</p>
                            <div className="flex gap-2 mb-2">
                                <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl cursor-pointer text-sm text-slate-600 font-medium transition-all">
                                    <i className="fas fa-camera text-slate-400"></i> {t.upload_photo}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                                </label>
                                {proofImage && <img src={proofImage} alt="Proof" className="h-12 w-12 rounded-xl object-cover shadow" />}
                            </div>
                            <button onClick={submitCompletion}
                                className={`btn-primary ${proofImage ? 'btn-success' : 'opacity-50 cursor-not-allowed'}`}
                                disabled={!proofImage}>
                                <i className="fas fa-check-circle mr-2"></i> {t.submit_verification}
                            </button>
                        </div>

                        <button onClick={() => setActiveTask(null)} className="w-full text-center text-red-500 text-sm font-medium hover:text-red-700 transition-colors">
                            <i className="fas fa-arrow-left mr-1"></i> {t.back_to_tasks}
                        </button>
                    </div>
                </div>
            ) : (
                /* ---- TASK LIST ---- */
                <div className="p-4 space-y-4 max-w-lg mx-auto">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-slate-700" style={{ fontFamily: 'Space Grotesk' }}>
                            {t.active_tasks} ({assignedComplaints.length})
                        </h2>
                        <span className={`text-xs px-2.5 py-1.5 rounded-full font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            <i className={`fas fa-circle text-[8px] mr-1 ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}></i>
                            {isOnline ? t.online : t.offline}
                        </span>
                    </div>

                    {assignedComplaints.length === 0 && (
                        <div className="text-center py-20 text-slate-400">
                            <i className="fas fa-check-double text-5xl block mb-4 text-emerald-200"></i>
                            <p className="font-semibold">{t.all_caught_up}</p>
                            <p className="text-sm mt-1">{t.no_pending_tasks}</p>
                        </div>
                    )}

                    {assignedComplaints.map(c => (
                        <div key={c.id} className="task-card fade-in-up" style={{
                            '--tw-border-left-color': c.priority === Priority.EMERGENCY ? '#dc2626' : c.priority === 'High' ? '#ea580c' : '#059669'
                        } as React.CSSProperties}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-3">
                                    <h3 className="font-bold text-slate-800">{c.title}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{c.category}</p>
                                </div>
                                <span className={`badge ${c.priority === 'Emergency' ? 'badge-emergency' : c.priority === 'High' ? 'badge-high' : c.priority === 'Medium' ? 'badge-medium' : 'badge-low'}`}>
                                    {c.priority}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mb-3 line-clamp-2">{c.description}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">
                                    <i className="fas fa-map-marker-alt mr-1 text-red-400"></i>
                                    {c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}
                                </span>
                                <button
                                    onClick={() => { setActiveTask(c.id); updateStatus(c.id, ComplaintStatus.ON_THE_WAY); setTaskStatus(ComplaintStatus.ON_THE_WAY); }}
                                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                                    <i className="fas fa-play"></i> {t.start_task}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;
