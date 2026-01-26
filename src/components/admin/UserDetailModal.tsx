
import React, { useState } from 'react';
import type { UserProfile, UserRole } from '../../types';
import { supabase } from '../../lib/supabase'; // Adjust as needed
import { X, Save, User, Phone, Shield, Power } from 'lucide-react';
import { cn } from '../../lib/utils'; // Adjust as needed

interface UserDetailModalProps {
    user?: UserProfile; // Optional for create mode
    onClose: () => void;
    onUpdate: () => void;
    isCreateMode?: boolean;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, onUpdate, isCreateMode = false }) => {
    // State initialization
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [mobile, setMobile] = useState(user?.mobile || '');
    const [role, setRole] = useState<UserRole>(user?.role || 'hub_tech');
    const [status, setStatus] = useState<'active' | 'suspended'>((user?.status as 'active' | 'suspended') || 'active');

    // Create Mode specific state

    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            if (isCreateMode) {
                // CREATE NEW USER
                if (!password || !fullName || !mobile) {
                    throw new Error("All fields are required for new users.");
                }

                // Auto-generate email to match AuthContext login logic
                const autoEmail = `${mobile}@hub.com`;

                const { error: rpcError } = await supabase.rpc('create_technician_user', {
                    p_email: autoEmail,
                    p_password: password,
                    p_full_name: fullName,
                    p_mobile: mobile,
                    p_role: role
                });

                if (rpcError) throw rpcError;

            } else {
                // UPDATE EXISTING USER
                if (!user) return;

                const { error: updateError } = await supabase.rpc('admin_update_user_details', {
                    target_user_id: user.id,
                    p_full_name: fullName,
                    p_mobile: mobile,
                    p_role: role,
                    p_status: status
                });

                if (updateError) throw updateError;
            }

            onUpdate(); // Refresh parent list
            onClose();

        } catch (err: any) {
            console.error('Error saving user:', err);
            setError(err.message || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={onClose}></div>
                </div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-700 relative z-10">

                    {/* Header */}
                    <div className="bg-gray-700/50 px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-700">
                        <h3 className="text-lg leading-6 font-medium text-white flex items-center gap-2">
                            {isCreateMode ? 'Create New Technician' : 'Edit User Details'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-5 sm:p-6 space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* ID Display (Read-only) - Only in Edit Mode */}
                        {!isCreateMode && user && (
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">User ID</label>
                                <div className="bg-gray-900/50 px-3 py-2 rounded-lg border border-gray-700 text-gray-500 text-sm font-mono truncate">
                                    {user.id}
                                </div>
                            </div>
                        )}

                        {/* Create Mode Only Fields */}
                        {isCreateMode && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Password <span className="text-red-400">*</span></label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="Min 6 characters"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Login ID will be generated as: <span className="font-mono text-indigo-400">{mobile || 'mobile'}@hub.com</span>
                                    </p>
                                </div>
                            </>
                        )}


                        {/* Name Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-9 w-full bg-gray-700 border border-gray-600 rounded-lg py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>

                        {/* Mobile Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Mobile Number <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.trim())}
                                    className="pl-9 w-full bg-gray-700 border border-gray-600 rounded-lg py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Enter mobile number"
                                />
                            </div>
                        </div>

                        {/* Role Dropdown */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Role <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as UserRole)}
                                    className="pl-9 w-full bg-gray-700 border border-gray-600 rounded-lg py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                                >
                                    {isCreateMode ? (
                                        <>
                                            <option value="hub_tech">Hub Technician</option>
                                            <option value="rsa_tech">RSA Technician</option>
                                            <option value="admin">Admin</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="rider">Rider</option>
                                            <option value="hub_tech">Hub Technician</option>
                                            <option value="rsa_tech">RSA Technician</option>
                                            <option value="admin">Admin</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Status Dropdown - Only Edit Mode */}
                        {!isCreateMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                                <div className="relative">
                                    <Power className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
                                        className={cn(
                                            "pl-9 w-full border rounded-lg py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none cursor-pointer font-medium",
                                            status === 'active' ? "bg-green-900/20 border-green-500/30 text-green-400" : "bg-red-900/20 border-red-500/30 text-red-400"
                                        )}
                                    >
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer */}
                    <div className="bg-gray-700/30 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-700 gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={loading}
                            className={cn(
                                "w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                                loading && "cursor-wait"
                            )}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {isCreateMode ? 'Creating...' : 'Saving...'}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    {isCreateMode ? 'Create User' : 'Save Changes'}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-600 shadow-sm px-4 py-2 bg-gray-800 text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
