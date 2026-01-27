import React from 'react';
import { FileText, ImageIcon, Mic } from 'lucide-react';
import type { Ticket } from '../../types';

interface WorkReportCardProps {
    ticket: Ticket;
}

const WorkReportCard: React.FC<WorkReportCardProps> = ({ ticket }) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                <FileText className="text-cyan-600 dark:text-cyan-400" size={20} />
                Technician Work Report
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Work Summary & Parts */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={14} /> Job Details
                    </h4>

                    <div className="space-y-3">
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">Parts Replaced</span>
                            {ticket.parts_replaced ? (
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-900 dark:text-white font-mono border border-gray-200 dark:border-gray-700">
                                    {ticket.parts_replaced}
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400 italic">No parts listed or job pending.</span>
                            )}
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 block mb-1">Technician Remarks</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                                {ticket.technician_remarks || "No remarks provided."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Media Evidence */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon size={14} /> Completion Evidence
                    </h4>

                    {/* Images */}
                    {ticket.completion_images && ticket.completion_images.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {ticket.completion_images.map((img, i) => (
                                <a key={i} href={img} target="_blank" rel="noreferrer" className="aspect-square relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group cursor-zoom-in">
                                    <img src={img} alt="Completion" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ImageIcon className="text-white" size={16} />
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">No images uploaded.</p>
                    )}

                    {/* Voice Notes & Transcripts */}
                    <div>
                        <span className="text-xs text-gray-500 block mb-2 flex items-center gap-2">
                            <Mic size={12} /> Voice Notes & Transcripts
                        </span>

                        {ticket.completion_voice_notes && ticket.completion_voice_notes.length > 0 ? (
                            <div className="space-y-2">
                                {ticket.completion_voice_notes.map((note, i) => (
                                    <div key={i} className="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
                                        <audio controls src={note} className="w-full h-8 mb-2" />
                                        {ticket.technician_voice_transcripts && ticket.technician_voice_transcripts[i] && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                                                "{ticket.technician_voice_transcripts[i]}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">No voice notes.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkReportCard;
