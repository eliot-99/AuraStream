import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';
import PasswordField from '../components/ui/PasswordField';
// Small lock icon
const LockIcon = (props) => (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...props, children: _jsx("path", { d: "M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" }) }));
// Neon underline component
const NeonUnderline = ({ color = '#00ffff' }) => (_jsx("span", { "aria-hidden": "true", className: "block h-[3px] w-24 mx-auto mt-2 rounded-full", style: {
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 12px ${color}`,
    } }));
// Floating badge bottom-left
const SecurityBadge = () => (_jsxs("div", { className: "fixed left-4 bottom-4 text-[12px] font-montserrat text-[#00ff00] select-none", style: { animation: 'badgePulse 1s infinite alternate' }, "aria-label": "Zero-Knowledge Room", children: ["Zero-Knowledge Room", _jsx("style", { children: `
      @keyframes badgePulse { from { opacity: .6 } to { opacity: 1 } }
    ` })] }));
// Glass button
const GlassBtn = ({ className = '', label, rainbow = true, children, ...rest }) => (_jsxs("button", { ...rest, className: [
        'relative px-5 py-3 rounded-xl text-white/90 backdrop-blur-md',
        'border border-white/20 bg-white/10 hover:scale-[1.05] transition-transform outline-none',
        className,
    ].join(' '), children: [_jsx("span", { className: "relative z-10 flex items-center gap-2", children: children }), _jsx("span", { "aria-hidden": true, className: "absolute inset-0 rounded-xl", style: {
                borderWidth: 2,
                borderStyle: 'solid',
                borderImageSlice: 1,
                borderImageSource: rainbow
                    ? 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)'
                    : 'linear-gradient(90deg, #00ffff, #00ff88)'
            } })] }));
// Simple AES-GCM E2EE helpers (client-side only for demo)
async function generateKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function exportKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
}
// Screen
function useProfile() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    useEffect(() => {
        const token = localStorage.getItem('auth');
        if (!token) {
            setLoading(false);
            return;
        }
        fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(async (r) => {
            if (!r.ok)
                throw new Error(`status:${r.status}`);
            const j = await r.json();
            if (j?.ok)
                setData(j.profile);
        })
            .catch(() => {
            // Token invalid/expired — force re-auth
            try {
                localStorage.removeItem('auth');
            }
            catch { }
            location.hash = '#/auth';
        })
            .finally(() => setLoading(false));
    }, []);
    return { loading, data };
}
function ProfileCard() {
    const { loading, data } = useProfile();
    if (loading)
        return _jsx("div", { className: "text-white/70", children: "Loading\u2026" });
    if (!data)
        return _jsx("div", { className: "text-white/70", children: "Not logged in" });
    return (_jsxs("div", { className: "grid gap-3 text-left", children: [_jsxs("div", { className: "flex items-center gap-3", children: [data.avatar ? (_jsx("img", { src: data.avatar, alt: "Avatar", className: "h-12 w-12 rounded-full object-cover border border-white/30" })) : (_jsx("div", { className: "h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center", children: "\uD83D\uDC64" })), _jsxs("div", { children: [_jsx("div", { className: "text-white font-semibold", children: data.username }), _jsx("div", { className: "text-white/70 text-sm", children: data.email })] })] }), _jsx("div", { className: "flex items-center justify-end gap-2", children: _jsx("button", { onClick: () => { localStorage.removeItem('auth'); location.hash = '#/auth'; }, className: "px-4 py-2 rounded-lg bg-white/10 border border-white/20", children: "Logout" }) })] }));
}
export default function WatchTogether() {
    const [ready, setReady] = useState(false);
    const [room, setRoom] = useState('');
    const [password, setPassword] = useState('');
    const [liveCount, setLiveCount] = useState(0);
    const [showProfile, setShowProfile] = useState(false);
    const [flash, setFlash] = useState(null);
    const keyRef = useRef(null);
    useEffect(() => {
        // Pre-generate client E2EE key (stored only in memory)
        generateKey().then(k => { keyRef.current = k; setReady(true); });
        // Placeholder for Socket.IO user count subscription
        const id = setInterval(() => setLiveCount(c => Math.min(999, c + Math.floor(Math.random() * 2))), 3000);
        return () => clearInterval(id);
    }, []);
    const keyPreview = useMemo(() => {
        if (!keyRef.current)
            return '…';
        return 'E2EE ready';
    }, [ready]);
    const handleCreate = async () => {
        // Navigate to dedicated Create Room screen
        location.hash = '#/create-room';
    };
    const handleJoin = async (e) => {
        e.preventDefault();
        const name = room.trim();
        if (!name) {
            setFlash({ type: 'error', text: 'Enter room name' });
            return;
        }
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            // Derive verifier same as CreateRoom
            const enc = new TextEncoder();
            const salt = enc.encode(`aurastream:${name}`);
            const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, baseKey, 256);
            const bytes = new Uint8Array(bits);
            let b64 = '';
            for (let i = 0; i < bytes.length; i++)
                b64 += String.fromCharCode(bytes[i]);
            const passVerifier = btoa(b64);
            const r = await fetch(`${API_BASE}/api/rooms/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, passVerifier }) });
            const j = await r.json();
            if (r.status === 404) {
                setFlash({ type: 'error', text: 'Room does not exist' });
                return;
            }
            if (r.status === 401) {
                setFlash({ type: 'error', text: 'Room password incorrect' });
                return;
            }
            if (r.status === 410) {
                setFlash({ type: 'error', text: 'Room expired' });
                return;
            }
            if (!r.ok || !j?.token) {
                setFlash({ type: 'error', text: j?.error || 'Failed to join room' });
                return;
            }
            // Save access token for handshake and navigate (pass token via URL to new tab)
            try {
                sessionStorage.setItem(`room:${name}:access`, j.token);
            }
            catch { }
            const url = `${location.origin}${location.pathname}#/shared?room=${encodeURIComponent(name)}&access=${encodeURIComponent(j.token)}`;
            window.open(url, '_blank');
            setFlash({ type: 'success', text: 'Joined room' });
        }
        catch {
            setFlash({ type: 'error', text: 'Failed to join room' });
        }
    };
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("div", { className: "absolute top-4 left-4 z-20", children: _jsx("button", { onClick: () => (window.location.hash = '#/home'), "aria-label": "Back", title: "Back", className: "h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", className: "text-white", children: _jsx("polygon", { points: "15,4 5,12 15,20" }) }) }) }), _jsxs("div", { className: "absolute top-4 right-4 z-30", children: [!showProfile && (_jsx("button", { "aria-label": "User Profile", title: "User Profile", onClick: () => setShowProfile(true), className: "h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition", children: _jsx("span", { className: "text-white", children: "\uD83D\uDC64" }) })), showProfile && (_jsxs("div", { className: "mt-2 w-[320px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h2", { className: "text-sm font-semibold", children: "User Profile" }), _jsx("button", { onClick: () => setShowProfile(false), "aria-label": "Close", className: "text-white/80 hover:text-white", children: "\u2715" })] }), _jsx(ProfileCard, {})] }))] }), _jsx(SecurityBadge, {}), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: motion.div, className: "max-w-[44rem] w-[90vw] text-center", color: "#88ccff", speed: "8s", thickness: 2, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, "aria-live": "polite", children: [_jsxs("div", { className: "py-4", children: [_jsx("div", { className: "w-full max-w-[42rem] mx-auto h-[72px] md:h-[96px]", children: _jsx(TextPressure, { text: "Watch Together", className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 40 }) }), _jsxs(motion.p, { className: "mt-3 text-white/80 not-italic flex items-center justify-center gap-2", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.2, duration: 0.4 }, children: ["Feel the Seamless Experience of Watching and Hearing Together", _jsx(LockIcon, { className: "w-4 h-4 text-white" })] })] }), _jsxs("form", { onSubmit: handleJoin, className: "mt-8 w-full max-w-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 text-left", "aria-label": "Room access", children: [_jsxs("label", { className: "text-sm text-white/80", children: ["Room name", _jsx("input", { value: room, onChange: e => setRoom(e.target.value), required: true, "aria-label": "Room name", className: "mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" })] }), _jsxs("label", { className: "text-sm text-white/80", children: ["Password", _jsx(PasswordField, { value: password, onChange: e => setPassword(e.target.value), ariaLabel: "Password", placeholder: "Enter password" })] }), _jsxs("div", { className: "md:col-span-2 w-full flex flex-col items-center justify-center gap-4", role: "group", "aria-label": "Primary actions", children: [_jsxs(StarBorder, { as: "button", "aria-label": "Join Room button", className: "px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none text-white/90", color: "#ffffff", speed: "7s", thickness: 1, type: "submit", children: [_jsx("span", { className: "mr-2", children: "\u2934\uFE0F" }), "Join Room"] }), _jsx("div", { className: "text-white/80 text-sm", children: "Create your own room" }), _jsxs(StarBorder, { as: "button", "aria-label": "Create Room button", className: "px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none text-white/90", color: "#ffffff", speed: "7s", thickness: 1, type: "button", onClick: handleCreate, children: [_jsx("span", { className: "mr-2", children: "\u2795" }), "Create Room"] })] }), _jsxs("div", { className: "md:col-span-2 flex items-center justify-between text-xs text-white/70", children: [_jsx("span", { "aria-live": "polite", children: ready ? keyPreview : 'Preparing secure environment…' }), _jsxs("span", { className: "text-white/90", children: ["Live: ", liveCount, " \u2022 ", _jsx("span", { className: "text-[#00ffff]", children: "Privacy Protected" })] })] })] })] }) }), flash && (_jsx("div", { className: `fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-xl border ${flash.type === 'error' ? 'bg-red-600/80 border-red-400 text-white' : 'bg-green-600/80 border-green-400 text-white'}`, role: "status", "aria-live": "polite", children: flash.text })), _jsx("div", { id: "profileModal", className: "hidden fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-white", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-lg font-semibold", children: "User Profile" }), _jsx("button", { onClick: () => document.getElementById('profileModal')?.classList.add('hidden'), "aria-label": "Close", className: "text-white/80 hover:text-white", children: "\u2715" })] }), _jsx(ProfileCard, {})] }) })] }));
}
