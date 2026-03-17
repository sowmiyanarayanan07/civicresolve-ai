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

    const handleSubmit = async () => {
        if (!title.trim() || !desc.trim()) return;
        setIsAnalyzing(true);
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
        addComplaint(newComplaint);
        setIsAnalyzing(false);
        setView('list');
        setTitle(''); setDesc(''); setImage(null); setGpsCaptured(false);
    };

    const priorityBadgeClass = (p: Priority) => {
        if (p === Priority.EMERGENCY) return 'badge badge-emergency';
        if (p === Priority.HIGH) return 'badge badge-high';
        if (p === Priority.MEDIUM) return 'badge badge-medium';
        return 'badge badge-low';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 pb-24">
            {/* Header */}
            <header className="dash-header dash-header-citizen">
                <div>
                    <h1 style={{ fontFamily: 'Space Grotesk' }}>{t.app_name}</h1>
                    <p className="text-xs text-indigo-200 mt-0.5">
                        <i className="fas fa-user-circle mr-1"></i> {user.name}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} className="lang-toggle">
                        <i className="fas fa-language text-xs"></i>
                        {lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>
                    <button onClick={onLogout} className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                        <i className="fas fa-right-from-bracket"></i>
                    </button>
                </div>
            </header>

            <main className="p-4 max-w-lg mx-auto space-y-4">
                {view === 'report' ? (
                    <div className="fade-in-up space-y-4">
                        <h2 className="text-lg font-bold text-slate-700" style={{ fontFamily: 'Space Grotesk' }}>
                            <i className="fas fa-circle-plus text-indigo-500 mr-2"></i>{t.report_complaint}
                        </h2>

                        {/* ─── STEP 1: Title ─── */}
                        <div className="form-section space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.complaint_title}</span>
                            </div>
                            <input
                                className="civic-input"
                                placeholder={t.complaint_title_placeholder}
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        {/* ─── STEP 2: Description ─── */}
                        <div className="form-section space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.description}</span>
                            </div>
                            <textarea
                                className="civic-input min-h-[90px] resize-y"
                                placeholder={t.description_placeholder}
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                            />
                        </div>

                        {/* ─── STEP 3: Photo ─── */}
                        <div className="form-section space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.upload_image}</span>
                                <span className="text-xs text-slate-400">{t.optional}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-indigo-50 border-2 border-dashed border-slate-200 hover:border-indigo-300 p-3 rounded-xl cursor-pointer transition-all text-sm text-slate-600 font-medium">
                                    <i className="fas fa-camera text-indigo-400"></i> {image ? t.change_photo : t.upload_photo}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                                {image && (
                                    <div className="relative">
                                        <img src={image} alt="Preview" className="h-16 w-16 rounded-xl object-cover shadow-md" />
                                        <button
                                            onClick={() => setImage(null)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                        >×</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── STEP 4: Location (Map) — LAST ─── */}
                        <div className="form-section p-0 overflow-hidden">
                            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                                <span className="font-semibold text-slate-700 text-sm">{t.issue_location}</span>
                            </div>

                            {/* GPS Badge + coords */}
                            <div className="px-4 py-2 flex items-center justify-between">
                                <div className={`gps-badge ${gpsCapturing ? 'capturing' : ''}`}>
                                    <span className={`gps-dot ${gpsCapturing ? 'capturing' : ''}`}></span>
                                    {gpsCapturing
                                        ? t.gps_capturing
                                        : gpsCaptured
                                            ? t.gps_captured
                                            : t.detecting_location}
                                </div>
                                <button
                                    onClick={captureLocation}
                                    disabled={gpsCapturing}
                                    className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800 transition-colors disabled:opacity-60"
                                >
                                    <i className={`fas ${gpsCapturing ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`}></i>
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
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t.longitude}</label>
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={location.lng}
                                        onChange={e => setLocation(l => ({ ...l, lng: parseFloat(e.target.value) || l.lng }))}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-400"
                                    />
                                </div>
                            </div>

                            {/* Hint */}
                            <p className="px-4 pb-2 text-[11px] text-slate-400">
                                <i className="fas fa-hand-pointer mr-1 text-indigo-400"></i>
                                {t.drag_pin_hint}
                            </p>

                            {/* Map — draggable pin + click-to-move */}
                            <div className="h-52 relative">
                                <MapComponent
                                    center={location}
                                    zoom={15}
                                    interactive={true}
                                    onLocationChange={loc => { setLocation(loc); setGpsCaptured(true); }}
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={isAnalyzing || !title.trim() || !desc.trim()}
                            className="btn-primary"
                        >
                            {isAnalyzing
                                ? <span className="flex items-center justify-center gap-2"><span className="spinner"></span>{t.analyzing}</span>
                                : <span><i className="fas fa-paper-plane mr-2"></i>{t.submit}</span>
                            }
                        </button>
                    </div>
                ) : (
                    <div className="fade-in-up space-y-3">
                        <h2 className="text-lg font-bold text-slate-700" style={{ fontFamily: 'Space Grotesk' }}>
                            <i className="fas fa-list-check text-indigo-500 mr-2"></i>{t.my_complaints}
                        </h2>

                        {complaints.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                <i className="fas fa-inbox text-5xl mb-4 block text-slate-200"></i>
                                <p className="font-medium">{t.no_complaints}</p>
                                <p className="text-sm">{t.submit_first}</p>
                            </div>
                        )}

                        {complaints.map((c: Complaint) => (
                            <div key={c.id} className="complaint-card slide-in-right">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-800">{c.title}</h3>
                                    <span className={priorityBadgeClass(c.priority)}>{c.priority}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-3">{c.description}</p>

                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <i className="fas fa-tag"></i> {c.category}
                                    </span>
                                    <span className={`font-semibold ${STATUS_COLORS[c.status] || 'text-slate-600'}`}>
                                        Status: {c.status}
                                    </span>
                                </div>

                                {c.adminComment && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg">
                                        <strong>{t.admin_note}</strong> {c.adminComment}
                                    </div>
                                )}
                                {c.aiAnalysis && (
                                    <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs rounded-lg">
                                        <i className="fas fa-robot mr-1"></i>
                                        {c.aiAnalysis.department} • Est: {c.aiAnalysis.estimatedTime}
                                    </div>
                                )}

                                {/* Issue tracking mini-map — always show if location exists */}
                                {c.location && (
                                    <div className="h-32 mt-3 rounded-xl overflow-hidden relative border border-indigo-100">
                                        <MapComponent
                                            center={c.location}
                                            markers={[
                                                { position: c.location, title: 'Issue', type: 'complaint' },
                                                ...(c.employeeLocation ? [{ position: c.employeeLocation, title: 'Worker', type: 'employee' as const }] : [])
                                            ]}
                                            zoom={14}
                                        />
                                        {c.employeeLocation && (
                                            <div className="absolute bottom-2 right-2 bg-white px-2 py-1 text-xs rounded-lg shadow font-bold text-indigo-700">
                                                <i className="fas fa-clock mr-1"></i>{t.eta_5min}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <div className="bottom-nav">
                <button onClick={() => setView('report')} className={view === 'report' ? 'active' : ''}>
                    <i className="fas fa-circle-plus text-xl"></i>
                    <span>{t.report_complaint}</span>
                </button>
                <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''}>
                    <i className="fas fa-list-check text-xl"></i>
                    <span>{t.my_complaints}</span>
                </button>
            </div>

            <ChatBot userLocation={location} />
        </div>
    );
};

export default CitizenDashboard;
