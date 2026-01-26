import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';
import { Lock, Phone, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { RequestPasswordResetModal } from '../components/auth/RequestPasswordResetModal';

const Login: React.FC = () => {
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const { signIn } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Attempt Standard Login
            const { error: signInError } = await signIn(mobile, password);

            if (signInError) {
                console.warn("Standard Login Failed:", signInError.message);

                const errMessage = signInError.message || '';
                const isDatabaseError = errMessage.toLowerCase().includes('database error') || errMessage.toLowerCase().includes('finding user');
                const isDefaultPass = password === '123456';

                if (isDefaultPass || isDatabaseError) {
                    // AUTO-REPAIR
                    if (isDatabaseError) {
                        console.warn("Attempting Auto-Repair for:", mobile);
                        await supabase.rpc('repair_technician_account', { check_mobile: mobile });
                    }

                    // A. Check RIDER Eligibility
                    const { data: masterData } = await supabase
                        .rpc('check_rider_eligibility', { check_mobile: mobile });

                    const riderData = masterData && masterData.length > 0 ? masterData[0] : null;

                    if (riderData) {
                        if (riderData.status === 'suspended') throw new Error('Account is Suspended. Please contact Admin.');

                        const { data: authData } = await supabase.auth.signUp({
                            email: `${mobile}@hub.com`,
                            password: '123456',
                            options: { data: { full_name: riderData.full_name, role: 'rider' } }
                        });

                        // Ignore "already registered" since we expect it might fail if repair didn't work perfectly
                        // But if authData.user exists, we proceed.

                        if (authData.user) {
                            const { data: profileCheck } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
                            if (profileCheck?.role === 'admin') {
                                await supabase.auth.signOut();
                                throw new Error("ACCESS DENIED: Administrators must use the Secure Portal.");
                            }

                            await supabase.from('profiles').upsert({
                                id: authData.user.id,
                                role: 'rider',
                                mobile: riderData.mobile,
                                full_name: riderData.full_name,
                                chassis_number: riderData.chassis_number,
                                wallet_balance: riderData.wallet_balance,
                                team_leader: riderData.team_leader_name,
                                status: 'active'
                            });

                            localStorage.setItem('portal_type', 'public');
                            window.location.reload();
                            return;
                        }
                    }

                    // B. Check TECHNICIAN Eligibility
                    if (!riderData) {
                        const { data: techData } = await supabase
                            .rpc('check_technician_eligibility', { check_mobile: mobile });

                        const technician = techData && techData.length > 0 ? techData[0] : null;

                        if (technician) {
                            if (technician.status === 'suspended') throw new Error('Account Suspended.');

                            const { data: authData } = await supabase.auth.signUp({
                                email: `${mobile}@hub.com`,
                                password: '123456',
                                options: { data: { full_name: technician.full_name, role: technician.role } }
                            });

                            if (authData.user) {
                                await supabase.from('profiles').upsert({
                                    id: authData.user.id,
                                    role: technician.role,
                                    mobile: technician.mobile,
                                    full_name: technician.full_name,
                                    status: 'active'
                                });

                                localStorage.setItem('portal_type', 'public');
                                window.location.reload();
                                return;
                            }
                        }
                    }
                }

                throw new Error("Invalid login credentials. Please check your mobile and password.");
            }

            // 3. Post-Login Checks
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('force_password_change, status, role')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    if (profile.status === 'suspended') {
                        await supabase.auth.signOut();
                        throw new Error("Account Suspended. Contact Admin.");
                    }
                    if (profile.force_password_change) {
                        navigate('/change-password');
                        return;
                    }

                    localStorage.setItem('portal_type', 'public');
                    if (profile.role === 'admin') {
                        await supabase.auth.signOut();
                        throw new Error("⛔ SECURITY ALERT: Administrators must use the Secure Admin Panel.");
                    }

                    if (profile.role === 'rider') navigate('/rider');
                    else if (['hub_tech', 'rsa_tech'].includes(profile.role)) navigate('/tech');
                    else navigate('/');
                    return;
                }
            }
            navigate('/');

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Failed to login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#FAFAFA] dark:bg-[#0a0a0f] flex items-center justify-center p-4 overflow-y-auto relative font-sans">
            {/* Soft Orange Glow Background */}
            <div className="absolute top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-orange-400/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-yellow-400/10 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                whileHover={{ y: -5, scale: 1.01 }}
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden relative z-10 transition-shadow duration-300 hover:shadow-2xl hover:shadow-orange-500/10"
            >
                <div className="p-8 pb-4 text-center bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/50">
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 mx-auto bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-orange-500/10 border border-white/20"
                    >
                        <img src="/triev_logo.png" alt="TriEv Logo" className="w-15 h-15 object-contain drop-shadow-md" />
                    </motion.div>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                        <span className="text-orange-500">TriEv</span> <span className="text-black dark:text-white">RSA</span>
                    </h1>
                    <p className="text-xs font-bold text-blue-500 tracking-widest uppercase">#JoinTheEVTriEv</p>
                </div>

                <div className="p-10 pt-4">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center gap-3"
                        >
                            <AlertCircle className="text-red-500 shrink-0" size={20} />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">{t('auth.mobile_placeholder')}</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                                    <Phone size={20} />
                                </span>
                                <input
                                    type="tel"
                                    value={mobile}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setMobile(val);
                                    }}
                                    className="w-full bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white py-4 pl-12 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-bold text-lg placeholder:font-normal"
                                    placeholder="Enter your 10-digit mobile number"
                                    required
                                />
                            </div>
                        </div>

                        <div className="group">
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">{t('auth.password_placeholder')}</label>
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(true)}
                                    className="text-xs font-bold text-orange-500 hover:text-orange-600 focus:outline-none"
                                >
                                    {t('auth.forgot_password')}
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                                    <Lock size={20} />
                                </span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white py-4 pl-12 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-bold text-lg placeholder:font-normal"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 transform hover:-translate-y-0.5 transition-all text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                                loading && "opacity-80 cursor-not-allowed"
                            )}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : (
                                <>
                                    {t('auth.login_button')} <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>

            <RequestPasswordResetModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} />
        </div>
    );
};

export default Login;
