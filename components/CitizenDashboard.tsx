import React, { useState, useEffect } from 'react';
import { Role, User, Language, Complaint, ComplaintStatus, Priority } from '../types';
import { TRANSLATIONS, STATUS_COLORS } from '../constants';
import MapComponent from './MapComponent';
import { analyzeComplaint } from '../services/geminiService';
import ChatBot from './ChatBot';

interface Props {
    user: User;
    lang: Language;
    setLang: (l: Language) => void;
    complaints: Complaint[];
    addComplaint: (c: Complaint) => void;
    onLogout: () => void;
}

const CitizenDashboard: React.FC<Props> = ({ user, lang, setLang, complaints, addComplaint, onLogout }) => {
    const [view, setView] = useState<'report' | 'list'>('report');
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [location, setLocation] = useState({ lat: 13.0827, lng: 80.2707 }); // Default: Chennai
    const [gpsCaptured, setGpsCaptured] = useState(false);
    const [gpsCapturing, setGpsCapturing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    const [submitError, setSubmitError] = useState('');

    const handleSubmit = async () => {
        if (!title.trim() || !desc.trim()) return;
        setIsAnalyzing(true);
        setSubmitError('');
        try {
            const base64Data = image ? image.split(',')[1] : undefined;
            const analysis = await analyzeComplaint(title, desc, base64Data, `${location.lat},${location.lng}`);
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
                    ? { reason: analysis.reason, department: analysis.department, estimatedTime: analysis.estimatedTime }
                    : undefined,
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

    return (
        <div className="citizen-bg pb-24">
            {/* ── Header ── */}
            <header className="dash-header dash-header-citizen">
                <div>
                    <h1 style={{ fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
                        <i className="fas fa-leaf mr-2 opacity-90" />
                        {t.app_name}
                    </h1>
                    <div className="citizen-greeting mt-1" style={{ display: 'inline-flex' }}>
                        <i className="fas fa-user-circle" />
                        <span>{user.name}</span>
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
                {view === 'report' ? (
                    <div className="fade-in-up space-y-4">
                        {/* Section title */}
                        <div className="citizen-section-title">
                            <span className="title-icon"><i className="fas fa-circle-plus" /></span>
                            {t.report_complaint}
                        </div>

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
                                    <h3 className="font-bold text-slate-800 text-sm">{c.title}</h3>
                                    <span className={priorityBadgeClass(c.priority)}>{c.priority}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-3 pl-3">{c.description}</p>

                                <div className="pl-3 flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <i className="fas fa-tag" style={{ color: '#16a34a' }} /> {c.category}
                                    </span>
                                    <span className={`font-semibold ${STATUS_COLORS[c.status] || 'text-slate-600'}`}>
                                        <i className="fas fa-circle-half-stroke mr-1" />
                                        {c.status}
                                    </span>
                                </div>

                                {c.adminComment && (
                                    <div className="mt-3 ml-3 p-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg">
                                        <strong>{t.admin_note}</strong> {c.adminComment}
                                    </div>
                                )}
                                {c.aiAnalysis && (
                                    <div className="mt-2 ml-3 citizen-ai-pill">
                                        <i className="fas fa-robot" />
                                        <span>{c.aiAnalysis.department}</span>
                                        <span className="text-slate-400">•</span>
                                        <span>Est: {c.aiAnalysis.estimatedTime}</span>
                                    </div>
                                )}

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
            </div>

            <ChatBot userLocation={location} />
        </div>
    );
};

export default CitizenDashboard;
