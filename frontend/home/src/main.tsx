import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import LoadingScreen from './components/ui/LoadingScreen';
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
  const [screen, setScreen] = React.useState<'loading' | 'home' | 'solo' | 'audio' | 'video' | 'together' | 'auth' | 'create-room' | 'forgot-password' | 'shared' | 'audio-shared' | 'video-shared' | 'about'>('loading');
  const [media, setMedia] = React.useState<{ url: string; name: string; kind: 'audio' | 'video' } | null>(null);

  // Loading screen timer
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setScreen('home');
    }, 3000); // Show loading for 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Simple hash-router to reach Auth before Together (after loading)
  React.useEffect(() => {
    const apply = () => {
      const token = localStorage.getItem('auth');
      if (location.hash.startsWith('#/shared')) {
        setScreen(token ? 'shared' : 'auth');
      } else if (location.hash === '#/watch-together') {
        setScreen(token ? 'together' : 'auth');
      } else if (location.hash === '#/auth') {
        setScreen('auth');
      } else if (location.hash === '#/create-room') {
        setScreen('create-room');
      } else if (location.hash === '#/forgot-password') {
        setScreen('forgot-password');
      } else if (location.hash === '#/audio-shared') {
        setScreen('audio-shared');
      } else if (location.hash === '#/video-shared') {
        setScreen('video-shared');
      } else if (location.hash === '#/about') {
        setScreen('about');
      } else if (location.hash === '#/home' || location.hash === '') {
        setScreen('home');
      }
    };
    
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []); // Remove screen dependency to prevent interference
  
  // Handle initial hash on mount (after loading screen)
  React.useEffect(() => {
    if (screen === 'home' && location.hash) {
      const token = localStorage.getItem('auth');
      if (location.hash.startsWith('#/shared')) {
        setScreen(token ? 'shared' : 'auth');
      } else if (location.hash === '#/watch-together') {
        setScreen(token ? 'together' : 'auth');
      } else if (location.hash === '#/auth') {
        setScreen('auth');
      } else if (location.hash === '#/create-room') {
        setScreen('create-room');
      } else if (location.hash === '#/forgot-password') {
        setScreen('forgot-password');
      } else if (location.hash === '#/audio-shared') {
        setScreen('audio-shared');
      } else if (location.hash === '#/video-shared') {
        setScreen('video-shared');
      } else if (location.hash === '#/about') {
        setScreen('about');
      }
    }
  }, [screen]); // Only trigger when screen changes to 'home'

  if (screen === 'loading') {
    return <LoadingScreen />;
  }

  if (screen === 'home') {
    return <Home onStartSolo={() => setScreen('solo')} />;
  }
  if (screen === 'about') {
    return <About />;
  }
  if (screen === 'auth') {
    return <Auth />;
  }
  if (screen === 'forgot-password') {
    return <ForgotPassword />;
  }
  if (screen === 'create-room') {
    return <CreateRoom onBack={() => { location.hash = '#/watch-together'; }} />;
  }
  if (screen === 'together') {
    return <WatchTogether />;
  }
  if (screen === 'shared') {
    return <SharedRoom />;
  }
  if (screen === 'audio-shared') {
    // hydrate from session
    let shared: any = null;
    try { shared = JSON.parse(sessionStorage.getItem('shared:media') || 'null'); } catch {}
    return <AudioPlayerShared onBack={() => { location.hash = '#/shared'; }} src={shared?.url} name={shared?.name} />;
  }
  if (screen === 'video-shared') {
    let shared: any = null;
    try { shared = JSON.parse(sessionStorage.getItem('shared:media') || 'null'); } catch {}
    return <VideoPlayerShared onBack={() => { location.hash = '#/shared'; }} src={shared?.url} />;
  }
  if (screen === 'solo') {
    return (
      <SoloSelect
        onBack={() => setScreen('home')}
        onPicked={(m) => {
          setMedia(m);
          setScreen(m.kind === 'video' ? 'video' : 'audio');
        }}
      />
    );
  }
  if (screen === 'video') {
    return <VideoPlayer onBack={() => setScreen('solo')} src={media?.url || ''} />;
  }
  return <AudioPlayer onBack={() => setScreen('solo')} src={media?.url || ''} name={media?.name} />;
}

function ToastHost() {
  const [msg, setMsg] = React.useState<{ type: 'error' | 'success'; text: string } | null>(null);
  React.useEffect(() => {
    const handler = (e: any) => {
      setMsg(e.detail);
      setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener('toast', handler as any);
    return () => window.removeEventListener('toast', handler as any);
  }, []);
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-4 py-3 rounded-xl border ${msg.type === 'error' ? 'bg-red-600/80 border-red-400 text-white' : 'bg-green-600/80 border-green-400 text-white'}`} role="status" aria-live="polite">{msg.text}</div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastHost />
    <App />
  </React.StrictMode>
);