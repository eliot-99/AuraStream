import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';
import PasswordField from '../components/ui/PasswordField';
export default function ForgotPassword() {
    const [step, setStep] = useState('start');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [hint, setHint] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const buttonBase = 'px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none';
    const start = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernameOrEmail }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || 'Failed to send OTP');
            setHint(data.hint || '');
            setStep('otp');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    const verify = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernameOrEmail, otp }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.resetToken)
                throw new Error(data?.error || 'Invalid OTP');
            setResetToken(data.resetToken);
            setStep('reset');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    const reset = async () => {
        setError(null);
        setBusy(true);
        try {
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${API_BASE}/api/users/forgot/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetToken, newPassword }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || 'Failed to reset password');
            location.hash = '#/auth';
            alert('Password updated. Please log in.');
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: motion.div, className: "max-w-[44rem] w-[90vw] text-center", color: "#88ccff", speed: "8s", thickness: 2, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, "aria-live": "polite", children: [_jsx("div", { className: "py-4", children: _jsx("div", { className: "w-full max-w-[42rem] mx-auto", children: _jsx(TextPressure, { text: step === 'reset' ? 'Set New Password' : 'Forgot Password', className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 40 }) }) }), error && (_jsx("div", { className: "max-w-md mx-auto mb-3 text-sm text-red-200 bg-red-900/30 border border-red-500/50 rounded-md p-2", children: error })), _jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 text-left max-w-md mx-auto", children: [step === 'start' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "text-sm text-white/80", children: ["Username or Email", _jsx("input", { value: usernameOrEmail, onChange: e => setUsernameOrEmail(e.target.value), placeholder: "Enter username or email", className: "mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 placeholder-white/40" })] }), _jsx(StarBorder, { as: "button", className: `${buttonBase} text-white/90`, color: "#ffffff", speed: "7s", thickness: 1, innerClassName: "py-[10px] px-[16px] text-sm", onClick: start, disabled: busy || !usernameOrEmail, children: busy ? 'Sending…' : 'Send OTP' })] })), step === 'otp' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-xs text-white/70", children: ["We sent an OTP to ", hint, ". Enter it below."] }), _jsxs("label", { className: "text-sm text-white/80", children: ["OTP", _jsx("input", { value: otp, onChange: e => setOtp(e.target.value), placeholder: "6-digit OTP", className: "mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 placeholder-white/40" })] }), _jsx(StarBorder, { as: "button", className: `${buttonBase} text-white/90`, color: "#ffffff", speed: "7s", thickness: 1, onClick: verify, disabled: busy || otp.length < 4, children: busy ? 'Verifying…' : 'Verify OTP' })] })), step === 'reset' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "text-sm text-white/80", children: ["New Password", _jsx(PasswordField, { value: newPassword, onChange: e => setNewPassword(e.target.value), placeholder: "Enter new password", ariaLabel: "New Password" })] }), _jsx(StarBorder, { as: "button", className: `${buttonBase} text-white/90`, color: "#ffffff", speed: "7s", thickness: 1, onClick: reset, disabled: busy || newPassword.length < 6, children: busy ? 'Saving…' : 'Set New Password' })] })), _jsx("div", { className: "mt-2 flex justify-center", children: _jsx("button", { type: "button", className: "text-sm underline text-white/90", onClick: () => { location.hash = '#/auth'; }, children: "Back to login" }) })] })] }) })] }));
}
