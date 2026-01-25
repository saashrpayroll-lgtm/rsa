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

const SLAMonitor: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400">
                    <Timer size={18} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">SLA Monitor</h3>
                    <p className="text-xs text-gray-500">Live Compliance Tracking</p>
                </div>
            </div>

            <div className="flex justify-around py-4">
                <CircularProgress value={92} size={80} color="text-green-500" label="Response Time" />
                <CircularProgress value={84} size={80} color="text-yellow-500" label="Resolution Time" />
            </div>

            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3">
                <AlertOctagon size={16} className="text-red-500" />
                <div>
                    <p className="text-xs font-bold text-red-700 dark:text-red-400">Breach Warning</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400/70">
                        2 tickets are approaching resolution deadline ( less than 15 mins).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SLAMonitor;
