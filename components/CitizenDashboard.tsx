import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Role, User, Language, Complaint, ComplaintStatus, Priority } from '../types';
import { TRANSLATIONS, STATUS_COLORS } from '../constants';
import MapComponent from './MapComponent';
import { analyzeComplaint, findDuplicateIncident, extractVoiceReport } from '../services/geminiService';
import { calculateDistance } from '../utils/geoUtils';
import ChatBot from './ChatBot';
import { formatDuration } from '../utils/timeUtils';
import CivicRewardsTab from './CivicRewardsTab';
import { computeRewards } from '../utils/civicRewards';

interface Props {
    user: User;
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    addComplaint: (c: Complaint) => void;
    submitFeedback: (complaintId: string, rating: number, comments?: string) => void;
    updateUserAvatar: (avatarData: string) => void;
    onLogout: () => void;
}

const CitizenDashboard: React.FC<Props> = ({ user, lang, setLang, complaints, addComplaint, submitFeedback, updateUserAvatar, onLogout }) => {
    const [view, setView] = useState<'report' | 'list' | 'rewards'>('report');
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [location, setLocation] = useState({ lat: 13.0827, lng: 80.2707 }); // Default: Chennai
    const [gpsCaptured, setGpsCaptured] = useState(false);
    const [gpsCapturing, setGpsCapturing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // ── Voice drive-by reporting ──
    const [isListening, setIsListening] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');

    // ── Real-time duplicate detection state ──────────────────────────────────
    type DupStatus = 'idle' | 'checking' | 'found' | 'none';
    const [dupStatus, setDupStatus] = useState<DupStatus>('idle');
    const [dupMatch, setDupMatch] = useState<Complaint | null>(null);
    const [dupDismissed, setDupDismissed] = useState(false);
    const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── New-badge toast notification ─────────────────────────────────────────
    const [newBadgeToast, setNewBadgeToast] = useState<string | null>(null);
    const prevEarnedBadgesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const profile = computeRewards(complaints);
        const currentEarned = new Set(profile.badges.filter(b => b.earned).map(b => b.id));
        const prev = prevEarnedBadgesRef.current;

        if (prev.size > 0) {
            // Find newly earned badges since last render
            const newOnes = [...currentEarned].filter(id => !prev.has(id));
            if (newOnes.length > 0) {
                const badge = profile.badges.find(b => b.id === newOnes[0])!;
                setNewBadgeToast(`${badge.icon} You earned the "${badge.name}" badge!`);
                setTimeout(() => setNewBadgeToast(null), 4000);
            }
        }
        prevEarnedBadgesRef.current = currentEarned;
    }, [complaints]);
    
    // ── Voice Input logic ────────────────────────────────────────────────────
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if ('window' in globalThis && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        currentTranscript += event.results[i][0].transcript;
                    }
                }
                if (currentTranscript.trim()) setVoiceTranscript(currentTranscript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = async () => {
                setIsListening(false);
                // When recording ends, extract with Gemini
                setVoiceTranscript((prev) => {
                    if (prev.trim()) {
                        processVoiceToText(prev);
                    }
                    return prev;
                });
            };
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setVoiceTranscript('');
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const processVoiceToText = async (transcript: string) => {
        setIsAnalyzing(true);
        try {
            const parsed = await extractVoiceReport(transcript);
            setTitle(parsed.title || 'Voice Report');
            setDesc(parsed.description || transcript);
        } catch (error) {
            console.error('Failed to parse voice report', error);
            setDesc(transcript);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Feedback state map: complaintId -> { rating, comments }
    const [feedbackState, setFeedbackState] = useState<Record<string, { rating: number; comments: string }>>({});
    
    const t = TRANSLATIONS[lang];

    // Auto-locate on mount — silently update to real GPS
    const captureLocation = () => {
        if (!navigator.geolocation) return;
        setGpsCapturing(true);
        setGpsCaptured(false);
        navigator.geolocation.getCurrentPosition(
            pos => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setGpsCaptured(true);
                setGpsCapturing(false);
            },
            _err => {
                setGpsCapturing(false);
                // Keep default city center; user can retry
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    useEffect(() => { captureLocation(); }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // ── Debounced real-time duplicate check ───────────────────────────────────
    useEffect(() => {
        // Only run when user has typed meaningful content
        if (title.trim().length < 8 || desc.trim().length < 15) {
            setDupStatus('idle');
            setDupMatch(null);
            return;
        }
        if (dupDismissed) return; // user already dismissed the warning

        if (dupTimerRef.current) clearTimeout(dupTimerRef.current);

        dupTimerRef.current = setTimeout(async () => {
            setDupStatus('checking');

            // Step 1: Fast local prefilter — proximity (2 km) only
            const RADIUS_M = 2000;
            const nearby = complaints.filter(c =>
                c.status !== ComplaintStatus.VERIFIED &&
                !c.parentId &&
                calculateDistance(location.lat, location.lng, c.location.lat, c.location.lng) <= RADIUS_M
            );

            if (nearby.length === 0) { setDupStatus('none'); return; }

            // Step 2: AI confirmation (only if local candidates exist)
            try {
                const matchId = await findDuplicateIncident(
                    title.trim(),
                    desc.trim(),
                    nearby.map(c => ({ id: c.id, title: c.title, description: c.description }))
                );
                if (matchId) {
                    const matched = nearby.find(c => c.id === matchId) ?? null;
                    setDupMatch(matched);
                    setDupStatus('found');
                } else {
                    setDupStatus('none');
                }
            } catch {
                setDupStatus('none');
            }
        }, 1500); // 1.5s debounce

        return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, desc]);

    // Reset dismissal when user clears the form
    useEffect(() => {
        if (title === '' && desc === '') {
            setDupDismissed(false);
            setDupStatus('idle');
            setDupMatch(null);
        }
    }, [title, desc]);

    // ── Upvote existing issue (link as duplicate and submit instantly) ─────────
    const handleUpvote = useCallback(async () => {
        if (!dupMatch) return;
        setIsAnalyzing(true);
        setSubmitError('');
        try {
            const base64Data = image ? image.split(',')[1] : undefined;
            const analysis = await analyzeComplaint(title, desc, base64Data, `${location.lat},${location.lng}`);
            const newComplaint: Complaint = {
                id: `C-${Date.now()}`,
                citizenId: user.id,
                citizenEmail: user.email,
                title: title || dupMatch.title,
                description: desc || dupMatch.description,
                image: image || undefined,
                location,
                category: analysis?.category || dupMatch.category || 'General',
                priority: analysis?.priority || dupMatch.priority || Priority.LOW,
                status: ComplaintStatus.SUBMITTED,
                createdAt: Date.now(),
                aiAnalysis: analysis
                    ? { reason: analysis.reason, department: analysis.department, estimatedTime: analysis.estimatedTime, equipmentNeeded: analysis.equipmentNeeded }
                    : undefined,
                parentId: dupMatch.id, // ← Link as duplicate
            };
            await addComplaint(newComplaint);
            setTitle(''); setDesc(''); setImage(null); setGpsCaptured(false);
            setDupStatus('idle'); setDupMatch(null); setDupDismissed(false);
            setView('list');
        } catch (err: any) {
            setSubmitError(err?.message || 'Failed to submit. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    }, [dupMatch, title, desc, image, location, user]);

    const [submitError, setSubmitError] = useState('');

    const handleSubmit = async () => {
        if (!title.trim() || !desc.trim()) return;
        setIsAnalyzing(true);
        setSubmitError('');
        try {
            const base64Data = image ? image.split(',')[1] : undefined;
            const analysis = await analyzeComplaint(title, desc, base64Data, `${location.lat},${location.lng}`);

            // SMART DUPLICATE GROUPING
            let overrideParentId: string | undefined = undefined;
            const twoKm = 2000;
            const candidates = complaints.filter(c => 
                c.status !== ComplaintStatus.VERIFIED && 
                !c.parentId && 
                (!analysis || c.category === analysis.category) &&
                calculateDistance(location.lat, location.lng, c.location.lat, c.location.lng) <= twoKm
            );

            if (candidates.length > 0) {
                const dupId = await findDuplicateIncident(
                    title, 
                    desc, 
                    candidates.map(c => ({ id: c.id, title: c.title, description: c.description }))
                );
                if (dupId) overrideParentId = dupId;
            }

            const newComplaint: Complaint = {
                id: `C-${Date.now()}`,
                citizenId: user.id,
                citizenEmail: user.email,
                title,
                description: desc,
                image: image || undefined,
                location,
                category: analysis?.category || 'General',
                priority: analysis?.priority || Priority.LOW,
                status: ComplaintStatus.SUBMITTED,
                createdAt: Date.now(),
                aiAnalysis: analysis
                    ? { reason: analysis.reason, department: analysis.department, estimatedTime: analysis.estimatedTime, equipmentNeeded: analysis.equipmentNeeded }
                    : undefined,
                parentId: overrideParentId,
            };
            await addComplaint(newComplaint);  // ← await ensures state updates before view switch
            setTitle(''); setDesc(''); setImage(null); setGpsCaptured(false);
            setView('list');
        } catch (err: any) {
            setSubmitError(err?.message || 'Failed to submit complaint. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const priorityBadgeClass = (p: Priority) => {
        if (p === Priority.EMERGENCY) return 'badge badge-emergency';
        if (p === Priority.HIGH) return 'badge badge-high';
        if (p === Priority.MEDIUM) return 'badge badge-medium';
        return 'badge badge-low';
    };

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
        <div className="citizen-bg pb-24">
            {/* ── New Badge Toast ── */}
            {newBadgeToast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-bounce-in">
                    <div className="flex items-center gap-3 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 text-sm font-bold backdrop-blur-md">
                        <i className="fas fa-trophy text-amber-400"></i>
                        <span>{newBadgeToast}</span>
                        <button onClick={() => setNewBadgeToast(null)} className="ml-2 text-white/60 hover:text-white">
                            <i className="fas fa-xmark"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <header className="dash-header dash-header-citizen">
                <div className="flex items-center gap-3">
                    <label className="relative cursor-pointer group">
                        <div className="w-10 h-10 shadow-sm rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <i className="fas fa-user text-indigo-400 text-lg"></i>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fas fa-camera text-white text-xs"></i>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    <div>
                        <h1 style={{ fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
                            <i className="fas fa-leaf mr-2 opacity-90" />
                            {t.app_name}
                        </h1>
                        <div className="citizen-greeting mt-1" style={{ display: 'inline-flex' }}>
                            <span>{user.name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.location.hash = '#/about'}
                        className="text-white/90 hover:text-white text-[15px] font-medium transition-colors border border-white/20 bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-full mr-1"
                        title="About Us"
                    >
                        <i className="fas fa-hand-holding-heart mr-1.5" />
                        <span className="text-xs">About Us</span>
                    </button>
                    <button
                        onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                        className="lang-toggle"
                    >
                        <i className="fas fa-language text-xs" />
                        {lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>
                    <button
                        onClick={onLogout}
                        className="text-white/80 hover:text-white text-sm font-medium transition-colors"
                        title="Logout"
                    >
                        <i className="fas fa-right-from-bracket" />
                    </button>
                </div>
            </header>

            <main className="p-4 max-w-lg mx-auto space-y-4">
                {view === 'rewards' ? (
                    <CivicRewardsTab complaints={complaints} userName={user.name} />
                ) : view === 'report' ? (
                    <div className="fade-in-up space-y-4">
                        {/* Section title & Voice Mic Feature */}
                        <div className="flex items-center justify-between">
                            <div className="citizen-section-title">
                                <span className="title-icon"><i className="fas fa-circle-plus" /></span>
                                {t.report_complaint}
                            </div>
                            
                            <button 
                                onClick={toggleListening}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border ${
                                    isListening 
                                    ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-red-500/30' 
                                    : 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 shadow-indigo-500/10'
                                }`}
                                title="Drive-by voice reporting"
                            >
                                <i className={`fas ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                                {isListening ? 'Listening...' : 'Voice Report'}
                            </button>
                        </div>

                        {/* Processing Voice Overlay */}
                        {isListening && (
                            <div className="citizen-form-section flex items-center justify-center p-4 bg-red-50 border-red-200 animate-pulse">
                                <div className="text-red-600 font-semibold text-sm flex items-center gap-2">
                                    <i className="fas fa-microphone-lines"></i>
                                    Recording: Speak clearly to report the issue...
                                </div>
                            </div>
                        )}

                        {/* ─── STEP 1: Title ─── */}
                        <div className="citizen-form-section space-y-3">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="citizen-step">1</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.complaint_title}</span>
                            </div>
                            <input
                                className="citizen-input"
                                placeholder={t.complaint_title_placeholder}
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        {/* ─── STEP 2: Description ─── */}
                        <div className="citizen-form-section space-y-3">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="citizen-step">2</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.description}</span>
                            </div>
                            <textarea
                                className="citizen-input min-h-[90px] resize-y"
                                placeholder={t.description_placeholder}
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                            />
                        </div>

                        {/* ─── DUPLICATE DETECTION BANNER ─── */}
                        {dupStatus === 'checking' && title.trim().length >= 8 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 animate-pulse">
                                <i className="fas fa-circle-notch fa-spin text-amber-500"></i>
                                <span className="font-medium">Checking for similar reports nearby…</span>
                            </div>
                        )}

                        {dupStatus === 'found' && dupMatch && !dupDismissed && (
                            <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-50 overflow-hidden shadow-md">
                                {/* Header */}
                                <div className="flex items-center gap-2 px-4 py-3 bg-amber-400/20">
                                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                                        <i className="fas fa-triangle-exclamation text-white text-xs"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-amber-900 text-sm">Similar issue already reported!</p>
                                        <p className="text-[11px] text-amber-700">Someone nearby reported the same problem</p>
                                    </div>
                                    <button
                                        onClick={() => { setDupDismissed(true); setDupStatus('idle'); }}
                                        className="text-amber-500 hover:text-amber-700 transition-colors ml-1"
                                    >
                                        <i className="fas fa-xmark text-sm"></i>
                                    </button>
                                </div>

                                {/* Matched complaint preview */}
                                <div className="px-4 py-3 bg-white/60 border-t border-amber-200">
                                    <div className="flex items-start gap-3">
                                        {dupMatch.image ? (
                                            <img src={dupMatch.image} alt="Existing" className="w-14 h-14 rounded-xl object-cover border border-amber-200 flex-shrink-0" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-image text-amber-400"></i>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{dupMatch.title}</p>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{dupMatch.description}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                                                <span><i className="fas fa-tag mr-1 text-green-600"></i>{dupMatch.category}</span>
                                                <span><i className="fas fa-map-marker-alt mr-1 text-red-400"></i>
                                                    {Math.round(calculateDistance(location.lat, location.lng, dupMatch.location.lat, dupMatch.location.lng))}m away
                                                </span>
                                                <span className="font-semibold" style={{ color: dupMatch.status === ComplaintStatus.VERIFIED ? '#16a34a' : '#d97706' }}>
                                                    <i className="fas fa-circle-half-stroke mr-1"></i>{dupMatch.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CTAs */}
                                <div className="px-4 py-3 flex gap-2 border-t border-amber-200 bg-amber-50/80">
                                    <button
                                        onClick={handleUpvote}
                                        disabled={isAnalyzing}
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        {isAnalyzing
                                            ? <><i className="fas fa-spinner fa-spin"></i> Submitting…</>
                                            : <><i className="fas fa-thumbs-up"></i> Yes, upvote this issue</>
                                        }
                                    </button>
                                    <button
                                        onClick={() => { setDupDismissed(true); setDupStatus('idle'); }}
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold py-2 rounded-xl border border-slate-200 transition-all"
                                    >
                                        <i className="fas fa-circle-xmark mr-1 text-slate-400"></i> No, mine is different
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ─── STEP 3: Photo ─── */}
                        <div className="citizen-form-section space-y-3">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="citizen-step">3</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.upload_image}</span>
                                <span className="text-xs text-slate-400 ml-1 px-2 py-0.5 bg-slate-100 rounded-full">{t.optional}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="citizen-upload-zone flex-1">
                                    <i className="fas fa-camera" />
                                    {image ? t.change_photo : t.upload_photo}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                                {image && (
                                    <div className="relative">
                                        <img src={image} alt="Preview" className="h-16 w-16 rounded-xl object-cover shadow-md border-2 border-green-200" />
                                        <button
                                            onClick={() => setImage(null)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
                                        >×</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── STEP 4: Location (Map) ─── */}
                        <div className="citizen-form-section p-0 overflow-hidden">
                            <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                                <span className="citizen-step">4</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.issue_location}</span>
                            </div>

                            {/* GPS Badge + re-detect */}
                            <div className="px-4 py-2 flex items-center justify-between">
                                <div className={`gps-badge-green ${gpsCapturing ? 'capturing' : ''}`}>
                                    <span className={`gps-dot ${gpsCapturing ? 'capturing' : ''}`} style={{ background: gpsCapturing ? '#2563eb' : '#16a34a' }} />
                                    {gpsCapturing
                                        ? t.gps_capturing
                                        : gpsCaptured
                                            ? t.gps_captured
                                            : t.detecting_location}
                                </div>
                                <button
                                    onClick={captureLocation}
                                    disabled={gpsCapturing}
                                    className="text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-60"
                                    style={{ color: '#16a34a' }}
                                >
                                    <i className={`fas ${gpsCapturing ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`} />
                                    {gpsCapturing ? t.locating : t.re_detect_gps}
                                </button>
                            </div>

                            {/* Manual coordinate override */}
                            <div className="px-4 pb-2 flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t.latitude}</label>
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={location.lat}
                                        onChange={e => setLocation(l => ({ ...l, lat: parseFloat(e.target.value) || l.lat }))}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-green-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t.longitude}</label>
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={location.lng}
                                        onChange={e => setLocation(l => ({ ...l, lng: parseFloat(e.target.value) || l.lng }))}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-green-400"
                                    />
                                </div>
                            </div>

                            {/* Hint */}
                            <p className="px-4 pb-2 text-[11px] text-slate-400">
                                <i className="fas fa-hand-pointer mr-1" style={{ color: '#16a34a' }} />
                                {t.drag_pin_hint}
                            </p>

                            {/* Map */}
                            <div className="h-52 relative citizen-map-border mx-3 mb-3">
                                <MapComponent
                                    center={location}
                                    zoom={15}
                                    interactive={true}
                                    onLocationChange={loc => { setLocation(loc); setGpsCaptured(true); }}
                                />
                            </div>
                        </div>

                        {/* Submit Error */}
                        {submitError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                                <i className="fas fa-triangle-exclamation mt-0.5 flex-shrink-0" />
                                <span>{submitError}</span>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            onClick={handleSubmit}
                            disabled={isAnalyzing || !title.trim() || !desc.trim()}
                            className="btn-citizen"
                        >
                            {isAnalyzing
                                ? <span className="flex items-center justify-center gap-2"><span className="spinner" />{t.analyzing}</span>
                                : <span><i className="fas fa-paper-plane mr-2" />{t.submit}</span>
                            }
                        </button>
                    </div>
                ) : (
                    <div className="fade-in-up space-y-3">
                        {/* Section title */}
                        <div className="citizen-section-title">
                            <span className="title-icon"><i className="fas fa-list-check" /></span>
                            {t.my_complaints}
                        </div>

                        {complaints.length === 0 && (
                            <div className="citizen-empty">
                                <div className="citizen-empty-icon">
                                    <i className="fas fa-inbox" />
                                </div>
                                <p className="font-semibold text-slate-600 mb-1">{t.no_complaints}</p>
                                <p className="text-sm text-slate-400">{t.submit_first}</p>
                            </div>
                        )}

                        {complaints.map((c: Complaint) => (
                            <div key={c.id} className="citizen-card slide-in-right">
                                <div className="flex justify-between items-start mb-2 pl-3">
                                    <div className="flex items-center gap-2 pr-3 flex-1 break-words pb-1">
                                        {user.avatar ? (
                                            <img src={user.avatar} className="w-6 h-6 rounded-full object-cover shadow-sm bg-white border border-slate-200" alt="Citizen Avatar" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-[10px] font-bold shadow-sm border border-slate-200">
                                                <i className="fas fa-user-circle" />
                                            </div>
                                        )}
                                        <h3 className="font-bold text-slate-800 text-sm leading-snug">
                                            {c.title}
                                        </h3>
                                    </div>
                                    <span className={priorityBadgeClass(c.priority)}>{c.priority}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-3 pl-3">{c.description}</p>

                                <div className="pl-3 flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <i className="fas fa-tag" style={{ color: '#16a34a' }} /> {c.category}
                                    </span>
                                    <span className={`font-semibold ${STATUS_COLORS[c.parentId ? complaints.find(p => p.id === c.parentId)?.status || c.status : c.status] || 'text-slate-600'}`}>
                                        <i className="fas fa-circle-half-stroke mr-1" />
                                        {c.parentId ? complaints.find(p => p.id === c.parentId)?.status || c.status : c.status}
                                    </span>
                                </div>

                                {c.adminComment && (
                                    <div className="mt-3 ml-3 p-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg">
                                        <strong>{t.admin_note}</strong> {c.adminComment}
                                    </div>
                                )}
                                {c.status === ComplaintStatus.VERIFIED && c.resolvedAt ? (
                                    <div className="mt-2 ml-3 inline-flex items-center gap-2 px-2.5 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-bold border border-green-200">
                                        <i className="fas fa-check-circle" />
                                        Resolved in {formatDuration(c.resolvedAt - c.createdAt)}
                                    </div>
                                ) : c.aiAnalysis ? (
                                    <div className="mt-2 ml-3 citizen-ai-pill">
                                        <i className="fas fa-robot text-emerald-600" />
                                        <span>{c.aiAnalysis.department}</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="font-bold text-indigo-700">Est. Time: {c.aiAnalysis.estimatedTime}</span>
                                    </div>
                                ) : null}

                                {/* Issue tracking mini-map */}
                                {c.location && (
                                    <div className="h-32 mt-3 ml-3 citizen-map-border relative">
                                        <MapComponent
                                            center={c.location}
                                            markers={[
                                                { position: c.location, title: 'Issue', type: 'complaint' },
                                                ...(c.employeeLocation ? [{ position: c.employeeLocation, title: 'Worker', type: 'employee' as const }] : [])
                                            ]}
                                            zoom={14}
                                        />
                                        {c.employeeLocation && (
                                            <div className="absolute bottom-2 right-2 bg-white px-2 py-1 text-xs rounded-lg shadow font-bold" style={{ color: '#15803d' }}>
                                                <i className="fas fa-clock mr-1" />{t.eta_5min}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Feedback Section for Resolved Complaints */}
                                {c.status === ComplaintStatus.VERIFIED && (
                                    <div className="mt-4 ml-3 p-3 bg-green-50/50 border border-green-100 rounded-xl">
                                        <h4 className="text-xs font-bold text-green-800 mb-2 uppercase tracking-wide">
                                            <i className="fas fa-star text-yellow-500 mr-1" /> Service Feedback
                                        </h4>
                                        {c.feedbackRating ? (
                                            <div className="space-y-1">
                                                <div className="flex gap-1 text-yellow-400 text-sm">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <i key={star} className={`fas fa-star ${star <= c.feedbackRating! ? 'text-yellow-500' : 'text-slate-200'}`} />
                                                    ))}
                                                </div>
                                                {c.feedbackComments && (
                                                    <p className="text-sm text-slate-600 italic mt-2">"{c.feedbackComments}"</p>
                                                )}
                                                <p className="text-xs text-green-600 font-medium mt-1">Thank you for your feedback!</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(star => {
                                                        const currentRating = feedbackState[c.id]?.rating || 0;
                                                        return (
                                                            <button
                                                                key={star}
                                                                onClick={() => setFeedbackState(prev => ({ ...prev, [c.id]: { ...prev[c.id], rating: star } }))}
                                                                className={`text-xl transition-all hover:scale-110 ${star <= currentRating ? 'text-yellow-500' : 'text-slate-200 hover:text-yellow-300'}`}
                                                            >
                                                                <i className="fas fa-star" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <textarea
                                                    placeholder="Optional comments about the service..."
                                                    className="w-full bg-white border border-green-200 rounded-lg p-2 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 resize-none min-h-[60px]"
                                                    value={feedbackState[c.id]?.comments || ''}
                                                    onChange={e => setFeedbackState(prev => ({ ...prev, [c.id]: { ...prev[c.id], comments: e.target.value } }))}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const state = feedbackState[c.id];
                                                        if (state?.rating) {
                                                            submitFeedback(c.id, state.rating, state.comments);
                                                        }
                                                    }}
                                                    disabled={!feedbackState[c.id]?.rating}
                                                    className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                                >
                                                    Submit Feedback
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Bottom Nav — green active */}
            <div className="bottom-nav citizen-bottom-nav">
                <button onClick={() => setView('report')} className={view === 'report' ? 'active' : ''}>
                    <i className="fas fa-circle-plus text-xl" />
                    <span>{t.report_complaint}</span>
                </button>
                <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''}>
                    <i className="fas fa-list-check text-xl" />
                    <span>{t.my_complaints}</span>
                </button>
                <button onClick={() => setView('rewards')} className={view === 'rewards' ? 'active' : ''}
                    style={view === 'rewards' ? { color: '#f59e0b' } : {}}>
                    <i className="fas fa-trophy text-xl" />
                    <span>Rewards</span>
                </button>
            </div>

            <ChatBot userLocation={location} />
        </div>
    );
};

export default CitizenDashboard;
