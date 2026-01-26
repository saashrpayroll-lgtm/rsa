import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UserProfile, Ticket } from '../../types';

interface TechPerformanceProps {
    users: UserProfile[];
    tickets: Ticket[];
}

type Period = 'day' | 'week' | 'month' | 'all';

const TechnicianPerformance: React.FC<TechPerformanceProps> = ({ users, tickets }) => {
    const [period, setPeriod] = useState<Period>('all');
    const [activeTab, setActiveTab] = useState<'HUB' | 'RSA'>('HUB');

    // Helper: Calculate metrics for a specific time window
    const getMetrics = (startDate: Date, endDate: Date) => {
        const targetRole = activeTab === 'HUB' ? 'hub_tech' : 'rsa_tech';
        const relevantTechs = users.filter(u => u.role === targetRole);

        const stats = relevantTechs.map(tech => {
            const techTickets = tickets.filter(t =>
                t.technician_id === tech.id &&
                t.created_at &&
                new Date(t.created_at) >= startDate &&
                new Date(t.created_at) <= endDate
            );
            const completed = techTickets.filter(t => t.status === 'COMPLETED');

            // Avg Resolution
            let totalResTime = 0;
            let resCount = 0;
            completed.forEach(t => {
                if (t.created_at && t.completed_at) {
                    totalResTime += new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
                    resCount++;
                }
            });
            const avgResolution = resCount > 0 ? Math.round((totalResTime / resCount) / 1000 / 60) : 0;

            // Avg Rating
            const ratedTickets = techTickets.filter(t => t.customer_rating && t.customer_rating > 0);
            const avgRating = ratedTickets.length > 0
                ? (ratedTickets.reduce((sum, t) => sum + (t.customer_rating || 0), 0) / ratedTickets.length).toFixed(1)
                : "N/A";

            return {
                id: tech.id,
                name: tech.full_name || 'Unknown',
                tickets: techTickets.length,
                completed: completed.length,
                avgResolution,
                rating: avgRating
            };
        });

        const activeTechCount = stats.filter(s => s.tickets > 0).length;
        const totalAvgRes = stats.reduce((acc, s) => acc + s.avgResolution, 0) / Math.max(1, activeTechCount);
        const totalTickets = stats.reduce((acc, s) => acc + s.tickets, 0);
        const totalCompleted = stats.reduce((acc, s) => acc + s.completed, 0);
        const closureRate = totalTickets > 0 ? Math.round((totalCompleted / totalTickets) * 100) : 0;

        return {
            techs: stats.sort((a, b) => b.completed - a.completed),
            avgResolution: Math.round(totalAvgRes),
            closureRate,
            activeTechCount
        };
    };

    const metrics = useMemo(() => {
        const now = new Date();
        let start = new Date();
        let prevStart = new Date();
        let prevEnd = new Date();

        if (period === 'day') {
            start.setDate(now.getDate() - 1);
            prevStart.setDate(now.getDate() - 2);
            prevEnd.setDate(now.getDate() - 1);
        } else if (period === 'week') {
            start.setDate(now.getDate() - 7);
            prevStart.setDate(now.getDate() - 14);
            prevEnd.setDate(now.getDate() - 7);
        } else if (period === 'month') {
            start.setDate(now.getDate() - 30);
            prevStart.setDate(now.getDate() - 60);
            prevEnd.setDate(now.getDate() - 30);
        } else {
            start = new Date(0); // All time
            prevStart = new Date(0);
        }

        const current = getMetrics(start, now);
        const previous = getMetrics(prevStart, prevEnd);

        return { current, previous };
    }, [users, tickets, activeTab, period]);

    const getTrend = (curr: number, prev: number, invert = false) => {
        if (prev === 0) return { val: 0, show: false };
        const diff = curr - prev;
        const pct = Math.round((diff / prev) * 100);
        const isPositive = diff > 0;
        // Invert: Lower is better (e.g. Resolution Time)
        const isGood = invert ? !isPositive : isPositive;

        return {
            val: Math.abs(pct),
            isPositive,
            color: isGood ? 'text-green-500' : 'text-red-500',
            icon: isPositive ? '↑' : '↓'
        };
    };

    const resTrend = getTrend(metrics.current.avgResolution, metrics.previous.avgResolution, true);
    const closeTrend = getTrend(metrics.current.closureRate, metrics.previous.closureRate);
    const activeTrend = getTrend(metrics.current.activeTechCount, metrics.previous.activeTechCount);

    return (
        <div className="bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* ... Header Content (Same as before) ... */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-500" />
                        Technician Performance
                    </h3>
                    <p className="text-xs text-gray-500">Live metrics and KPI analysis</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('HUB')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", activeTab === 'HUB' ? "bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
                        >
                            HUB Techs
                        </button>
                        <button
                            onClick={() => setActiveTab('RSA')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", activeTab === 'RSA' ? "bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
                        >
                            RSA Techs
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1" />

                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                    >
                        <option value="day">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700">
                <div className="p-4 text-center group">
                    <p className="text-xs font-medium text-gray-500 uppercase">Avg. Resolution</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.current.avgResolution} <span className="text-xs font-normal text-gray-500">mins</span></p>
                        {period !== 'all' && resTrend.show !== false && (
                            <span className={cn("text-[10px] font-bold flex items-center", resTrend.color)}>
                                {resTrend.icon} {resTrend.val}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase">Closure Rate</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.current.closureRate}%</p>
                        {period !== 'all' && closeTrend.show !== false && (
                            <span className={cn("text-[10px] font-bold flex items-center", closeTrend.color)}>
                                {closeTrend.icon} {closeTrend.val}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase">Active Techs</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.current.activeTechCount}</p>
                        {period !== 'all' && activeTrend.show !== false && (
                            <span className={cn("text-[10px] font-bold flex items-center", activeTrend.color)}>
                                {activeTrend.icon} {activeTrend.val}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="px-6 py-3 font-medium">Technician</th>
                            <th className="px-6 py-3 font-medium text-center">Tickets</th>
                            <th className="px-6 py-3 font-medium text-center">Completed</th>
                            <th className="px-6 py-3 font-medium text-center">Avg Time</th>
                            <th className="px-6 py-3 font-medium text-right">Rating</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {metrics.current.techs.map((tech) => (
                            <tr key={tech.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tech.name}</td>
                                <td className="px-6 py-4 text-center text-gray-500">{tech.tickets}</td>
                                <td className="px-6 py-4 text-center text-green-600 dark:text-green-400 font-bold">{tech.completed}</td>
                                <td className="px-6 py-4 text-center text-gray-500">{tech.avgResolution}m</td>
                                <td className="px-6 py-4 text-right font-bold text-yellow-500">★ {tech.rating}</td>
                            </tr>
                        ))}
                        {metrics.current.techs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500 italic">
                                    No activity found for this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TechnicianPerformance;
