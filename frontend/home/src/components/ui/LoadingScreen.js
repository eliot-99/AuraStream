import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from 'framer-motion';
export default function LoadingScreen() {
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-aura-bg font-montserrat", children: [_jsx("div", { className: "absolute inset-0 overflow-hidden", children: Array.from({ length: 8 }).map((_, i) => (_jsx(motion.div, { className: "absolute w-1 h-1 bg-cyan-400/30 rounded-full", animate: {
                        x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                        y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                        opacity: [0, 0.6, 0],
                        scale: [0, 1, 0],
                    }, transition: {
                        duration: 4 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.5,
                        ease: "easeInOut"
                    } }, i))) }), _jsxs("div", { className: "relative text-center", children: [_jsxs(motion.div, { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.8, ease: "easeOut" }, className: "mb-8", children: [_jsxs("div", { className: "relative", children: [_jsx(motion.h1, { className: "text-6xl md:text-8xl font-bold mb-4 relative z-10", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 1, delay: 0.2 }, children: ['A', 'u', 'r', 'a', 'S', 't', 'r', 'e', 'a', 'm'].map((letter, index) => (_jsx(motion.span, { className: "inline-block bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: {
                                                duration: 0.5,
                                                delay: 0.3 + index * 0.1,
                                                ease: "easeOut"
                                            }, whileHover: {
                                                scale: 1.1,
                                                textShadow: "0 0 20px rgba(56, 189, 248, 0.5)"
                                            }, children: letter }, index))) }), _jsx("div", { className: "absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 animate-pulse" })] }), _jsx(motion.p, { className: "text-lg md:text-xl text-white/60 font-light tracking-wider", initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 1.5 }, children: "Ambient Bliss, Shared or Solo" })] }), _jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay: 2 }, className: "space-y-6", children: [_jsx("div", { className: "flex justify-center space-x-2", children: [0, 1, 2].map((i) => (_jsx(motion.div, { className: "w-2 h-2 bg-cyan-400/80 rounded-full", animate: {
                                        scale: [1, 1.2, 1],
                                        opacity: [0.4, 1, 0.4],
                                    }, transition: {
                                        duration: 1.5,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: "easeInOut"
                                    } }, i))) }), _jsx(motion.div, { className: "text-white/50 text-sm font-light tracking-widest", animate: { opacity: [0.3, 1, 0.3] }, transition: {
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }, children: "INITIALIZING" })] }), _jsx(motion.div, { className: "absolute -inset-32 opacity-30", animate: { rotate: 360 }, transition: { duration: 20, repeat: Infinity, ease: "linear" }, children: _jsx("div", { className: "w-full h-full border border-dashed border-cyan-400/20 rounded-full" }) }), _jsx(motion.div, { className: "absolute -inset-48 opacity-20", animate: { rotate: -360 }, transition: { duration: 30, repeat: Infinity, ease: "linear" }, children: _jsx("div", { className: "w-full h-full border border-dashed border-blue-400/20 rounded-full" }) })] }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 2.5 }, className: "absolute bottom-8 left-8 text-xs text-aura-ok font-light tracking-wide pulse-badge", children: "Encrypted & Secure" })] }));
}
