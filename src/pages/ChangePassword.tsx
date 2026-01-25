import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Lock, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const ChangePassword: React.FC = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { profile, session, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user) return;

        setError('');

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            // 1. Update Password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            // 2. Update force_password_change flag
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ force_password_change: false })
                .eq('id', session.user.id);

            if (profileError) throw profileError;

            // 3. Update local profile state
            await refreshProfile();

            // 4. Redirect back to dashboard logic (App.tsx will handle the redirect based on role)
            navigate('/', { replace: true });

        } catch (err: any) {
            setError(err.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">

            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] bg-yellow-600/10 rounded-full blur-[100px] mix-blend-screen animate-pulse" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-gray-900/40 backdrop-blur-xl border border-yellow-500/20 rounded-3xl shadow-2xl overflow-hidden">

                    <div className="p-8 pb-6 text-center border-b border-white/5 bg-white/5">
                        <motion.div
                            initial={{ rotate: -10, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20"
                        >
                            <Key className="text-white" size={32} />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-white mb-2">Change Password</h1>
                        <p className="text-gray-400 text-sm">
                            Hello {profile?.full_name || 'User'}, for security reasons, please change your default password to continue.
                        </p>
                    </div>

                    <div className="p-8 pt-6">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200">
                                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">New Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-400 transition-colors pointer-events-none">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:bg-white/5 transition-all font-medium"
                                        placeholder="New password"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Confirm New Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-400 transition-colors pointer-events-none">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:bg-white/5 transition-all font-medium"
                                        placeholder="Confirm new password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/25 flex items-center justify-center gap-2 group relative overflow-hidden",
                                    loading && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Update Password
                                        <CheckCircle className="group-hover:scale-110 transition-transform" size={20} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ChangePassword;
