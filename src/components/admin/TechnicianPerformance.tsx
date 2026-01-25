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

    // Filter Logic
    const filteredTickets = useMemo(() => {
        const now = new Date();
        return tickets.filter(t => {
            if (!t.created_at) return false;
            const date = new Date(t.created_at);
            if (period === 'day') return now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
            if (period === 'week') return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
            if (period === 'month') return now.getTime() - date.getTime() < 30 * 24 * 60 * 60 * 1000;
            return true;
        });
    }, [tickets, period]);

    // Metrics Calculation
    const metrics = useMemo(() => {
        const targetRole = activeTab === 'HUB' ? 'hub_tech' : 'rsa_tech';
        const relevantTechs = users.filter(u => u.role === targetRole);

        const stats = relevantTechs.map(tech => {
            const techTickets = filteredTickets.filter(t => t.technician_id === tech.id);
            const completed = techTickets.filter(t => t.status === 'COMPLETED');

            // Calc Avg Resolution Time (in mins)
            let totalResolutionTime = 0;
            let resolutionCount = 0;

            completed.forEach(t => {
                if (t.created_at && t.completed_at) {
                    const diff = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
                    totalResolutionTime += diff;
                    resolutionCount++;
                }
            });

            const avgResolution = resolutionCount > 0 ? Math.round((totalResolutionTime / resolutionCount) / 1000 / 60) : 0;

            // Mock Satisfaction Score (if real column exists, better)
            const rating = 4.5; // Placeholder or calculate from tickets if rating exists

            return {
                id: tech.id,
                name: tech.full_name || 'Unknown',
                tickets: techTickets.length,
                completed: completed.length,
                avgResolution, // mins
                rating
            };
        });

        // Computed Aggregates
        const overallAvgRes = stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + curr.avgResolution, 0) / stats.length) : 0;
        const overallClosure = stats.length > 0 ? Math.round((stats.reduce((acc, curr) => acc + curr.completed, 0) / Math.max(1, stats.reduce((acc, curr) => acc + curr.tickets, 0))) * 100) : 0;

        return {
            techs: stats.sort((a, b) => b.completed - a.completed), // Top performers first
            avgResolution: overallAvgRes,
            closureRate: overallClosure
        };
    }, [users, filteredTickets, activeTab]);

    return (
        <div className="bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <div className="p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase">Avg. Resolution</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.avgResolution} <span className="text-xs font-normal text-gray-500">mins</span></p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase">Closure Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{metrics.closureRate}%</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase">Active Techs</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{metrics.techs.length}</p>
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
                        {metrics.techs.map((tech) => (
                            <tr key={tech.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tech.name}</td>
                                <td className="px-6 py-4 text-center text-gray-500">{tech.tickets}</td>
                                <td className="px-6 py-4 text-center text-green-600 dark:text-green-400 font-bold">{tech.completed}</td>
                                <td className="px-6 py-4 text-center text-gray-500">{tech.avgResolution}m</td>
                                <td className="px-6 py-4 text-right font-bold text-yellow-500">★ {tech.rating}</td>
                            </tr>
                        ))}
                        {metrics.techs.length === 0 && (
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
