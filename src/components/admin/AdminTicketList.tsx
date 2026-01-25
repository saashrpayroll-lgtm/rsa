import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Ticket } from '../../types';
import {
    Search, ChevronLeft, ChevronRight,
    MapPin, XCircle, AlertTriangle, ToggleLeft, ToggleRight, UserPlus
} from 'lucide-react';
import { Button } from '../ui/Button';
import TicketDetailView from '../technician/TicketDetailView';

interface AdminTicketListProps {
    initialStatus?: string[];
    title: string;
}

interface Technician {
    id: string;
    full_name: string;
    mobile: string;
    role: string;
    is_online: boolean;
    is_available: boolean;
    last_assigned_at: string | null;
}

export const AdminTicketList: React.FC<AdminTicketListProps> = ({ initialStatus, title }) => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(initialStatus ? 'ALL' : 'ALL');
    const [hubFilter, setHubFilter] = useState('ALL');
    const [hubs, setHubs] = useState<any[]>([]);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const PAGE_SIZE = 10;

    // Selection
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // New State for Assignment
    const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTicketId, setAssignTicketId] = useState<string | null>(null);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [assigning, setAssigning] = useState(false);

    // 1. Defined Outside useEffect to be accessible
    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('auto_assign_enabled')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching settings:', error);
                return;
            }

            if (data) {
                setAutoAssignEnabled(data.auto_assign_enabled);
            } else {
                console.warn('No settings found. Defaulting to true.');
            }
        } catch (err) {
            console.error('Unexpected error fetching settings:', err);
        }
    };

    // 2. Initial Fetch
    useEffect(() => {
        fetchSettings();
    }, []);

    // Fetch Hubs
    useEffect(() => {
        const fetchHubs = async () => {
            const { data } = await supabase.from('hubs').select('id, name').eq('status', 'ACTIVE');
            if (data) setHubs(data);
        };
        fetchHubs();
    }, []);

    const fetchTechnicians = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, mobile, role, is_online, is_available, last_assigned_at')
            .in('role', ['hub_tech', 'rsa_tech']);
        if (data) setTechnicians(data as Technician[]);
    };

    const toggleAutoAssign = async () => {
        // Optimistic update
        const newState = !autoAssignEnabled;
        setAutoAssignEnabled(newState);

        try {
            const { error } = await supabase.rpc('toggle_auto_assign', { enabled: newState });
            if (error) {
                throw error;
            }

            // Verify source of truth by re-fetching
            await fetchSettings();
        } catch (e: any) {
            console.error("Failed to toggle:", e);
            // Revert on error
            setAutoAssignEnabled(!newState);
            alert(`Failed to update setting: ${e.message || 'Unknown error'}`);
        }
    };

    const handleManualAssignClick = (ticketId: string) => {
        setAssignTicketId(ticketId);
        fetchTechnicians();
        setShowAssignModal(true);
    };

    const confirmAssignment = async (techId: string) => {
        if (!assignTicketId) return;
        setAssigning(true);
        try {
            const { error } = await supabase.rpc('manual_assign_ticket', {
                p_ticket_id: assignTicketId,
                p_tech_id: techId
            });
            if (error) throw error;

            setShowAssignModal(false);
            setAssignTicketId(null);
            fetchTickets();
        } catch (e: any) {
            console.error(e);
            alert('Assignment Failed');
        } finally {
            setAssigning(false);
        }
    };

    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('tickets')
                .select(`
                    *,
                    images,
                    voice_notes,
                    rider:rider_id (
                        full_name,
                        mobile
                    ),
                    technician:technician_id (
                        full_name
                    )
                `, { count: 'exact' });

            if (initialStatus) {
                if (statusFilter === 'ALL') {
                    query = query.in('status', initialStatus);
                } else {
                    query = query.eq('status', statusFilter);
                }
            } else {
                if (statusFilter !== 'ALL') {
                    query = query.eq('status', statusFilter);
                }
            }

            if (searchQuery) {
                // Determine if ticket_id column exists or just fallback to location
                // Since we might not have ticket_id yet, we try to use it cautiously or rely on user running SQL.
                // Safest is to try both or rely on what's available. 
                // For now, assuming user ran the SQL.
                query = query.or(`ticket_id.ilike.%${searchQuery}%, location_address.ilike.%${searchQuery}%`);
            }

            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to).order('created_at', { ascending: false });

            const { data, error, count } = await query;

            if (error) throw error;

            setTickets(data as any as Ticket[]);
            if (count) setTotalPages(Math.ceil(count / PAGE_SIZE));

        } catch (err: any) {
            console.error('Error fetching tickets:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();

        // Real-time subscription for Ticket List
        const channel = supabase
            .channel('admin_ticket_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [page, statusFilter, hubFilter, searchQuery, initialStatus]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
            case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            case 'CANCELLED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="space-y-6 min-h-screen bg-gray-900 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <a href="/admin" className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-indigo-500 transition-colors">
                        <ChevronLeft className="h-5 w-5" />
                    </a>
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700 px-4">
                        <span className="text-sm text-gray-400 font-medium">Auto-Assign (Round Robin)</span>
                        <button onClick={toggleAutoAssign} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                            {autoAssignEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-gray-600" />}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchTickets()}
                            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-colors shadow-sm"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-700 space-y-4 md:space-y-0 md:flex md:gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search Ticket ID, Location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full rounded-lg bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {(!initialStatus || initialStatus.length > 1) && (
                    <div className="w-full md:w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-lg bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="ALL">All Status</option>
                            {initialStatus ? initialStatus.map(s => <option key={s} value={s}>{s}</option>) : (
                                <>
                                    <option value="PENDING">Pending</option>
                                    <option value="ACCEPTED">Accepted</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </>
                            )}
                        </select>
                    </div>
                )}

                <div className="w-full md:w-48">
                    <select
                        value={hubFilter}
                        onChange={(e) => setHubFilter(e.target.value)}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="ALL">All Hubs</option>
                        {hubs.map(hub => (
                            <option key={hub.id} value={hub.id}>{hub.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading tickets...</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-400">Error: {error}</div>
                ) : tickets.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No tickets found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticket ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rider</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Technician</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {tickets.map((ticket) => (
                                    <tr
                                        key={ticket.id}
                                        className="hover:bg-gray-700 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('button')) return;
                                            setSelectedTicket(ticket);
                                        }}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                            {ticket.ticket_id || ticket.id.slice(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {formatDate(ticket.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold mr-3 border border-indigo-500/30">
                                                    {(ticket as any).rider?.full_name?.[0] || 'U'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{(ticket as any).rider?.full_name || 'Unknown'}</div>
                                                    <div className="text-sm text-gray-400">{(ticket as any).rider?.mobile || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                {ticket.category === 'RUNNING_REPAIR' || ticket.type === 'RUNNING_REPAIR' ? <MapPin className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                                {ticket.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 max-w-xs truncate" title={ticket.location_address}>
                                            {ticket.location_address || 'No address'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {(ticket as any).technician ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    {(ticket as any).technician?.full_name}
                                                </div>
                                            ) : (
                                                ticket.status === 'PENDING' ? (
                                                    <button
                                                        onClick={() => handleManualAssignClick(ticket.id)}
                                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                    >
                                                        <UserPlus size={12} /> Assign
                                                    </button>
                                                ) : 'Unassigned'
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="text-indigo-400 hover:text-indigo-300"
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-700">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-400">
                                Showing page <span className="font-medium text-white">{page}</span> of <span className="font-medium text-white">{totalPages}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-50"
                                >
                                    <span className="sr-only">Previous</span>
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-50"
                                >
                                    <span className="sr-only">Next</span>
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            {selectedTicket && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={() => setSelectedTicket(null)}></div>
                        </div>
                        <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-gray-700">
                            <div className="bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto text-white">
                                <TicketDetailView
                                    ticket={selectedTicket}
                                    onClose={() => { setSelectedTicket(null); fetchTickets(); }}
                                    onStatusUpdate={() => { fetchTickets(); setSelectedTicket(null); }}
                                    onComplete={() => { fetchTickets(); setSelectedTicket(null); }}
                                    onReject={() => { fetchTickets(); setSelectedTicket(null); }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Assign Technician</h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-white"><XCircle /></button>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
                            {technicians.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">No technicians found.</p>
                            ) : (
                                technicians.map(tech => (
                                    <div key={tech.id} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors">
                                        <div>
                                            <p className="font-bold text-white flex items-center gap-2">
                                                {tech.full_name}
                                                <span className={`w-2 h-2 rounded-full ${tech.is_online ? 'bg-green-500' : 'bg-gray-500'}`} title={tech.is_online ? 'Online' : 'Offline'} />
                                            </p>
                                            <p className="text-xs text-gray-400">{tech.role} • {tech.mobile}</p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                Last Assigned: {tech.last_assigned_at ? new Date(tech.last_assigned_at).toLocaleTimeString() : 'Never'}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            loading={assigning}
                                            disabled={assigning}
                                            onClick={() => confirmAssignment(tech.id)}
                                            className="bg-indigo-600 hover:bg-indigo-500"
                                        >
                                            Assign
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
