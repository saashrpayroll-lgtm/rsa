import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Wrench } from 'lucide-react';

interface TechnicianPerformanceTableProps {
    timeRange: 'day' | 'week' | 'month';
    refreshTrigger: number;
}

const TechnicianPerformanceTable: React.FC<TechnicianPerformanceTableProps> = ({ timeRange, refreshTrigger }) => {
    const [techs, setTechs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const getStartTime = () => {
        const now = new Date();
        if (timeRange === 'week') return new Date(now.setDate(now.getDate() - 7)).toISOString();
        if (timeRange === 'month') return new Date(now.setDate(now.getDate() - 30)).toISOString();
        return new Date(now.setDate(now.getDate() - 1)).toISOString(); // Default 'day'
    };

    useEffect(() => {
        fetchStats();
    }, [timeRange, refreshTrigger]);

    const fetchStats = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_technician_stats', {
            time_range_start: getStartTime()
        });

        if (!error && data) {
            setTechs(data);
        }
        setLoading(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wrench size={16} className="text-cyan-500" /> Technician Performance
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th className="px-4 py-3">Technician</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Assigned (24h)</th>
                            <th className="px-4 py-3">Resolved (24h)</th>
                            <th className="px-4 py-3">Avg Time</th>
                            <th className="px-4 py-3">Efficiency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading...</td></tr>
                        ) : techs.map((tech) => (
                            <tr key={tech.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">
                                    {tech.full_name}
                                    <div className="text-[10px] text-gray-500 uppercase">{tech.role}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${tech.is_available
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${tech.is_available ? 'bg-green-500' : 'bg-gray-500'}`} />
                                        {tech.is_available ? 'Online' : 'Offline'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">{tech.total_tickets_assigned}</td>
                                <td className="px-4 py-3 text-center text-green-500 font-bold">{tech.total_tickets_resolved}</td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                    {tech.avg_resolution_time_minutes > 0
                                        ? `${Math.round(tech.avg_resolution_time_minutes)}m`
                                        : '-'
                                    }
                                </td>
                                <td className="px-4 py-3">
                                    {tech.total_tickets_assigned > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-cyan-500"
                                                    style={{ width: `${(tech.total_tickets_resolved / tech.total_tickets_assigned) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">{Math.round((tech.total_tickets_resolved / tech.total_tickets_assigned) * 100)}%</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400">N/A</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TechnicianPerformanceTable;
