import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BoxesBackground from '../components/ui/BoxesBackground';
import RippleGrid from '../components/background/RippleGrid';
import { preLoadSecurity } from '../utils/security';
import useVoiceCommands from '../hooks/useVoiceCommands';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';

type HomeProps = { onStartSolo?: () => void };
export default function Home({ onStartSolo }: HomeProps) {
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState<string>('');

  // Initialize security (TLS stub + AES-GCM key gen)
  useEffect(() => {
    preLoadSecurity().then(() => setReady(true));
  }, []);

  // Live clock update every minute
  useEffect(() => {
    const format = () => new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', hour12: true,
      day: '2-digit', month: 'short', year: 'numeric'
    }).replace(',', '');
    setClock(format());
    const id = setInterval(() => setClock(format()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Voice commands: "navigate to Watch Alone/Together"
  useVoiceCommands({
    onAlone: () => document.getElementById('watchAlone')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    onTogether: () => document.getElementById('watchTogether')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  });

  const buttonBase = 'px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none';

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      {/* Visual background */}
      <div className="absolute inset-0 -z-20">
        <RippleGrid enableRainbow={false} gridColor="#8ab4ff" rippleIntensity={0.06} gridSize={10} gridThickness={12} fadeDistance={1.6} vignetteStrength={1.8} glowIntensity={0.12} opacity={0.6} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.8} />
      </div>

      {/* Security badge */}
      <div className="fixed left-4 bottom-4 text-[12px] text-aura-ok pulse-badge select-none" aria-label="Encrypted & Secure">
        Encrypted & Secure
      </div>

      {/* Top-left logo with tooltip */}
      <div className="fixed top-4 left-4">
        <button aria-label="AuraStream Privacy Policy" className="text-white/90 hover:text-white text-sm" title="Privacy Policy">
          AuraStream
        </button>
      </div>

      {/* Bottom-right clock + link */}
      <div className="fixed right-4 bottom-4 text-[12px] text-white/90 flex flex-col items-end gap-1">
        <span aria-live="polite">{clock || '—'}</span>
        <a href="/transparency-report" className="text-aura-neon underline">Data Safety Pledge</a>
      </div>

      {/* Center panel */}
      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={motion.div} className="max-w-[44rem] w-[90vw] text-center" color="#88ccff" speed="8s" thickness={2}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          <div className="py-4">
            {/* Interactive variable-font title */}
            <div className="w-full max-w-[42rem] mx-auto h-[84px] md:h-[108px]">
              <TextPressure
                text="AuraStream"
                className="select-none"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true}
                weight={true}
                italic={true}
                alpha={false}
                flex={false}
                stroke={false}
                scale={false}
                textColor="#ffffff"
                minFontSize={44}
              />
            </div>
            <motion.p
              className="mt-3 text-white/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Ambient Bliss, Shared or Solo.
            </motion.p>
          </div>

          {/* CTA buttons */}
          <div className="mt-8 w-full max-w-xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-center md:justify-between gap-4 md:gap-6" role="group" aria-label="Primary actions">
            <StarBorder as="button" id="watchAlone" aria-label="Watch Alone button" className={`${buttonBase} text-white/90 text-left`} color="#ffffff" speed="7s" thickness={1}
              onClick={onStartSolo}
            >
              <span className="mr-2">🎧</span>
              Watch Alone

            </StarBorder>

            <StarBorder as="a" id="watchTogether" aria-label="Watch Together button" className={`${buttonBase} text-white/90 text-right`} color="#ffffff" speed="7s" thickness={1}
              href="#/auth"
            >
              <span className="mr-2">👥</span>
              Watch Together

            </StarBorder>
          </div>

          {!ready && (
            <p className="mt-4 text-xs text-white/60" aria-live="polite">Initializing secure session…</p>
          )}
        </StarBorder>
      </main>
    </div>
  );
}