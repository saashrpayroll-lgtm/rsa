import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import ActivityChart from '../../components/admin/analytics/ActivityChart';
import TechnicianPerformanceTable from '../../components/admin/analytics/TechnicianPerformanceTable';
import AIAnalyticsWidget from '../../components/admin/analytics/AIAnalyticsWidget';

const ActivityDashboard = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');



    // ... existing mock data ...
    const chartData = [
        { time: '08:00', active_users: 12 },
        { time: '10:00', active_users: 45 },
        { time: '12:00', active_users: 82 },
        { time: '14:00', active_users: 65 },
        { time: '16:00', active_users: 90 },
        { time: '18:00', active_users: 110 },
        { time: '20:00', active_users: 75 },
    ];

    const handleDownloadReport = async () => {
        try {
            const { data, error } = await supabase.rpc('get_technician_stats', {
                time_range_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            });

            if (error) throw error;
            if (!data || data.length === 0) {
                alert("No data available to download.");
                return;
            }

            // Convert to CSV
            const headers = ['User ID', 'Name', 'Role', 'Status', 'Tickets Assigned', 'Tickets Resolved', 'Avg Resolution (mins)', 'Last Active'];
            const csvRows = [headers.join(',')];

            data.forEach((row: any) => {
                csvRows.push([
                    row.user_id,
                    `"${row.full_name}"`,
                    row.role,
                    row.is_available ? 'Online' : 'Offline',
                    row.total_tickets_assigned,
                    row.total_tickets_resolved,
                    Math.round(row.avg_resolution_time_minutes || 0),
                    row.last_active
                ].join(','));
            });

            const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `activity_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e: any) {
            console.error("Download failed:", e);
            alert("Failed to generate report.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button onClick={() => navigate('/admin')} className="flex items-center text-gray-500 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors">
                        <ArrowLeft size={18} className="mr-2" /> {t('admin.back_to_dashboard')}
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Activity & Performance Tracking
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Real-time monitoring of system usage and technician efficiency.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        {(['day', 'week', 'month'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${timeRange === r
                                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 border-gray-200 dark:border-gray-600 shadow-sm'
                                    : 'text-gray-500 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <button
                        className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-95"
                        onClick={() => window.location.reload()}
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 rounded-lg transition-colors shadow-sm active:scale-95"
                        onClick={handleDownloadReport}
                        title="Download Report"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Charts & Tables */}
                <div className="lg:col-span-2 space-y-6">
                    <ActivityChart data={chartData} />
                    <TechnicianPerformanceTable />
                </div>

                {/* Right Column: AI Insights */}
                <div className="space-y-6">
                    <AIAnalyticsWidget />

                    {/* Quick Stats Summary */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">System Pulse</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-center">
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">98%</div>
                                <div className="text-[10px] text-gray-500 uppercase">Uptime</div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-center">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">12m</div>
                                <div className="text-[10px] text-gray-500 uppercase">Avg Response</div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-center">
                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">45</div>
                                <div className="text-[10px] text-gray-500 uppercase">Active Techs</div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-center">
                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">3</div>
                                <div className="text-[10px] text-gray-500 uppercase">Overloaded</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityDashboard;
