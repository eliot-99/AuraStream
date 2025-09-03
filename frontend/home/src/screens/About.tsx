import React, { useRef } from 'react';
import StarBorder from '../components/ui/StarBorder';

import TextPressure from '../components/ui/TextPressure';
import Particles from '../components/background/Particles';

// Simple social icon buttons (GitHub, LinkedIn)
function SocialIcon({ type, href, label }: { type: 'github' | 'linkedin'; href?: string; label: string }) {
  const isDisabled = !href;
  const base = 'h-9 w-9 rounded-xl flex items-center justify-center border transition-transform';
  const classes = `${base} ${isDisabled ? 'opacity-50 cursor-not-allowed border-white/15 bg-white/6' : 'hover:scale-105 border-white/15 bg-white/6 hover:bg-white/8'}`;
  const content = type === 'github' ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.162 19.492c.5.092.686-.216.686-.482 0-.237-.01-1.024-.014-1.86-2.793.607-3.383-1.195-3.383-1.195-.455-1.157-1.112-1.466-1.112-1.466-.908-.62.069-.608.069-.608 1.004.07 1.531 1.032 1.531 1.032.892 1.528 2.341 1.087 2.91.832.091-.647.35-1.087.636-1.338-2.231-.253-4.577-1.114-4.577-4.957 0-1.095.39-1.991 1.03-2.693-.104-.253-.446-1.272.098-2.651 0 0 .84-.269 2.75 1.028A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.338 1.909-1.297 2.748-1.028 2.748-1.028.546 1.379.204 2.398.1 2.651.641.702 1.028 1.598 1.028 2.693 0 3.852-2.35 4.701-4.588 4.949.359.31.679.92.679 1.855 0 1.337-.012 2.416-.012 2.745 0 .269.182.58.692.481A10 10 0 0 0 12 2Z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M19 3h-14a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-14a2 2 0 0 0-2-2Zm-11.5 16h-2v-9h2v9Zm-1-10.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5ZM20 19h-2v-4.8c0-1.144-.023-2.615-1.594-2.615-1.596 0-1.841 1.247-1.841 2.534v4.881h-2v-9h1.922v1.229h.027c.268-.507.923-1.043 1.9-1.043 2.032 0 2.586 1.337 2.586 3.076V19Z"/>
    </svg>
  );
  return isDisabled ? (
    <span className={classes} aria-label={label} aria-disabled>{content}</span>
  ) : (
    <a className={classes} href={href} target="_blank" rel="noreferrer" aria-label={label}>{content}</a>
  );
}

// Magic Bento-like image tile with: Stars, Spotlight, Tilt, Click effects
function MagicBentoImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;  // 0..1
    const rx = (py - 0.5) * 6; // tilt X
    const ry = (0.5 - px) * 6; // tilt Y
    el.style.setProperty('--mx', `${px}`);
    el.style.setProperty('--my', `${py}`);
    el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)';
  };
  const onDown = () => {
    const el = ref.current; if (!el) return;
    el.style.transition = 'transform 120ms ease';
    el.style.transform += ' scale(0.98)';
  };
  const onUp = () => {
    const el = ref.current; if (!el) return;
    el.style.transition = 'transform 180ms ease';
    el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)';
    setTimeout(() => { el.style.transition = 'transform 240ms ease'; }, 200);
  };

  return (
    <div
      ref={ref}
      className="relative select-none rounded-3xl overflow-hidden border border-white/15 bg-white/6"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 240ms ease' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseDown={onDown}
      onMouseUp={onUp}
    >
      {/* Stars layer */}
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="w-full h-full stars-layer" />
      </div>
      {/* Spotlight following cursor */}
      <div
        className="pointer-events-none absolute inset-0" aria-hidden
        style={{
          background: 'radial-gradient(220px circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%), rgba(255,255,255,0.18), transparent 60%)'
        }}
      />
      {/* Image */}
      <img src={src} alt={alt} loading="lazy" className="block w-full h-full object-cover" />
    </div>
  );
}

