import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Complaint } from '../types';

interface Props {
    complaints: Complaint[]; // should be master complaints only (no duplicates)
}

// ── Colour palette for categories ────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    Road: '#f97316',
    Water: '#3b82f6',
    Electricity: '#eab308',
    Drainage: '#8b5cf6',
    Garbage: '#22c55e',
    Other: '#64748b',
};
function colorForCategory(cat: string): string {
    for (const key of Object.keys(CATEGORY_COLORS)) {
        if (cat?.toLowerCase().includes(key.toLowerCase())) return CATEGORY_COLORS[key];
    }
    return CATEGORY_COLORS.Other;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLast7Days(): { label: string; date: Date }[] {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
            label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
            date: d,
        });
    }
    return days;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="text-slate-300 font-semibold mb-1">{label}</p>
            <p className="text-indigo-300"><span className="font-bold text-white">{payload[0].value}</span> complaints</p>
        </div>
    );
};

const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p style={{ color: payload[0].payload.fill }} className="font-semibold">{payload[0].name}</p>
            <p className="text-slate-200"><span className="font-bold">{payload[0].value}</span> issues</p>
        </div>
    );
};

// ── Custom Label inside Donut ─────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
            className="text-[11px] font-bold pointer-events-none" fontSize={11} fontWeight={700}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AnalyticsCharts: React.FC<Props> = ({ complaints }) => {
    // Bar chart: complaints per day for last 7 days
    const barData = useMemo(() => {
        const days = getLast7Days();
        return days.map(({ label, date }) => ({
            day: label,
            count: complaints.filter(c => isSameDay(new Date(c.createdAt), date)).length,
        }));
    }, [complaints]);

    // Donut chart: complaints grouped by category
    const donutData = useMemo(() => {
        const map: Record<string, number> = {};
        complaints.forEach(c => {
            const cat = c.category || 'Other';
            map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value, fill: colorForCategory(name) }))
            .sort((a, b) => b.value - a.value);
    }, [complaints]);

    const totalLast7 = barData.reduce((s, d) => s + d.count, 0);
    const todayCount = barData[barData.length - 1]?.count ?? 0;
    const peakDay = [...barData].sort((a, b) => b.count - a.count)[0];

    return (
        <div className="border-b border-slate-700/50 bg-slate-900">
            <div className="w-full px-6 py-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                            <i className="fas fa-chart-bar text-indigo-400 text-xs"></i>
                        </div>
                        <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                            Analytics Overview
                        </h3>
                    </div>
                    <div className="flex gap-3 text-[11px]">
                        <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                            <i className="fas fa-calendar-day text-indigo-400"></i>
                            <span className="text-slate-300">Today: <span className="text-white font-bold">{todayCount}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                            <i className="fas fa-calendar-week text-violet-400"></i>
                            <span className="text-slate-300">7-Day: <span className="text-white font-bold">{totalLast7}</span></span>
                        </div>
                        {peakDay && peakDay.count > 0 && (
                            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                                <i className="fas fa-arrow-trend-up text-orange-400"></i>
                                <span className="text-slate-300">Peak: <span className="text-orange-300 font-bold">{peakDay.day} ({peakDay.count})</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

                {/* ── Bar Chart (3/5 width) ── */}
                <div className="md:col-span-3 bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        <i className="fas fa-calendar-alt mr-1.5 text-indigo-400"></i>
                        Issues Reported — Last 7 Days
                    </p>
                    {totalLast7 === 0 ? (
                        <div className="flex items-center justify-center h-32 text-slate-600 text-sm flex-col gap-2">
                            <i className="fas fa-inbox text-2xl"></i>
                            <span>No data yet</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
                                    {barData.map((entry, index) => {
                                        const isToday = index === barData.length - 1;
                                        const isPeak = entry.day === peakDay?.day && peakDay.count > 0;
                                        return (
                                            <Cell
                                                key={`bar-${index}`}
                                                fill={isToday ? '#6366f1' : isPeak ? '#f97316' : '#334155'}
                                            />
                                        );
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                        <span><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500 mr-1"></span>Today</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-500 mr-1"></span>Peak day</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-700 mr-1"></span>Other days</span>
                    </div>
                </div>

                {/* ── Donut Chart (2/5 width) ── */}
                <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        <i className="fas fa-chart-pie mr-1.5 text-violet-400"></i>
                        Issues by Category
                    </p>
                    {donutData.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-slate-600 text-sm flex-col gap-2">
                            <i className="fas fa-inbox text-2xl"></i>
                            <span>No data yet</span>
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={130}>
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={60}
                                        paddingAngle={3}
                                        dataKey="value"
                                        labelLine={false}
                                        label={renderCustomLabel}
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<DonutTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                {donutData.map(d => (
                                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }}></span>
                                        <span>{d.name}</span>
                                        <span className="text-slate-500">({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};

export default AnalyticsCharts;
