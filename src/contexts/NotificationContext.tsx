import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type NotificationType = 'INFO' | 'ALERT' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    reference_id?: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (ids: string[]) => Promise<void>;
    deleteNotification: (ids: string[]) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const user = session?.user;
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.rpc('get_notifications', { p_limit: 50 });
            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (ids: string[]) => {
        if (!ids.length) return;

        // Optimistic Update
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));

        try {
            const { error } = await supabase.rpc('mark_notifications_read', { p_notification_ids: ids });
            if (error) throw error;
        } catch (err) {
            console.error('Error marking as read:', err);
            // Revert on error (optional, skipping for simpler UX)
        }
    };

    const deleteNotification = async (ids: string[]) => {
        if (!ids.length) return;

        // Optimistic Update
        setNotifications(prev => prev.filter(n => !ids.includes(n.id)));

        try {
            const { error } = await supabase.rpc('delete_notifications', { p_notification_ids: ids });
            if (error) throw error;
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        await markAsRead(unreadIds);
    };

    const clearAll = async () => {
        const allIds = notifications.map(n => n.id);
        await deleteNotification(allIds);
    };

    const channelRef = React.useRef<any>(null);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        fetchNotifications();

        // STRICT MODE SAFEGUARD: Only subscribe if channel doesn't exist
        if (!channelRef.current) {
            const channel = supabase
                .channel('public:notifications:' + user.id)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newNotif = payload.new as Notification;
                        // Prevent Duplicates (Store Level)
                        setNotifications(prev => {
                            if (prev.some(n => n.id === newNotif.id)) return prev;
                            return [newNotif, ...prev];
                        });
                    }
                )
                .subscribe();

            channelRef.current = channel;
        }

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            deleteNotification,
            markAllAsRead,
            clearAll,
            refresh: fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
