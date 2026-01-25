import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Sparkles, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SmartStatCardProps {
    title: string;
    value: string | number;
    trend: number; // Percentage change
    data: number[]; // Array of numbers for sparkline
    icon: React.ReactNode;
    color: string;
    onAiExplain?: () => void;
}

const SmartStatCard: React.FC<SmartStatCardProps> = ({ title, value, trend, data, icon, color, onAiExplain }) => {
    const [hovered, setHovered] = useState(false);

    // Normalize data for sparkline (0-100 range)
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="relative bg-white dark:bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Background Gradient Blob */}
            <div className={cn("absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 blur-3xl transition-all duration-500", color, hovered ? "opacity-20 scale-150" : "")} />

            <div className="relative z-10 flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl bg-opacity-10 dark:bg-opacity-20", color)}>
                    {icon}
                </div>
                <div className="flex gap-2">
                    {onAiExplain && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAiExplain(); }}
                            className="p-1.5 rounded-full text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors opacity-0 group-hover:opacity-100"
                            title="Ask AI about this metric"
                        >
                            <Sparkles size={14} />
                        </button>
                    )}
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <MoreHorizontal size={16} />
                    </button>
                </div>
            </div>

            <div className="relative z-10">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide uppercase mb-1">{title}</h3>
                <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</span>
                    <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1", trend >= 0 ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
                        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trend)}%
                    </div>
                </div>
            </div>

            {/* Sparkline */}
            <div className="mt-6 h-12 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Fill Gradient */}
                    <defs>
                        <linearGradient id={`gradient-${title}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" className={cn(color.replace('bg-', 'text-'))} stopOpacity="0.2" />
                            <stop offset="100%" className={cn(color.replace('bg-', 'text-'))} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`M0,100 ${points} L100,100 Z`}
                        fill={`url(#gradient-${title})`}
                        className="opacity-50"
                    />
                    {/* Line */}
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        d={`M${points}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={cn(color.replace('bg-', 'text-'))}
                    />
                </svg>
            </div>
        </motion.div>
    );
};

export default SmartStatCard;
