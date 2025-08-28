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

function App() {
  const [screen, setScreen] = React.useState<'home' | 'solo' | 'audio' | 'video' | 'together' | 'auth' | 'create-room' | 'forgot-password' | 'shared' | 'audio-shared' | 'video-shared'>('home');
  const [media, setMedia] = React.useState<{ url: string; name: string; kind: 'audio' | 'video' } | null>(null);

  // Simple hash-router to reach Auth before Together
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
      } else if (location.hash === '#/home' || location.hash === '') {
        setScreen('home');
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  if (screen === 'home') {
    return <Home onStartSolo={() => setScreen('solo')} />;
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);