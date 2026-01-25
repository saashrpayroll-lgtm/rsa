import React from 'react';
import {
    Clock, CheckCircle, Navigation, Wrench, FileText,
    Mic, Image as ImageIcon, Sparkles
} from 'lucide-react';
import type { Ticket } from '../../types';
import { cn } from '../../lib/utils'; // Assuming this utility exists

interface TechnicianWorkflowSectionProps {
    ticket: Ticket;
}

const TechnicianWorkflowSection: React.FC<TechnicianWorkflowSectionProps> = ({ ticket }) => {
    // Helper to calculate duration
    const getDuration = (start?: string, end?: string) => {
        if (!start || !end) return null;
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    const totalDuration = getDuration(ticket.accepted_at || ticket.created_at, ticket.completed_at);

    // Timeline steps
    const timeline = [
        {
            status: 'ACCEPTED',
            label: 'Accepted',
            time: ticket.accepted_at,
            icon: CheckCircle,
            color: 'text-blue-400',
            bg: 'bg-blue-500/20'
        },
        {
            status: 'ON_WAY',
            label: 'On The Way',
            time: ticket.on_way_at,
            icon: Navigation,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/20'
        },
        {
            status: 'IN_PROGRESS',
            label: 'Work Started',
            time: ticket.in_progress_at,
            icon: Wrench,
            color: 'text-orange-400',
            bg: 'bg-orange-500/20'
        },
        {
            status: 'COMPLETED',
            label: 'Completed',
            time: ticket.completed_at,
            icon: CheckCircle,
            color: 'text-green-400',
            bg: 'bg-green-500/20'
        }
    ];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wrench className="text-cyan-400" size={20} />
                    Technician Workflow & Insights
                </h3>
                {totalDuration && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-sm font-mono text-gray-200">Total Time: {totalDuration}</span>
                    </div>
                )}
            </div>

            {/* Workflow Timeline */}
            <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                {timeline.map((step, idx) => {
                    const isCompleted = !!step.time;
                    return (
                        <div key={step.status} className={cn("relative flex gap-4", !isCompleted && "opacity-50")}>
                            {/* Icon Node */}
                            <div className={cn(
                                "relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shrink-0",
                                isCompleted ? `${step.bg} ${step.color} border-${step.color.split('-')[1]}-500/50` : "bg-gray-900 border-gray-700 text-gray-600"
                            )}>
                                <step.icon size={18} />
                            </div>

                            {/* Content */}
                            <div>
                                <h4 className={cn("font-bold text-sm", isCompleted ? "text-white" : "text-gray-500")}>
                                    {step.label}
                                </h4>
                                {step.time ? (
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                        {new Date(step.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-600 mt-0.5">Pending...</p>
                                )}

                                {/* Duration between steps (optional insight) */}
                                {idx > 0 && isCompleted && timeline[idx - 1].time && (
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        +{getDuration(timeline[idx - 1].time, step.time)} from previous step
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Insights & Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 1. Work Summary & Parts */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={14} /> Work Report
                    </h4>

                    <div className="space-y-3">
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">Parts Replaced</span>
                            {ticket.parts_replaced ? (
                                <div className="p-2 bg-gray-800 rounded-lg text-sm text-white font-mono border border-gray-700">
                                    {ticket.parts_replaced}
                                </div>
                            ) : (
                                <span className="text-xs text-gray-600 italic">No parts listed or job pending.</span>
                            )}
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 block mb-1">Technician Remarks</span>
                            <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/50 p-2 rounded-lg">
                                {ticket.technician_remarks || "No remarks provided."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Media Evidence */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon size={14} /> Completion Evidence
                    </h4>

                    {/* Images */}
                    {ticket.completion_images && ticket.completion_images.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {ticket.completion_images.map((img, i) => (
                                <a key={i} href={img} target="_blank" rel="noreferrer" className="aspect-square relative rounded-lg overflow-hidden border border-gray-700 group cursor-zoom-in">
                                    <img src={img} alt="Completion" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ImageIcon className="text-white" size={16} />
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600 italic">No images uploaded.</p>
                    )}

                    {/* Voice Notes & Transcripts */}
                    <div>
                        <span className="text-xs text-gray-500 block mb-2 flex items-center gap-2">
                            <Mic size={12} /> Voice Notes & Transcripts
                        </span>

                        {ticket.completion_voice_notes && ticket.completion_voice_notes.length > 0 ? (
                            <div className="space-y-2">
                                {ticket.completion_voice_notes.map((note, i) => (
                                    <div key={i} className="bg-gray-800 p-2 rounded-lg text-sm border border-gray-700">
                                        <audio controls src={note} className="w-full h-8 mb-2" />
                                        {ticket.technician_voice_transcripts && ticket.technician_voice_transcripts[i] && (
                                            <p className="text-xs text-gray-400 italic border-t border-gray-700 pt-2 mt-1">
                                                "{ticket.technician_voice_transcripts[i]}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-600 italic">No voice notes.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Auto-Analysis (Mock) */}
            <div className="mt-4 bg-purple-900/10 border border-purple-500/20 rounded-xl p-4">
                <h4 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Sparkles size={14} /> AI Performance Insight
                </h4>
                <p className="text-sm text-purple-200/80">
                    {totalDuration
                        ? `Job completed in ${totalDuration}. This is within the expected range for "${ticket.category}". Efficiency Score: High.`
                        : "Job is currently in progress. AI analysis will be available upon completion."
                    }
                </p>
            </div>
        </div>
    );
};

export default TechnicianWorkflowSection;
