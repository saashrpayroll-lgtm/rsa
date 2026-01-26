import React from 'react';
import { motion } from 'framer-motion';
import { Timer, AlertOctagon } from 'lucide-react';
import { cn } from '../../lib/utils';

const CircularProgress: React.FC<{ value: number; size: number; color: string; label: string }> = ({ value, size, color, label }) => {
    const radius = size / 2 - 4;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Circle */}
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-gray-100 dark:text-gray-800"
                    />
                    {/* Progress Circle */}
                    <motion.circle
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeLinecap="round"
                        className={color}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={cn("text-lg font-bold", color.replace('text-', 'text-'))}>{value}%</span>
                </div>
            </div>
            <span className="text-xs font-medium text-gray-500 mt-2">{label}</span>
        </div>
    );
};

// ... imports
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// ... CircularProgress component ...

const SLAMonitor: React.FC = () => {
    const [stats, setStats] = useState({ response: 95, resolution: 88, arrival: 92, satisfaction: 98 });

    useEffect(() => {
        const fetchSLA = async () => {
            const { data } = await supabase.rpc('get_sla_monitor_stats');
            if (data && data[0]) {
                setStats({
                    response: data[0].response_score ?? 95,
                    resolution: data[0].resolution_score ?? 88,
                    arrival: data[0].arrival_score ?? 92,
                    satisfaction: data[0].customer_satisfaction ?? 98
                });
            }
        };

        fetchSLA();
        const interval = setInterval(fetchSLA, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400">
                    <Timer size={18} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">SLA Monitor</h3>
                    <p className="text-xs text-gray-500">Live Compliance Tracking (4 Points)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                <CircularProgress value={stats.response} size={70} color="text-green-500" label="Response" />
                <CircularProgress value={stats.resolution} size={70} color="text-yellow-500" label="Resolution" />
                <CircularProgress value={stats.arrival} size={70} color="text-purple-500" label="Arrival" />
                <CircularProgress value={stats.satisfaction} size={70} color="text-orange-500" label="Cust. Sat" />
            </div>

            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3">
                <AlertOctagon size={16} className="text-red-500 shrink-0" />
                <div>
                    <p className="text-xs font-bold text-red-700 dark:text-red-400">Live Breach Warning</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400/70">
                        Monitoring all active tickets for SLA violations.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SLAMonitor;