// Creator card — increased height
function CreatorCard({ name, role, img, github, linkedin }: { name: string; role: string; img: string; github?: string; linkedin?: string }) {
  return (
    <div className="rounded-3xl bg-white/6 border border-white/15 p-6 md:p-8 flex items-center gap-6 min-h-[320px]">
      <div className="shrink-0 w-48 h-48 md:w-56 md:h-56">
        <MagicBentoImage src={img} alt={name} />
      </div>
      <div className="flex-1">
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-semibold text-white">{name}</div>
          <div className="text-white/85 text-sm md:text-base mt-1">{role}</div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <SocialIcon type="github" href={github} label={`${name} GitHub`} />
            <SocialIcon type="linkedin" href={linkedin} label={`${name} LinkedIn`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBox({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/6 border border-white/15 p-5 sm:p-6 text-center hover:bg-white/8 transition-colors">
      <div className="text-2xl mb-2" aria-hidden>{icon}</div>
      <div className="text-base md:text-lg font-medium text-white">{title}</div>
      <div className="text-white/85 text-sm mt-1 leading-relaxed">{text}</div>
    </div>
  );
}

function TechPill({ icon, label }: { icon: string; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * 4;
    const ry = (0.5 - px) * 4;
    el.style.setProperty('--mx', `${px}`);
    el.style.setProperty('--my', `${py}`);
    el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)';
  };
  return (
    <div ref={ref} className="group relative rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm flex items-center gap-3 justify-center overflow-hidden"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 240ms ease' }} onMouseMove={onMove} onMouseLeave={onLeave}
    >
      {/* Stars */}
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="w-full h-full stars-layer" />
      </div>
      {/* Spotlight */}
      <div className="pointer-events-none absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" aria-hidden style={{ background: 'radial-gradient(180px circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%), rgba(255,255,255,0.14), transparent 60%)' }} />
      {/* Content */}
      <div className="relative z-10 flex items-center gap-2">
        <span className="text-lg" aria-hidden>{icon}</span>
        <span className="text-white/95">{label}</span>
      </div>
    </div>
  );
}

export default function About() {
  const buttonBase = 'px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none';

  return (
    <div className="relative min-h-screen font-montserrat text-white">
      {/* Background: Particles */}
      <div className="fixed inset-0 -z-20">
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Particles
            particleColors={["#ffffff", "#ffffff"]}
            particleCount={200}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
          />
        </div>
      </div>

      {/* Back */}
      <div className="fixed top-5 left-5 z-30">
        <button onClick={() => (window.location.hash = '#/home')} aria-label="Back to Home" title="Back" className="h-10 w-10 rounded-full bg-white/6 border border-white/15 flex items-center justify-center hover:scale-110 transition">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden className="text-white"><polygon points="15,4 5,12 15,20" /></svg>
        </button>
      </div>

      {/* Page styles: stars layer for bento */}
      <style>{`
        .stars-layer { position: relative; width: 100%; height: 100%; background: transparent; }
        .stars-layer::before, .stars-layer::after {
          content: ""; position: absolute; inset: 0; background-repeat: repeat; opacity: 0.7;
        }
        .stars-layer::before {
          background-image: radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.7) 99%, transparent 100%),
                            radial-gradient(1px 1px at 60px 80px, rgba(255,255,255,0.6) 99%, transparent 100%),
                            radial-gradient(1.5px 1.5px at 120px 40px, rgba(255,255,255,0.65) 99%, transparent 100%);
          background-size: 120px 120px;
          animation: twinkle 4s linear infinite;
        }
        .stars-layer::after {
          background-image: radial-gradient(1.5px 1.5px at 40px 20px, rgba(255,255,255,0.6) 99%, transparent 100%),
                            radial-gradient(1px 1px at 100px 100px, rgba(255,255,255,0.55) 99%, transparent 100%),
                            radial-gradient(2px 2px at 160px 60px, rgba(255,255,255,0.7) 99%, transparent 100%);
          background-size: 160px 160px;
          animation: twinkle 6s linear infinite reverse;
        }
        @keyframes twinkle { 0% { transform: translateY(0px); } 50% { transform: translateY(-1px); } 100% { transform: translateY(0px); } }
        main::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>

      {/* Content (scrollbar hidden) */}
      <main className="relative z-10 overflow-y-auto max-h-screen [scrollbar-width:none] [-ms-overflow-style:none]">
        {/* Title */}
        <section className="px-4 md:px-8 pt-14">
          <div className="text-center w-full max-w-[60rem] mx-auto">
            <div className="mx-auto h-[96px] md:h-[116px]">
              <TextPressure
                text="About AuraStream"
                className="select-none"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
                textColor="#F5F3FF" minFontSize={58}
              />
            </div>
            <p className="mt-2 text-violet-100/90 text-lg md:text-xl leading-relaxed">Elegant, minimal, and secure. Watch alone or perfectly in sync with friends.</p>
          </div>
        </section>

        {/* Creators */}
        <section className="px-4 md:px-8 py-10">
          <div className="mx-auto max-w-[24rem] h-[56px]">
            <TextPressure
              text="The Creators"
              className="select-none text-center"
              fontFamily="Compressa VF"
              fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
              width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
              textColor="#ffffff" minFontSize={28}
            />
          </div>
          <div className="mt-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <CreatorCard name="Saptarshi Ghosh" role="UI Design & Backend" img="/creators/Saptarshi_AuraStream.png" github="https://github.com/saptarshi0999" />
            <CreatorCard name="Sudip Mishra" role="Frontend" img="/creators/Sudip_AuraStream.png" />
          </div>
        </section>

        {/* Story (no book icon) */}
        <section className="px-4 md:px-8 py-8">
          <div className="mx-auto max-w-[36rem] h-[50px]">
            <TextPressure
              text="The Story Behind AuraStream"
              className="select-none text-center"
              fontFamily="Compressa VF"
              fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
              width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
              textColor="#ffffff" minFontSize={24}
            />
          </div>
          <div className="max-w-5xl mx-auto mt-5 rounded-3xl bg-white/6 border border-white/15 p-6 md:p-7 text-center">
            <p className="text-white/90 leading-relaxed">
              AuraStream began from a simple belief: watching together should feel effortless and delightful. We were tired of tools
              that added friction—noisy UIs, unreliable sync, awkward recovery. AuraStream focuses on flow: calm visuals, thoughtful
              controls, and a resilient core that keeps you connected.
            </p>
            <p className="text-white/85 leading-relaxed mt-3">
              Under the hood, it quietly handles the hard parts: queued signaling if you go offline, HTTP fallbacks with retries,
              graceful ICE restarts, TURN validation and re‑validation, and state recovery on reconnect. The result is a premium
              experience that gets out of your way.
            </p>
          </div>
        </section>

        {/* How to use */}
        <section className="px-4 md:px-8 py-10">
          <div className="mx-auto max-w-[28rem] h-[50px]">
            <TextPressure
              text="How to Use AuraStream"
              className="select-none text-center"
              fontFamily="Compressa VF"
              fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
              width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
              textColor="#ffffff" minFontSize={24}
            />
          </div>
          <div className="mt-6 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
            <StepBox icon="🔐" title="1. Join/Create" text="Open Watch Together. Create or join a room and share the link/code." />
            <div className="hidden sm:block text-white/70">➜</div>
            <StepBox icon="🎬" title="2. Pick Media" text="Choose a local file to capture or share a screen/window." />
            <div className="hidden sm:block text-white/70">➜</div>
            <StepBox icon="⏯️" title="3. Play in Sync" text="Use controls and chat. We keep everyone perfectly aligned." />
            <div className="hidden sm:block text-white/70">➜</div>
            <StepBox icon="🌈" title="4. Enjoy" text="Ambient visuals, light UI, and smooth recovery if the network blips." />
          </div>
        </section>

        {/* Technology stack */}
        <section className="px-4 md:px-8 py-10">
          <div className="mx-auto max-w-[26rem] h-[50px]">
            <TextPressure
              text="Technology Stack"
              className="select-none text-center"
              fontFamily="Compressa VF"
              fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
              width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
              textColor="#ffffff" minFontSize={24}
            />
          </div>
          <div className="max-w-5xl mx-auto mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            <TechPill icon="⚛️" label="React + TypeScript" />
            <TechPill icon="⚡" label="Vite" />
            <TechPill icon="🎨" label="TailwindCSS" />
            <TechPill icon="🎞️" label="Framer Motion (minimal)" />
            <TechPill icon="🧵" label="Socket.IO" />
            <TechPill icon="📹" label="WebRTC + ICE Restarts" />
            <TechPill icon="🟩" label="Node + Express" />
            <TechPill icon="🍃" label="MongoDB" />
            <TechPill icon="🛡️" label="JWT, Helmet, CSP, HSTS" />
          </div>
        </section>

        {/* CTA */}
        <section className="min-h-[32vh] flex items-center justify-center px-4 md:px-8 pb-14">
          <div className="max-w-[44rem] w-[92vw] text-center">
            <div className="w-full max-w-[42rem] mx-auto h-[84px] md:h-[100px]">
              <TextPressure
                text="Build with us"
                className="select-none"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
                textColor="#ffffff" minFontSize={42}
              />
            </div>
            <p className="mt-3 text-white/85">We welcome ideas, feedback, and contributions. Let’s make AuraStream even better.</p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <StarBorder as="a" className={`${buttonBase} text-white/90 rounded-2xl`} color="#ffffff" speed="7s" thickness={1} href="https://github.com/eliot-99/AuraStream" target="_blank" rel="noreferrer">🔗 GitHub Repository</StarBorder>
              <StarBorder as="a" className={`${buttonBase} text-white/90 rounded-2xl`} color="#ffffff" speed="7s" thickness={1} href="mailto:saptarshi0999@gmail.com?subject=AuraStream%20Collaboration">🤝 Collaborate</StarBorder>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}