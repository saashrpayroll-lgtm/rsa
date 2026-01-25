import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Shield, Lock, Key, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

const AdminLoginPage: React.FC = () => {
    const [identifier, setIdentifier] = useState(''); // Email or Mobile
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Simple heuristic to detect mobile number vs email
            let email = identifier;
            if (!identifier.includes('@')) {
                email = `${identifier}@hub.com`; // Pseudo-email for mobile login
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) throw signInError;

            // Check if admin
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role, force_password_change').eq('id', user.id).single();

                if (profile?.role !== 'admin') {
                    throw new Error('Access Denied. Admins Only.');
                }

                if (profile?.force_password_change || password === '123456') {
                    // Force change if flag is set OR if using default password
                    navigate('/change-password');
                    return;
                }
            }

            navigate('/admin');
        } catch (err: any) {
            console.error('Admin Login error:', err);
            setError(err.message || 'Authentication Failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative font-sans">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-8 bg-slate-900/50 border-b border-slate-700 text-center">
                        <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4 border border-slate-600">
                            <Shield size={32} className="text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{t('auth.admin_login_title')}</h1>
                        <p className="text-slate-400 text-sm mt-1">{t('auth.secure_connection')}</p>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-3 text-red-400">
                                <AlertCircle size={18} />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('auth.mobile_placeholder')}</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                                        placeholder={t('auth.mobile_placeholder')}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('auth.password_placeholder')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2",
                                    loading && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <>{t('auth.admin_login_button')} <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </div>
                </div>
                <p className="text-center text-slate-600 text-xs mt-6">System v2.4.0 • Secure Connection</p>
            </motion.div>
        </div>
    );
};

export default AdminLoginPage;
