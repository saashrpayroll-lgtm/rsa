import React, { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { generateAdminInsights, type AdminInsight } from '../../lib/groq';
import { cn } from '../../lib/utils';

interface AIInsightsPanelProps {
    metrics: any;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ metrics }) => {
    const [insights, setInsights] = useState<AdminInsight[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const results = await generateAdminInsights(metrics);
            setInsights(results);
            setLastUpdated(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-b from-purple-900/10 to-transparent rounded-2xl border border-purple-200 dark:border-purple-500/20 p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Sparkles size={18} className="text-purple-500" />
                        AI Control Center
                    </h3>
                    <p className="text-xs text-gray-500">Real-time system intelligence</p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            <div className="space-y-3">
                {insights.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-600 text-sm border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                        <Sparkles className="mx-auto mb-2 opacity-50" />
                        <p>No insights generated yet.</p>
                        <button onClick={handleGenerate} className="text-purple-500 font-bold mt-2 text-xs hover:underline">
                            Analyze System
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="space-y-3 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                        ))}
                    </div>
                )}

                {insights.map((insight, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "p-3 rounded-xl border flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in duration-500",
                            insight.type === 'ALERT' ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30" :
                                insight.type === 'WARNING' ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-500/30" :
                                    insight.type === 'PRAISE' ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/30" :
                                        "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30"
                        )}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className={cn(
                            "mt-0.5 p-1.5 rounded-full shrink-0",
                            insight.type === 'ALERT' ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" :
                                insight.type === 'WARNING' ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" :
                                    insight.type === 'PRAISE' ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400" :
                                        "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        )}>
                            {insight.type === 'ALERT' ? <AlertCircle size={14} /> :
                                insight.type === 'WARNING' ? <AlertCircle size={14} /> :
                                    insight.type === 'PRAISE' ? <CheckCircle size={14} /> :
                                        <Info size={14} />}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className={cn(
                                    "text-[10px] font-bold uppercase",
                                    insight.type === 'ALERT' ? "text-red-600 dark:text-red-400" :
                                        insight.type === 'WARNING' ? "text-orange-600 dark:text-orange-400" :
                                            insight.type === 'PRAISE' ? "text-green-600 dark:text-green-400" :
                                                "text-blue-600 dark:text-blue-400"
                                )}>{insight.type}</span>
                                {insight.target && <span className="text-[10px] text-gray-500 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded shadow-sm">{insight.target}</span>}
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                {insight.message}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {lastUpdated && (
                <p className="text-[10px] text-right text-gray-400 mt-4">
                    Last analysis: {lastUpdated.toLocaleTimeString()}
                </p>
            )}
        </div>
    );
};

export default AIInsightsPanel;
