import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';
import PasswordField from '../components/ui/PasswordField';
// Lightweight password strength estimator
function estimateStrength(pw) {
    let score = 0;
    if (pw.length >= 6)
        score++;
    if (pw.length >= 10)
        score++;
    if (/[A-Z]/.test(pw))
        score++;
    if (/[a-z]/.test(pw))
        score++;
    if (/[0-9]/.test(pw))
        score++;
    if (/[^A-Za-z0-9]/.test(pw))
        score++;
    if (score <= 2)
        return { label: 'Weak', color: '#ff0000' };
    if (score <= 4)
        return { label: 'Medium', color: '#ffff00' };
    return { label: 'Strong', color: '#00ff00' };
}
const ROOM_NAME_RE = /^[A-Za-z0-9]{1,20}$/;
const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:8080';
// Derive deterministic salt from room name so the verifier is reproducible across clients
function saltFromRoom(name) {
    return new TextEncoder().encode(`aurastream:${name}`);
}
async function deriveVerifier(room, password) {
    // PBKDF2 via WebCrypto — no WASM, works in all modern browsers
    const enc = new TextEncoder();
    const salt = saltFromRoom(room);
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 200000, hash: 'SHA-256' }, baseKey, 256);
    const bytes = new Uint8Array(bits);
    // Base64 encode
    let b64 = '';
    for (let i = 0; i < bytes.length; i++)
        b64 += String.fromCharCode(bytes[i]);
    return btoa(b64);
}
export default function CreateRoom({ onBack }) {
    const [roomName, setRoomName] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [privacy, setPrivacy] = React.useState('private');
    const [nameValid, setNameValid] = React.useState(null);
    const [nameExists, setNameExists] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const strength = estimateStrength(password);
    // Debounced validation against backend
    React.useEffect(() => {
        const name = roomName.trim();
        if (!name || !ROOM_NAME_RE.test(name)) {
            setNameValid(name.length === 0 ? null : false);
            setNameExists(false);
            return;
        }
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`${API_BASE}/api/rooms/validate?name=${encodeURIComponent(name)}`);
                const data = await r.json();
                setNameValid(!!data.valid && !data.exists);
                setNameExists(!!data.exists);
            }
            catch {
                setNameValid(false);
                setNameExists(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [roomName]);
    async function handleCreate() {
        const name = roomName.trim();
        if (!ROOM_NAME_RE.test(name)) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', text: 'Invalid room name. Use 1-20 alphanumeric characters, no spaces.' } }));
            return null;
        }
        if (privacy !== 'public' && password.length < 6) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', text: 'Password must be at least 6 characters.' } }));
            return null;
        }
        setLoading(true);
        try {
            const passVerifier = privacy === 'public' ? '' : await deriveVerifier(name, password);
            const res = await fetch(`${API_BASE}/api/rooms/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, passVerifier, privacy })
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data?.error || 'Failed to create');
            // Store room context for later navigation if needed
            sessionStorage.setItem('room', name);
            sessionStorage.setItem('roomPrivacy', data.privacy || privacy);
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Room created' } }));
            return name;
        }
        catch (err) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', text: err?.message || 'Failed to create room' } }));
            return null;
        }
        finally {
            setLoading(false);
        }
    }
    const fieldBase = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/40 transition';
    const labelBase = 'text-white text-sm mb-1';
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("div", { className: "absolute top-4 left-4 z-20", children: _jsx("button", { onClick: () => (window.location.hash = '#/watch-together'), "aria-label": "Back", title: "Back", className: "h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", className: "text-white", children: _jsx("polygon", { points: "15,4 5,12 15,20" }) }) }) }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: motion.div, className: "max-w-[44rem] w-[90vw] text-center", color: "#88ccff", speed: "8s", thickness: 2, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: [_jsx("div", { className: "py-4", children: _jsx("div", { className: "w-full max-w-[42rem] mx-auto h-[84px] md:h-[108px]", children: _jsx(TextPressure, { text: "Create Room", className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 44 }) }) }), _jsxs("div", { className: "mt-4 w-full max-w-xl mx-auto grid grid-cols-1 gap-4 text-left", children: [_jsxs("label", { className: "text-sm text-white/80", children: ["Enter Room Name", _jsx("input", { className: "mt-1 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/40 transition", value: roomName, onChange: (e) => setRoomName(e.target.value.replace(/\s+/g, '')), placeholder: "Enter Room Name", maxLength: 20 }), _jsxs("div", { className: "mt-1 text-xs text-white/80", children: [nameValid === null && 'Alphanumeric, no spaces (max 20).', nameValid === false && (nameExists ? 'Name already exists.' : 'Invalid name.'), nameValid === true && 'Name is available.'] })] }), _jsxs("label", { className: "text-sm text-white/80", children: ["Enter Password", _jsx(PasswordField, { value: password, onChange: (e) => setPassword(e.target.value), placeholder: privacy === 'public' ? 'Disabled for public rooms' : 'Enter Password', disabled: privacy === 'public', ariaLabel: "Room Password", inputClassName: "px-4" }), privacy !== 'public' && (_jsxs("div", { className: "mt-1 text-xs flex items-center gap-2", children: [_jsx("span", { className: "text-white/80", children: "Strength:" }), _jsx("span", { style: { color: strength.color }, children: strength.label })] }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-white text-sm", children: "Room Privacy" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setPrivacy('public'), className: `px-3 py-1 rounded-full border ${privacy === 'public' ? 'bg-white/20 border-white/40 text-white' : 'border-white/20 text-white/70'}`, children: "Public" }), _jsx("button", { onClick: () => setPrivacy('private'), className: `px-3 py-1 rounded-full border ${privacy === 'private' ? 'bg-white/20 border-white/40 text-white' : 'border-white/20 text-white/70'}`, children: "Private" })] })] }), _jsx("div", { className: "w-full flex items-stretch justify-center gap-3", role: "group", "aria-label": "Actions", children: _jsx(StarBorder, { as: "button", "aria-label": "Create Room button", className: "px-5 py-3 text-white/90", color: "#ffffff", speed: "7s", thickness: 1, onClick: async () => {
                                            const name = await handleCreate();
                                            if (name) {
                                                try {
                                                    const res = await fetch(`${API_BASE}/api/rooms/share?name=${encodeURIComponent(name)}`);
                                                    const data = await res.json();
                                                    if (!res.ok)
                                                        throw new Error(data?.error || 'Failed to generate link');
                                                    const joinUrl = data.shareUrl;
                                                    await navigator.clipboard.writeText(joinUrl);
                                                    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Room link copied' } }));
                                                    // Navigate to shared screen after copying
                                                    const url = `${location.origin}${location.pathname}#/shared?room=${encodeURIComponent(name)}`;
                                                    window.location.href = url;
                                                }
                                                catch (err) {
                                                    alert(err?.message || 'Failed to copy room link');
                                                }
                                            }
                                        }, disabled: loading, children: loading ? 'Creating…' : 'Create Room' }) })] })] }) })] }));
}
