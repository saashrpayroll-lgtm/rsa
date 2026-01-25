import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Ticket } from '../../types';
import { Button } from '../ui/Button';
import {
    Trash2, XCircle, CheckCircle, RotateCcw,
    Edit2, PauseCircle, PlayCircle, ShieldAlert, X
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Enhanced Admin Controls with Polished UI and "Pause" feature

interface AdminTicketControlsProps {
    ticket: Ticket & { is_paused?: boolean };
    onUpdate: () => void;
    onClose: () => void;
}

const AdminTicketControls: React.FC<AdminTicketControlsProps> = ({ ticket, onUpdate, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<'STATUS' | 'EDIT' | 'DELETE' | 'PAUSE' | 'PRIORITY'>('STATUS');
    const [targetAction, setTargetAction] = useState<string | null>(null); // e.g., 'COMPLETED' or 'HIGH'
    const [reason, setReason] = useState('');

    // Edit Fields
    const [editDesc, setEditDesc] = useState(ticket.description || '');
    const [editLoc, setEditLoc] = useState(ticket.location_address || '');

    const openDialog = (type: 'STATUS' | 'EDIT' | 'DELETE' | 'PAUSE' | 'PRIORITY', action?: string) => {
        setDialogType(type);
        setTargetAction(action || null);
        setReason(''); // Reset reason
        setDialogOpen(true);
    };

    const executeAction = async () => {
        if (!reason.trim()) {
            alert('A reason is MANDATORY for the Audit Log.');
            return;
        }

        setLoading(true);
        try {
            let updates: any = {};
            let actionType = '';

            if (dialogType === 'DELETE') {
                const { error } = await supabase.from('tickets').delete().eq('id', ticket.id);
                if (error) throw error;
                alert('Ticket Permanently Deleted.');
                onClose();
                return;
            }

            if (dialogType === 'STATUS' && targetAction) {
                updates = { status: targetAction };
                actionType = 'STATUS_CHANGE';
            } else if (dialogType === 'PRIORITY' && targetAction) {
                // Merge existing analysis with new severity
                const currentAnalysis = ticket.ai_analysis || {};
                updates = {
                    ai_analysis: { ...currentAnalysis, severity: targetAction }
                };
                actionType = 'PRIORITY_UPDATE';
            } else if (dialogType === 'EDIT') {
                updates = { description: editDesc, location_address: editLoc };
                actionType = 'EDIT';
            } else if (dialogType === 'PAUSE') {
                updates = { is_paused: !ticket.is_paused };
                actionType = ticket.is_paused ? 'RESUME' : 'PAUSE';
            }

            if (actionType) {
                const { error } = await supabase.rpc('admin_update_ticket', {
                    p_ticket_id: ticket.id,
                    p_updates: updates,
                    p_reason: reason,
                    p_action_type: actionType
                });
                if (error) throw error;
                onUpdate();
            }

            setDialogOpen(false);
        } catch (e: any) {
            console.error(e);
            alert('Action Failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const [isCollapsed, setIsCollapsed] = useState(false);

    // Quick Reasons
    const quickReasons = ['Customer Request', 'Technician Unavailable', 'Mistake/Error', 'Testing', 'Priority Escalation'];

    const setReasonFromChip = (r: string) => {
        setReason(prev => prev ? `${prev}, ${r}` : r);
    };

    return (
        <div className="mb-6 animate-in slide-in-from-top-2">
            {/* Control Bar Header */}
            <div className={cn(
                "rounded-t-xl border p-4 shadow-lg transition-all flex justify-between items-center cursor-pointer group",
                ticket.is_paused
                    ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500/50"
                    : "bg-white dark:bg-gray-900/80 border-red-500/20"
            )} onClick={() => setIsCollapsed(!isCollapsed)}>

                <div className="flex items-center gap-2">
                    <ShieldAlert className={ticket.is_paused ? "text-yellow-600 dark:text-yellow-500" : "text-red-500 dark:text-red-400"} size={20} />
                    <div>
                        <h3 className={cn("text-sm font-black uppercase tracking-wider", ticket.is_paused ? "text-yellow-700 dark:text-yellow-400" : "text-red-600 dark:text-red-400")}>
                            {ticket.is_paused ? 'WORKFLOW PAUSED' : 'ADMIN OVERRIDE PANEL'}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                            {isCollapsed ? 'Click to Expand Controls' : 'Full Control Access Granted'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Pause Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); openDialog('PAUSE'); }}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm hover:scale-105 active:scale-95",
                            ticket.is_paused
                                ? "bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500 shadow-yellow-500/50"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-black dark:hover:bg-gray-700"
                        )}
                    >
                        {ticket.is_paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        {ticket.is_paused ? 'RESUME' : 'PAUSE'}
                    </button>
                </div>
            </div>

            {/* Collapsible Body */}
            {!isCollapsed && (
                <div className={cn(
                    "rounded-b-xl border-x border-b p-4 shadow-lg backdrop-blur-md transition-all space-y-5",
                    ticket.is_paused
                        ? "bg-yellow-50/50 dark:bg-yellow-900/5 border-yellow-500/50"
                        : "bg-white/90 dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/50"
                )}>

                    {/* 1. Status Overrides - VIVID BUTTONS */}
                    <div>
                        <p className="text-[10px] uppercase text-gray-500 font-black tracking-wider mb-2">Force Status Change</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* PENDING */}
                            <button
                                onClick={() => openDialog('STATUS', 'PENDING')}
                                disabled={ticket.is_paused}
                                className={cn("py-3 rounded-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100",
                                    "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border border-blue-400"
                                )}>
                                <RotateCcw size={16} className="mb-1 text-blue-100" />
                                <span className="text-[10px] font-bold tracking-wide">RESET PENDING</span>
                            </button>

                            {/* ACCEPTED */}
                            <button
                                onClick={() => openDialog('STATUS', 'ACCEPTED')}
                                disabled={ticket.is_paused}
                                className={cn("py-3 rounded-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100",
                                    "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border border-purple-400"
                                )}>
                                <CheckCircle size={16} className="mb-1 text-purple-100" />
                                <span className="text-[10px] font-bold tracking-wide">FORCE ACCEPT</span>
                            </button>

                            {/* COMPLETED */}
                            <button
                                onClick={() => openDialog('STATUS', 'COMPLETED')}
                                disabled={ticket.is_paused}
                                className={cn("py-3 rounded-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100",
                                    "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border border-emerald-400"
                                )}>
                                <CheckCircle size={16} className="mb-1 text-emerald-100" />
                                <span className="text-[10px] font-bold tracking-wide">FORCE COMPLETE</span>
                            </button>

                            {/* CANCELLED */}
                            <button
                                onClick={() => openDialog('STATUS', 'CANCELLED')}
                                disabled={ticket.is_paused}
                                className={cn("py-3 rounded-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100",
                                    "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border border-red-400"
                                )}>
                                <XCircle size={16} className="mb-1 text-red-100" />
                                <span className="text-[10px] font-bold tracking-wide">FORCE CANCEL</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. Priority & Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] uppercase text-gray-500 font-black tracking-wider mb-2">Priority Level</p>
                            <div className="flex gap-2 p-1">
                                {['LOW', 'NORMAL', 'HIGH'].map(p => {
                                    const isActive = ticket.ai_analysis?.severity === p;
                                    let colorClass = "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200";
                                    if (p === 'LOW') colorClass = isActive ? "bg-green-500 text-white ring-2 ring-green-300" : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400";
                                    if (p === 'NORMAL') colorClass = isActive ? "bg-blue-500 text-white ring-2 ring-blue-300" : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
                                    if (p === 'HIGH') colorClass = isActive ? "bg-red-500 text-white ring-2 ring-red-300" : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400";

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => openDialog('PRIORITY', p)}
                                            className={cn("flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-md", colorClass)}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-gray-500 font-black tracking-wider mb-2">Assignment</p>
                            <button
                                onClick={() => openDialog('STATUS', 'PENDING')}
                                className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-red-500 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02]"
                            >
                                <XCircle size={14} /> Unassign Technician
                            </button>
                        </div>
                    </div>


                    {/* 3. Modify Data */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => openDialog('EDIT')}
                            className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600 rounded-lg p-2 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <Edit2 size={14} /> Edit Details
                        </button>
                        <button
                            onClick={() => openDialog('DELETE')}
                            className="bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg p-2 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <Trash2 size={14} /> Delete Ticket
                        </button>
                    </div>
                </div>
            )}

            {/* ACTION DIALOG / MODAL (Themed) */}
            {dialogOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl relative overflow-hidden">
                        <button onClick={() => setDialogOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>

                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                {dialogType === 'DELETE' ? <Trash2 className="text-red-500" /> : <ShieldAlert className="text-blue-500" />}
                                {dialogType === 'PAUSE' ? (ticket.is_paused ? 'Resume Workflow' : 'Pause Workflow') :
                                    dialogType === 'STATUS' ? 'Override Status' :
                                        dialogType === 'PRIORITY' ? 'Update Priority' :
                                            dialogType === 'EDIT' ? 'Edit Ticket Details' : 'Delete Ticket'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {dialogType === 'DELETE' ? "Permanent - Cannot be undone." : "Admin Action - Will be logged."}
                            </p>
                        </div>

                        <div className="p-6">
                            {/* NOTE: Inside Edit Helpers, ensure Inputs are themed */}
                            {dialogType === 'EDIT' && (
                                <div className="space-y-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Description</label>
                                        <textarea
                                            value={editDesc}
                                            onChange={e => setEditDesc(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-black dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Location Address</label>
                                        <input
                                            value={editLoc}
                                            onChange={e => setEditLoc(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-black dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* REASON INPUT */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                    Reason for Action <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {quickReasons.map(r => (
                                        <button key={r} onClick={() => setReasonFromChip(r)} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-full border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-gray-600 dark:text-gray-300 transition-colors">
                                            {r}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Type reason here..."
                                    className="w-full bg-white dark:bg-black/50 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-black dark:text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button variant="secondary" className="flex-1 border border-gray-300 dark:border-gray-600 text-black dark:text-white" onClick={() => setDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className={cn("flex-1 text-white", dialogType === 'DELETE' ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500")}
                                    onClick={executeAction}
                                    loading={loading}
                                >
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTicketControls;
