
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../types';
import { ArrowLeft, Users, Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Trash2, UserPlus, Key, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { UserDetailModal } from '../../components/admin/UserDetailModal';
import { useLanguage } from '../../contexts/LanguageContext';

const UserManagement = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingRequests, setPendingRequests] = useState<string[]>([]); // Array of user IDs or mobiles with pending requests

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof UserProfile | 'created_at', direction: 'asc' | 'desc' }>({ key: 'created_at' as any, direction: 'desc' });

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Modal
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isCreateMode, setIsCreateMode] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users
            const { data: userData, error: userError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (userError) throw userError;
            setUsers(userData || []);

            // 2. Fetch Pending Reset Requests
            const { data: requestData, error: requestError } = await supabase
                .from('password_reset_requests')
                .select('user_id, mobile')
                .eq('status', 'PENDING');

            if (requestError) console.error("Error fetching requests:", requestError);
            else {
                // Store user IDs that have pending requests
                const requestUserIds = requestData?.map(r => r.user_id).filter(Boolean) || [];
                setPendingRequests(requestUserIds);
            }

        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (user: UserProfile) => {
        if (!window.confirm(`Reset password for ${user.full_name} to '123456'?\n\nThis will also resolve any pending reset requests.`)) return;

        try {
            setLoading(true);

            // 1. Reset Password
            const { error: resetError } = await supabase.rpc('reset_user_password', { target_user_id: user.id });
            if (resetError) throw resetError;

            // 2. Resolve Request
            const { error: resolveError } = await supabase.rpc('resolve_reset_request', { target_user_id: user.id });
            if (resolveError) console.warn("Request resolution warning:", resolveError);

            // Optimistic Update: Remove badge immediately
            setPendingRequests(prev => prev.filter(id => id !== user.id));

            alert(`Password for ${user.full_name} reset to '123456'.`);
            fetchUsers(); // Silent Refresh
        } catch (err: any) {
            console.error('Error resetting password:', err);
            alert(`Failed to reset password: ${err.message}`);
            setLoading(false); // Only set loading false on error, success triggers fetchUsers which sets loading
        }
    };

    const handleDeleteUser = async (user: UserProfile) => {
        const isRider = user.role === 'rider';

        let confirmMessage = `Are you sure you want to PERMANENTLY DELETE ${user.full_name}? This cannot be undone.`;
        if (isRider) {
            confirmMessage += `\n\n⚠️ IMPORTANT: You MUST manually remove this rider from the Google Sheet also, or they will be re-created on the next sync!`;
        }

        if (!window.confirm(confirmMessage)) return;

        try {
            setLoading(true);
            const { error } = await supabase.rpc('delete_user_permanently', { target_user_id: user.id });

            if (error) throw error;

            alert('User deleted successfully.');
            fetchUsers();
        } catch (err: any) {
            console.error('Error deleting user:', err);
            alert(`Failed to delete user: ${err.message}`);
            setLoading(false);
        }
    };

    const handleSort = (key: keyof UserProfile) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
            user.mobile.includes(searchQuery) ||
            user.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === 'ALL' ||
            (roleFilter === 'TECHS' ? (user.role === 'hub_tech' || user.role === 'rsa_tech') : user.role === roleFilter);

        const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
    });

    // Sort Logic
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        // Specific handling for 'created_at' if it's not on UserProfile (e.g. use join date or metadata)
        // Assuming metadata has created_at or it's on the root for now, or fallback to 0
        const aValue = sortConfig.key === 'created_at' ? (a as any).created_at : a[sortConfig.key];
        const bValue = sortConfig.key === 'created_at' ? (b as any).created_at : b[sortConfig.key];

        if (!aValue) return 1;
        if (!bValue) return -1;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination Logic
    const totalPages = Math.ceil(sortedUsers.length / PAGE_SIZE);
    const paginatedUsers = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="p-6 bg-gray-900 min-h-screen">
            <button onClick={() => navigate('/admin')} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
                <ArrowLeft size={20} className="mr-2" /> {t('admin.back_to_dashboard')}
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="text-indigo-400" /> {t('admin.user_management')}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={fetchUsers}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-colors shadow-sm"
                    >
                        {t('common.refresh')}
                    </button>
                    <button
                        onClick={() => { setIsCreateMode(true); setSelectedUser({} as any); }} // Empty user for modal
                        className="px-4 py-2 bg-indigo-600 border border-transparent rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <UserPlus size={18} />
                        {t('admin.add_technician')}
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 mb-6 space-y-4 md:space-y-0 md:flex md:gap-4 md:items-end">
                {/* Search */}
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Search Users</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder={t('admin.search_users')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-full bg-gray-700 border border-gray-600 rounded-lg py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                {/* Role Filter */}
                <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                        <option value="ALL">{t('admin.all_roles')}</option>
                        <option value="rider">Rider</option>
                        <option value="hub_tech">Hub Tech</option>
                        <option value="rsa_tech">RSA Tech</option>
                        <option value="TECHS">All Techs</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                {/* Status Filter */}
                <div className="w-full md:w-36">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                    >
                        <option value="ALL">{t('admin.all_status')}</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>
            </div>

            {loading ? <div className="p-12 text-center text-gray-400">Loading users...</div> : (
                <div className="space-y-4">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="col-span-4 cursor-pointer flex items-center gap-1 hover:text-indigo-400" onClick={() => handleSort('full_name')}>
                            User Profile <ArrowUpDown className="h-3 w-3" />
                        </div>
                        <div className="col-span-3 cursor-pointer flex items-center gap-1 hover:text-indigo-400" onClick={() => handleSort('role')}>
                            Role <ArrowUpDown className="h-3 w-3" />
                        </div>
                        <div className="col-span-3 cursor-pointer flex items-center gap-1 hover:text-indigo-400" onClick={() => handleSort('status')}>
                            {t('common.status')} <ArrowUpDown className="h-3 w-3" />
                        </div>
                        <div className="col-span-2 text-right">{t('common.actions')}</div>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {paginatedUsers.map(user => (
                            <div
                                key={user.id}
                                className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-indigo-500/50 hover:bg-gray-750 transition-all group"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    {/* Profile */}
                                    <div className="col-span-1 md:col-span-4 flex items-center gap-4 cursor-pointer" onClick={() => { setIsCreateMode(false); setSelectedUser(user); }}>
                                        <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-sm font-bold text-indigo-300 border border-indigo-500/30">
                                            {user.full_name?.charAt(0) || user.mobile.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-medium group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                                                {user.full_name || 'Unknown User'}
                                                {pendingRequests.includes(user.id) && (
                                                    <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20 flex items-center gap-1">
                                                        <AlertCircle size={10} /> Reset Requested
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-gray-400 text-sm">{user.mobile}</p>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div className="col-span-1 md:col-span-3 cursor-pointer" onClick={() => { setIsCreateMode(false); setSelectedUser(user); }}>
                                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border",
                                            user.role === 'admin' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                                                user.role.includes('tech') ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" :
                                                    "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                                        )}>
                                            {user.role.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1 md:col-span-3 flex items-center gap-2 cursor-pointer" onClick={() => { setIsCreateMode(false); setSelectedUser(user); }}>
                                        <span className={cn("w-2 h-2 rounded-full", (user.status === 'active' || !user.status) ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500")}></span>
                                        <span className="text-gray-300 text-sm capitalize">{user.status || 'Active'}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 md:col-span-2 flex justify-end gap-2">
                                        <button
                                            onClick={() => handleResetPassword(user)}
                                            className={cn("p-2 rounded-lg transition-colors relative",
                                                pendingRequests.includes(user.id) ? "bg-orange-500/20 text-orange-500 hover:bg-orange-500 hover:text-white" : "hover:bg-gray-700 text-gray-500 hover:text-white"
                                            )}
                                            title="Reset Password to '123456'"
                                        >
                                            <Key className="h-4 w-4" />
                                            {pendingRequests.includes(user.id) && (
                                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setIsCreateMode(false); setSelectedUser(user); }}
                                            className="p-2 hover:bg-gray-700 rounded-lg text-gray-500 hover:text-white transition-colors"
                                            title="Edit User"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="p-2 hover:bg-red-900/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                                            title="Delete User"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {paginatedUsers.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No users found matching your filters.
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                            <p className="text-sm text-gray-500">
                                {t('admin.showing')} <span className="text-white font-medium">{(page - 1) * PAGE_SIZE + 1}</span> {t('admin.to')} <span className="text-white font-medium">{Math.min(page * PAGE_SIZE, sortedUsers.length)}</span> {t('admin.of')} <span className="text-white font-medium">{sortedUsers.length}</span>
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Edit/Create Modal */}
            {selectedUser && (
                <UserDetailModal
                    user={selectedUser}
                    isCreateMode={isCreateMode}
                    onClose={() => setSelectedUser(null)}
                    onUpdate={fetchUsers}
                />
            )}
        </div>
    );
};

export default UserManagement;
