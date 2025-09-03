import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Home from './screens/Home';
import SoloSelect from './screens/SoloSelect';
import AudioPlayer from './screens/AudioPlayer';
import VideoPlayer from './screens/VideoPlayer';
import WatchTogether from './screens/WatchTogether';
import SharedRoom from './screens/SharedRoom';
import Auth from './screens/Auth';
import CreateRoom from './screens/CreateRoom';
import ForgotPassword from './screens/ForgotPassword';
import AudioPlayerShared from './screens/AudioPlayerShared';
import VideoPlayerShared from './screens/VideoPlayerShared';
import About from './screens/About';
function App() {
    const [screen, setScreen] = React.useState('home');
    const [media, setMedia] = React.useState(null);
    // Simple hash-router to reach Auth before Together
    React.useEffect(() => {
        const apply = () => {
            const token = localStorage.getItem('auth');
            if (location.hash.startsWith('#/shared')) {
                setScreen(token ? 'shared' : 'auth');
            }
            else if (location.hash === '#/watch-together') {
                setScreen(token ? 'together' : 'auth');
            }
            else if (location.hash === '#/auth') {
                setScreen('auth');
            }
            else if (location.hash === '#/create-room') {
                setScreen('create-room');
            }
            else if (location.hash === '#/forgot-password') {
                setScreen('forgot-password');
            }
            else if (location.hash === '#/audio-shared') {
                setScreen('audio-shared');
            }
            else if (location.hash === '#/video-shared') {
                setScreen('video-shared');
            }
            else if (location.hash === '#/about') {
                setScreen('about');
            }
            else if (location.hash === '#/home' || location.hash === '') {
                setScreen('home');
            }
        };
        apply();
        window.addEventListener('hashchange', apply);
        return () => window.removeEventListener('hashchange', apply);
    }, []);
    if (screen === 'home') {
        return _jsx(Home, { onStartSolo: () => setScreen('solo') });
    }
    if (screen === 'about') {
        return _jsx(About, {});
    }
    if (screen === 'auth') {
        return _jsx(Auth, {});
    }
    if (screen === 'forgot-password') {
        return _jsx(ForgotPassword, {});
    }
    if (screen === 'create-room') {
        return _jsx(CreateRoom, { onBack: () => { location.hash = '#/watch-together'; } });
    }
    if (screen === 'together') {
        return _jsx(WatchTogether, {});
    }
    if (screen === 'shared') {
        return _jsx(SharedRoom, {});
    }
    if (screen === 'audio-shared') {
        // hydrate from session
        let shared = null;
        try {
            shared = JSON.parse(sessionStorage.getItem('shared:media') || 'null');
        }
        catch { }
        return _jsx(AudioPlayerShared, { onBack: () => { location.hash = '#/shared'; }, src: shared?.url, name: shared?.name });
    }
    if (screen === 'video-shared') {
        let shared = null;
        try {
            shared = JSON.parse(sessionStorage.getItem('shared:media') || 'null');
        }
        catch { }
        return _jsx(VideoPlayerShared, { onBack: () => { location.hash = '#/shared'; }, src: shared?.url });
    }
    if (screen === 'solo') {
        return (_jsx(SoloSelect, { onBack: () => setScreen('home'), onPicked: (m) => {
                setMedia(m);
                setScreen(m.kind === 'video' ? 'video' : 'audio');
            } }));
    }
    if (screen === 'video') {
        return _jsx(VideoPlayer, { onBack: () => setScreen('solo'), src: media?.url || '' });
    }
    return _jsx(AudioPlayer, { onBack: () => setScreen('solo'), src: media?.url || '', name: media?.name });
}
function ToastHost() {
    const [msg, setMsg] = React.useState(null);
    React.useEffect(() => {
        const handler = (e) => {
            setMsg(e.detail);
            setTimeout(() => setMsg(null), 2200);
        };
        window.addEventListener('toast', handler);
        return () => window.removeEventListener('toast', handler);
    }, []);
    if (!msg)
        return null;
    return (_jsx("div", { className: `fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-4 py-3 rounded-xl border ${msg.type === 'error' ? 'bg-red-600/80 border-red-400 text-white' : 'bg-green-600/80 border-green-400 text-white'}`, role: "status", "aria-live": "polite", children: msg.text }));
}
createRoot(document.getElementById('root')).render(_jsxs(React.StrictMode, { children: [_jsx(ToastHost, {}), _jsx(App, {})] }));
