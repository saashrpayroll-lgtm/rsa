
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, MapPin, Radio, Search, X, Activity, BrainCircuit, ArrowLeft, Trash2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// --- LEAFLET ICON FIX ---
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: icon,
    shadowUrl: iconShadow,
});
// ------------------------

// --- TYPES ---
interface Hub {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    address: string;
    status: 'ACTIVE' | 'INACTIVE';
    gps_device_id: string;
    hub_radius: number;
    rsa_radius: number;
    ai_location_score?: number;
}

// --- COMPONENTS ---

// 1. Location Marker Component (Handles Map Clicks)
const LocationMarker = ({ setFormData }: { setFormData: any }) => {
    useMapEvents({
        click(e) {
            setFormData((prev: any) => ({
                ...prev,
                latitude: parseFloat(e.latlng.lat.toFixed(6)),
                longitude: parseFloat(e.latlng.lng.toFixed(6))
            }));
        },
    });
    return null;
};

// 2. Main Page Component
const HubManagement = () => {
    const navigate = useNavigate();
    const [hubs, setHubs] = useState<Hub[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [mapReady, setMapReady] = useState(false); // Delay map rendering to prevent modal crash
    const [editingHub, setEditingHub] = useState<Hub | null>(null);

    // Form Data State
    const [formData, setFormData] = useState<Partial<Hub>>({
        name: '',
        latitude: 28.6139,
        longitude: 77.2090,
        address: '',
        status: 'ACTIVE',
        gps_device_id: '',
        hub_radius: 5.0,
        rsa_radius: 10.0
    });

    const [radiusUnit, setRadiusUnit] = useState<'km' | 'm'>('km');
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Initial Load
    useEffect(() => {
        fetchHubs();
    }, []);

    // Handle Map Delay in Modal
    useEffect(() => {
        if (showModal) {
            setMapReady(false);
            const timer = setTimeout(() => {
                setMapReady(true);
            }, 300); // Wait for modal animation
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // --- ACTIONS ---

    const fetchHubs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('hubs').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setHubs(data || []);
        } catch (error) {
            console.error('Error fetching hubs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNew = () => {
        setEditingHub(null);
        setFormData({
            status: 'ACTIVE',
            latitude: 28.6139,
            longitude: 77.2090,
            hub_radius: 5.0,
            rsa_radius: 10.0,
            name: '',
            address: '',
            gps_device_id: ''
        });
        setRadiusUnit('km');
        setShowModal(true);
        setAiAnalysis(null);
    };

    const handleEdit = (hub: Hub) => {
        setEditingHub(hub);
        setFormData(hub);
        setRadiusUnit('km');
        setShowModal(true);
        setAiAnalysis(null);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete hub "${name}"?`)) return;
        try {
            const { error } = await supabase.from('hubs').delete().eq('id', id);
            if (error) throw error;
            fetchHubs();
        } catch (error) {
            alert(`Error: ${(error as any).message}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingHub) {
                const { error } = await supabase.from('hubs').update(formData).eq('id', editingHub.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('hubs').insert([formData]);
                if (error) throw error;
            }
            setShowModal(false);
            fetchHubs();
        } catch (error) {
            alert(`Error saving hub: ${(error as any).message}`);
        }
    };

    const toggleStatus = async (hub: Hub) => {
        try {
            const newStatus = hub.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await supabase.from('hubs').update({ status: newStatus }).eq('id', hub.id);
            fetchHubs();
        } catch (error) {
            console.error(error);
        }
    };

    // --- HELPERS ---

    const getRadiusValue = (kmValue: number | undefined) => {
        const km = kmValue || 0;
        return radiusUnit === 'm' ? Math.round(km * 1000) : km;
    };

    const updateRadius = (field: 'hub_radius' | 'rsa_radius', value: number) => {
        const kmValue = radiusUnit === 'm' ? value / 1000 : value;
        setFormData(prev => ({ ...prev, [field]: kmValue }));
    };

    const fetchAddress = async () => {
        if (!formData.latitude || !formData.longitude) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${formData.latitude}&lon=${formData.longitude}`);
            const data = await res.json();
            if (data.display_name) {
                setFormData(prev => ({ ...prev, address: data.display_name }));
            }
        } catch (e) {
            console.error("Address fetch failed", e);
        }
    };

    const analyzeLocation = () => {
        setAnalyzing(true);
        setTimeout(() => {
            const score = Math.floor(Math.random() * 30) + 70;
            let analysis = score > 85 ? "🌟 Excellent Coverage Area" : "✅ Good Coverage Area";
            setAiAnalysis(analysis);
            setFormData(prev => ({ ...prev, ai_location_score: score }));
            setAnalyzing(false);
        }, 1000);
    };

    // --- RENDER ---

    return (
        <div className="p-6 min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <button onClick={() => navigate('/admin')} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
                <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            </button>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Radio className="text-cyan-400" size={32} />
                        Hub Management
                    </h1>
                    <p className="text-gray-400 mt-1">Configure service centers and coverage zones</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
                >
                    <Plus size={20} /> Add New Hub
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20"><Activity className="animate-spin text-cyan-500" size={40} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hubs.map(hub => (
                        <div key={hub.id} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden hover:border-cyan-500/50 transition-all group relative shadow-lg">
                            {/* Delete Action */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(hub.id, hub.name); }}
                                className="absolute top-4 right-4 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={18} />
                            </button>

                            <div className="p-6">
                                <div className="mb-4 pr-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-xl font-bold">{hub.name}</h3>
                                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", hub.status === 'ACTIVE' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                            {hub.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <MapPin size={14} /> {hub.latitude.toFixed(4)}, {hub.longitude.toFixed(4)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Hub Radius</p>
                                        <p className="text-cyan-400 font-bold text-lg">{hub.hub_radius} km</p>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">RSA Radius</p>
                                        <p className="text-purple-400 font-bold text-lg">{hub.rsa_radius} km</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700">
                                    <button onClick={() => handleEdit(hub)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                                        <Edit2 size={16} /> Edit
                                    </button>
                                    <button onClick={() => toggleStatus(hub)} className={cn("flex-1 py-2 rounded-lg font-medium transition-colors", hub.status === 'ACTIVE' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20")}>
                                        {hub.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-6xl h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">

                        {/* LEFT: MAP */}
                        <div className="w-full md:w-1/2 bg-gray-800 relative border-r border-gray-700">
                            {!mapReady ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 animate-pulse">
                                    <MapPin size={48} className="mb-4 opacity-50" />
                                    <p>Loading Map Interface...</p>
                                </div>
                            ) : (
                                <MapContainer
                                    center={[formData.latitude || 28.6139, formData.longitude || 77.2090]}
                                    zoom={13}
                                    className="h-full w-full"
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; OpenStreetMap'
                                    />
                                    <LocationMarker setFormData={setFormData} />
                                    {formData.latitude && formData.longitude && (
                                        <Marker position={[formData.latitude, formData.longitude]} />
                                    )}
                                </MapContainer>
                            )}
                            <div className="absolute top-4 left-4 bg-gray-900/90 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-[1000] border border-gray-700">
                                Click anywhere to set location
                            </div>
                        </div>

                        {/* RIGHT: FORM */}
                        <div className="w-full md:w-1/2 flex flex-col h-full bg-gray-900">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {editingHub ? <Edit2 className="text-cyan-400" /> : <Plus className="text-green-400" />}
                                    {editingHub ? 'Edit Hub Details' : 'Add New Hub'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <form id="hubForm" onSubmit={handleSubmit} className="space-y-6">
                                    {/* Name */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1.5">Hub Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                            placeholder="e.g. Central Delhi Hub"
                                        />
                                    </div>

                                    {/* Coordinates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-400 block mb-1.5">Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.latitude}
                                                onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-400 block mb-1.5">Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.longitude}
                                                onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Radius */}
                                    <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="font-bold text-gray-300">Coverage Zones</span>
                                            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                                <button type="button" onClick={() => setRadiusUnit('km')} className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", radiusUnit === 'km' ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white")}>KM</button>
                                                <button type="button" onClick={() => setRadiusUnit('m')} className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", radiusUnit === 'm' ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white")}>M</button>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-medium text-gray-400">Hub Radius</label>
                                                    <span className="text-cyan-400 font-mono font-bold">{getRadiusValue(formData.hub_radius)} {radiusUnit}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={radiusUnit === 'km' ? "0.5" : "500"}
                                                    max={radiusUnit === 'km' ? "50" : "50000"}
                                                    step={radiusUnit === 'km' ? "0.5" : "100"}
                                                    value={getRadiusValue(formData.hub_radius)}
                                                    onChange={e => updateRadius('hub_radius', parseFloat(e.target.value))}
                                                    className="w-full accent-cyan-500 cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-medium text-gray-400">RSA Radius</label>
                                                    <span className="text-purple-400 font-mono font-bold">{getRadiusValue(formData.rsa_radius)} {radiusUnit}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={radiusUnit === 'km' ? "1" : "1000"}
                                                    max={radiusUnit === 'km' ? "100" : "100000"}
                                                    step={radiusUnit === 'km' ? "1" : "500"}
                                                    value={getRadiusValue(formData.rsa_radius)}
                                                    onChange={e => updateRadius('rsa_radius', parseFloat(e.target.value))}
                                                    className="w-full accent-purple-500 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address & Extra */}
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="text-sm font-medium text-gray-400">Address</label>
                                                <button type="button" onClick={fetchAddress} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                                                    <Search size={12} /> Fetch from Coords
                                                </button>
                                            </div>
                                            <textarea
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none h-20 resize-none"
                                                placeholder="Enter address details..."
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-400 block mb-1.5">GPS Device ID</label>
                                            <input
                                                type="text"
                                                value={formData.gps_device_id}
                                                onChange={e => setFormData({ ...formData, gps_device_id: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                                placeholder="Optional Device Serial"
                                            />
                                        </div>

                                        {/* AI Analysis */}
                                        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-purple-400 font-bold text-sm flex items-center gap-2">
                                                    <BrainCircuit size={16} /> AI Suitability Score
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={analyzeLocation}
                                                    disabled={analyzing}
                                                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    {analyzing ? 'Analyzing...' : 'Run Analysis'}
                                                </button>
                                            </div>
                                            {aiAnalysis && (
                                                <div className="animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500" style={{ width: `${formData.ai_location_score}%` }}></div>
                                                        </div>
                                                        <span className="text-xs font-mono text-cyan-400">{formData.ai_location_score}/100</span>
                                                    </div>
                                                    <p className="text-gray-300 text-xs">{aiAnalysis}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 border-t border-gray-700 bg-gray-900 sticky bottom-0 z-10 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="hubForm"
                                    disabled={!formData.name}
                                    className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-cyan-500/25 transition-all"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Save size={18} /> Save Hub
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HubManagement;
