import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { History, RotateCcw, User, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { Ticket } from '../../types';

interface AuditLog {
    id: string;
    actor_name: string;
    action_type: string;
    previous_state: Partial<Ticket>;
    new_state: Partial<Ticket>;
    reason: string;
    created_at: string;
}

interface TicketAuditTimelineProps {
    ticketId: string;
    onRollback: () => void;
}

const TicketAuditTimeline: React.FC<TicketAuditTimelineProps> = ({ ticketId, onRollback }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [rollingBack, setRollingBack] = useState<string | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_ticket_audit_history', { p_ticket_id: ticketId });
            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Fetch logs failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();

        // Subscribe to Realtime Changes
        const channel = supabase
            .channel(`audit_log_${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ticket_audit_logs',
                    filter: `ticket_id=eq.${ticketId}`
                },
                (payload) => {
                    // Optimistically add new log or re-fetch
                    const newLog = payload.new as AuditLog;
                    setLogs(prev => [newLog, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketId]);

    const handleRollback = async (logId: string) => {
        if (!confirm('Are you sure you want to ROLLBACK this action? This will revert the ticket state.')) return;

        const reason = prompt('Please provide a reason for this rollback (Mandatory):');
        if (!reason) return alert('Rollback cancelled. Reason is required.');

        setRollingBack(logId);
        try {
            const { error } = await supabase.rpc('rollback_ticket', {
                p_log_id: logId,
                p_reason: reason
            });

            if (error) throw error;

            alert('Rollback successful.');
            fetchLogs();
            onRollback(); // Trigger parent refresh
        } catch (e: any) {
            console.error(e);
            alert('Rollback failed: ' + e.message);
        } finally {
            setRollingBack(null);
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500 text-xs">Loading audit history...</div>;
    if (logs.length === 0) return <div className="p-4 text-center text-gray-500 text-xs italic">No audit history found.</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <History size={14} /> Audit Trail
            </h3>

            <div className="relative pl-4 border-l border-gray-700 space-y-6">
                {logs.map((log) => (
                    <div key={log.id} className="relative">
                        {/* Dot */}
                        <div className={cn(
                            "absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-[#0a0a0f]",
                            log.action_type === 'ROLLBACK' ? "bg-red-500" : "bg-blue-500"
                        )} />

                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                        log.action_type === 'ROLLBACK' ? "bg-red-900/50 text-red-300" :
                                            log.action_type === 'STATUS_CHANGE' ? "bg-blue-900/50 text-blue-300" :
                                                "bg-gray-700 text-gray-300"
                                    )}>
                                        {log.action_type.replace('_', ' ')}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <User size={10} /> {log.actor_name || 'System'}
                                        <span>•</span>
                                        {new Date(log.created_at).toLocaleString()}
                                    </p>
                                </div>
                                {log.action_type !== 'ROLLBACK' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 border-dashed border-gray-600 text-gray-400 hover:text-white hover:bg-red-900/20 hover:border-red-500"
                                        onClick={() => handleRollback(log.id)}
                                        loading={rollingBack === log.id}
                                    >
                                        <RotateCcw size={10} className="mr-1" /> Revert
                                    </Button>
                                )}
                            </div>

                            {/* Changes */}
                            <div className="space-y-1">
                                {log.action_type === 'STATUS_CHANGE' && log.previous_state.status !== log.new_state.status && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-400 line-through">{log.previous_state.status}</span>
                                        <ArrowRight size={10} className="text-gray-500" />
                                        <span className="text-white font-bold">{log.new_state.status}</span>
                                    </div>
                                )}

                                {log.reason && (
                                    <p className="text-xs text-gray-400 italic mt-2 border-l-2 border-gray-600 pl-2">
                                        "{log.reason}"
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TicketAuditTimeline;
