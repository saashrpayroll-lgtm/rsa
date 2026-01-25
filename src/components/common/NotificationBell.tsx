import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, type Notification } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { BroadcastModal } from '../admin/BroadcastModal';
import { useAuth } from '../../contexts/AuthContext';

export const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead, deleteNotification, markAllAsRead, clearAll } = useNotifications();
    const { profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTypeColor = (type: Notification['type']) => {
        switch (type) {
            case 'ALERT': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
            case 'SUCCESS': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'WARNING': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
            default: return 'bg-blue-50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400 border-blue-100 dark:border-blue-800';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed left-4 right-4 top-[4.5rem] md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100]"
                    >
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100">Notifications</h3>

                            <div className="flex gap-3 items-center">
                                {/* Broadcast Button (Admin Only) */}
                                {profile?.role === 'admin' && (
                                    <button
                                        onClick={() => { setIsOpen(false); setShowBroadcast(true); }}
                                        className="text-orange-500 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                        title="Send Broadcast"
                                    >
                                        <Megaphone size={16} />
                                    </button>
                                )}

                                {notifications.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => markAllAsRead()}
                                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                            title="Mark all as read"
                                        >
                                            Read All
                                        </button>
                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                        <button
                                            onClick={() => clearAll()}
                                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                                            title="Clear all"
                                        >
                                            Clear
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                                    <Bell size={32} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No notifications yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => !notif.is_read && markAsRead([notif.id])}
                                            className={cn(
                                                "p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative group",
                                                !notif.is_read ? "bg-blue-50/30 dark:bg-blue-900/5" : ""
                                            )}
                                        >
                                            <div className="flex gap-3">
                                                <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", !notif.is_read ? "bg-blue-500" : "bg-transparent")} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={cn(
                                                            "text-xs font-bold px-2 py-0.5 rounded border",
                                                            getTypeColor(notif.type)
                                                        )}>
                                                            {notif.type}
                                                        </span>
                                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                            {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                                                        </span>
                                                    </div>
                                                    <h4 className={cn("font-medium text-sm text-gray-900 dark:text-gray-100 mb-0.5", !notif.is_read && "font-bold")}>
                                                        {notif.title}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 break-words leading-relaxed">
                                                        {notif.message}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Hover Actions */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification([notif.id]);
                                                }}
                                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <BroadcastModal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} />
        </div>
    );
};
