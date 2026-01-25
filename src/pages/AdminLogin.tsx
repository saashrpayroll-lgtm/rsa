import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminLogin: React.FC = () => {
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // AuthContext.signIn automatically appends @hub.com
            const { error } = await signIn(mobile, password);

            if (error) throw error;

            // PERSIST PORTAL IDENTITY
            localStorage.setItem('portal_type', 'admin');

            // Strict Role Check via separate fetch to ensure we have latest role
            // (Assuming useAuth updates profile, but for safety we check the returned hook state which might lag, 
            // so actually best to rely on the Redirect logic or check user metadata if possible, 
            // but for now we trust the auth flow, and the ProtectedRoute to screen them out if not admin.)

            // However, we want to fail EARLY if they are not admin.
            // Since signIn updates the session, the useAuth context will eventually react.
            // But we can't easily sync check here without direct DB call or trusting RLS.
            // We'll let the standard flow proceed, but Dashboard will start.

            navigate('/admin');

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Secure Login Failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-[#050505] to-[#050505] animate-pulse-slow" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-md bg-black/40 backdrop-blur-xl border border-red-900/30 p-8 rounded-2xl shadow-2xl shadow-red-900/20"
            >
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-500/20">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Secure Admin Portal</h1>
                    <p className="text-red-400 text-xs font-mono tracking-widest uppercase">Restricted Access Only</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-950/50 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-200 text-sm">
                        <ShieldAlert size={20} className="shrink-0 text-red-500" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Mobile Number</label>
                        <div className="relative">
                            <input
                                type="tel"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className="w-full bg-black/50 border border-gray-800 rounded-lg pl-4 pr-12 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-gray-800 font-mono tracking-wider"
                                placeholder="9876543210"
                                required
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-bold pointer-events-none select-none">
                                +91
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Security Clearance (Password)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-gray-700"
                            placeholder="••••••••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>Authenticate <ArrowRight size={20} /></>}
                    </button>

                    <div className="flex flex-col gap-2 text-center pt-4">
                        <button
                            type="button"
                            onClick={() => alert('🔒 SECURITY PROTOCOL ACTIVE\n\nFor security reasons, Administrator passwords cannot be reset via the web interface.\n\nPlease execute the "Admin Recovery Script" (reset_admin_credentials.sql) directly in the Database Console to restore access.')}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors font-mono tracking-wide uppercase"
                        >
                            Forgot Credentials?
                        </button>

                        <a href="/login" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-2">
                            Return to Public Portal
                        </a>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
