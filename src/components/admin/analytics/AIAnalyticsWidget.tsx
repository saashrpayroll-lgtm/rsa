import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Brain, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';

const AIAnalyticsWidget = () => {
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate AI Analysis delay
        setTimeout(() => {
            generateInsights();
            setLoading(false);
        }, 1500);
    }, []);

    const generateInsights = async () => {
        // Fetch real stats to base insights on
        const { data: techs } = await supabase.rpc('get_technician_stats', {
            time_range_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        });

        const newInsights: any[] = [];

        // Simple Heuristics based on real data
        if (techs) {
            const overloadedTech = techs.find((t: any) => t.total_tickets_assigned > 5 && t.is_available);
            if (overloadedTech) {
                newInsights.push({
                    type: 'warning',
                    icon: AlertTriangle,
                    title: `High Load: ${overloadedTech.full_name}`,
                    description: `${overloadedTech.full_name} has ${overloadedTech.total_tickets_assigned} active tickets. Consider reallocating.`,
                    action: "Reassign Tickets",
                    actionData: { techId: overloadedTech.user_id }
                });
            }

            const efficientTech = techs.find((t: any) => t.avg_resolution_time_minutes > 0 && t.avg_resolution_time_minutes < 30);
            if (efficientTech) {
                newInsights.push({
                    type: 'success',
                    icon: TrendingUp,
                    title: `High Efficiency: ${efficientTech.full_name}`,
                    description: `Avg resolution time is only ${Math.round(efficientTech.avg_resolution_time_minutes)} mins.`,
                    action: "View Details",
                    actionData: { techId: efficientTech.user_id }
                });
            }
        }

        // Always add a recommendation to auto-assign if there are open tickets (we can't check open tickets count easily here without another query, so we'll just add it as a general tool)
        newInsights.push({
            type: 'recommendation',
            icon: Lightbulb,
            title: "Optimization Recommendation",
            description: "Check for unassigned tickets and distribute them to available staff.",
            action: "Auto-Assign",
            actionData: {}
        });

        setInsights(newInsights);
    };

    const handleAction = async (insight: any) => {
        setLoading(true);
        try {
            if (insight.action === 'Reassign Tickets') {
                const { error } = await supabase.rpc('reassign_technician_tickets', { target_tech_id: insight.actionData.techId });
                if (error) throw error;
                alert('Tickets successfully unassigned. They are now OPEN for other technicians.');
            } else if (insight.action === 'Auto-Assign') {
                const { data, error } = await supabase.rpc('auto_assign_tickets');
                if (error) throw error;
                alert(`Successfully auto-assigned ${data} tickets to available technicians.`);
            } else {
                alert(`Action: ${insight.action} (No automated logic implemented yet)`);
            }
            // Refresh insights
            generateInsights();
        } catch (err: any) {
            console.error(err);
            alert('Action failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-purple-900/10 to-indigo-900/10 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl p-6 border border-purple-200 dark:border-purple-500/30 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Brain size={120} />
            </div>

            <div className="relative z-10">
                <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-6">
                    <Brain className="text-purple-600 dark:text-purple-400" />
                    AI Performance Insights
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/30">BETA</span>
                </h3>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-16 bg-gray-200 dark:bg-gray-700/50 rounded-lg" />
                        <div className="h-16 bg-gray-200 dark:bg-gray-700/50 rounded-lg" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {insights.map((insight, idx) => (
                            <div key={idx} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 rounded-lg border border-white dark:border-gray-700 shadow-sm flex items-start gap-4 transition-transform hover:scale-[1.01]">
                                <div className={`p-2 rounded-lg shrink-0 ${insight.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                                    insight.type === 'success' ? 'bg-green-100 text-green-600' :
                                        'bg-blue-100 text-blue-600'
                                    }`}>
                                    <insight.icon size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{insight.title}</h4>
                                        <button
                                            onClick={() => handleAction(insight)}
                                            className="px-3 py-1 text-xs font-semibold rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800 transition-colors shadow-sm active:scale-95 border border-purple-200 dark:border-purple-500/30"
                                        >
                                            {insight.action}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                                        {insight.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAnalyticsWidget;
