import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { RiderMaster } from '../../types';
import { Button } from '../../components/ui/Button';
import {
    RefreshCw, Search, UserCheck, FileSpreadsheet, CheckCircle2,
    ArrowLeft, ArrowUpDown, ShieldAlert, ShieldCheck, Eye, EyeOff,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

// Google Sheets API Constants
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const RiderManagement: React.FC = () => {
    const navigate = useNavigate();
    const [riders, setRiders] = useState<RiderMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sheetId, setSheetId] = useState('');
    const [syncStats, setSyncStats] = useState<{ total: number, success: number, updated: number } | null>(null);

    // Advanced Features
    const [autoSync, setAutoSync] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof RiderMaster, direction: 'asc' | 'desc' } | null>(null);
    const [selectedRider, setSelectedRider] = useState<RiderMaster | null>(null); // For Modal

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Refs for Auto Sync
    const autoSyncInterval = useRef<any>(null);

    useEffect(() => {
        fetchRiders();

        // Load settings
        const savedSheetId = localStorage.getItem('rider_master_sheet_id');
        if (savedSheetId) setSheetId(savedSheetId);

        // Realtime Subscription
        const subscription = supabase
            .channel('rider_master_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_master' }, () => {
                fetchRiders(false); // Silent refresh
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
            if (autoSyncInterval.current) clearInterval(autoSyncInterval.current);
        };
    }, []);

    // Effect for Auto Sync Toggle
    useEffect(() => {
        if (autoSync) {
            handleSync(true); // Initial sync
            autoSyncInterval.current = setInterval(() => {
                handleSync(true);
            }, 10000); // 10 sec
        } else {
            if (autoSyncInterval.current) clearInterval(autoSyncInterval.current);
        }
    }, [autoSync]);

    const fetchRiders = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        const { data, error } = await supabase
            .from('rider_master')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) console.error('Error fetching riders:', error);
        else setRiders(data as RiderMaster[] || []);
        if (showLoading) setLoading(false);
    };

    const handleSync = async (isAuto = false) => {
        if (!sheetId) {
            if (!isAuto) alert('Please enter a valid Google Sheet ID');
            return;
        }

        if (!isAuto) setSyncing(true);
        if (!isAuto) setSyncStats(null);
        localStorage.setItem('rider_master_sheet_id', sheetId);

        try {
            // 1. Fetch from Google Sheets
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:H?key=${GOOGLE_API_KEY}`);
            const result = await response.json();

            if (result.error) throw new Error(result.error.message);

            const rows = result.values;
            if (!rows || rows.length < 2) return;

            // 2. Parse Data
            const parseDate = (dateStr: string) => {
                if (!dateStr) return null;
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return dateStr;
            };

            const ridersToUpsert = rows.slice(1).map((row: any[]) => {
                const cleanMobile = (row[2] || '').replace(/\D/g, '');
                return {
                    custom_rider_id: row[0] ? String(row[0]) : null,
                    full_name: row[1] || 'Unknown',
                    mobile: cleanMobile ? String(cleanMobile) : '',
                    chassis_number: row[3] || '',
                    wallet_balance: parseFloat(row[4] || '0'),
                    allotment_date: parseDate(row[5]),
                    team_leader_name: row[6] || '',
                    team_leader_mobile: row[7] || '',
                    updated_at: new Date().toISOString()
                };
            }).filter((r: any) => r.mobile && r.mobile.length >= 10);

            if (ridersToUpsert.length === 0) return;

            // 3. Upsert
            const { error } = await supabase.rpc('sync_riders', { riders_data: ridersToUpsert });
            if (error) throw error;

            if (!isAuto) {
                setSyncStats({
                    total: ridersToUpsert.length,
                    success: ridersToUpsert.length,
                    updated: ridersToUpsert.length
                });
                alert(`Sync Complete! Processed ${ridersToUpsert.length} rows.`);
                await fetchRiders();
            }

        } catch (error: any) {
            console.error('Sync failed:', error);
            if (!isAuto) alert(`Sync Failed: ${error.message}`);
        } finally {
            if (!isAuto) setSyncing(false);
        }
    };

    const toggleRiderStatus = async (rider: RiderMaster) => {
        const newStatus = rider.status === 'suspended' ? 'active' : 'suspended';
        const confirmMsg = newStatus === 'suspended'
            ? `Are you sure you want to BLOCK ${rider.full_name}? They will not be able to login.`
            : `Unblock ${rider.full_name}?`;

        if (!confirm(confirmMsg)) return;

        // 1. Update Rider Master
        const { error: masterError } = await supabase
            .from('rider_master')
            .update({ status: newStatus })
            .eq('id', rider.id);

        if (masterError) {
            alert('Failed to update status');
            return;
        }

        // 2. Update Profile (if exists) to enforce immediate effect
        await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('mobile', rider.mobile);

        fetchRiders(false);
        if (selectedRider) setSelectedRider(prev => prev ? { ...prev, status: newStatus } : null);
    };

    const handleSort = (key: keyof RiderMaster) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter & Sort Logic
    const processedRiders = React.useMemo(() => {
        let result = [...riders];

        // Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.full_name.toLowerCase().includes(lowerTerm) ||
                r.mobile.includes(lowerTerm) ||
                (r.custom_rider_id && r.custom_rider_id.toLowerCase().includes(lowerTerm))
            );
        }

        if (filterStatus !== 'all') {
            result = result.filter(r => (r.status || 'active') === filterStatus);
        }

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key] ?? '';
                const bVal = b[sortConfig.key] ?? '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [riders, searchTerm, filterStatus, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(processedRiders.length / rowsPerPage);
    const paginatedRiders = processedRiders.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserCheck className="text-cyan-600 dark:text-cyan-400" /> Rider Master Data
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage Rider Identities & Access</p>
                    </div>
                </div>

                {/* Sync & Auto-Sync Controls */}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl border border-gray-700">
                        <FileSpreadsheet className="text-green-500 ml-2" size={20} />
                        <input
                            type="text"
                            placeholder="Sheet ID"
                            className="bg-transparent border-none text-white text-sm focus:ring-0 w-32"
                            value={sheetId}
                            onChange={(e) => setSheetId(e.target.value)}
                        />
                        <div className="h-6 w-px bg-gray-700 mx-2" />
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer mr-2">
                            <input
                                type="checkbox"
                                checked={autoSync}
                                onChange={(e) => setAutoSync(e.target.checked)}
                                className="rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-offset-gray-900"
                            />
                            Auto (10s)
                        </label>
                        <Button
                            size="sm"
                            onClick={() => handleSync()}
                            loading={syncing}
                            className="bg-green-600 hover:bg-green-500 text-white"
                            icon={<RefreshCw size={16} className={cn(autoSync && "animate-spin")} />}
                        >
                            {syncing ? 'Syncing...' : 'Sync'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sync Stats Notification */}
            {syncStats && (
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={20} />
                    <div>
                        <span className="font-bold">Sync Report:</span> {syncStats.total} riders processed. {syncStats.success} updated.
                    </div>
                </div>
            )}

            {/* Controls Bar */}
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search Riders..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-cyan-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1); // Reset to page 1 on search
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
                            className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === 'all' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                        >
                            All
                        </button>
                        <button
                            onClick={() => { setFilterStatus('active'); setCurrentPage(1); }}
                            className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === 'active' ? "bg-green-500/20 text-green-400" : "text-gray-400 hover:text-green-400")}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => { setFilterStatus('suspended'); setCurrentPage(1); }}
                            className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", filterStatus === 'suspended' ? "bg-red-500/20 text-red-400" : "text-gray-400 hover:text-red-400")}
                        >
                            Blocked
                        </button>
                    </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">Rows:</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-gray-900 border border-gray-700 rounded-lg text-white text-xs px-2 py-1 outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <div className="text-gray-400 text-sm">
                        <span className="text-white font-bold">
                            {Math.min((currentPage - 1) * rowsPerPage + 1, processedRiders.length)} - {Math.min(currentPage * rowsPerPage, processedRiders.length)}
                        </span>
                        <span className="mx-1">of</span>
                        <span className="text-white font-bold">{loading ? '...' : processedRiders.length}</span>
                    </div>

                    <div className="flex bg-gray-900 rounded-lg border border-gray-700 p-1">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-gray-800 text-gray-300 uppercase font-bold text-xs">
                            <tr>
                                <th onClick={() => handleSort('custom_rider_id')} className="p-4 cursor-pointer hover:text-white transition-colors">
                                    <div className="flex items-center gap-1">ID <ArrowUpDown size={12} /></div>
                                </th>
                                <th onClick={() => handleSort('full_name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                                    <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4">Contact</th>
                                <th className="p-4">Chassis / Allotment</th>
                                <th onClick={() => handleSort('wallet_balance')} className="p-4 cursor-pointer hover:text-white transition-colors">
                                    <div className="flex items-center gap-1">Wallet <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {paginatedRiders.map((rider) => (
                                <tr key={rider.id} className="hover:bg-gray-800/50 transition-colors group">
                                    <td className="p-4">
                                        <button
                                            onClick={() => setSelectedRider(rider)}
                                            className="font-mono text-cyan-400 font-bold hover:underline hover:text-cyan-300"
                                        >
                                            {rider.custom_rider_id || 'N/A'}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white">{rider.full_name}</div>
                                        <div className="text-xs text-gray-500">{rider.team_leader_name ? `TL: ${rider.team_leader_name}` : 'No TL'}</div>
                                    </td>
                                    <td className="p-4 font-mono">{rider.mobile}</td>
                                    <td className="p-4">
                                        <div className="font-mono text-white">{rider.chassis_number || '-'}</div>
                                        <div className="text-xs text-gray-500">
                                            {rider.allotment_date ? new Date(rider.allotment_date).toLocaleDateString() : 'No Date'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn("font-bold px-2 py-1 rounded bg-opacity-20",
                                            rider.wallet_balance < 0 ? "bg-red-900 text-red-200" : "bg-green-900 text-green-200"
                                        )}>
                                            ₹{rider.wallet_balance}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {rider.status === 'suspended' ? (
                                            <span className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase bg-red-500/10 px-2 py-1 rounded w-fit">
                                                <ShieldAlert size={12} /> Blocked
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-green-400 text-xs font-bold uppercase bg-green-500/10 px-2 py-1 rounded w-fit">
                                                <CheckCircle2 size={12} /> Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setSelectedRider(rider)}
                                                className="p-2 hover:bg-cyan-500/20 rounded-full text-cyan-400 transition-colors"
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => toggleRiderStatus(rider)}
                                                className={cn("p-2 rounded-full transition-colors",
                                                    rider.status === 'suspended' ? "hover:bg-green-500/20 text-green-400" : "hover:bg-red-500/20 text-red-400"
                                                )}
                                                title={rider.status === 'suspended' ? "Unblock Login" : "Block Login"}
                                            >
                                                {rider.status === 'suspended' ? <ShieldCheck size={16} /> : <EyeOff size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {processedRiders.length === 0 && (
                        <div className="p-10 text-center text-gray-500">
                            No riders found matching your criteria.
                        </div>
                    )}
                </div>
            </div>

            {/* Rider Details Modal */}
            {selectedRider && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-sm font-mono">
                                        {selectedRider.custom_rider_id}
                                    </span>
                                    {selectedRider.full_name}
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">Rider Profile</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRider(null)}>Close</Button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 uppercase">Mobile</label>
                                    <p className="text-white font-mono">{selectedRider.mobile}</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 uppercase">Status</label>
                                    <p className={cn("font-bold", selectedRider.status === 'suspended' ? "text-red-400" : "text-green-400")}>
                                        {selectedRider.status ? selectedRider.status.toUpperCase() : 'ACTIVE'}
                                    </p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 uppercase">Wallet Balance</label>
                                    <p className={cn("font-bold text-lg", selectedRider.wallet_balance < 0 ? "text-red-400" : "text-green-400")}>
                                        ₹{selectedRider.wallet_balance}
                                    </p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 uppercase">Chassis NO.</label>
                                    <p className="text-white font-mono text-sm">{selectedRider.chassis_number || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg col-span-2">
                                    <label className="text-xs text-gray-500 uppercase">Allotment Date</label>
                                    <p className="text-white font-mono text-sm">
                                        {selectedRider.allotment_date ? new Date(selectedRider.allotment_date).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-4">
                                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase">Team Info</h3>
                                <div className="flex items-center gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                                        TL
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{selectedRider.team_leader_name || 'No Team Leader'}</p>
                                        <p className="text-xs text-gray-500">{selectedRider.team_leader_mobile}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-950 flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                className={cn("border-gray-700 text-gray-300",
                                    selectedRider.status === 'suspended' ? "hover:border-green-500 hover:text-green-400" : "hover:border-red-500 hover:text-red-400"
                                )}
                                onClick={() => toggleRiderStatus(selectedRider)}
                            >
                                {selectedRider.status === 'suspended' ? "Unblock Rider" : "Block Rider"}
                            </Button>
                            <Button onClick={() => setSelectedRider(null)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiderManagement;
