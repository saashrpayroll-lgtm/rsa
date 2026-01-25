import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Mic, Image as ImageIcon, X, Sparkles, CheckCircle, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CompletionModalProps {
    onClose: () => void;
    onComplete: (remarks: string, images: File[], voiceNotes: Blob[], parts: string) => Promise<void>;
}

const CompletionModal: React.FC<CompletionModalProps> = ({ onClose, onComplete }) => {
    const [remarks, setRemarks] = useState('');
    const [parts, setParts] = useState('');
    const [images, setImages] = useState<File[]>([]);
    const [voiceNotes, setVoiceNotes] = useState<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setVoiceNotes(prev => [...prev, blob]);
                chunksRef.current = [];
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            alert("Microphone access denied or unavailable.");
        }
    };

    const [isListeningForText, setIsListeningForText] = useState(false);

    const toggleDictation = () => {
        if (isListeningForText) return; // Already listening (or let it stop via native UI)

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            setIsListeningForText(true);

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setRemarks(prev => prev + (prev ? ' ' : '') + transcript);
                setIsListeningForText(false);
            };

            recognition.onerror = () => setIsListeningForText(false);
            recognition.onend = () => setIsListeningForText(false);

            recognition.start();
        } else {
            alert('Browser does not support speech recognition');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleGenerateSummary = () => {
        // Mock AI Summary
        setRemarks("Diagnosed electrical fault in ignition system. Replaced worn spark plug and tested battery voltage (12.6V). Vehicle started successfully.");
    };

    const handleSubmit = async () => {
        if (!remarks && images.length === 0) {
            alert("Please provide at least a summary or one image.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onComplete(remarks, images, voiceNotes, parts);
        } catch (error) {
            console.error(error);
            alert("Failed to submit completion. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
            <div className="bg-[#111118] w-full max-w-lg md:rounded-2xl border-t md:border border-gray-800 shadow-2xl flex flex-col h-[85vh] md:h-auto md:max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#111118]">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-500" /> Job Completion
                        </h2>
                        <p className="text-sm text-gray-400">Verify work and upload evidence</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar bg-[#0a0a0f]">

                    {/* Work Summary Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Work Summary</label>
                            <button
                                onClick={handleGenerateSummary}
                                className="text-xs bg-purple-600/20 text-purple-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-purple-600/30 transition-all border border-purple-500/30"
                            >
                                <Sparkles size={12} /> AI Auto-Summarize
                            </button>
                        </div>
                        <div className="relative group">
                            <textarea
                                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-600"
                                rows={5}
                                placeholder="Describe the repairs carried out..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            />
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                <button
                                    onClick={toggleDictation}
                                    className={cn("p-2 rounded-full transition-colors",
                                        isListeningForText ? "bg-red-500 text-white animate-pulse" : "bg-gray-800 text-gray-400 hover:text-white"
                                    )}
                                    title="Dictate Summary"
                                >
                                    <Mic size={16} />
                                </button>
                                <div className="p-2 opacity-50">
                                    <FileText size={16} className="text-gray-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Parts Replaced Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Parts Replaced / Added</label>
                        <textarea
                            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-600"
                            rows={2}
                            placeholder="e.g., Spark Plug, Brake Shoe, Engine Oil (leave empty if none)"
                            value={parts}
                            onChange={(e) => setParts(e.target.value)}
                        />
                    </div>

                    {/* Evidence Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 uppercase tracking-wider block">Evidence & Media</label>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Photo Upload */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="h-32 bg-gray-900/50 border border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 hover:border-cyan-500 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-2 group-hover:bg-gray-700 transition-colors">
                                    <ImageIcon size={20} className="text-cyan-400" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 group-hover:text-white">Add Photos</span>
                                <input
                                    type="file" multiple accept="image/*" ref={fileInputRef} className="hidden"
                                    onChange={(e) => e.target.files && setImages(prev => [...prev, ...Array.from(e.target.files!)])}
                                />
                            </div>

                            {/* Voice Record */}
                            <div
                                onClick={isRecording ? stopRecording : startRecording}
                                className={cn(
                                    "h-32 border border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group",
                                    isRecording ? "bg-red-500/10 border-red-500/50" : "bg-gray-900/50 border-gray-700 hover:bg-gray-800 hover:border-red-400"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors",
                                    isRecording ? "bg-red-500 animate-pulse" : "bg-gray-800 group-hover:bg-gray-700"
                                )}>
                                    <Mic size={20} className={isRecording ? "text-white" : "text-red-400"} />
                                </div>
                                <span className={cn("text-xs font-bold", isRecording ? "text-red-400" : "text-gray-400 group-hover:text-white")}>
                                    {isRecording ? "Stop Recording..." : "Record Voice"}
                                </span>
                            </div>
                        </div>

                        {/* Previews */}
                        {(images.length > 0 || voiceNotes.length > 0) && (
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide pt-2">
                                {images.map((img, i) => (
                                    <div key={i} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-700 group">
                                        <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setImages(p => p.filter((_, idx) => idx !== i))}
                                            className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {voiceNotes.map((_, i) => (
                                    <div key={i} className="relative w-20 h-20 shrink-0 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 group">
                                        <Mic size={24} className="text-gray-500" />
                                        <button
                                            onClick={() => setVoiceNotes(p => p.filter((_, idx) => idx !== i))}
                                            className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-gray-800 bg-[#111118] flex gap-4">
                    <Button variant="ghost" onClick={onClose} className="flex-1 text-gray-400 hover:text-white" disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-[2] bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 font-bold py-6 rounded-xl"
                    >
                        {isSubmitting ? "Completing Job..." : "Confirm & Complete Job"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CompletionModal;
