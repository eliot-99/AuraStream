import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
export default function SoloSelect({ onBack, onPicked }) {
    const [picking, setPicking] = useState(false);
    const fileInputRef = useRef(null);
    // Robust media kind detection (handles empty or generic MIME types)
    const detectKind = (file) => {
        const type = (file.type || '').toLowerCase();
        if (type.startsWith('video/'))
            return 'video';
        if (type.includes('matroska'))
            return 'video'; // some UAs use */x-matroska
        if (type.startsWith('audio/'))
            return 'audio';
        const name = (file.name || '').toLowerCase();
        const ext = name.split('.').pop() || '';
        const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ts', 'mpeg', 'mpg', 'wmv', 'flv'];
        const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus', 'aiff', 'alac'];
        if (videoExts.includes(ext))
            return 'video';
        if (audioExts.includes(ext))
            return 'audio';
        // Default to video for safety in this app context
        return 'video';
    };
    const openPicker = async () => {
        try {
            setPicking(true);
            // Prefer File System Access API when available
            // @ts-ignore
            if (window.showOpenFilePicker) {
                // @ts-ignore
                const [handle] = await window.showOpenFilePicker({
                    types: [
                        { description: 'Media', accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'], 'video/*': ['.mp4', '.webm', '.mkv', '.mov'] } },
                    ],
                    multiple: false,
                    excludeAcceptAllOption: false,
                }) ?? [];
                if (!handle)
                    return;
                const file = await handle.getFile();
                const url = URL.createObjectURL(file);
                const kind = detectKind(file);
                onPicked?.({ url, name: file.name, kind });
            }
            else {
                // Fallback to hidden input
                fileInputRef.current?.click();
            }
        }
        finally {
            setPicking(false);
        }
    };
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("div", { className: "pointer-events-none absolute inset-0 -z-10 flex items-center justify-center", children: _jsx("div", { className: "text-white/30 text-[14px] tracking-widest", children: "Encrypted Files" }) }), _jsxs("div", { className: "fixed top-4 left-4 right-4 flex items-center justify-between z-20", children: [_jsx("button", { onClick: () => (onBack ? onBack() : window.history.back()), "aria-label": "Back to Home", className: "h-8 w-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-transform", children: _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", "aria-hidden": "true", className: "text-white", children: _jsx("polygon", { points: "15,4 5,12 15,20" }) }) }), _jsx("div", {})] }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: motion.div, className: "max-w-xl w-[88vw] text-left", color: "#88ccff", speed: "8s", thickness: 2, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, "aria-label": "Media Selection Box", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Open Local Media" }), _jsx("p", { className: "text-white/70 text-sm mt-1", children: "Browse files on your device. No uploads \u2014 playback is local and private." }), _jsxs("div", { className: "mt-6", children: [_jsx("button", { onClick: openPicker, disabled: picking, className: "px-4 py-2 rounded-md border border-cyan-300/40 text-cyan-300 hover:scale-[1.02] transition-transform bg-white/5 backdrop-blur", children: picking ? 'Opening…' : 'Browse Files' }), _jsx("input", { ref: fileInputRef, type: "file", accept: "audio/*,video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts,.mpeg,.mpg,.wmv,.flv", className: "hidden", onChange: (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const url = URL.createObjectURL(file);
                                            const kind = detectKind(file);
                                            onPicked?.({ url, name: file.name, kind });
                                        }
                                        e.currentTarget.value = '';
                                    } })] })] }) })] }));
}
