import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile, Ticket } from '../types';
import { cn } from '../lib/utils';
import { calculateDistance, parseLocation } from '../lib/maps';
import { Users, CheckCircle, Shield, Radio, XCircle, UserCheck, Clock, Activity, Zap, FileText, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import TechnicianPerformance from '../components/admin/TechnicianPerformance';
import AIInsightsPanel from '../components/admin/AIInsightsPanel';
import SmartStatCard from '../components/admin/SmartStatCard';
import AIForecastChart from '../components/admin/AIForecastChart';
import SLAMonitor from '../components/admin/SLAMonitor';

// Mock Data generator for charts
const generateSparkline = () => Array.from({ length: 10 }, () => Math.floor(Math.random() * 50) + 20);


const UserRow: React.FC<{ user: UserProfile }> = ({ user }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition shadow-sm hover:shadow-md">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-white">
                {user.full_name?.charAt(0) || user.mobile.charAt(0)}
            </div>
            <div>
                <h4 className="text-gray-900 dark:text-white font-medium">{user.full_name || 'Unknown User'}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-500">{user.mobile}</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <span className={cn("px-2 py-1 rounded text-xs font-medium uppercase border",
                user.role === 'admin' ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" :
                    user.role.includes('tech') ? "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20" :
                        "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20"
            )}>
                {user.role}
            </span>
            {user.performance_score !== undefined && (
                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-500">
                    ★ {user.performance_score}
                </span>
            )}
        </div>
    </div>
);

