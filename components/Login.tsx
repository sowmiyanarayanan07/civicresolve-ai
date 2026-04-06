import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role, User, Language } from '../types';
import { loginWithOtp } from '../services/authService';
import { sendOtp, verifyOtpAsync } from '../services/otpService';
import { TRANSLATIONS } from '../constants';

type Panel = 'citizen' | 'employee' | 'admin';
type Step = 'email' | 'otp';

interface LoginProps {
    onLogin: (user: User) => void;
    lang: Language;
    setLang: (l: Language) => void;
}

/* ─── OTP Box sub-component ──────────────────────────────────────── */
function OtpBoxes({
    digits, onChange, onKeyDown, onPaste, refs
}: {
    digits: string[];
    onChange: (i: number, v: string) => void;
    onKeyDown: (i: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}) {
    return (
        <div className="flex gap-2 justify-between">
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={el => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => onChange(i, e.target.value)}
                    onKeyDown={e => onKeyDown(i, e)}
                    onPaste={onPaste}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 focus:border-green-500 focus:outline-none transition-all bg-white shadow-sm"
                    style={d ? { borderColor: 'var(--role-color)' } : {}}
                />
            ))}
        </div>
    );
}

/* ─── Panel role → app Role mapping ─────────────────────────────── */
function panelToRole(panel: Panel): Role {
    if (panel === 'employee') return Role.EMPLOYEE;
    if (panel === 'admin') return Role.ADMIN;
    return Role.CITIZEN;
}

