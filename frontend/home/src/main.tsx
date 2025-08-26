import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Home from './screens/Home';
import SoloSelect from './screens/SoloSelect';
import AudioPlayer from './screens/AudioPlayer';
import VideoPlayer from './screens/VideoPlayer';
import WatchTogether from './screens/WatchTogether';

function App() {
  const [screen, setScreen] = React.useState<'home' | 'solo' | 'audio' | 'video' | 'together'>('home');
  const [media, setMedia] = React.useState<{ url: string; name: string; kind: 'audio' | 'video' } | null>(null);

  // Simple hash-router to reach Watch Together
  React.useEffect(() => {
    const apply = () => {
      if (location.hash === '#/watch-together') {
        setScreen('together');
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
  if (screen === 'together') {
    return <WatchTogether />;
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