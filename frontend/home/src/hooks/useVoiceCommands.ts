// Basic Web Speech API command listener
// Commands supported:
// - "navigate to Watch Alone"
// - "navigate to Watch Together"

export default function useVoiceCommands({ onAlone, onTogether }: { onAlone: () => void; onTogether: () => void; }): () => void {
  if (typeof window === 'undefined') return () => {};
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SR) return () => {};

  const recognition: any = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (e: any) => {
    const last = e.results?.[e.results.length - 1];
    if (!last?.isFinal) return;
    const text = String(last[0]?.transcript || '').trim().toLowerCase();
    if (text.includes('navigate to watch alone') || text.includes('watch alone')) onAlone();
    if (text.includes('navigate to watch together') || text.includes('watch together')) onTogether();
  };

  recognition.onerror = () => {
    // fail silently for now
  };

  try { recognition.start(); } catch {}

  return () => { try { recognition.stop(); } catch {} };
}