
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentLocation, calculateDistance, parseLocation } from '../lib/maps';
import type { Coordinates } from '../lib/maps';
import { MAP_TILE_URL, MAP_ATTRIBUTION, TICKET_CATEGORIES } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { analyzeTicketWithAI } from '../lib/groq';
import { Mic, Wrench, Truck, Loader2, X, Phone, MessageCircle, Navigation, CheckCircle2, Clock, CheckCircle, StopCircle, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import TicketHistory from '../components/TicketHistory';
import RatingModal from '../components/RatingModal';
import type { Ticket, TicketType, RiderMaster } from '../types';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

interface Hub {
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
}

// Web Speech API Types
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const STATUS_STEPS = [
    { status: 'PENDING', label: 'Requested', icon: Clock },
    { status: 'ACCEPTED', label: 'Accepted', icon: CheckCircle2 },
    { status: 'ON_WAY', label: 'On Way', icon: Navigation },
    { status: 'IN_PROGRESS', label: 'In Repair', icon: Wrench },
    { status: 'COMPLETED', label: 'Done', icon: CheckCircle },
];

const uploadFiles = async (files: File[], path: string) => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { error } = await supabase.storage.from('tickets').upload(filePath, file);

        if (error) {
            console.error('Error uploading file:', error);
            continue;
        }

        const { data } = supabase.storage.from('tickets').getPublicUrl(filePath);
        if (data) {
            uploadedUrls.push(data.publicUrl);
        }
    }
    return uploadedUrls;
};

