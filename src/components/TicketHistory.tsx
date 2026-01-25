import React, { useState, useMemo } from 'react';
import type { Ticket } from '../types';
import { Star, Clock, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TicketHistoryProps {
    tickets: Ticket[];
    onRate: (ticketId: string) => void;
}

const CompactTicketRow = ({ ticket, onRate }: { ticket: Ticket, onRate: (id: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const isCompleted = ticket.status === 'COMPLETED';

    return (
        <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div
                onClick={() => setExpanded(!expanded)}
                className="py-3 px-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        ticket.status === 'COMPLETED' ? "bg-green-500" : "bg-red-500"
                    )} />
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-200">{ticket.category}</h4>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            {new Date(ticket.created_at).toLocaleDateString()} • {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Rating Indicator */}
                    {isCompleted && (
                        <div className="text-xs font-bold text-yellow-500 flex items-center gap-1">
                            {ticket.customer_rating ? (
                                <><span>{ticket.customer_rating}</span><Star size={10} fill="currentColor" /></>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRate(ticket.id); }}
                                    className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded text-[10px] hover:underline"
                                >
                                    Rate
                                </button>
                            )}
                        </div>
                    )}
                    <ChevronRight size={14} className={cn("text-gray-400 transition-transform", expanded && "rotate-90")} />
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-gray-50/50 dark:bg-black/20"
                    >
                        <div className="p-4 pt-0 text-sm space-y-3">
                            {/* Description */}
                            <div className="pt-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Issue Description</p>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 text-xs leading-relaxed">{ticket.description}</p>
                            </div>

                            {/* Technician */}
                            {ticket.technician && (
                                <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                                            {ticket.technician.full_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-900 dark:text-white">{ticket.technician.full_name}</p>
                                            <p className="text-[10px] text-gray-400">Technician</p>
                                        </div>
                                    </div>
                                    {!['COMPLETED', 'CANCELLED', 'CLOSED'].includes(ticket.status) && (
                                        <span className="text-[10px] text-gray-400 font-mono">{ticket.technician.mobile}</span>
                                    )}
                                </div>
                            )}

                            {/* Cancel Reason */}
                            {ticket.status === 'CANCELLED' && ticket.rejection_reason && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                                    <p className="text-[10px] text-red-500 font-bold">Cancellation Reason</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">{ticket.rejection_reason}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const TicketHistory: React.FC<TicketHistoryProps> = ({ tickets, onRate }) => {
    // Group tickets by Month-Year
    const groupedTickets = useMemo(() => {
        const groups: Record<string, Ticket[]> = {};
        tickets.forEach(t => {
            const date = new Date(t.created_at);
            const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });
        return groups;
    }, [tickets]);

    if (tickets.length === 0) {
        return (
            <div className="p-6 text-center text-gray-400 text-sm italic border rounded-2xl border-dashed border-gray-200 dark:border-gray-700">
                No past history available.
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <Clock size={16} className="text-cyan-600" />
                    History Log
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {tickets.length} Tickets
                </span>
            </div>

            {/* Scrollable List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-4">
                {Object.entries(groupedTickets).map(([month, monthTickets]) => (
                    <div key={month} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 px-2 mb-2">
                            <Calendar size={12} className="text-gray-400" />
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{month}</h4>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                            {monthTickets.map(ticket => (
                                <CompactTicketRow key={ticket.id} ticket={ticket} onRate={onRate} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TicketHistory;
