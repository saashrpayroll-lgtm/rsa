import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils'; // Using utils for class merging

const Register: React.FC = () => {
    const [mobile, setMobile] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('123456');
    const [role, setRole] = useState('rider');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const email = `${mobile}@hub.com`;

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        mobile,
                        full_name: fullName,
                        role: role
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                // 1. Create Profile
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    mobile,
                    full_name: fullName,
                    role: role as any,
                    status: 'active'
                });

                if (profileError) {
                    console.error("Profile creation failed:", profileError);
                    // Don't throw, just warn
                }

                // 2. If Technician, Sync to Master
                if (['hub_tech', 'rsa_tech'].includes(role)) {
                    const { error: masterError } = await supabase.from('technician_master').upsert({
                        mobile,
                        full_name: fullName,
                        role: role,
                        status: 'active'
                    }, { onConflict: 'mobile' });

                    if (masterError) console.error("Master sync failed:", masterError);
                }

                setSuccess('User registered successfully! Redirecting to login...');
                setTimeout(() => navigate('/login'), 2000);
            }

        } catch (err: any) {
            setError(err.message || 'Failed to register.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">

            {/* Dynamic Background Effects - Green for Registration */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-green-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-teal-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-gray-900/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl overflow-hidden">

                    <div className="p-8 pb-6 text-center border-b border-white/5 bg-white/5">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                            <UserPlus className="text-white" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
                        <p className="text-gray-400 text-sm">Register new users for testing</p>
                    </div>

                    <div className="p-8 pt-6">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200">
                                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3 text-green-200">
                                <span className="text-sm font-medium">{success}</span>
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:bg-white/5 transition-all"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Mobile Number</label>
                                <input
                                    type="tel"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:bg-white/5 transition-all"
                                    placeholder="9876543210"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-green-500/50 focus:bg-white/5 transition-all [&>option]:bg-gray-800"
                                >
                                    <option value="rider">Rider</option>
                                    <option value="hub_tech">HUB Technician</option>
                                    <option value="rsa_tech">RSA Technician</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Password (Default)</label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:bg-white/5 transition-all"
                                    placeholder="123456"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-400 hover:to-teal-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 mt-4",
                                    loading && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Register User
                                        <ArrowRight size={20} />
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

export default Register;