const RiderDashboard: React.FC = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const [location, setLocation] = useState<Coordinates | null>(null);
    const [allowedAction, setAllowedAction] = useState<TicketType | null>(null); // Computed based on location
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [hubs, setHubs] = useState<Hub[]>([]);
    const [distanceToHub, setDistanceToHub] = useState<number | null>(null);
    const [nearestHub, setNearestHub] = useState<Hub | null>(null);

    // Ticket State
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [showRatingModal, setShowRatingModal] = useState(false);

    // Ticket Form State
    const [showForm, setShowForm] = useState(false);
    const [ticketCategory, setTicketCategory] = useState(TICKET_CATEGORIES[0]);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState('');

    // Media State
    const [images, setImages] = useState<File[]>([]);
    const [voiceNotes, setVoiceNotes] = useState<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recognitionRef = useRef<any>(null);

    // AI Suggestion State
    const [aiSuggestion, setAiSuggestion] = useState<string>('');

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<any>(null);

    // State for Rider Master Data (for self display)
    const [myMasterData, setMyMasterData] = useState<RiderMaster | null>(null);

    useEffect(() => {
        let ticketChannel: ReturnType<typeof supabase.channel> | null = null;
        let masterChannel: ReturnType<typeof supabase.channel> | null = null;

        const init = async () => {
            const { data } = await supabase.from('hubs').select('*').eq('status', 'ACTIVE');
            const fetchedHubs = data || [];
            setHubs(fetchedHubs as unknown as Hub[]);
            refreshLocation(fetchedHubs);
        };
        init();
        if (profile) {
            fetchTickets();

            // 1. Ticket Subscription
            ticketChannel = supabase
                .channel('rider_tickets')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'tickets',
                        filter: `rider_id=eq.${profile.id}`,
                    },
                    () => fetchTickets()
                )
                .subscribe();

            // 2. Master Data Fetch & Subscription
            const setupMasterData = async () => {
                if (!profile.mobile) return;
                const cleanMobile = profile.mobile.replace(/\D/g, '').slice(-10);
                const { data } = await supabase
                    .from('rider_master')
                    .select('*')
                    .ilike('mobile', `%${cleanMobile}%`)
                    .maybeSingle();

                if (data) {
                    setMyMasterData(data as RiderMaster);
                    masterChannel = supabase
                        .channel(`rider_master_self_${data.id}`)
                        .on(
                            'postgres_changes',
                            { event: 'UPDATE', schema: 'public', table: 'rider_master', filter: `id=eq.${data.id}` },
                            (payload) => setMyMasterData(payload.new as RiderMaster)
                        )
                        .subscribe();
                }
            };
            setupMasterData();
        }

        return () => {
            if (ticketChannel) supabase.removeChannel(ticketChannel);
            if (masterChannel) supabase.removeChannel(masterChannel);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [profile]);

    // --- VOICE TO TEXT (Description) ---
    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Voice typing not supported in this browser.");
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US'; // Or 'hi-IN' for Hindi mix

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setDescription(prev => prev + (prev ? ' ' : '') + transcript);
            };

            recognition.start();
            recognitionRef.current = recognition;
        }
    };

    // --- AUDIO RECORDER (Voice Notes) ---
    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            if (voiceNotes.length >= 3) {
                // Alert handled in UI button disabled state typically, but good safety check
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];

                mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    setVoiceNotes(prev => [...prev, blob]);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
            } catch (err) {
                console.error("Mic access denied", err);
                alert("Microphone access restriction. Please enable permissions.");
            }
        }
    };

    // --- AI SUGGESTIONS ---
    useEffect(() => {
        // Simple mock AI suggestions based on category
        const suggestions: Record<string, string> = {
            'Engine Issue': 'Suggestion: Check oil level and coolant. (kripya oil level check karein)',
            'Tyre/Wheel': 'Suggestion: Check air pressure and punctures. (hawa ka dabav check karein)',
            'Battery/Electrical': 'Suggestion: Check battery connections and fuses. (battery connections check karein)',
            'Brake Issue': 'Suggestion: Check brake fluid level. (brake fluid check karein)',
            'Fuel Issue': 'Suggestion: Ensure sufficient fuel level. (fuel level check karein)',
            'Chain Drive': 'Suggestion: Check chain tension and lubrication. (chain tension check karein)',
            'General Service': 'Suggestion: List all required service points. (sabhi service points note karein)',
            'Accident/Damage': 'Suggestion: Take photos of all visible damage. (damage ki photo lein)'
        };
        setAiSuggestion(suggestions[ticketCategory] || 'Describe the issue clearly. (Samasya ka vivaran dein)');
    }, [ticketCategory]);

    const fetchTickets = async () => {
        if (!profile) return;

        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('*, technician:technician_id(full_name, mobile)')
                .eq('rider_id', profile.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTickets(data as Ticket[]);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        }
    };

    const refreshLocation = async (currentHubs: any[]) => {
        try {
            const loc = await getCurrentLocation();
            setLocation(loc);

            // Calculate distance to nearest hub
            if (currentHubs.length > 0 && loc) {
                let minDist = Infinity;
                let closest: Hub | null = null;

                currentHubs.forEach(hub => {
                    const d = calculateDistance(loc, { lat: hub.latitude, lng: hub.longitude });
                    if (d < minDist) {
                        minDist = d;
                        closest = hub;
                    }
                });

                setDistanceToHub(minDist);
                setNearestHub(closest);
            }
        } catch (e) {
            console.error('Location error:', e);
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        // validation: ensure location & allowed action
        if (!profile || !location || !allowedAction) return;

        // Double check radius constraint at submission time to prevent hacking
        if (allowedAction === 'RUNNING_REPAIR' && distanceToHub && distanceToHub > 2.5) { // 2.5km buffer
            setFeedback('Error: You are too far from a Hub for Repair. Please use Emergency RSA.');
            return;
        }

        setSubmitting(true);
        setFeedback('');

        try {
            // 1. Upload Media
            const imageUrls = await uploadFiles(images, `images/${profile.id}`);
            // Note: uploadFiles expects File[], voiceNotes are Blob[]. Need to cast or convert.
            const voiceFiles = voiceNotes.map((blob, i) => new File([blob], `voice_${Date.now()}_${i}.webm`, { type: 'audio/webm' }));
            const voiceUrls = await uploadFiles(voiceFiles, `voice/${profile.id}`);

            // 2. AI Analysis
            const aiAnalysis = await analyzeTicketWithAI(description);

            // 2.5 Fetch Rider Snapshot from Single Source of Truth
            let riderSnapshot = null;
            if (profile.mobile) {
                const cleanMobile = profile.mobile.replace(/\D/g, '').slice(-10);
                const { data: masterData } = await supabase
                    .from('rider_master')
                    .select('*')
                    .ilike('mobile', `%${cleanMobile}%`)
                    .maybeSingle();

                if (masterData) {
                    riderSnapshot = {
                        full_name: masterData.full_name,
                        mobile: masterData.mobile,
                        chassis_number: masterData.chassis_number,
                        wallet_balance: masterData.wallet_balance,
                        team_leader_name: masterData.team_leader_name,
                        team_leader_mobile: masterData.team_leader_mobile
                    };
                    setMyMasterData(masterData as RiderMaster);
                }
            }

            // 3. Create Ticket
            const { error } = await supabase.from('tickets').insert({
                rider_id: profile.id,
                type: allowedAction,
                category: ticketCategory,
                description,
                location: `POINT(${location.lng} ${location.lat})`,
                ai_analysis: aiAnalysis,
                images: imageUrls,
                voice_notes: voiceUrls,
                status: 'PENDING',
                rider_snapshot: riderSnapshot
            });

            if (error) throw error;

            setFeedback('Ticket created successfully! Help is on the way.');
            setShowForm(false);
            setDescription('');
            setImages([]);
            setVoiceNotes([]);
        } catch (error: any) {
            console.error('Ticket creation error:', error);
            setFeedback(`Error: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRateClick = (id: string) => {
        setActiveTicketId(id);
        setShowRatingModal(true);
    };

    const handleRatingSubmit = async (rating: number, comment: string) => {
        if (!activeTicketId) return;
        const { error } = await supabase
            .from('tickets')
            .update({
                customer_rating: rating,
                customer_feedback: comment
            })
            .eq('id', activeTicketId);

        if (!error) {
            setShowRatingModal(false);
            fetchTickets();
        }
    };

    return (
        <div className="relative min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pb-24 font-sans text-gray-900 dark:text-gray-100 overflow-x-hidden selection:bg-cyan-500/30 transition-colors duration-300">
            {/* Map Background */}
            <div className="absolute inset-0 z-0 opacity-40">
                <MapContainer
                    center={[location?.lat || 28.6139, location?.lng || 77.2090]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
                    {location && (
                        <Marker position={[location.lat, location.lng]}>
                            <Popup>You are here</Popup>
                        </Marker>
                    )}
                    {/* Active Hub Markers */}
                    {hubs.map(hub => (
                        <Marker
                            key={hub.id}
                            position={[hub.latitude, hub.longitude]}
                            icon={new L.Icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                            })}
                        >
                            <Popup>
                                <div className="text-black font-bold">{hub.name}</div>
                                <div className="text-gray-600 text-xs text-center">Active Hub</div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Main Content Overlay */}
            <div className="relative z-10 p-4 md:p-6 pt-16 space-y-6 md:space-y-8 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-end backdrop-blur-sm bg-white/60 dark:bg-black/20 p-4 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm dark:shadow-none">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                            {t('rider.hello')}, <span className="text-cyan-600 dark:text-cyan-400">{profile?.full_name?.split(' ')[0] || 'Rider'}</span> 👋
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
                            {loadingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                            {loadingLocation ? t('rider.locating') : distanceToHub !== null ?
                                `${t('rider.nearest_hub')}: ${distanceToHub.toFixed(2)} km (${distanceToHub <= 2 ? t('rider.in_range') : t('rider.out_of_range')})` :
                                t('rider.location_verified')}
                        </p>
                    </div>
                </div>

                {/* Create Ticket Buttons */}
                {!showForm && !tickets.some(t => ['PENDING', 'ACCEPTED', 'ON_WAY'].includes(t.status)) && (
                    <div className="grid grid-cols-2 gap-4">
                        {/* Repair Button - Only if within 2km */}
                        <button
                            disabled={!distanceToHub || distanceToHub > 2}
                            onClick={() => { setAllowedAction('RUNNING_REPAIR'); setShowForm(true); }}
                            className={cn(
                                "group p-6 bg-gradient-to-br backdrop-blur-md rounded-2xl border flex flex-col items-center gap-3 shadow-lg transition-all",
                                (!distanceToHub || distanceToHub > 2)
                                    ? "from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed"
                                    : "from-blue-50 to-blue-100 dark:from-blue-900/80 dark:to-blue-800/80 border-blue-200 dark:border-blue-500/30 hover:scale-[1.02] hover:shadow-blue-500/20"
                            )}
                        >
                            <div className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                                (!distanceToHub || distanceToHub > 2) ? "bg-gray-200 dark:bg-gray-700 text-gray-500" : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white"
                            )}>
                                <Wrench size={32} />
                            </div>
                            <span className="font-bold text-lg">{t('rider.running_repair')}</span>
                            {distanceToHub && distanceToHub > 2 && <span className="text-[10px] text-red-400">{t('rider.out_of_range')} ({distanceToHub.toFixed(1)}km )</span>}
                        </button>

                        {/* RSA Button - Only if outside 2km */}
                        <button
                            disabled={distanceToHub !== null && distanceToHub <= 2}
                            onClick={() => { setAllowedAction('RSA'); setShowForm(true); }}
                            className={cn(
                                "group p-6 bg-gradient-to-br backdrop-blur-md rounded-2xl border flex flex-col items-center gap-3 shadow-lg transition-all",
                                (distanceToHub !== null && distanceToHub <= 2)
                                    ? "from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed"
                                    : "from-red-50 to-red-100 dark:from-red-900/80 dark:to-red-800/80 border-red-200 dark:border-red-500/30 hover:scale-[1.02] hover:shadow-red-500/20"
                            )}
                        >
                            <div className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                                (distanceToHub !== null && distanceToHub <= 2) ? "bg-gray-200 dark:bg-gray-700 text-gray-500" : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 group-hover:bg-red-500 group-hover:text-white"
                            )}>
                                <Truck size={32} />
                            </div>
                            <span className="font-bold text-lg">{t('rider.emergency_rsa')}</span>
                            {distanceToHub !== null && distanceToHub <= 2 && <span className="text-[10px] text-blue-400">{t('rider.go_to_hub')}</span>}
                        </button>
                    </div>
                )}

                {/* Active Activity Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 size={16} /> {t('rider.active_activity')}
                    </h3>

                    {tickets.filter(t => ['PENDING', 'ACCEPTED', 'ON_WAY', 'IN_PROGRESS'].includes(t.status)).length > 0 ? (
                        <div className="grid gap-4">
                            {tickets.filter(t => ['PENDING', 'ACCEPTED', 'ON_WAY', 'IN_PROGRESS'].includes(t.status)).map(ticket => {
                                const currentStepIndex = STATUS_STEPS.findIndex(s => s.status === ticket.status);
                                return (
                                    <div key={ticket.id} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-6 rounded-2xl border border-gray-200 dark:border-cyan-500/30 shadow-lg relative overflow-hidden transition-all group">
                                        {/* Live Status Indicator */}
                                        <div className="absolute top-0 right-0 p-2 bg-cyan-100 dark:bg-cyan-950/80 rounded-bl-2xl border-b border-l border-cyan-200 dark:border-cyan-500/30 shadow-xl backdrop-blur-md z-10">
                                            <span className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs uppercase tracking-wider">
                                                <div className="w-2 h-2 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]" />
                                                Live Updates
                                            </span>
                                        </div>

                                        {/* Navigation to Hub (If Type is Repair and Hub exists) */}
                                        {ticket.type === 'RUNNING_REPAIR' && nearestHub && (
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${nearestHub?.latitude},${nearestHub?.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute top-0 left-0 p-2 pb-3 pr-3 bg-blue-900/80 rounded-br-2xl border-b border-r border-blue-500/30 text-xs text-blue-200 hover:text-white font-bold flex items-center gap-1 z-10 hover:pr-4 transition-all"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Navigation size={12} /> {t('rider.directions')}
                                            </a>
                                        )}

                                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-600 shrink-0">
                                            {ticket.type === 'RSA' ? <Truck className="text-red-500 dark:text-red-400" /> : <Wrench className="text-blue-500 dark:text-blue-400" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1 truncate">{ticket.category}</h4>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">{ticket.description}</p>
                                            {parseLocation(ticket.location) && (
                                                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                                    <Navigation size={10} />
                                                    {parseLocation(ticket.location)?.lat.toFixed(4)}, {parseLocation(ticket.location)?.lng.toFixed(4)}
                                                </p>
                                            )}
                                        </div>


                                        {/* Workflow Progress Bar */}
                                        <div className="mb-6 relative">
                                            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-700 -translate-y-1/2 rounded-full" />
                                            <div
                                                className="absolute top-1/2 left-0 h-1 bg-cyan-500 -translate-y-1/2 rounded-full transition-all duration-500"
                                                style={{ width: `${(Math.max(0, currentStepIndex) / (STATUS_STEPS.length - 1)) * 100}%` }}
                                            />
                                            <div className="relative flex justify-between">
                                                {STATUS_STEPS.map((step, idx) => {
                                                    const isCompleted = idx <= currentStepIndex;
                                                    const isActive = idx === currentStepIndex;
                                                    const Icon = step.icon;
                                                    return (
                                                        <div key={step.status} className="flex flex-col items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${isActive ? 'bg-cyan-500 border-cyan-400 text-white scale-110 shadow-[0_0_15px_#22d3ee]' :
                                                                isCompleted ? 'bg-cyan-100 dark:bg-cyan-900/50 border-cyan-500 text-cyan-600 dark:text-cyan-400' :
                                                                    'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600'
                                                                }`}>
                                                                <Icon size={14} />
                                                            </div>
                                                            <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-cyan-600 dark:text-cyan-400' :
                                                                isCompleted ? 'text-gray-400 dark:text-gray-300' :
                                                                    'text-gray-400 dark:text-gray-600'
                                                                }`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* My Profile Info on Ticket */}
                                        {
                                            (myMasterData || ticket.rider_snapshot) && (
                                                <div className="mb-4 bg-gray-900/80 p-3 rounded-lg border border-gray-700/50 flex items-center justify-between shadow-inner">
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Rider Data</p>
                                                        <p className="text-sm font-bold text-white">
                                                            {myMasterData?.full_name || ticket.rider_snapshot?.full_name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-mono">
                                                            {myMasterData?.chassis_number || ticket.rider_snapshot?.chassis_number}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-500 uppercase mb-1">Wallet</p>
                                                        <p className={cn("font-bold font-mono", (myMasterData?.wallet_balance || 0) < 0 ? "text-red-400" : "text-green-400")}>
                                                            ₹{myMasterData?.wallet_balance ?? ticket.rider_snapshot?.wallet_balance ?? '0'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        {
                                            ticket.technician ? (
                                                <div className="mt-4 p-4 bg-gray-50 dark:bg-black/40 rounded-xl flex items-center justify-between border border-gray-200 dark:border-white/5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-2xl border border-gray-300 dark:border-gray-700">
                                                            👷
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{ticket.technician?.full_name}</p>
                                                            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium tracking-wide uppercase">{t('rider.technician_assigned')}</p>
                                                        </div>
                                                    </div>

                                                    {!['COMPLETED', 'CANCELLED', 'CLOSED'].includes(ticket.status) && (
                                                        <div className="flex gap-2">
                                                            <a
                                                                href={`tel:${ticket.technician?.mobile}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="bg-green-600 hover:bg-green-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-green-900/20 flex items-center justify-center"
                                                                title="Call Technician"
                                                            >
                                                                <Phone size={20} />
                                                            </a>
                                                            <a
                                                                href={`https://wa.me/${ticket.technician?.mobile}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-3 rounded-xl transition-colors shadow-lg shadow-green-900/20 flex items-center justify-center"
                                                                title="WhatsApp Technician"
                                                            >
                                                                <MessageCircle size={20} />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-4 flex items-center gap-2 text-xs text-yellow-500 font-medium bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20 w-fit">
                                                    <Loader2 size={14} className="animate-spin" /> {t('rider.looking_for_tech')}
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-gray-500 dark:text-gray-500 text-sm italic p-8 bg-white/50 dark:bg-gray-900/50 rounded-2xl text-center border border-dashed border-gray-300 dark:border-gray-800">
                            No active repairs. Use the buttons above to get help.
                        </div>
                    )}
                </div>

                {/* Past History */}
                <div className="space-y-4 pt-8 border-t border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Past History</h3>
                    <TicketHistory
                        tickets={tickets.filter(t => ['COMPLETED', 'CANCELLED'].includes(t.status))}
                        onRate={handleRateClick}
                    />
                </div>
            </div>

            {/* MODERNIZED FORM MODAL */}
            {
                showForm && (
                    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[85vh] overflow-y-auto transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {allowedAction === 'RSA' ? <Truck className="text-red-500" /> : <Wrench className="text-blue-500" />}
                                    {allowedAction === 'RSA' ? 'Emergency Request' : 'Repair Request'}
                                </h2>
                                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-white">
                                    <X />
                                </button>
                            </div>

                            <form onSubmit={handleCreateTicket} className="space-y-6">
                                {/* Category Select */}
                                <div>
                                    <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block font-medium">Issue Category</label>
                                    <select
                                        value={ticketCategory}
                                        onChange={e => setTicketCategory(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl p-4 border border-gray-200 dark:border-gray-700 outline-none focus:border-cyan-500 transition-colors appearance-none"
                                    >
                                        {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Description with AI & Voice */}
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-500 dark:text-gray-400 block font-medium">Description</label>
                                    <div className="relative">
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl p-4 pr-12 border border-gray-200 dark:border-gray-700 outline-none focus:border-cyan-500 min-h-[120px] resize-none"
                                            placeholder="Describe the issue... (Bolkar batane ke liye mic dabayein)"
                                        />
                                        <button
                                            type="button"
                                            onClick={toggleListening}
                                            className={cn("absolute right-4 bottom-4 p-2 rounded-full transition-all", isListening ? "bg-red-500 animate-pulse text-white" : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300")}
                                            title="Voice to Text"
                                        >
                                            <Mic size={20} />
                                        </button>
                                    </div>

                                    {/* AI Helper Highlight */}
                                    <div className="flex items-start gap-2 bg-gradient-to-r from-purple-900/40 to-cyan-900/40 p-3 rounded-lg border border-purple-500/20">
                                        <Sparkles size={16} className="text-purple-400 mt-0.5" />
                                        <p className="text-xs text-purple-200">
                                            <span className="font-bold text-purple-400">{t('rider.ai_tip')}:</span> {aiSuggestion}
                                        </p>
                                    </div>
                                </div>

                                {/* Media Section */}
                                <div className="space-y-4">
                                    <label className="text-sm text-gray-400 block font-medium">Media Attachments</label>

                                    <div className="flex gap-3">
                                        {/* Image Upload Button */}
                                        <Button
                                            type="button"
                                            onClick={() => images.length < 3 && fileInputRef.current?.click()}
                                            disabled={images.length >= 3}
                                            className={cn("flex-1 border-gray-700 hover:bg-gray-800 relative overflow-hidden", images.length >= 3 && "opacity-50")}
                                            variant="outline"
                                        >
                                            <ImageIcon className="mr-2 text-cyan-400" size={18} />
                                            Photos ({images.length}/3)
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="hidden"
                                                ref={fileInputRef}
                                                onChange={e => {
                                                    if (e.target.files) {
                                                        const newFiles = Array.from(e.target.files).slice(0, 3 - images.length);
                                                        setImages(prev => [...prev, ...newFiles]);
                                                    }
                                                }}
                                            />
                                        </Button>

                                        {/* Voice Note Recorder */}
                                        <Button
                                            type="button"
                                            onClick={toggleRecording}
                                            disabled={voiceNotes.length >= 3}
                                            className={cn(
                                                "flex-1 border-gray-700 relative overflow-hidden",
                                                isRecording ? "bg-red-900/20 border-red-500/50 text-red-500" : "hover:bg-gray-800",
                                                voiceNotes.length >= 3 && "opacity-50"
                                            )}
                                            variant="outline"
                                        >
                                            {isRecording ? <StopCircle className="mr-2 animate-pulse" size={18} /> : <Mic className="mr-2 text-yellow-400" size={18} />}
                                            {isRecording ? "Stop Rec" : `Audit(${voiceNotes.length}/3)`}
                                        </Button>
                                    </div>

                                    {/* Previews */}
                                    {images.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {images.map((file, idx) => (
                                                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-700 shrink-0 group">
                                                    <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {voiceNotes.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                            {voiceNotes.map((_, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg border border-gray-700">
                                                    <span className="text-xs text-gray-400 flex items-center gap-2">
                                                        <Mic size={12} /> Voice Note {idx + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setVoiceNotes(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-gray-500 hover:text-red-400"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {feedback && (
                                    <div className={`p-4 rounded-xl text-sm font-medium ${feedback.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                        {feedback}
                                    </div>
                                )}

                                <Button
                                    loading={submitting}
                                    type="submit"
                                    className={cn(
                                        "w-full font-bold py-4 rounded-xl shadow-lg transition-all text-white", // Explicitly text-white
                                        allowedAction === 'RSA'
                                            ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/20'
                                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20'
                                    )}
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Submitting...</span>
                                    ) : (
                                        "Submit Request Now"
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Rating Modal */}
            {
                activeTicketId && (
                    <RatingModal
                        isOpen={showRatingModal}
                        onClose={() => setShowRatingModal(false)}
                        onSubmit={handleRatingSubmit}
                        ticketId={activeTicketId}
                        technicianName={tickets.find(t => t.id === activeTicketId)?.technician?.full_name}
                    />
                )
            }
        </div >
    );
};
export default RiderDashboard;