const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { t } = useLanguage();

    // Dispatch State
    const [systemSettings, setSystemSettings] = useState({
        id: '',
        auto_assign_enabled: true,
        rsa_routing_enabled: true,
        hub_routing_enabled: true
    });
    const [dispatchLogs, setDispatchLogs] = useState<string[]>([]);
    const [isRealtime, setIsRealtime] = useState(false);
    const [forecastData, setForecastData] = useState<any[]>([]);

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000);
        // Real-time subscription for Settings
        const settingsSubscription = supabase
            .channel('system_settings_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, payload => {
                setSystemSettings(prev => ({ ...prev, ...payload.new }));
                setIsRealtime(true);
                addLog(`🔄 System Settings updated remotely.`);
                setTimeout(() => setIsRealtime(false), 2000);
            })
            .subscribe();

        // Real-time subscription for Tickets (Global Counters)
        const ticketsSubscription = supabase
            .channel('admin_dashboard_tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                // Refresh data on ANY ticket change
                fetchDashboardData();
                setIsRealtime(true);
                setTimeout(() => setIsRealtime(false), 2000);
            })
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(settingsSubscription);
            supabase.removeChannel(ticketsSubscription);
        };
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users & Tickets
            const [usersResponse, ticketsResponse] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('tickets').select('*')
            ]);

            if (usersResponse.error) throw usersResponse.error;
            if (ticketsResponse.error) throw ticketsResponse.error;

            setUsers(usersResponse.data as UserProfile[]);
            setTickets(ticketsResponse.data as Ticket[]);

            // 2. Fetch Settings
            const { data: settingsData, error: settingsError } = await supabase.from('system_settings').select('*').limit(1).single();

            if (settingsData) {
                setSystemSettings(settingsData);
            } else if (settingsError && settingsError.code === 'PGRST116') {
                // Initialize if empty
                const defaultSettings = {
                    auto_assign_enabled: true,
                    rsa_routing_enabled: true,
                    hub_routing_enabled: true
                };
                const { data: newData } = await supabase.from('system_settings').insert([defaultSettings]).select().single();
                if (newData) setSystemSettings(newData);
            }

            // 3. Fetch Forecast
            // 3. Fetch Forecast
            const { data: forecast, error: forecastError } = await supabase.rpc('get_ticket_forecast');

            if (forecast && forecast.length > 0) {
                setForecastData(forecast);
            } else {
                console.warn("Forecast RPC failed or empty, using fallback.", forecastError);
                // Fallback: Generate local 24h data
                const now = new Date();
                const fallbackData = Array.from({ length: 24 }, (_, i) => {
                    const d = new Date(now);
                    d.setHours(d.getHours() - 12 + i);
                    d.setMinutes(0);
                    const isPast = i <= 12;
                    const hour = d.getHours();

                    // Simple mock logic
                    let prediction = 10;
                    if (hour >= 8 && hour <= 10) prediction = 25; // Morning
                    if (hour >= 17 && hour <= 19) prediction = 30; // Evening
                    if (hour <= 5) prediction = 5; // Night
                    prediction += Math.floor(Math.random() * 5);

                    return {
                        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        predicted: prediction,
                        actual: isPast ? Math.max(0, prediction + Math.floor(Math.random() * 10 - 5)) : null
                    };
                });
                setForecastData(fallbackData);
            }

        } catch (error) {
            console.error('Admin fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- CLIENT-SIDE "AI" AUTO-DISPATCHER ---
    useEffect(() => {
        if (!systemSettings.auto_assign_enabled) return;

        // The "Brain" Loop - Runs every 10 seconds checking for work
        const interval = setInterval(async () => {
            // 1. Identify Pending Work
            const pendingTickets = tickets.filter(t => t.status === 'PENDING');
            if (pendingTickets.length === 0) return;

            // 2. Identify Workforce
            const availableTechs = users.filter(u =>
                (u.role === 'hub_tech' || u.role === 'rsa_tech') &&
                u.is_available !== false // Default to available
            );

            if (availableTechs.length === 0) {
                addLog("⚠️ AI Alert: No technicians available for dispatch.");
                return;
            }

            // Process one ticket at a time to simulate "Focus"
            const ticket = pendingTickets[0];

            // "AI Processing" Delay (Visual only, per user request)
            addLog(`🤖 AI analyzing Ticket #${ticket.id.slice(0, 4)}...`);

            await new Promise(r => setTimeout(r, 3000)); // 3s Thinking time

            // 3. Score Candidates
            let bestTech = null;
            let highestScore = -Infinity;
            const logDetails: string[] = [];

            const ticketLoc = parseLocation(ticket.location);

            for (const tech of availableTechs) {
                // A. Filter by Role/Skill
                const requiredRole = ticket.type === 'RSA' ? 'rsa_tech' : 'hub_tech';
                const isRoleMatch = tech.role === requiredRole;

                // If specific routing is enabled, enforce role. Else, allow cross-assigment if desperate? 
                // Strict adhering to user request "work according to these tickets Hub/RSA"
                if (systemSettings.rsa_routing_enabled && ticket.type === 'RSA' && !isRoleMatch) continue;
                if (systemSettings.hub_routing_enabled && ticket.type === 'RUNNING_REPAIR' && !isRoleMatch) continue;

                // B. Calculate Score
                let score = 0;

                // B1. Workload (Who is free?)
                const activeTechTickets = tickets.filter(t =>
                    t.technician_id === tech.id &&
                    ['ACCEPTED', 'ON_WAY', 'IN_PROGRESS'].includes(t.status)
                );

                if (activeTechTickets.length === 0) score += 50; // Huge bonus for completely free
                else if (activeTechTickets.length === 1) score += 10; // Manageable
                else score -= 30; // Overloaded

                // B2. Proximity (Who is close?)
                let dist = 999;
                if (ticketLoc && tech.current_location) {
                    dist = calculateDistance(ticketLoc, tech.current_location);
                    if (dist < 5) score += 40; // < 5km
                    else if (dist < 10) score += 20; // < 10km
                    else score -= 10; // Too far
                } else if (tech.hub_center && ticketLoc) {
                    // Fallback to Hub Center if live location missing
                    dist = calculateDistance(ticketLoc, tech.hub_center);
                    if (dist < 5) score += 30;
                }

                // B3. Momentum (Who is about to finish?)
                // Heuristic: If they have a "COMPLETED" ticket in last 10 mins? 
                // Hard to track without efficient TS queries, skipping for now.
                // Instead check status of active ticket
                if (activeTechTickets.length === 1) {
                    const currentStatus = activeTechTickets[0].status;
                    if (currentStatus === 'IN_PROGRESS') score += 5; // Might finish soon?
                    if (currentStatus === 'ON_WAY') score -= 10; // Just started travelling
                }

                logDetails.push(`${tech.full_name?.split(' ')[0]}: ${score}pts (${dist.toFixed(1)}km, ${activeTechTickets.length} active)`);

                if (score > highestScore) {
                    highestScore = score;
                    bestTech = tech;
                }
            }

            // 4. Decision & Execution
            if (bestTech) {
                await new Promise(r => setTimeout(r, 2000)); // 2s Decision time

                try {
                    const { error } = await supabase
                        .from('tickets')
                        .update({
                            technician_id: bestTech.id,
                            status: 'ACCEPTED'
                        })
                        .eq('id', ticket.id);

                    if (!error) {
                        addLog(`✅ AI Assigned: ${bestTech.full_name} (Score: ${highestScore})`);
                        // Optional: Log the candidates for transparency
                        // addLog(`Candidate Analysis: ${logDetails.join(', ')}`);
                        fetchDashboardData();
                    }
                } catch (err) {
                    console.error("Auto-assign error", err);
                }
            } else {
                addLog(`⚠️ AI: No suitable candidate found for Ticket #${ticket.id.slice(0, 4)}`);
            }

        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [tickets, users, systemSettings]);

    const addLog = (msg: string) => {
        setDispatchLogs(prev => [msg, ...prev].slice(0, 50));
    };

    const toggleSetting = async (key: keyof typeof systemSettings) => {
        if (key === 'id') return;

        const newValue = !systemSettings[key];
        // Optimistic Update
        setSystemSettings(prev => ({ ...prev, [key]: newValue }));

        try {
            // Ensure we have an ID
            let rowId = systemSettings.id;

            if (!rowId) {
                const { data } = await supabase.from('system_settings').select('id').limit(1).single();
                if (data) {
                    rowId = data.id;
                    setSystemSettings(prev => ({ ...prev, id: data.id }));
                }
            }

            if (!rowId) throw new Error("Settings row ID not found");

            const { error } = await supabase
                .from('system_settings')
                .update({ [key]: newValue })
                .eq('id', rowId);

            if (error) throw error;

            addLog(`Changed ${key} to ${newValue}`);
        } catch (error) {
            console.error(`Failed to update ${key}`, error);
            // Revert on error
            setSystemSettings(prev => ({ ...prev, [key]: !newValue }));
            addLog(`❌ Failed to update ${key}`);
        }
    };

    const activeTickets = tickets.filter(t => ['ACCEPTED', 'ON_WAY', 'IN_PROGRESS'].includes(t.status)).length;
    const upcomingTickets = tickets.filter(t => t.status === 'PENDING').length;
    const completedTickets = tickets.filter(t => t.status === 'COMPLETED').length;
    const cancelledTickets = tickets.filter(t => t.status === 'CANCELLED').length;
    const totalRiders = users.filter(u => u.role === 'rider').length;
    const totalTechs = users.filter(u => u.role === 'hub_tech' || u.role === 'rsa_tech').length;

    if (loading) {
        return <div className="p-10 text-center text-white">Loading admin data...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                        Command Center
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                        <Activity size={14} className="text-green-500" />
                        System Optimal • AI Monitoring Active
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800/50 p-2 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", systemSettings.auto_assign_enabled ? "bg-green-500" : "bg-red-500")}></span>
                            <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", systemSettings.auto_assign_enabled ? "bg-green-500" : "bg-red-500")}></span>
                        </span>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            {systemSettings.auto_assign_enabled ? "Auto-Pilot ON" : "Manual Mode"}
                        </span>
                    </div>
                </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* 1. Key Metrics Row */}
                <div className="lg:col-span-1" onClick={() => navigate('/admin/upcoming-tickets')}>
                    <SmartStatCard
                        title={t('dashboard.pending_tickets')}
                        value={upcomingTickets}
                        trend={12}
                        data={generateSparkline()}
                        icon={<Clock size={20} className="text-orange-500" />}
                        color="bg-orange-500"
                        onAiExplain={() => addLog("AI: Pending tickets spiked due to morning rush.")}
                    />
                </div>
                <div className="lg:col-span-1" onClick={() => navigate('/admin/active-tickets')}>
                    <SmartStatCard
                        title={t('nav.active_tickets')}
                        value={activeTickets}
                        trend={5}
                        data={generateSparkline()}
                        icon={<Zap size={20} className="text-yellow-500" />}
                        color="bg-yellow-500"
                    />
                </div>
                <div className="lg:col-span-1" onClick={() => navigate('/admin/completed-tickets')}>
                    <SmartStatCard
                        title={t('nav.completed_tickets')}
                        value={completedTickets}
                        trend={8}
                        data={generateSparkline()}
                        icon={<CheckCircle size={20} className="text-green-500" />}
                        color="bg-green-500"
                    />
                </div>
                <div className="lg:col-span-1" onClick={() => navigate('/admin/tickets/cancelled')}>
                    <SmartStatCard
                        title="Cancelled"
                        value={cancelledTickets}
                        trend={-2}
                        data={generateSparkline()}
                        icon={<XCircle size={20} className="text-red-500" />}
                        color="bg-red-500"
                    />
                </div>

                {/* 2. Main Content Grid - Balanced 3 Columns */}

                {/* Left Column: Operations (Dispatch + SLA) */}
                <div className="lg:col-span-1 space-y-4">
                    <div className={cn("bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border p-6 transition-all duration-300 shadow-sm", isRealtime ? "border-green-500/50 shadow-green-500/10" : "border-gray-200 dark:border-gray-700/50")}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Shield size={18} className="text-cyan-600 dark:text-cyan-400" />
                                Dispatch Settings
                            </h3>
                            {isRealtime && <span className="text-[10px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-full animate-pulse font-bold">LIVE</span>}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div>
                                    <p className="text-gray-900 dark:text-white font-medium text-sm">Auto-Assign</p>
                                    <p className="text-xs text-gray-500">Global System Toggle</p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('auto_assign_enabled')}
                                    className={cn("w-12 h-6 rounded-full transition-colors relative shadow-inner", systemSettings.auto_assign_enabled ? "bg-green-500 shadow-green-500/50" : "bg-gray-300 dark:bg-gray-700")}
                                >
                                    <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-md", systemSettings.auto_assign_enabled ? "left-7" : "left-1")} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-500/30 transition-colors">
                                <div>
                                    <p className="text-gray-900 dark:text-white font-medium text-sm">RSA Routing</p>
                                    <p className="text-xs text-gray-500">Route RSA tickets</p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('rsa_routing_enabled')}
                                    className={cn("w-12 h-6 rounded-full transition-colors relative shadow-inner", systemSettings.rsa_routing_enabled ? "bg-purple-500 shadow-purple-500/50" : "bg-gray-300 dark:bg-gray-700")}
                                >
                                    <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-md", systemSettings.rsa_routing_enabled ? "left-7" : "left-1")} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-cyan-500/30 transition-colors">
                                <div>
                                    <p className="text-gray-900 dark:text-white font-medium text-sm">Hub Routing</p>
                                    <p className="text-xs text-gray-500">Route Repair tickets</p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('hub_routing_enabled')}
                                    className={cn("w-12 h-6 rounded-full transition-colors relative shadow-inner", systemSettings.hub_routing_enabled ? "bg-cyan-500 shadow-cyan-500/50" : "bg-gray-300 dark:bg-gray-700")}
                                >
                                    <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-md", systemSettings.hub_routing_enabled ? "left-7" : "left-1")} />
                                </button>
                            </div>
                        </div>

                        {/* Logs */}
                        <div className="mt-6">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">System Logs</h4>
                            <div className="h-32 bg-gray-100 dark:bg-black/40 rounded-lg p-3 overflow-y-auto text-xs font-mono space-y-1 custom-scrollbar border border-gray-200 dark:border-transparent">
                                {dispatchLogs.length === 0 && <span className="text-gray-500 dark:text-gray-600 italic">No recent activity...</span>}
                                {dispatchLogs.map((log, i) => (
                                    <div key={i} className="text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800/50 pb-1 mb-1 last:border-0">
                                        <span className="text-gray-400 dark:text-gray-600">[{new Date().toLocaleTimeString()}]</span> {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <SLAMonitor />
                </div>

                {/* Middle Column: Analytics & Forecast (Span 2) */}
                <div className="lg:col-span-2 space-y-4">
                    <AIForecastChart data={forecastData} />

                    {/* Action Cards Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div onClick={() => navigate('/admin/hubs')} className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600 dark:text-cyan-400"><Radio size={16} /></div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Hubs</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Manage Hubs</p>
                        </div>
                        <div onClick={() => navigate('/admin/activity')} className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400"><TrendingUp size={16} /></div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Activity</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Live Monitoring</p>
                        </div>
                        <div onClick={() => navigate('/admin/riders')} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400"><UserCheck size={16} /></div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Riders</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{totalRiders} Registered Riders</p>
                        </div>
                        <div onClick={() => navigate('/admin/reports')} className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400"><FileText size={16} /></div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Reports</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Downloads</p>
                        </div>
                    </div>

                    <TechnicianPerformance users={users} tickets={tickets} />
                </div>

                {/* Right Column: Insights & Users (Span 1) */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/admin/users')}>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users size={18} className="text-gray-500 dark:text-gray-400" />
                                User Database
                            </h3>
                            <span className="text-xs text-blue-500 hover:underline">View All</span>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {users.slice(0, 5).map(user => (
                                <UserRow key={user.id} user={user} />
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <AIInsightsPanel metrics={{
                            totalTickets: tickets.length,
                            activeTickets: activeTickets,
                            avgResponseTime: "~2.5m",
                            satisfaction: "4.8/5",
                            pending: upcomingTickets,
                            techCount: totalTechs
                        }} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;
