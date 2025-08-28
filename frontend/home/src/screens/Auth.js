import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';
import PasswordField from '../components/ui/PasswordField';
export default function Auth() {
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ username: '', email: '', password: '', avatarFile: null });
    const [error, setError] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const buttonBase = 'px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none';
    useEffect(() => {
        // if already authed, go to together
        const t = localStorage.getItem('auth');
        if (t)
            location.hash = '#/watch-together';
    }, []);
    const onFileChange = async (e) => {
        const f = e.target.files?.[0] || null;
        setForm(prev => ({ ...prev, avatarFile: f }));
        if (f) {
            const reader = new FileReader();
            reader.onload = () => setAvatarPreview(String(reader.result));
            reader.readAsDataURL(f);
        }
        else {
            setAvatarPreview(null);
        }
    };
    const toBase64 = (f) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(f);
    });
    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (mode === 'signup') {
                if (!form.avatarFile)
                    throw new Error('Avatar required');
                const avatarBase64 = await toBase64(form.avatarFile);
                const res = await fetch('/api/users/register', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: form.username, email: form.email, password: form.password, avatarBase64 })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.token)
                    throw new Error(data?.error || 'Signup failed');
                localStorage.setItem('auth', data.token);
                location.hash = '#/watch-together';
            }
            else {
                const res = await fetch('/api/users/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: form.username, password: form.password })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.token)
                    throw new Error(data?.error || 'Login failed');
                localStorage.setItem('auth', data.token);
                location.hash = '#/watch-together';
            }
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    // Forgot Password actions
    const [fpUser, setFpUser] = useState('');
    const [fpOtp, setFpOtp] = useState('');
    const [fpToken, setFpToken] = useState('');
    const [fpNewPw, setFpNewPw] = useState('');
    const [fpStep, setFpStep] = useState('idle');
    const [fpHint, setFpHint] = useState('');
    const startForgot = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernameOrEmail: fpUser })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || 'Failed to send OTP');
            setFpHint(data.hint || '');
            setFpStep('otp-sent');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    const verifyOtp = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernameOrEmail: fpUser, otp: fpOtp })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.resetToken)
                throw new Error(data?.error || 'Invalid OTP');
            setFpToken(data.resetToken);
            setFpStep('verified');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    const resetPassword = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetToken: fpToken, newPassword: fpNewPw })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || 'Failed to reset password');
            // After reset, go back to login
            setMode('login');
            setFpStep('idle');
            setFpUser('');
            setFpOtp('');
            setFpToken('');
            setFpNewPw('');
            setFpHint('');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: motion.div, className: "max-w-[44rem] w-[90vw] text-center", color: "#88ccff", speed: "8s", thickness: 2, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, "aria-live": "polite", children: [_jsxs("div", { className: "py-4", children: [_jsx("div", { className: "w-full max-w-[42rem] mx-auto", children: _jsx(TextPressure, { text: mode === 'signup' ? 'Create AuraStream Account' : 'Welcome Back', className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 40 }) }), _jsx(motion.p, { className: "mt-2 text-white/80", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.2, duration: 0.4 }, children: mode === 'signup' ? 'Join with a secure profile to start watching together.' : 'Sign in to continue to Watch Together.' })] }), error && (_jsx("div", { className: "max-w-md mx-auto mb-3 text-sm text-red-200 bg-red-900/30 border border-red-500/50 rounded-md p-2", children: error })), _jsxs("form", { onSubmit: submit, className: "mt-4 grid grid-cols-1 gap-4 text-left max-w-md mx-auto", children: [_jsxs("label", { className: "text-sm text-white/80", children: ["Username", _jsx("input", { value: form.username, onChange: e => setForm(p => ({ ...p, username: e.target.value })), required: true, "aria-label": "Username", placeholder: "Enter username", className: "mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 placeholder-white/40" })] }), mode === 'signup' && (_jsxs("label", { className: "text-sm text-white/80", children: ["Email", _jsx("input", { value: form.email, onChange: e => setForm(p => ({ ...p, email: e.target.value })), required: true, "aria-label": "Email", type: "email", placeholder: "Enter email", className: "mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 placeholder-white/40" })] })), _jsxs("label", { className: "text-sm text-white/80", children: ["Password", _jsx(PasswordField, { value: form.password, onChange: e => setForm(p => ({ ...p, password: e.target.value })), required: true, ariaLabel: "Password", placeholder: "Enter password" })] }), mode === 'signup' && (_jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm text-white/80 text-center", children: "Avatar Image" }), _jsxs("div", { className: "flex items-center justify-center gap-4", children: [avatarPreview ? (_jsx("img", { src: avatarPreview, alt: "Avatar preview", className: "h-20 w-20 rounded-full object-cover border border-white/30 shadow-md" })) : (_jsx("div", { className: "h-20 w-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70", children: "\uD83D\uDC64" })), _jsxs("label", { className: "cursor-pointer", children: [_jsx("input", { onChange: onFileChange, required: true, "aria-label": "Avatar", type: "file", accept: "image/*", className: "hidden" }), _jsx("span", { className: "px-4 py-2 rounded-lg bg-white/10 border border-white/20 inline-block", children: "Choose Image" })] })] })] })), _jsxs("div", { className: "mt-2 grid gap-3", role: "group", "aria-label": "Auth actions", children: [_jsx(StarBorder, { as: "button", className: `${buttonBase} text-white/90`, color: "#ffffff", speed: "7s", thickness: 1, type: "submit", disabled: busy, children: busy ? 'Please wait…' : (mode === 'signup' ? 'Create Account' : 'Login') }), mode === 'login' && (_jsx("button", { type: "button", className: "text-sm underline text-white/80", onClick: () => { location.hash = '#/forgot-password'; }, children: "Forgot password?" })), _jsx("p", { className: "text-white/70 text-sm text-center", children: mode === 'signup' ? (_jsxs(_Fragment, { children: ["Already have an account?", ' ', _jsx("button", { type: "button", className: "underline text-white", onClick: () => setMode('login'), children: "Login" })] })) : (_jsxs(_Fragment, { children: ["New user?", ' ', _jsx("button", { type: "button", className: "underline text-white", onClick: () => setMode('signup'), children: "Sign Up" })] })) })] })] })] }) })] }));
}
