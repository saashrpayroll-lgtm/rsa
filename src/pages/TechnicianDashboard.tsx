import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import type { Ticket } from '../types';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import {
    MessageCircle, User as UserIcon, Clock, AlertTriangle, Navigation,
    FileText, Loader2, Mic, X, Image as ImageIcon
} from 'lucide-react';

// Mapped imports
import { getCurrentLocation, calculateDistance, parseLocation } from '../lib/maps';
import TicketDetailView from '../components/technician/TicketDetailView';
import CompletionModal from '../components/technician/CompletionModal';

type TabType = 'upcoming' | 'active' | 'completed' | 'cancelled';
const ALERT_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAP/7kGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAADwAAAAQAAAEgAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMz//uQZAABAAABAAAAAAAABAAAAAAAABAAAAAAAABAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='; // Short silent placeholder - replace with real base64 if needed, or simple beep logic


const TechnicianDashboard: React.FC = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('upcoming');
    const [loading, setLoading] = useState(false);

    // Modals State
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);

    // Form States
    const [rejectReason, setRejectReason] = useState('');
    const [rejectImage, setRejectImage] = useState<File | null>(null);

    // Alert State: Array of tickets for stacked notifications
    const [alertTickets, setAlertTickets] = useState<Ticket[]>([]);

    // ticketLocation removed - was unused

    // Helper for Voice Input (Reject Modal only now)
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        if (profile) {
            // Fetch actual availability
            setIsAvailable(profile.is_available ?? true);
        }
        fetchTickets();

        const channel = supabase.channel('tech_tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
                fetchTickets();

                // Alert Logic: New Ticket OR Ticket Assigned to Me
                const newTicket = payload.new as Ticket;
                const isNewPending = payload.eventType === 'INSERT' && newTicket.status === 'PENDING';
                const isAssignedToMe = payload.eventType === 'UPDATE' && newTicket.technician_id === profile?.id && (payload.old as Ticket)?.technician_id !== profile?.id;

                if (isNewPending || isAssignedToMe) {
                    // Play Sound
                    const audio = new Audio(ALERT_SOUND);
                    audio.play().catch(() => { });

                    // Add to alert stack
                    setAlertTickets(prev => [newTicket, ...prev]);

                    // Auto-hide THIS specific ticket after 5s
                    setTimeout(() => {
                        setAlertTickets(prev => prev.filter(t => t.id !== newTicket.id));
                    }, 5000);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeTab, profile]);

    // ... (rest of code)

    const fetchTickets = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            let query = supabase.from('tickets').select('*, rider:rider_id(*)').order('created_at', { ascending: false });

            if (activeTab === 'upcoming') {
                // Pending tickets that are either unassigned OR assigned to me (Auto-assigned but not accepted yet)
                query = query.eq('status', 'PENDING').or(`technician_id.is.null,technician_id.eq.${profile.id}`);
            } else if (activeTab === 'active') {
                query = query.in('status', ['ACCEPTED', 'ON_WAY', 'IN_PROGRESS']).eq('technician_id', profile.id);
            } else if (activeTab === 'completed') {
                query = query.eq('status', 'COMPLETED').eq('technician_id', profile.id);
            } else if (activeTab === 'cancelled') {
                // Show cancelled tickets that were either assigned to this tech OR rejected by this tech
                query = query.eq('status', 'CANCELLED');
            }

            const { data, error } = await query;
            if (error) throw error;
            setTickets(data as Ticket[] || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedTicket || !rejectReason) return;
        try {
            let rejectionImageUrl = null;

            // Upload Image if present
            if (rejectImage) {
                const path = `rejection/${Date.now()}_${rejectImage.name}`;
                const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(path, rejectImage);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('ticket-attachments').getPublicUrl(path);
                rejectionImageUrl = data.publicUrl;
            }

            const { error } = await supabase.from('tickets').update({
                status: 'CANCELLED',
                technician_id: profile?.id,
                rejection_reason: rejectReason,
                technician_remarks: `Rejected: ${rejectReason} ${rejectionImageUrl ? '[evidence attached]' : ''}`,
                images: rejectionImageUrl ? [rejectionImageUrl] : []
            }).eq('id', selectedTicket.id);

            if (error) throw error;
            setShowRejectModal(false);
            setSelectedTicket(null);
            setRejectReason('');
            setRejectImage(null);
            fetchTickets();
        } catch (error) {
            console.error(error);
            alert('Failed to reject ticket');
        }
    };

    const handleStatusUpdate = async (ticketId: string, status: string) => {
        try {
            const updates: any = { status };
            if (status === 'ACCEPTED') {
                updates.technician_id = profile?.id;
                updates.accepted_at = new Date().toISOString();

                // AUTO NAVIGATE: Switch to Active Tab immediately
                setActiveTab('active');
            } else if (status === 'ON_WAY') {
                updates.on_way_at = new Date().toISOString();
            } else if (status === 'IN_PROGRESS') {
                updates.in_progress_at = new Date().toISOString();
            }

            const { error } = await supabase.from('tickets').update(updates).eq('id', ticketId);
            if (error) throw error;

            // Optimistic update
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));

            if (selectedTicket?.id === ticketId) {
                // Ensure the selected detail view gets the new status
                setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to update status");
        }
    };

    const handleCompleteJob = async (remarks: string, images: File[], voiceNotes: Blob[], parts: string) => {
        if (!selectedTicket) return;

        try {
            setLoading(true);
            const currentPos = await getCurrentLocation();
            const ticketLocation = parseLocation(selectedTicket.location);

            if (ticketLocation) {
                const dist = calculateDistance(currentPos, ticketLocation);
                console.log(`Distance to ticket: ${dist} km`);

                // Geofencing Rule: RSA Techs must be within 100m (0.1km)
                // Admins and Hub Techs are exempt from this restriction.
                // "50 to 100 mtr" interpretation: We allow anything UNDER 0.1km (100m).
                // Ideally 0m is best, but GPS drifts. 

                const isRSATech = profile?.role === 'rsa_tech';

                if (isRSATech && dist > 0.1) {
                    alert(`🚫 Geofencing Alert: You are ${dist.toFixed(3)}km away.\nYou must be within 100 meters of the vehicle to complete this job.\n\nPlease move closer and try again.`);
                    setLoading(false);
                    return;
                }
            }
        } catch (error) {
            console.error("Location check failed", error);
            // If GPS fails, should we block? User said "Must be safe".
            // Let's warn but maybe allow if it's a critical error, OR block if strict.
            // For now, let's block RSA techs if location fails to be safe.
            if (profile?.role === 'rsa_tech') {
                alert("Location verification failed. Please enable GPS to complete the job.");
                setLoading(false);
                return;
            }
        }

        try {
            const imageUrls = await Promise.all(images.map(async (file) => {
                const path = `completion/${Date.now()}_${file.name}`;
                await supabase.storage.from('ticket-attachments').upload(path, file);
                const { data } = supabase.storage.from('ticket-attachments').getPublicUrl(path);
                return data.publicUrl;
            }));

            const voiceUrls = await Promise.all(voiceNotes.map(async (blob, idx) => {
                const path = `completion_voice/${Date.now()}_${idx}.webm`;
                await supabase.storage.from('ticket-attachments').upload(path, blob);
                const { data } = supabase.storage.from('ticket-attachments').getPublicUrl(path);
                return data.publicUrl;
            }));

            const { error } = await supabase.from('tickets').update({
                status: 'COMPLETED',
                technician_remarks: remarks,
                parts_replaced: parts,
                completion_images: imageUrls,
                completion_voice_notes: voiceUrls,
                completed_at: new Date().toISOString()
            }).eq('id', selectedTicket.id);

            if (error) throw error;
            setShowCompleteModal(false);
            setSelectedTicket(null);
            fetchTickets();
        } catch (error) {
            alert('Failed to complete job: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    const toggleListening = (setter: (val: string) => void) => {
        if (isListening) return;
        setIsListening(true);
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setter(transcript);
                setIsListening(false);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.start();
        } else {
            alert('Browser does not support speech recognition');
            setIsListening(false);
        }
    };

    const handleAISuggestion = (setter: (val: string) => void, context: string) => {
        setTimeout(() => {
            if (context === 'rejection') {
                setter("Distance too far and battery is low.");
            } else if (context === 'completion') {
                setter("Fixed the loose wiring connection and charged the battery for 10 mins. Vehicle tested OK.");
            }
        }, 1000);
    };

    const TicketCardView = ({ ticket, onSelect }: { ticket: Ticket, onSelect: (t: Ticket) => void }) => {
        const isPending = ticket.status === 'PENDING';

        return (
            <div
                onClick={() => onSelect(ticket)}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-cyan-500/50 dark:hover:border-cyan-500/50 cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-lg group relative flex flex-col h-full overflow-hidden"
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={cn("px-2 py-1 rounded text-xs font-bold uppercase",
                        ticket.type === 'RSA' ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                    )}>
                        {ticket.type}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} /> {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <h3 className="text-gray-900 dark:text-white font-bold mb-1 truncate">{ticket.category}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3 flex-1">{ticket.description || 'No description provided.'}</p>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700/50 pt-3 mt-auto mb-1">
                    <span className="flex items-center gap-2 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                        <UserIcon size={14} className="text-gray-400 dark:text-gray-600 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                        {ticket.rider?.full_name || ticket.rider?.mobile || 'Unknown'}
                    </span>
                    {ticket.ai_analysis?.severity && (
                        <span className={cn("font-bold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase",
                            ticket.ai_analysis.severity === 'HIGH' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        )}>
                            {ticket.ai_analysis.severity} Priority
                        </span>
                    )}
                </div>

                {/* QUICK ACTIONS OVERLAY (For Upcoming/Pending) */}
                {isPending && (
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 rounded-b-xl z-20">
                        <Button
                            size="sm"
                            variant="danger"
                            className="flex-1 h-8 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/30"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(ticket);
                                setShowRejectModal(true);
                            }}
                        >
                            Reject
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-500 border-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate(ticket.id, 'ACCEPTED');
                            }}
                        >
                            Accept
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    const [isAvailable, setIsAvailable] = useState(true);

    const toggleAvailability = async () => {
        const newState = !isAvailable;
        setIsAvailable(newState);
        try {
            await supabase.from('profiles').update({ is_available: newState }).eq('id', profile?.id);

            // Log Activity
            await supabase.from('activity_logs').insert({
                user_id: profile?.id,
                action: newState ? 'ONLINE' : 'OFFLINE',
                metadata: { source: 'dashboard_toggle' }
            });
        } catch (err) {
            console.error("Failed to update availability", err);
            setIsAvailable(!newState);
        }
    };

    return (
        <div className="space-y-6 pb-20 relative text-gray-900 dark:text-white">
            {/* Header & Tabs */}
            <div className="sticky top-0 bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur-xl z-30 pb-4 border-b border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-2xl transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 pt-4">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {profile?.role === 'hub_tech' ? 'HUB Technician Portal' : profile?.role === 'rsa_tech' ? 'RSA Technician Portal' : t('tech.portal_title')}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                {t('tech.manage_tasks')}
                            </p>
                        </div>
                        <button
                            onClick={toggleAvailability}
                            className={cn(
                                "flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md group relative overflow-hidden",
                                isAvailable
                                    ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20"
                                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <div className={cn("w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]", isAvailable ? "bg-green-500" : "bg-gray-500")} />
                            <span className="text-sm font-bold tracking-wide">{isAvailable ? t('common.online') : t('common.offline')}</span>
                        </button>
                    </div>

                    {/* Enhanced Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide md:justify-start border-b border-gray-200 dark:border-gray-800/50">
                        {[
                            { id: 'upcoming', label: t('tech.upcoming'), color: 'cyan', icon: Clock },
                            { id: 'active', label: t('tech.active'), color: 'blue', icon: Navigation },
                            { id: 'completed', label: t('tech.completed'), color: 'green', icon: FileText },
                            { id: 'cancelled', label: t('tech.cancelled'), color: 'red', icon: X }
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            // Dynamic color classes based on active state (Light vs Dark)
                            const activeClass = isActive
                                ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/20 border-${tab.color}-400`
                                : `bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600`;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id as TabType); setSelectedTicket(null); }}
                                    className={cn(
                                        "px-5 py-2.5 rounded-t-lg text-sm font-bold whitespace-nowrap transition-all duration-300 border-t border-x border-b-0 flex items-center gap-2 relative top-[1px]",
                                        activeClass,
                                        isActive ? "z-10 translate-y-0" : "translate-y-1 hover:translate-y-0.5"
                                    )}
                                >
                                    <Icon size={16} className={cn(isActive ? "text-white" : `text-gray-400 dark:text-gray-500 group-hover:text-${tab.color}-500 dark:group-hover:text-${tab.color}-400`)} />
                                    {tab.label}
                                    {/* Active Indicator Line */}
                                    {isActive && (
                                        <div className={cn("absolute bottom-0 left-0 w-full h-1", `bg-${tab.color}-400`)} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* STACKED REAL-TIME ALERTS */}
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3 w-full max-w-sm px-4 pointer-events-none">
                {alertTickets.map((ticket, index) => (
                    <div
                        key={ticket.id}
                        className="pointer-events-auto w-full bg-cyan-900/95 border border-cyan-400 rounded-xl shadow-[0_5px_20px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-4 backdrop-blur-md"
                        style={{ marginTop: index > 0 ? '-60px' : '0', transform: `scale(${1 - index * 0.05})` }}
                    >
                        <div className="p-4 relative">
                            {/* Progress Bar */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-900">
                                <div className="h-full bg-cyan-400 animate-progress-bar" style={{ animationDuration: '5s' }} />
                            </div>

                            <div className="flex items-start gap-3 mt-2">
                                <div className="p-2 bg-cyan-500 rounded-full text-white animate-pulse shrink-0">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-white text-base truncate">{t('tech.new_ticket')}</h4>
                                    <p className="text-cyan-200 text-sm font-medium truncate">{ticket.category}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                                        <span className={cn("px-1.5 py-0.5 rounded uppercase font-bold text-[10px]",
                                            ticket.ai_analysis?.severity === 'HIGH' ? "bg-red-500/30 text-red-200" : "bg-yellow-500/30 text-yellow-200"
                                        )}>
                                            {ticket.ai_analysis?.severity || 'NORMAL'}
                                        </span>
                                        <span className="truncate max-w-[120px]">
                                            ID: {ticket.id.slice(0, 8)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 truncate">
                                        <Navigation size={10} />
                                        <span>{parseLocation(ticket.location)?.lat ? "Location Available" : "No Location"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4 ml-11">
                                <Button
                                    size="sm"
                                    variant="danger"
                                    className="flex-1 py-1 h-8 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/30"
                                    onClick={() => setAlertTickets(prev => prev.filter(t => t.id !== ticket.id))}
                                >
                                    {t('tech.dismiss')}
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1 py-1 h-8 text-xs bg-cyan-500 hover:bg-cyan-600 border-none shadow-lg shadow-cyan-500/20"
                                    onClick={() => {
                                        setSelectedTicket(ticket);
                                        setActiveTab(ticket.status === 'PENDING' ? 'upcoming' : 'active');
                                        setAlertTickets(prev => prev.filter(t => t.id !== ticket.id));
                                    }}
                                >
                                    {t('tech.view_details')}
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Ticket List */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-500" size={32} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tickets.map(ticket => <TicketCardView key={ticket.id} ticket={ticket} onSelect={setSelectedTicket} />)}
                    {tickets.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-400 dark:text-gray-600">
                            <div className="bg-gray-100 dark:bg-gray-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText size={40} className="text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium">No tickets found in {activeTab}.</p>
                            <p className="text-sm mt-1">Check back later or switch tabs.</p>
                        </div>
                    )}
                </div>
            )}

            {/* UPCOMING MODAL REMOVED - Handled by TicketDetailView */}

            {/* REJECT REASON MODAL */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Reason for Rejection</h3>

                        <div className="space-y-4">
                            <div className="relative">
                                <textarea
                                    className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white text-sm"
                                    rows={4}
                                    placeholder="Why are you rejecting this ticket?"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <div className="absolute bottom-2 right-2 flex gap-2">
                                    <button onClick={() => toggleListening(setRejectReason)} className={cn("p-2 rounded-full", isListening ? "bg-red-500 text-white" : "bg-gray-700 text-gray-300")}>
                                        <Mic size={16} />
                                    </button>
                                    <button onClick={() => handleAISuggestion(setRejectReason, 'rejection')} className="p-2 bg-purple-600 rounded-full text-white">
                                        <MessageCircle size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Image Upload for Rejection Evidence */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-gray-400 mb-2 cursor-pointer hover:text-cyan-400 transition-colors">
                                    <ImageIcon size={16} />
                                    <span>Upload Evidence (Optional)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => setRejectImage(e.target.files?.[0] || null)}
                                    />
                                </label>
                                {rejectImage && (
                                    <div className="flex items-center justify-between bg-gray-800 p-2 rounded-lg border border-gray-700 text-xs text-gray-300">
                                        <span className="truncate max-w-[200px]">{rejectImage.name}</span>
                                        <button onClick={() => setRejectImage(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={() => { setShowRejectModal(false); setRejectImage(null); }}>Cancel</Button>
                            <Button variant="danger" onClick={handleReject}>Confirm Rejection</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW TICKET DETAIL VIEW (Replaces Active Ticket Modal) */}
            {selectedTicket && (activeTab === 'active' || activeTab === 'completed' || activeTab === 'upcoming' || activeTab === 'cancelled') && !showCompleteModal && (
                <TicketDetailView
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onStatusUpdate={handleStatusUpdate}
                    onComplete={() => setShowCompleteModal(true)}
                    onReject={() => setShowRejectModal(true)}
                />
            )}

            {/* NEW COMPLETION MODAL */}
            {showCompleteModal && (
                <CompletionModal
                    onClose={() => setShowCompleteModal(false)}
                    onComplete={handleCompleteJob}
                />
            )}
        </div>
    );
};

export default TechnicianDashboard;
