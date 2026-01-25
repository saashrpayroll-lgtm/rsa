import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
// import { generateContent } from '../../lib/ai_engine'; // Uncomment if AI Engine exists

interface BroadcastModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ isOpen, onClose }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetRole, setTargetRole] = useState<'ALL' | 'rider' | 'technician'>('ALL');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const handleSend = async () => {
        if (!title || !message) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('broadcast_notification', {
                p_title: title,
                p_message: message,
                p_target_role: targetRole,
                p_sender_id: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;
            alert(`Broadcast sent to ${(data as any).count} users!`);
            onClose();
            setTitle('');
            setMessage('');
        } catch (err: any) {
            alert('Failed to send broadcast: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateAIContent = async () => {
        setAiLoading(true);
        try {
            // Mock AI behavior if lib is missing, or replace with real call
            // const content = await generateContent(`Write a short, exciting notification for ${targetRole}s about...`);

            // Simulating AI for now to ensure UI works even without API key configured
            setTimeout(() => {
                setTitle("🚀 Important System Update!");
                setMessage(`Attention ${targetRole === 'ALL' ? 'everyone' : targetRole + 's'}! We have exciting updates coming your way. Please keep your app updated for the best experience. Stay safe and keep riding!`);
                setAiLoading(false);
            }, 1000);

        } catch (e) {
            console.error(e);
            setAiLoading(false);
        }
    };



    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-[#0F1117] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden relative my-8"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Send className="text-orange-500" /> Broadcast Message
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Target Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-2">Target Audience</label>
                            <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                {(['ALL', 'rider', 'technician'] as const).map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => setTargetRole(role)}
                                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${targetRole === role
                                            ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        {role.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Input */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="e.g. System Maintenance"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-500">Message</label>
                                    <button
                                        onClick={generateAIContent}
                                        disabled={aiLoading}
                                        className="text-xs flex items-center gap-1 text-purple-500 hover:text-purple-600 font-medium px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                    >
                                        <Sparkles size={12} />
                                        {aiLoading ? 'Thinking...' : 'Generate with AI'}
                                    </button>
                                </div>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    rows={4}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Type your message here..."
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? 'Sending...' : 'Send Broadcast'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
