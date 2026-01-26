import React from 'react';
import { motion } from 'framer-motion';
import { FileWarning } from 'lucide-react';

interface ForecastProps {
    data: { time: string; actual: number | null; predicted: number }[];
}

const AIForecastChart: React.FC<ForecastProps> = ({ data }) => {
    // Normalize logic
    const parseNum = (v: any) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
    }
    const maxVal = Math.max(1, ...data.map(d => Math.max(parseNum(d.actual), parseNum(d.predicted))));
    const height = 200;

    const getY = (val: number) => height - (parseNum(val) / maxVal) * height;
    const getX = (idx: number) => (idx / Math.max(1, data.length - 1)) * 100;

    const actualPath = data
        .map((d, i) => d.actual !== null ? `${getX(i)},${getY(d.actual)}` : null)
        .filter(Boolean)
        .join(' L ');

    const predictedPath = data
        .map((d, i) => `${getX(i)},${getY(d.predicted)}`)
        .join(' L ');

    // Prevent rendering if no data
    if (!data || data.length === 0) return (
        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm h-[300px] flex items-center justify-center">
            <p className="text-gray-400 text-sm">Waiting for forecast data...</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ticket Volume Forecast</h3>
                    <p className="text-xs text-gray-500">AI Prediction vs Actual Load</p>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Actual
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500 border border-purple-200 border-dashed" /> AI Predicted
                    </div>
                </div>
            </div>

            <div className="relative h-[200px] w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 200" preserveAspectRatio="none">
                    {/* Grid Lines */}
                    {[0, 25, 50, 75, 100].map(p => (
                        <line key={p} x1="0" y1={p * 2} x2="100" y2={p * 2} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="0.5" />
                    ))}

                    {/* Predicted Line (Dashed) - Static to prevent flicker */}
                    <path
                        d={`M ${predictedPath}`}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="opacity-70 transition-all duration-500 ease-in-out"
                    />

                    {/* Actual Line (Solid) - Static to prevent flicker */}
                    <path
                        d={`M ${actualPath}`}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-500 ease-in-out"
                    />

                    {/* Interaction Points (Mock for now) */}
                    {data.map((d, i) => (
                        (d.actual !== null && d.predicted && Math.abs(Number(d.actual) - Number(d.predicted)) > 5) && (
                            <g key={i}>
                                <circle cx={getX(i)} cy={getY(d.actual)} r="1.5" className="fill-red-500 animate-pulse" />
                            </g>
                        )
                    ))}
                </svg>

                {/* X-Axis Labels */}
                <div className="flex justify-between mt-2 text-[10px] text-gray-400 uppercase tracking-widest px-1">
                    {data.filter((_, i) => i % 3 === 0).map((d, i) => (
                        <span key={i}>{d.time}</span>
                    ))}
                </div>
            </div>

            {/* Insight Alert */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
                className="mt-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-3 flex items-start gap-3"
            >
                <div className="p-1.5 bg-orange-100 dark:bg-orange-800/30 rounded-lg text-orange-600 dark:text-orange-400">
                    <FileWarning size={14} />
                </div>
                <div>
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-0.5">High Load Predicted</p>
                    <p className="text-xs text-orange-600 dark:text-orange-500/80">
                        AI detects a potential spike in RSA requests around 18:00 due to forecasted rain. Recommend keeping 2 extra technicians on standby.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default AIForecastChart;
