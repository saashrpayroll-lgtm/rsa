import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RequestPasswordResetModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RequestPasswordResetModal: React.FC<RequestPasswordResetModalProps> = ({ isOpen, onClose }) => {
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            // Use Secure RPC
            const { data, error } = await supabase.rpc('request_password_reset', { target_mobile: mobile });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            setStatus('success');
            setTimeout(() => {
                onClose();
                setStatus('idle');
                setMobile('');
            }, 3000);

        } catch (err: any) {
            console.error('Reset request failed:', err);
            setStatus('error');
            setErrorMessage(err.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-6">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <Key className="text-orange-500" size={24} />
                        </div>

                        <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                            Reset Password
                        </h2>
                        <p className="text-center text-gray-500 text-sm mb-6">
                            Enter your mobile number. We will send a request to the Admin to reset your password.
                        </p>

                        {status === 'success' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-xl p-6 text-center"
                            >
                                <CheckCircle className="text-green-500 w-10 h-10 mx-auto mb-2" />
                                <h3 className="text-green-800 dark:text-green-200 font-bold mb-1">Request Sent!</h3>
                                <p className="text-green-600 dark:text-green-400 text-sm">
                                    Your admin currently reviews verify requests. Contact them for urgent access.
                                </p>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {status === 'error' && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                        <AlertCircle size={16} />
                                        {errorMessage}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Mobile Number</label>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                        placeholder="9876543210"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Request'}
                                </button>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
