/**
 * Civic Rewards Engine
 * Computes points, badges, and level purely from a citizen's complaint list.
 * No database schema changes required.
 */
import { Complaint, ComplaintStatus } from '../types';

// ─── Points Config ────────────────────────────────────────────────────────────
export const POINTS = {
    SUBMITTED: 10,          // For every complaint submitted
    VERIFIED: 40,           // Bonus when complaint is officially resolved
    UPVOTED: 10,            // Submitting as a duplicate (supporting an existing report)
    QUICK_RESOLVE: 20,      // Complaint resolved within 48 hours
} as const;

// ─── Badge Definitions ────────────────────────────────────────────────────────
export interface Badge {
    id: string;
    icon: string;           // emoji
    name: string;
    description: string;
    color: string;          // tailwind bg color
    borderColor: string;
    earned: boolean;
}

// ─── Level Tiers ─────────────────────────────────────────────────────────────
export interface Level {
    name: string;
    icon: string;
    minPoints: number;
    maxPoints: number;
    color: string;          // tailwind text/ring color
    bg: string;
}

export const LEVELS: Level[] = [
    { name: 'Newcomer',        icon: '🌱', minPoints: 0,   maxPoints: 49,   color: 'text-slate-400',   bg: 'bg-slate-100' },
    { name: 'Active Citizen',  icon: '🏙️', minPoints: 50,  maxPoints: 149,  color: 'text-blue-600',    bg: 'bg-blue-50' },
    { name: 'Community Hero',  icon: '⭐', minPoints: 150, maxPoints: 349,  color: 'text-amber-600',   bg: 'bg-amber-50' },
    { name: 'Civic Champion',  icon: '🏆', minPoints: 350, maxPoints: 99999, color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export function getLevel(points: number): Level & { nextLevel: Level | null } {
    const tier = [...LEVELS].reverse().find(l => points >= l.minPoints) || LEVELS[0];
    const idx = LEVELS.indexOf(tier);
    return { ...tier, nextLevel: LEVELS[idx + 1] ?? null };
}

// ─── Core Calculation ─────────────────────────────────────────────────────────
export interface RewardsProfile {
    totalPoints: number;
    pointsBreakdown: {
        submitted: number;
        verified: number;
        upvoted: number;
        quickResolve: number;
    };
    level: Level & { nextLevel: Level | null };
    progressPercent: number;   // 0–100 toward next level
    badges: Badge[];
    stats: {
        totalSubmitted: number;
        totalVerified: number;
        totalUpvoted: number;
        totalQuickResolve: number;
    };
}

export function computeRewards(complaints: Complaint[]): RewardsProfile {
    const submitted     = complaints.length;
    const verified      = complaints.filter(c => c.status === ComplaintStatus.VERIFIED).length;
    const upvoted       = complaints.filter(c => !!c.parentId).length;
    const quickResolve  = complaints.filter(c =>
        c.status === ComplaintStatus.VERIFIED &&
        c.resolvedAt &&
        (c.resolvedAt - c.createdAt) <= 48 * 60 * 60 * 1000
    ).length;

    const breakdown = {
        submitted:    submitted   * POINTS.SUBMITTED,
        verified:     verified    * POINTS.VERIFIED,
        upvoted:      upvoted     * POINTS.UPVOTED,
        quickResolve: quickResolve * POINTS.QUICK_RESOLVE,
    };
    const totalPoints = Object.values(breakdown).reduce((a, b) => a + b, 0);

    const level = getLevel(totalPoints);
    const progressPercent = level.nextLevel
        ? Math.min(100, Math.round(
            ((totalPoints - level.minPoints) / (level.nextLevel.minPoints - level.minPoints)) * 100
          ))
        : 100;

    const badges: Badge[] = [
        {
            id: 'first_report',
            icon: '🌱',
            name: 'First Reporter',
            description: 'Submitted your very first civic complaint.',
            color: 'bg-green-100',
            borderColor: 'border-green-300',
            earned: submitted >= 1,
        },
        {
            id: 'neighborhood_watch',
            icon: '🔍',
            name: 'Neighborhood Watch',
            description: 'Reported 5 or more civic issues in your area.',
            color: 'bg-blue-100',
            borderColor: 'border-blue-300',
            earned: submitted >= 5,
        },
        {
            id: 'problem_solver',
            icon: '✅',
            name: 'Problem Solver',
            description: 'Had your first complaint officially resolved.',
            color: 'bg-emerald-100',
            borderColor: 'border-emerald-300',
            earned: verified >= 1,
        },
        {
            id: 'eco_warrior',
            icon: '🌿',
            name: 'Eco Warrior',
            description: 'Got 5 or more complaints resolved by the city.',
            color: 'bg-teal-100',
            borderColor: 'border-teal-300',
            earned: verified >= 5,
        },
        {
            id: 'community_voice',
            icon: '🤝',
            name: 'Community Voice',
            description: 'Upvoted existing reports twice — reducing duplicate work.',
            color: 'bg-violet-100',
            borderColor: 'border-violet-300',
            earned: upvoted >= 2,
        },
        {
            id: 'quick_fix',
            icon: '⚡',
            name: 'Quick Fix Hero',
            description: 'Had a complaint resolved within 48 hours of reporting.',
            color: 'bg-yellow-100',
            borderColor: 'border-yellow-300',
            earned: quickResolve >= 1,
        },
        {
            id: 'civic_champion',
            icon: '🏆',
            name: 'Civic Champion',
            description: 'Accumulated 350+ civic points. A true city hero!',
            color: 'bg-amber-100',
            borderColor: 'border-amber-400',
            earned: totalPoints >= 350,
        },
    ];

    return {
        totalPoints,
        pointsBreakdown: breakdown,
        level,
        progressPercent,
        badges,
        stats: { totalSubmitted: submitted, totalVerified: verified, totalUpvoted: upvoted, totalQuickResolve: quickResolve },
    };
}
