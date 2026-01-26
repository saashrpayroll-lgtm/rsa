import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
    Navigation, Phone, MessageCircle, User,
    CreditCard, Hash, Shield, Flag, CheckCircle,
    Clock, ChevronRight, Sparkles, X, ArrowLeft,
    FileText, Mic, Image as ImageIcon, Calendar, BadgeCheck, Download, PauseCircle, Search, Wrench, Loader2
} from 'lucide-react';
import type { Ticket, RiderMaster } from '../../types';
import { supabase } from '../../lib/supabase';
import { parseLocation } from '../../lib/maps';
import { MAP_TILE_URL, MAP_ATTRIBUTION } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import TechnicianWorkflowSection from '../admin/TechnicianWorkflowSection';
import AdminTicketControls from '../admin/AdminTicketControls';
import TicketAuditTimeline from '../admin/TicketAuditTimeline';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2 } from 'lucide-react';

interface TicketDetailViewProps {
    ticket: Ticket;
    onClose: () => void;
    onStatusUpdate: (id: string, status: string) => void;
    onComplete: () => void;
    onReject: () => void;
}

const TicketDetailView: React.FC<TicketDetailViewProps> = ({
    ticket, onClose, onStatusUpdate, onComplete, onReject
}) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const location = parseLocation(ticket.location);
    const [activeTab, setActiveTab] = useState<'details' | 'ai'>('details');
    const [realTimeRider, setRealTimeRider] = useState<RiderMaster | null>(null);

    // AI Guide State
    const [techGuide, setTechGuide] = useState<any>(null);
    const [loadingGuide, setLoadingGuide] = useState(false);

    // Auto-fetch guide when tab opens
    useEffect(() => {
        if (activeTab === 'ai' && !techGuide) {
            fetchAiGuide();
        }
    }, [activeTab]);

    const fetchAiGuide = async () => {
        setLoadingGuide(true);
        try {
            // Dynamic Import to avoid cycle
            const { generateDetailedTechGuide } = await import('../../lib/groq');
            const guide = await generateDetailedTechGuide(ticket.description || 'General Maintenance', ticket.category);
            setTechGuide(guide);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingGuide(false);
        }
    };

    // Fetch Real-Time Rider Master Data & Subscribe
    useEffect(() => {
        let activeChannel: ReturnType<typeof supabase.channel> | null = null;

        const fetchAndSubscribe = async () => {
            // Priority: Snapshot Mobile -> Profile Mobile
            const mobile = ticket.rider_snapshot?.mobile || ticket.rider?.mobile;
            if (!mobile) return;

            const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

            const { data } = await supabase
                .from('rider_master')
                .select('*')
                .ilike('mobile', `%${cleanMobile}%`)
                .maybeSingle();

            if (data) {
                setRealTimeRider(data as RiderMaster);

                // Real-time Subscription
                activeChannel = supabase
                    .channel(`rider_master_detail_${data.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'rider_master',
                            filter: `id=eq.${data.id}`
                        },
                        (payload) => {
                            setRealTimeRider(payload.new as RiderMaster);
                        }
                    )
                    .subscribe();
            }
        };

        fetchAndSubscribe();

        return () => {
            if (activeChannel) supabase.removeChannel(activeChannel);
        };
    }, [ticket]);

    const displayRider = {
        full_name: realTimeRider?.full_name || ticket.rider_snapshot?.full_name || ticket.rider?.full_name || 'Unknown',
        mobile: realTimeRider?.mobile || ticket.rider_snapshot?.mobile || ticket.rider?.mobile || '',
        wallet_balance: realTimeRider?.wallet_balance ?? ticket.rider_snapshot?.wallet_balance ?? ticket.rider?.wallet_balance ?? 0,
        chassis_number: realTimeRider?.chassis_number || ticket.rider_snapshot?.chassis_number || ticket.rider?.chassis_number || '-',
        team_leader_name: realTimeRider?.team_leader_name || ticket.rider_snapshot?.team_leader_name || ticket.rider?.team_leader || 'Unassigned',
        team_leader_mobile: realTimeRider?.team_leader_mobile || ticket.rider_snapshot?.team_leader_mobile || '',
        custom_rider_id: realTimeRider?.custom_rider_id || ticket.rider?.id || '-',
        allotment_date: realTimeRider?.allotment_date
    };

    // Workflow Steps
    const steps = [
        { id: 'ACCEPTED', label: 'Accepted', color: 'bg-blue-500', text: 'text-blue-400' },
        { id: 'ON_WAY', label: 'On The Way', color: 'bg-yellow-500', text: 'text-yellow-400' },
        { id: 'IN_PROGRESS', label: 'Work Started', color: 'bg-orange-500', text: 'text-orange-400' },
        { id: 'COMPLETED', label: 'Completed', color: 'bg-green-500', text: 'text-green-400' }
    ];

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-[#0a0a0f] z-50 flex flex-col md:flex-row overflow-hidden animate-in slide-in-from-right duration-300">

            {/* LEFT/TOP: MAP & HEADER (Mobile: Top 40%, Desktop: Left 40%) */}
            <div className="relative w-full md:w-[40%] h-[40vh] md:h-full bg-gray-100 dark:bg-gray-900 border-b md:border-r md:border-b-0 border-gray-200 dark:border-gray-800 flex-shrink-0">
                {/* Back Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-[1000] bg-white/50 dark:bg-black/50 hover:bg-white/70 dark:hover:bg-black/70 text-gray-900 dark:text-white p-2 rounded-full backdrop-blur-md transition-all shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Map */}
                {location ? (
                    <MapContainer
                        center={[location.lat, location.lng]}
                        zoom={15}

                        className="dark:invert dark:grayscale dark:brightness-90 dark:contrast-125 contrast-125 brightness-105 saturate-125 transition-all duration-500"
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                    >
                        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
                        <Marker position={[location.lat, location.lng]}>
                            <Popup>
                                <div className="text-black font-bold text-xs">Rider Location</div>
                            </Popup>
                        </Marker>
                    </MapContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-800">
                        <div className="text-center">
                            <Navigation size={48} className="mx-auto mb-2 opacity-50 text-black dark:text-gray-500" />
                            <p className="text-black dark:text-gray-500 font-bold">Location Unavailable</p>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT/BOTTOM: DETAILS & ACTIONS */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0a0a0f] overflow-hidden">

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">

                    {/* ADMIN OVERRIDE PANEL */}
                    {isAdmin && (
                        <AdminTicketControls
                            ticket={ticket}
                            onUpdate={() => {
                                onStatusUpdate(ticket.id, ticket.status); // Trigger refresh
                            }}
                            onClose={onClose}
                        />
                    )}

                    {/* Header Info */}
                    <div>
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-black text-black dark:text-white mb-1 tracking-tight">{ticket.category}</h1>
                                <p className="text-gray-700 dark:text-gray-400 text-sm flex items-center gap-2 font-medium">
                                    <Hash size={14} /> ID: {ticket.id.slice(0, 8)}
                                    <span className="mx-1">•</span>
                                    <Clock size={14} /> {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                                ticket.ai_analysis?.severity === 'HIGH' ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            )}>
                                {ticket.ai_analysis?.severity || 'NORMAL'}
                            </span>
                        </div>
                    </div>

                    {/* RIDER REPORTED ISSUE (Fixed & Synced) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 mt-4">
                        <h3 className="text-xs font-black text-black/70 dark:text-gray-500 uppercase mb-2 flex items-center gap-2 tracking-wider">
                            Rider Reported Issue
                        </h3>
                        <p className="text-sm text-black dark:text-white leading-relaxed whitespace-pre-wrap font-bold">
                            {ticket.description || "No description provided by rider."}
                        </p>
                    </div>

                    {/* RIDER ATTACHMENTS (Voice/Images) with DOWNLOAD support */}
                    {(ticket.images?.length || ticket.voice_notes?.length) ? (
                        <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                <FileText size={14} /> Rider Attachments
                            </h3>

                            {/* Voice Notes */}
                            {ticket.voice_notes && ticket.voice_notes.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {ticket.voice_notes.map((note, idx) => (
                                        <div key={idx} className="bg-gray-900 rounded-lg p-2 flex flex-col gap-2 border border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-cyan-900/50 rounded-full flex items-center justify-center text-cyan-400">
                                                        <Mic size={14} />
                                                    </div>
                                                    <span className="text-xs text-gray-400">Voice Note {idx + 1}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(note, `voice_note_${idx + 1}.webm`)}
                                                    className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-md transition-colors"
                                                    title="Download Voice Note"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        className="p-1.5 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded-md transition-colors"
                                                        title="Delete (Admin Only)"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <audio controls src={note} className="w-full h-8" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Images */}
                            {ticket.images && ticket.images.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {ticket.images.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-700 group">
                                            <img src={img} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                            {/* Hover Actions */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity duration-200">
                                                <a
                                                    href={img}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white backdrop-blur-sm flex items-center gap-1"
                                                >
                                                    <ImageIcon size={12} /> View
                                                </a>
                                                <button
                                                    onClick={() => handleDownload(img, `evidence_${idx + 1}.jpg`)}
                                                    className="px-3 py-1 bg-cyan-600/80 hover:bg-cyan-600 rounded-full text-xs text-white backdrop-blur-sm flex items-center gap-1"
                                                >
                                                    <Download size={12} /> Save
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded-full text-xs text-white backdrop-blur-sm flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* Rider Profile Grid (Real Time > Snapshot > Profile) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <User size={14} /> Rider Profile
                            </h3>
                            {realTimeRider && (
                                <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded border border-green-500/20 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Real-Time
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Name & Contact */}
                            <div className="col-span-2 flex items-center gap-3 pb-4 border-b border-gray-700/50">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                                    {displayRider.full_name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-black dark:text-white font-black text-xl truncate">{displayRider.full_name}</p>

                                    {/* EXPLICIT MOBILE NUMBER DISPLAY */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                        <p className="text-gray-800 dark:text-gray-300 text-sm font-bold font-mono flex items-center gap-1">
                                            <Phone size={12} className="text-black dark:text-gray-400" />
                                            {displayRider.mobile || 'No Mobile'}
                                        </p>

                                        {displayRider.mobile && (
                                            <div className="flex gap-2">
                                                <a href={`tel:${displayRider.mobile}`} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 px-2 py-0.5 rounded textxs flex items-center gap-1 transition-colors text-xs border border-green-500/10">
                                                    Call
                                                </a>
                                                <a href={`https://wa.me/${displayRider.mobile}`} target="_blank" rel="noreferrer" className="bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded text-xs flex items-center gap-1 transition-colors border border-[#25D366]/10">
                                                    WhatsApp
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Alternate Mobile Display */}
                                    {ticket.alternate_mobile && (
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 pl-1 border-l-2 border-orange-500/30">
                                            <p className="text-gray-600 dark:text-gray-400 text-xs font-mono flex items-center gap-1">
                                                <span className="text-[10px] font-bold text-orange-400 uppercase">Alt:</span>
                                                {ticket.alternate_mobile}
                                            </p>
                                            <a href={`tel:${ticket.alternate_mobile}`} className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs flex items-center gap-1 transition-colors border border-orange-500/10 w-fit">
                                                <Phone size={10} /> Call Alt
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-transparent">
                                <span className="text-xs text-black/60 dark:text-gray-500 block mb-1 font-bold">Wallet Balance</span>
                                <span className={cn("text-lg font-mono font-bold flex items-center gap-1",
                                    (displayRider.wallet_balance || 0) < 0 ? "text-red-400" : "text-green-400"
                                )}>
                                    <CreditCard size={14} /> ₹{displayRider.wallet_balance || 0}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-transparent">
                                <span className="text-xs text-gray-500 block mb-1">Chassis / VIN</span>
                                <span className="text-sm text-gray-800 dark:text-gray-300 font-mono flex items-center gap-1 truncate" title={displayRider.chassis_number}>
                                    <Hash size={12} /> {displayRider.chassis_number || '-'}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg flex justify-between items-center group relative border border-gray-200 dark:border-transparent">
                                <div>
                                    <span className="text-xs text-black/60 dark:text-gray-500 block font-bold">Rider ID</span>
                                    <span className="text-sm text-gray-300 font-mono flex items-center gap-1 truncate" title={displayRider.custom_rider_id}>
                                        <BadgeCheck size={12} className="text-cyan-500" /> {displayRider.custom_rider_id}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg group relative border border-gray-200 dark:border-transparent">
                                <span className="text-xs text-black/60 dark:text-gray-500 block font-bold">Allotment Date</span>
                                <span className="text-sm text-gray-300 font-mono flex items-center gap-1">
                                    <Calendar size={12} /> {displayRider.allotment_date ? new Date(displayRider.allotment_date).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>

                            {/* Team Leader Section */}
                            <div className="col-span-2 bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-transparent">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-xs text-black/60 dark:text-gray-500 block mb-1 font-bold">Team Leader</span>
                                        <span className="text-sm text-black dark:text-gray-300 font-bold flex items-center gap-1">
                                            <Shield size={12} /> {displayRider.team_leader_name || 'Unassigned'}
                                        </span>

                                        {/* EXPLICIT TL MOBILE */}
                                        {displayRider.team_leader_mobile && (
                                            <p className="text-xs text-gray-400 font-mono mt-1 ml-1">
                                                {displayRider.team_leader_mobile}
                                            </p>
                                        )}
                                    </div>

                                    {displayRider.team_leader_mobile && (
                                        <div className="flex gap-2">
                                            <a href={`tel:${displayRider.team_leader_mobile}`} className="bg-gray-800 hover:bg-black text-white p-2 rounded-lg transition-colors shadow-sm" title="Call TL">
                                                <Phone size={14} />
                                            </a>
                                            <a href={`https://wa.me/${displayRider.team_leader_mobile}`} target="_blank" rel="noreferrer" className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-2 rounded-lg transition-colors shadow-sm" title="WhatsApp TL">
                                                <MessageCircle size={14} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Workflow Stepper */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Flag size={14} /> Live Status
                            </h3>
                            {activeTab === 'details' && (
                                <button
                                    onClick={() => setActiveTab('ai')}
                                    className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-600/30 transition-colors"
                                >
                                    <Sparkles size={12} /> AI Suggestions
                                </button>
                            )}
                        </div>

                        {activeTab === 'details' ? (
                            <div className="relative pl-6 border-l-2 border-gray-800 space-y-8 my-2">
                                {/* Fallback PENDING Action */}
                                {ticket.status === 'PENDING' && (
                                    <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                                        <p className="text-sm text-blue-300 mb-3 font-bold">New Ticket Request</p>
                                        <Button className="w-full bg-blue-600 hover:bg-blue-500" onClick={() => onStatusUpdate(ticket.id, 'ACCEPTED')}>
                                            Accept & Start Job
                                        </Button>
                                    </div>
                                )}

                                {steps.map((step, idx) => {
                                    const isCompleted = ['ACCEPTED', 'ON_WAY', 'IN_PROGRESS', 'COMPLETED'].indexOf(ticket.status) >= idx;
                                    const isCurrent = ticket.status === step.id;

                                    return (
                                        <div key={step.id} className="relative">
                                            {/* PAUSED OVERLAY FOR STEPS */}
                                            {ticket.is_paused && isCurrent && (
                                                <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-xl flex items-center gap-3 animate-pulse">
                                                    <PauseCircle className="text-yellow-500 h-6 w-6" />
                                                    <div>
                                                        <h4 className="text-yellow-400 font-bold text-sm">Workflow Paused</h4>
                                                        <p className="text-yellow-500/80 text-xs">Admin has paused this ticket. You cannot proceed currently.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Dot */}
                                            <div className={cn(
                                                "absolute -left-[31px] w-4 h-4 rounded-full border-4 border-[#0a0a0f] transition-all duration-500",
                                                isCompleted ? step.color : "bg-gray-700"
                                            )} />

                                            <div className={cn("transition-all duration-300 flex flex-col gap-2",
                                                isCompleted || isCurrent ? "opacity-100" : "opacity-40"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className={cn("font-bold text-sm", isCompleted ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-600")}>
                                                            {step.label}
                                                        </h4>
                                                        {isCurrent && (
                                                            <div className="mt-4 flex flex-col gap-3">
                                                                <p className="text-xs text-gray-400 animate-pulse mb-1">
                                                                    Currently active step...
                                                                </p>

                                                                {/* INLINE ACTIONS */}
                                                                {ticket.status === 'PENDING' && step.id === 'ACCEPTED' && (
                                                                    <div className="flex flex-col gap-3">
                                                                        <Button className="w-full bg-blue-600 hover:bg-blue-500 py-3" onClick={() => onStatusUpdate(ticket.id, 'ACCEPTED')}>
                                                                            Accept & Start Job
                                                                        </Button>
                                                                        <Button variant="danger" className="w-full" onClick={onReject}>
                                                                            Reject Request
                                                                        </Button>
                                                                    </div>
                                                                )}

                                                                {ticket.status === 'ACCEPTED' && step.id === 'ACCEPTED' && (
                                                                    <div className="flex flex-col gap-3">
                                                                        {location && (
                                                                            <a
                                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 border border-gray-700 py-3"
                                                                            >
                                                                                <Navigation size={18} className="text-blue-400" /> Navigate to Rider
                                                                            </a>
                                                                        )}
                                                                        <Button
                                                                            className="w-full bg-yellow-600 hover:bg-yellow-500 py-3"
                                                                            onClick={() => onStatusUpdate(ticket.id, 'ON_WAY')}
                                                                        >
                                                                            Mark On The Way <ChevronRight size={18} />
                                                                        </Button>
                                                                    </div>
                                                                )}

                                                                {ticket.status === 'ON_WAY' && step.id === 'ON_WAY' && (
                                                                    <div className="flex flex-col gap-3">
                                                                        {location && (
                                                                            <a
                                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 border border-gray-700 py-3"
                                                                            >
                                                                                <Navigation size={18} className="text-blue-400" /> Continue Navigation
                                                                            </a>
                                                                        )}
                                                                        <Button
                                                                            className="w-full bg-orange-600 hover:bg-orange-500 py-3"
                                                                            onClick={() => onStatusUpdate(ticket.id, 'IN_PROGRESS')}
                                                                        >
                                                                            Reach & Start Work <ChevronRight size={18} />
                                                                        </Button>
                                                                    </div>
                                                                )}

                                                                {ticket.status === 'IN_PROGRESS' && step.id === 'IN_PROGRESS' && (
                                                                    <Button
                                                                        className="w-full bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 py-4 text-lg"
                                                                        onClick={onComplete}
                                                                    >
                                                                        Complete Job <CheckCircle size={20} className="ml-2" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* AI Panel */
                            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 animate-in fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-purple-300 font-bold text-sm flex items-center gap-2">
                                        <Sparkles size={16} /> AI Repair Guide (EV Specific)
                                    </h4>
                                    <button onClick={() => setActiveTab('details')} className="text-gray-500 hover:text-white"><X size={14} /></button>
                                </div>
                                {loadingGuide ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-purple-400">
                                        <Loader2 size={24} className="animate-spin mb-2" />
                                        <p className="text-xs">Analyzing EV Diagnostics...</p>
                                    </div>
                                ) : techGuide ? (
                                    <div className="space-y-4 text-sm">
                                        {/* Diagnosis */}
                                        <div className="bg-purple-50 dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-500/10">
                                            <strong className="block text-purple-700 dark:text-purple-400 text-xs uppercase mb-2 flex items-center gap-1"><Search size={12} /> Diagnosis</strong>
                                            <ul className="list-disc ml-4 text-gray-800 dark:text-gray-300 space-y-1 text-xs font-medium">
                                                {techGuide.diagnosis.map((d: string, i: number) => <li key={i}>{d}</li>)}
                                            </ul>
                                        </div>

                                        {/* Steps */}
                                        <div className="bg-blue-50 dark:bg-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-500/10">
                                            <strong className="block text-blue-700 dark:text-blue-400 text-xs uppercase mb-2 flex items-center gap-1"><Wrench size={12} /> Repair Steps</strong>
                                            <ol className="list-decimal ml-4 text-gray-800 dark:text-gray-300 space-y-1 text-xs font-medium">
                                                {techGuide.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ol>
                                        </div>

                                        {/* Safety */}
                                        <div className="bg-red-900/10 p-3 rounded-lg border border-red-500/20">
                                            <strong className="block text-red-400 text-xs uppercase mb-2 flex items-center gap-1"><Shield size={12} /> Safety Warnings</strong>
                                            <ul className="list-disc ml-4 text-red-300 space-y-1 text-xs">
                                                {techGuide.safety.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>

                                        {/* Tools */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {techGuide.tools.map((t: string, i: number) => (
                                                <span key={i} className="px-2 py-1 bg-gray-800 text-gray-400 text-[10px] rounded border border-gray-700">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 text-xs">
                                        <p>Unable to generate guide. Please try again.</p>
                                        <Button variant="ghost" onClick={fetchAiGuide} className="mt-2 text-purple-400">Retry</Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* NEW TECHNICIAN WORKFLOW INSIGHTS SECTION */}
                    <div className="pt-6 border-t border-gray-800">
                        <TechnicianWorkflowSection ticket={ticket} />
                    </div>

                    {/* ADMIN AUDIT LOGS */}
                    {isAdmin && (
                        <div className="pt-6 border-t border-gray-800 animate-in slide-in-from-bottom pb-12">
                            <TicketAuditTimeline
                                ticketId={ticket.id}
                                onRollback={() => onStatusUpdate(ticket.id, ticket.status)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketDetailView;
