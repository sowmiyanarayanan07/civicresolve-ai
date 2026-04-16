import React, { useState, useEffect } from 'react';
import { Complaint, ComplaintStatus, Language, Location, Priority } from '../types';
import { TRANSLATIONS } from '../constants';
import MapComponent from './MapComponent';
import { verifyResolution } from '../services/geminiService';

interface Props {
    user: { id: string; name: string; avatar?: string };
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    updateStatus: (id: string, status: ComplaintStatus) => void;
    updateLocation: (id: string, loc: Location) => void;
    completeTask: (id: string, proofImage: string, aiVerification?: { isResolved: boolean; reason: string }) => void;
    updateUserAvatar: (avatarData: string) => void;
    crisisMode: boolean;
    onLogout: () => void;
}

const EmployeeDashboard: React.FC<Props> = ({ user, lang, setLang, complaints, updateStatus, updateLocation, completeTask, updateUserAvatar, crisisMode, onLogout }) => {
    const [activeTask, setActiveTask] = useState<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<Location>({ lat: 12.975, lng: 80.25 });
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [tab, setTab] = useState<'active' | 'completed'>('active');
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

    const submitCompletion = async () => {
        if (activeTask && proofImage) {
            const activeComplaint = complaints.find(c => c.id === activeTask);
            if (!activeComplaint) return;

            setIsVerifying(true);
            setVerificationError(null);
            
            try {
                const verification = await verifyResolution(proofImage, activeComplaint.description, activeComplaint.image);
                if (verification) {
                    if (!verification.isResolved) {
                        setVerificationError(verification.reason || "The AI detected that the issue is not fully resolved. Please submit a clearer photo or complete the task.");
                        setIsVerifying(false);
                        return; // Block submission
                    }
                    completeTask(activeTask, proofImage, verification);
                } else {
                    // Precaution in case of API failure - proceed but without AI verification mark
                    setVerificationError("AI verification service unavailable. Please try again or contact Admin.");
                    setIsVerifying(false);
                    return;
                }
            } catch (error) {
                setVerificationError("Error communicating with AI verification service.");
                setIsVerifying(false);
                return;
            }

            setActiveTask(null);
            setProofImage(null);
            setTaskStatus(null);
            setIsVerifying(false);
        }
    };

    const statusSteps: ComplaintStatus[] = [ComplaintStatus.ON_THE_WAY, ComplaintStatus.REACHED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.JOB_COMPLETED];
    const getProgressPct = (s: ComplaintStatus | null) => {
        if (!s) return 0;
        const idx = statusSteps.indexOf(s);
    const getProgressPct = (s: ComplaintStatus | null) => {
        if (!s) return 0;
        const idx = statusSteps.indexOf(s);
        return idx === -1 ? 0 : Math.round(((idx + 1) / statusSteps.length) * 100);
    };

    const activeTasks = complaints.filter(c =>
        c.status !== ComplaintStatus.VERIFIED && !c.parentId
    );
    
    const completedTasks = complaints.filter(c => 
        c.status === ComplaintStatus.VERIFIED && !c.parentId
    );

    const visibleTasks = tab === 'active' ? activeTasks : completedTasks;

    const activeComplaint = complaints.find(c => c.id === activeTask);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                updateUserAvatar(base64);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    return (
        <div className={`min-h-screen ${crisisMode ? 'bg-zinc-950' : 'bg-gradient-to-br from-slate-50 to-emerald-50'}`}>
            {/* Offline Banner */}
            {!isOnline && <div className="offline-banner">{t.offline_banner}</div>}

            {/* Header */}
            <header className={`dash-header ${crisisMode ? 'dash-header-crisis' : 'dash-header-employee'}`}>
                <div className="flex items-center gap-3">
                    <label className="relative cursor-pointer group">
                        <div className="w-10 h-10 shadow-sm rounded-full bg-emerald-100 border border-emerald-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <i className="fas fa-user-hard-hat text-emerald-500 text-lg"></i>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fas fa-camera text-white text-xs"></i>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    <div>
                        <h1 style={{ fontFamily: 'Space Grotesk' }}>
                            {crisisMode
                                ? <><i className="fas fa-shield-virus mr-2 text-red-300"></i>Crisis Response</>
                                : <><i className="fas fa-hard-hat mr-2 text-emerald-300"></i>{t.workforce_app}</>
                            }
                        </h1>
                        <p className="text-xs text-emerald-200 mt-0.5">{user.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.location.hash = '#/community'}
                        className="text-white/90 hover:text-white text-[15px] font-medium transition-colors border border-white/20 bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-full mr-1"
                        title="Community Hub"
                    >
                        <i className="fas fa-people-group mr-1.5" />
                        <span className="text-xs">Community</span>
                    </button>
                    <button
                        onClick={() => window.location.hash = '#/about'}
                        className="text-white/90 hover:text-white text-[15px] font-medium transition-colors border border-white/20 bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-full mr-1"
                        title="About Us"
                    >
                        <i className="fas fa-hand-holding-heart mr-1.5" />
                        <span className="text-xs">About Us</span>
                    </button>
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
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs text-slate-500">{activeComplaint.category}</p>
                                    {activeComplaint.aiAnalysis && (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                                            Est: {activeComplaint.aiAnalysis.estimatedTime}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className={`badge ${activeComplaint.priority === 'Emergency' ? 'badge-emergency' : activeComplaint.priority === 'High' ? 'badge-high' : activeComplaint.priority === 'Medium' ? 'badge-medium' : 'badge-low'}`}>{activeComplaint.priority}</span>
                        </div>

                        {/* Equipment Needed */}
                        {activeComplaint.aiAnalysis?.equipmentNeeded && activeComplaint.aiAnalysis.equipmentNeeded.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide"><i className="fas fa-toolbox mr-1"></i> Required Gear / Resources</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {activeComplaint.aiAnalysis.equipmentNeeded.map((eq, i) => (
                                        <span key={i} className="text-[11px] bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md shadow-sm font-medium">
                                            {eq}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

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

                        {/* Status Buttons & Proof Upload - Hidden if Job Completed */}
                        {taskStatus === ComplaintStatus.JOB_COMPLETED ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                <i className="fas fa-check-circle text-3xl text-emerald-500 mb-2"></i>
                                <p className="font-bold text-emerald-800 text-sm mb-1">Submitted for Verification</p>
                                <p className="text-xs text-emerald-600">The Admin is currently reviewing your completed work. You will be notified once verified.</p>
                            </div>
                        ) : (
                            <>
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
                                            <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} disabled={isVerifying} />
                                        </label>
                                        {proofImage && <img src={proofImage} alt="Proof" className="h-12 w-12 rounded-xl object-cover shadow" />}
                                    </div>

                                    {verificationError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mb-2">
                                            <i className="fas fa-robot mr-1 text-red-600"></i>
                                            <strong>AI Verification Failed:</strong> {verificationError}
                                        </div>
                                    )}

                                    <button onClick={submitCompletion}
                                        className={`btn-primary ${proofImage ? 'btn-success' : 'opacity-50 cursor-not-allowed'}`}
                                        disabled={!proofImage || isVerifying}>
                                        {isVerifying ? (
                                            <><i className="fas fa-spinner fa-spin mr-2"></i> AI verifying...</>
                                        ) : (
                                            <><i className="fas fa-check-circle mr-2"></i> {t.submit_verification}</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        <button onClick={() => setActiveTask(null)} className="w-full text-center text-red-500 text-sm font-medium hover:text-red-700 transition-colors">
                            <i className="fas fa-arrow-left mr-1"></i> {t.back_to_tasks}
                        </button>
                    </div>
                </div>
            ) : (
                /* ---- TASK LIST ---- */
                <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
                    <div className="flex items-center justify-between">
                        <h2 className={`font-bold ${crisisMode ? 'text-red-300' : 'text-slate-700'}`} style={{ fontFamily: 'Space Grotesk' }}>
                            {crisisMode ? '🚨 Emergency Tasks' : 'My Schedule'}
                        </h2>
                        <span className={`text-xs px-2.5 py-1.5 rounded-full font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            <i className={`fas fa-circle text-[8px] mr-1 ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}></i>
                            {isOnline ? t.online : t.offline}
                        </span>
                    </div>

                    <div className="flex gap-2 mb-4 bg-slate-200/50 p-1.5 rounded-xl border border-slate-200 shadow-inner">
                        <button onClick={() => setTab('active')} 
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${tab === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-indigo-500'}`}>
                            <i className="fas fa-list-check mr-1.5"></i> {t.active_tasks} ({activeTasks.length})
                        </button>
                        <button onClick={() => setTab('completed')} 
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${tab === 'completed' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-emerald-600'}`}>
                            <i className="fas fa-check-double mr-1.5"></i> Completed ({completedTasks.length})
                        </button>
                    </div>

                    {visibleTasks.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                            {tab === 'active' ? (
                                <>
                                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="fas fa-umbrella-beach text-3xl text-emerald-400"></i>
                                    </div>
                                    <p className="font-bold text-slate-700">{t.all_caught_up}</p>
                                    <p className="text-xs text-slate-500 mt-1">{t.no_pending_tasks}</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="fas fa-wind text-3xl text-slate-300"></i>
                                    </div>
                                    <p className="font-bold text-slate-700">No History Yet</p>
                                    <p className="text-xs text-slate-500 mt-1">You haven't completed any tasks.</p>
                                </>
                            )}
                        </div>
                    )}

                    {visibleTasks.map(c => (
                        <div key={c.id} className={crisisMode ? 'task-card-crisis fade-in-up' : 'task-card fade-in-up'} style={crisisMode ? undefined : {
                            '--tw-border-left-color': c.priority === Priority.EMERGENCY ? '#dc2626' : c.priority === 'High' ? '#ea580c' : '#059669',
                            opacity: tab === 'completed' ? 0.75 : 1
                        } as React.CSSProperties}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-3">
                                    <h3 className={`font-bold ${crisisMode ? 'text-red-200' : 'text-slate-800'}`}>{c.title}</h3>
                                    <p className={`text-xs mt-0.5 ${crisisMode ? 'text-red-400/70' : 'text-slate-500'}`}>{c.category}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`badge ${c.priority === 'Emergency' ? 'badge-emergency' : c.priority === 'High' ? 'badge-high' : c.priority === 'Medium' ? 'badge-medium' : 'badge-low'}`}>
                                        {c.priority}
                                    </span>
                                    {crisisMode && <span className="crisis-task-badge"><i className="fas fa-triangle-exclamation"></i>CRISIS</span>}
                                </div>
                            </div>
                            <p className={`text-sm mb-3 line-clamp-2 ${crisisMode ? 'text-red-300/70' : 'text-slate-500'}`}>{c.description}</p>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                <span className={`text-[11px] font-medium flex items-center ${crisisMode ? 'text-red-400/60' : 'text-slate-400'}`}>
                                    <i className={`fas fa-map-marker-alt mr-1.5 ${crisisMode ? 'text-red-500' : 'text-indigo-400'}`}></i>
                                    {c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}
                                </span>
                                {tab === 'active' ? (
                                    <button
                                        onClick={() => { 
                                            setActiveTask(c.id); 
                                            if (c.status === ComplaintStatus.ASSIGNED || c.status === ComplaintStatus.SUBMITTED) {
                                                updateStatus(c.id, ComplaintStatus.ON_THE_WAY); 
                                                setTaskStatus(ComplaintStatus.ON_THE_WAY); 
                                            } else {
                                                setTaskStatus(c.status as ComplaintStatus);
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                                            c.status === ComplaintStatus.JOB_COMPLETED
                                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200/50'
                                                : crisisMode
                                                    ? 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/50'
                                                    : c.status !== ComplaintStatus.ASSIGNED && c.status !== ComplaintStatus.SUBMITTED
                                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50'
                                        }`}>
                                        {c.status === ComplaintStatus.JOB_COMPLETED ? (
                                            <><i className="fas fa-hourglass-half"></i> Pending Review</>
                                        ) : c.status !== ComplaintStatus.ASSIGNED && c.status !== ComplaintStatus.SUBMITTED ? (
                                            <><i className="fas fa-play"></i> Resume Task</>
                                        ) : (
                                            <><i className="fas fa-play"></i> {crisisMode ? 'Respond' : t.start_task}</>
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                                        <i className="fas fa-check-circle mr-1"></i> Verified
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;
