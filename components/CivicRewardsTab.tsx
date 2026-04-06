import React, { useMemo } from 'react';
import { Complaint } from '../types';
import { computeRewards, POINTS, Badge } from '../utils/civicRewards';

interface Props {
    complaints: Complaint[];
    userName: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const BadgeCard: React.FC<{ badge: Badge }> = ({ badge }) => (
    <div className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
        badge.earned
            ? `${badge.color} ${badge.borderColor} shadow-sm`
            : 'bg-slate-100 border-slate-200 opacity-40 grayscale'
    }`}>
        <span className="text-3xl leading-none">{badge.icon}</span>
        <p className="text-[11px] font-bold text-slate-700 text-center leading-tight">{badge.name}</p>
        <p className="text-[10px] text-slate-500 text-center leading-tight">{badge.description}</p>
        {badge.earned && (
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[9px] text-white font-bold shadow">✓</span>
        )}
    </div>
);

const StatPill: React.FC<{ icon: string; label: string; value: number; points: number; color: string }> = ({ icon, label, value, points, color }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm`}>
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-sm font-bold text-slate-800">{value} <span className="text-slate-400 font-normal text-[11px]">× {points} pts</span></p>
        </div>
        <span className={`text-sm font-bold ${color}`}>+{value * points}</span>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const CivicRewardsTab: React.FC<Props> = ({ complaints, userName }) => {
    const profile = useMemo(() => computeRewards(complaints), [complaints]);
    const { totalPoints, pointsBreakdown, level, progressPercent, badges, stats } = profile;
    const earnedBadges = badges.filter(b => b.earned);
    const lockedBadges = badges.filter(b => !b.earned);

    return (
        <div className="fade-in-up space-y-4 pb-4">

            {/* ── Hero Card ── */}
            <div className="relative rounded-3xl overflow-hidden shadow-lg"
                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)' }}>
                {/* Decorative orbs */}
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 rounded-full bg-emerald-400/10 blur-2xl" />
                <div className="absolute bottom-[-10px] left-[-10px] w-32 h-32 rounded-full bg-teal-300/10 blur-xl" />

                <div className="relative z-10 p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-0.5">Civic Score</p>
                            <p className="text-5xl font-extrabold text-white leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                                {totalPoints}
                                <span className="text-emerald-300 text-xl ml-1.5 font-bold">pts</span>
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3">
                            <span className="text-3xl">{level.icon}</span>
                            <p className="text-xs font-bold text-white leading-tight text-center">{level.name}</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {level.nextLevel ? (
                        <div>
                            <div className="flex justify-between text-[10px] text-emerald-300/80 mb-1.5">
                                <span>{totalPoints} pts</span>
                                <span>{level.nextLevel.name} at {level.nextLevel.minPoints} pts</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #34d399, #6ee7b7)' }}
                                />
                            </div>
                            <p className="text-[10px] text-emerald-300/60 mt-1 text-right">{progressPercent}% to next level</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-2 bg-amber-400/20 border border-amber-400/30 rounded-xl px-3 py-2">
                            <span className="text-xl">🏆</span>
                            <p className="text-xs text-amber-200 font-semibold">Maximum level reached — true Civic Champion!</p>
                        </div>
                    )}

                    {/* Badges strip */}
                    {earnedBadges.length > 0 && (
                        <div className="flex gap-2 mt-4 flex-wrap">
                            {earnedBadges.map(b => (
                                <span key={b.id} title={b.name}
                                    className="text-lg bg-white/10 backdrop-blur border border-white/20 rounded-xl w-9 h-9 flex items-center justify-center">
                                    {b.icon}
                                </span>
                            ))}
                            <span className="text-[11px] text-emerald-300/70 self-center ml-1">
                                {earnedBadges.length}/{badges.length} badges
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Points Breakdown ── */}
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                    <i className="fas fa-coins mr-1.5 text-amber-500"></i>Points Breakdown
                </p>
                <div className="space-y-2">
                    <StatPill icon="📋" label="Complaints Submitted" value={stats.totalSubmitted} points={POINTS.SUBMITTED} color="text-blue-600" />
                    <StatPill icon="✅" label="Complaints Verified" value={stats.totalVerified} points={POINTS.VERIFIED} color="text-emerald-600" />
                    <StatPill icon="👍" label="Issues Upvoted" value={stats.totalUpvoted} points={POINTS.UPVOTED} color="text-violet-600" />
                    <StatPill icon="⚡" label="Quick Resolutions (<48h)" value={stats.totalQuickResolve} points={POINTS.QUICK_RESOLVE} color="text-amber-600" />
                </div>
            </div>

            {/* ── Earned Badges ── */}
            {earnedBadges.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                        <i className="fas fa-medal mr-1.5 text-amber-500"></i>Your Badges ({earnedBadges.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {earnedBadges.map(b => <BadgeCard key={b.id} badge={b} />)}
                    </div>
                </div>
            )}

            {/* ── Locked Badges ── */}
            {lockedBadges.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                        <i className="fas fa-lock mr-1.5 text-slate-400"></i>Locked Badges
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {lockedBadges.map(b => <BadgeCard key={b.id} badge={b} />)}
                    </div>
                </div>
            )}

            {/* ── Rewards Info Banner ── */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-bold text-indigo-700 mb-2">
                    <i className="fas fa-gift mr-1.5"></i>How to Earn Points
                </p>
                <div className="space-y-1.5 text-[11px] text-indigo-600">
                    <p>🌱 <strong>+10 pts</strong> for every complaint you submit</p>
                    <p>✅ <strong>+40 pts</strong> when a complaint gets officially resolved</p>
                    <p>👍 <strong>+10 pts</strong> for upvoting an existing report</p>
                    <p>⚡ <strong>+20 pts</strong> bonus if resolved within 48 hours</p>
                </div>
                <div className="mt-3 pt-3 border-t border-indigo-200">
                    <p className="text-[10px] text-indigo-400 font-medium">
                        <i className="fas fa-handshake mr-1"></i>
                        High civic scores may unlock special rewards from partner businesses in your city!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CivicRewardsTab;