/* ─── Single Role Login Panel ────────────────────────────────────── */
function RoleLoginPanel({
    panel, onLogin, lang,
}: {
    panel: Panel;
    onLogin: (user: User) => void;
    lang: Language;
}) {
    const navigate = useNavigate();
    const t = TRANSLATIONS[lang];
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resend, setResend] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Resend countdown
    useEffect(() => {
        if (resend <= 0) return;
        const t = setTimeout(() => setResend(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resend]);

    /* ── helpers ── */
    function startResend() { setResend(60); }

    function handleDigit(i: number, v: string) {
        if (!/^\d*$/.test(v)) return;
        const next = [...digits];
        next[i] = v.slice(-1);
        setDigits(next);
        setError('');
        if (v && i < 5) inputRefs.current[i + 1]?.focus();
    }

    function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[i] && i > 0) {
            inputRefs.current[i - 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').trim();
        if (!/^\d{6}$/.test(pasted)) return;
        setDigits(pasted.split(''));
        setError('');
        inputRefs.current[5]?.focus();
    }

    /* ── Step 1: Send OTP ── */
    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        const trimmed = email.trim().toLowerCase();

        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.'); return;
        }

        setLoading(true);
        try {
            await sendOtp(trimmed, name.trim() || trimmed.split('@')[0]);
            setStep('otp');
            startResend();
            setTimeout(() => inputRefs.current[0]?.focus(), 150);
        } catch (err: any) {
            setError(err.message ?? 'Failed to send OTP. Check your EmailJS setup in .env.local');
        } finally {
            setLoading(false);
        }
    }

    /* ── Step 2: Verify OTP ── */
    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        const code = digits.join('');
        if (code.length !== 6) { setError('Enter all 6 digits.'); return; }

        setLoading(true);
        try {
            const result = await verifyOtpAsync(email.trim().toLowerCase(), code);
            if (!result.valid) {
                let msg = 'Invalid OTP. Try again.';
                if (result.reason === 'expired') msg = 'This OTP has expired. Please resend a new code.';
                if (result.reason === 'not_found') msg = 'OTP not found in database. Did you refresh the page? Please resend a new code.';
                if (result.reason === 'config_missing') msg = 'Deployment Configuration Error: Supabase keys are missing. Please check your GitHub Secrets (VITE_SUPABASE_URL, etc.) or .env.local and redeploy.';
                if (result.reason === 'server_error') msg = 'Server verification error. Please try again.';
                
                setError(msg);
                setLoading(false);
                return;
            }
            const role = panelToRole(panel);
            const user = await loginWithOtp(email.trim().toLowerCase(), name.trim() || undefined, role);
            onLogin(user);
            if (user.role === Role.CITIZEN) navigate('/citizen');
            else if (user.role === Role.EMPLOYEE) navigate('/employee');
            else navigate('/admin');
        } catch (err: any) {
            setError(err.message ?? 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    /* ── Resend ── */
    async function handleResend() {
        if (resend > 0 || loading) return;
        setDigits(['', '', '', '', '', '']);
        setError('');
        setLoading(true);
        try {
            await sendOtp(email.trim().toLowerCase(), name.trim() || email.split('@')[0]);
            startResend();
            setTimeout(() => inputRefs.current[0]?.focus(), 150);
        } catch (err: any) {
            setError(err.message ?? 'Resend failed.');
        } finally { setLoading(false); }
    }

    const cfg = {
        citizen: { color: '#16a34a', icon: 'fa-leaf', label: 'Citizen', accent: 'green' },
        employee: { color: '#059669', icon: 'fa-hard-hat', label: 'Field Employee', accent: 'emerald' },
        admin: { color: '#dc2626', icon: 'fa-shield-halved', label: 'Administrator', accent: 'red' },
    }[panel];

    return (
        <div style={{ '--role-color': cfg.color } as React.CSSProperties} className="space-y-5">

            {/* Error */}
            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                    <i className="fas fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
                    <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
                </div>
            )}

            {/* ─── EMAIL STEP ─── */}
            {step === 'email' && (
                <form onSubmit={handleSend} className="space-y-4">
                    {panel === 'citizen' && (
                        <div>
                            <label className="civic-label">{t.your_name} <span className="text-slate-400 font-normal">{t.first_time_only}</span></label>
                            <input
                                className="civic-input"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    <div>
                        <label className="civic-label">{t.enter_email}</label>
                        <input
                            className="civic-input"
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(''); }}
                            placeholder="you@example.com"
                            autoComplete="email"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{ background: cfg.color }}
                    >
                        {loading
                            ? <span className="flex items-center justify-center gap-2"><span className="spinner"></span>{t.sending_otp}</span>
                            : <span><i className="fas fa-paper-plane mr-2"></i>{t.send_otp}</span>
                        }
                    </button>
                </form>
            )}

            {/* ─── OTP STEP ─── */}
            {step === 'otp' && (
                <form onSubmit={handleVerify} className="space-y-5">
                    {/* Info */}
                    <div className="px-4 py-3 rounded-xl border text-sm"
                        style={{ borderColor: cfg.color + '40', background: cfg.color + '08', color: cfg.color }}>
                        <p className="font-semibold"><i className="fas fa-envelope-open-text mr-2"></i>{t.otp_sent_to}</p>
                        <p className="font-mono font-bold mt-0.5 text-base">{email}</p>
                        <p className="text-xs mt-1 opacity-70">{t.check_inbox}</p>
                    </div>

                    {/* Digit boxes */}
                    <div>
                        <label className="civic-label mb-3">{t.enter_otp}</label>
                        <OtpBoxes digits={digits} onChange={handleDigit} onKeyDown={handleKey} onPaste={handlePaste} refs={inputRefs} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || digits.join('').length !== 6}
                        className="btn-primary"
                        style={{ background: cfg.color }}
                    >
                        {loading
                            ? <span className="flex items-center justify-center gap-2"><span className="spinner"></span>{t.verifying}</span>
                            : <span><i className="fas fa-unlock-keyhole mr-2"></i>{t.verify_login}</span>
                        }
                    </button>

                    <div className="flex items-center justify-between text-sm pt-1">
                        <button type="button" onClick={() => { setStep('email'); setDigits(['', '', '', '', '', '']); setError(''); }}
                            className="text-slate-500 hover:text-slate-700 transition-colors">
                            <i className="fas fa-arrow-left mr-1"></i>{t.change_email}
                        </button>
                        <button type="button" onClick={handleResend}
                            disabled={resend > 0 || loading}
                            className={`font-medium transition-colors ${resend > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}>
                            {resend > 0 ? `${t.resend_in} ${resend}s` : t.resend_otp}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

/* ─── Main Login Component ───────────────────────────────────────── */
const Login: React.FC<LoginProps> = ({ onLogin, lang, setLang }) => {
    const [panel, setPanel] = useState<Panel>('citizen');

    const tabs: { id: Panel; icon: string; label: string; color: string; bg: string }[] = [
        { id: 'citizen', icon: 'fa-leaf', label: 'Citizen', color: '#16a34a', bg: 'green' },
        { id: 'employee', icon: 'fa-hard-hat', label: 'Employee', color: '#059669', bg: 'emerald' },
        { id: 'admin', icon: 'fa-shield-halved', label: 'Admin', color: '#dc2626', bg: 'red' },
    ];

    const active = tabs.find(t => t.id === panel)!;

    return (
        <div className="min-h-screen flex flex-col md:flex-row">

            {/* ── LEFT HERO ── */}
            <div className="bg-green-700 hidden md:flex md:w-5/12 flex-col items-center justify-center p-12 text-white relative overflow-hidden shadow-2xl z-10">

                <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
                    {/* Premium App Icon */}
                    <div className="mb-8 relative group">
                        <div className="absolute inset-0 bg-green-400 blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 rounded-3xl" />
                        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                            <i className="fas fa-leaf text-5xl text-white drop-shadow-md"></i>
                        </div>
                    </div>

                    <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-center" style={{ fontFamily: 'Space Grotesk', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                        CivicResolve <span className="text-green-300">AI</span>
                    </h1>
                    <p className="text-green-50 text-base mb-10 leading-relaxed text-center font-medium opacity-90">
                        Intelligent Civic Grievance Management<br />with Real-Time Tracking & AI
                    </p>

                    {/* Role illustration cards - Premium Redesign */}
                    <div className="space-y-4 w-full">
                        {[
                            { icon: 'fa-leaf', title: 'Citizens', desc: 'Report issues, track status live', bg: 'bg-green-500/20', border: 'border-green-400/30', iconColor: 'text-green-300' },
                            { icon: 'fa-hard-hat', title: 'Employees', desc: 'View tasks, navigate & mark complete', bg: 'bg-emerald-500/20', border: 'border-emerald-400/30', iconColor: 'text-emerald-300' },
                            { icon: 'fa-shield-halved', title: 'Admins', desc: 'Full dashboard — assign, verify, resolve', bg: 'bg-teal-500/20', border: 'border-teal-400/30', iconColor: 'text-teal-300' },
                        ].map(r => (
                            <div key={r.icon} className={`flex items-center gap-4 p-4 rounded-2xl backdrop-blur-sm border transition-all hover:-translate-y-1 hover:bg-white/10 ${r.bg} ${r.border} shadow-lg`}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 border border-white/10 shadow-inner flex-shrink-0">
                                    <i className={`fas ${r.icon} text-lg ${r.iconColor}`}></i>
                                </div>
                                <div className="text-left">
                                    <p className="text-[15px] font-bold text-white mb-0.5 tracking-wide">{r.title}</p>
                                    <p className="text-xs text-green-100/70 font-medium">{r.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Security Badge */}
                    <div className="mt-10 inline-flex items-center gap-2 bg-black/20 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full text-[13px] font-semibold text-green-50 shadow-inner">
                        <i className="fas fa-shield-check text-green-400 text-lg"></i>
                        Secured by Email OTP — No Passwords
                    </div>
                </div>
            </div>

            {/* ── RIGHT FORM ── */}
            <div className="flex-1 flex flex-col items-center justify-center p-5 min-h-screen relative overflow-hidden bg-white">
                {/* Main Auth Panel with Glassmorphism */}
                <div className="auth-panel w-full max-w-md p-8 fade-in-up relative z-10 backdrop-blur-2xl bg-white/85 shadow-2xl border border-white/60">

                    {/* Mobile logo */}
                    <div className="flex md:hidden items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-green-600 to-emerald-500 border border-green-400/50">
                            <i className="fas fa-leaf text-white text-lg"></i>
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-green-800" style={{ fontFamily: 'Space Grotesk' }}>CivicResolve <span className="text-green-600">AI</span></span>
                    </div>

                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                                {TRANSLATIONS[lang].sign_in}
                            </h2>
                            <p className="text-[14px] text-slate-500 mt-1.5 font-medium">{TRANSLATIONS[lang].select_role_otp}</p>
                        </div>
                        <button
                            onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-green-200 text-green-700 bg-white/60 hover:bg-green-50 hover:border-green-300 transition-all shadow-sm backdrop-blur-sm"
                        >
                            {lang === 'en' ? 'தமிழ்' : 'English'}
                        </button>
                    </div>

                    {/* ── Role Tabs ── */}
                    <div className="flex gap-2 mb-6 p-1.5 bg-slate-100 rounded-2xl">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setPanel(tab.id)}
                                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                                style={panel === tab.id
                                    ? { background: tab.color, color: '#fff', boxShadow: `0 4px 12px ${tab.color}40` }
                                    : { color: '#64748b' }
                                }
                            >
                                <i className={`fas ${tab.icon} text-base`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Role description ── */}
                    <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
                        style={{ background: active.color + '10', color: active.color, border: `1px solid ${active.color}30` }}>
                        <i className={`fas ${active.icon} mr-2`}></i>
                        {panel === 'citizen' && TRANSLATIONS[lang].citizen_role_desc}
                        {panel === 'employee' && TRANSLATIONS[lang].employee_role_desc}
                        {panel === 'admin' && TRANSLATIONS[lang].admin_role_desc}
                    </div>

                    {/* ── Panel (re-mounts when panel changes to reset state) ── */}
                    <React.Fragment key={panel}>
                        <RoleLoginPanel panel={panel} onLogin={onLogin} lang={lang} />
                    </React.Fragment>

                    {/* About the Team Link */}
                    <div className="mt-8 text-center pt-6 border-t border-slate-200/50">
                        <button 
                            onClick={() => {
                                // @ts-ignore - Login component doesn't have useNavigate imported globally, using window.location for hash router
                                window.location.hash = '#/about';
                            }}
                            className="inline-flex items-center gap-2 text-[13px] font-semibold text-green-700 hover:text-green-800 bg-green-50/50 hover:bg-green-100/50 px-4 py-2 rounded-full transition-all"
                        >
                            <i className="fas fa-hand-holding-heart text-green-600"></i>
                            About Us
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
