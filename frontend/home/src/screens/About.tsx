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

// Enhanced Creator Card — glass, gradient edge, lift-on-hover
function CreatorCard({ name, role, img, github, linkedin }: { name: string; role: string; img: string; github?: string; linkedin?: string }) {
  return (
    <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
      <div className="rounded-3xl bg-white/6/80 border border-white/15 p-6 md:p-8 grid grid-cols-1 md:grid-cols-[auto,1fr] items-center gap-6 min-h-[320px] backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
        <div className="shrink-0 w-40 h-40 md:w-56 md:h-56 mx-auto md:mx-0">
          <MagicBentoImage src={img} alt={name} />
        </div>
        <div className="flex-1 w-full">
          <div className="text-center md:text-left">
            <div className="text-2xl md:text-3xl font-semibold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-200 whitespace-nowrap overflow-hidden text-ellipsis">{name}</div>
            <div className="text-white/85 text-sm md:text-base mt-1">{role}</div>
            <div className="mt-3 flex items-center justify-center md:justify-start gap-2">
              <SocialIcon type="github" href={github} label={`${name} GitHub`} />
              <SocialIcon type="linkedin" href={linkedin} label={`${name} LinkedIn`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBox({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
      <div className="rounded-3xl bg-white/6/80 border border-white/15 p-6 sm:p-8 text-center backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
        <div className="text-3xl mb-4" aria-hidden>{icon}</div>
        <div className="text-lg md:text-xl font-semibold text-white mb-2">{title}</div>
        <div className="text-white/85 leading-relaxed">{text}</div>
      </div>
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

// Section title wrapper with consistent spacing
function SectionTitle({ text, min }: { text: string; min: number }) {
  return (
    <div className="w-full text-center mb-12">
      <div className="mx-auto w-full h-[72px] flex items-center justify-center">
        <TextPressure
          text={text}
          className="select-none text-center"
          fontFamily="Compressa VF"
          fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
          width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
          textColor="#ffffff" minFontSize={min}
        />
      </div>
    </div>
  );
}

// Feature card to list key capabilities
function FeatureCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
      <div className="rounded-3xl bg-white/6/80 border border-white/15 p-6 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0 mt-1" aria-hidden>{icon}</div>
          <div>
            <div className="text-white font-semibold text-lg mb-2">{title}</div>
            <div className="text-white/85 leading-relaxed">{text}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Architecture box item
function ArchItem({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
      <div className="rounded-3xl bg-white/6/80 border border-white/15 p-6 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
        <div className="text-white font-semibold text-lg mb-4">{title}</div>
        <ul className="list-disc list-inside space-y-2 text-white/85 leading-relaxed">
          {points.map((p, i) => (<li key={i}>{p}</li>))}
        </ul>
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
        
        {/* Hero Title Section */}
        <section className="px-4 md:px-8 pt-20 pb-16">
          <div className="text-center w-full max-w-[64rem] mx-auto">
            {/* Main Title */}
            <div className="mx-auto w-full max-w-[48rem] h-[84px] md:h-[108px] flex items-center justify-center">
              <TextPressure
                text="About AuraStream"
                className="select-none text-center"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
                textColor="#F5F3FF" minFontSize={48}
              />
            </div>
            {/* Hero Description */}
            <div className="mt-6 max-w-4xl mx-auto">
              <p className="text-violet-100/90 text-xl md:text-2xl leading-relaxed">
                Elegant, minimal, and secure. Watch alone or perfectly in sync with friends through an ambient interface that gets out of your way.
              </p>
            </div>
          </div>
        </section>

        {/* Why AuraStream */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Why AuraStream" min={28} />
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
              <div className="rounded-3xl bg-white/6/80 border border-white/15 p-8 md:p-10 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
                <div className="text-2xl font-bold text-white mb-6 bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Experience First</div>
                <ul className="space-y-5 text-white/90 leading-relaxed">
                  <li className="flex gap-4 items-start"><span className="text-2xl flex-shrink-0 mt-1" aria-hidden>🎯</span><span>Zero‑clutter UI and ambient visuals that keep the focus on your media content.</span></li>
                  <li className="flex gap-4 items-start"><span className="text-2xl flex-shrink-0 mt-1" aria-hidden>🧭</span><span>Resilient sync with queued signaling, HTTP fallbacks, and fast state recovery.</span></li>
                </ul>
              </div>
            </div>
            <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
              <div className="rounded-3xl bg-white/6/80 border border-white/15 p-8 md:p-10 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
                <div className="text-2xl font-bold text-white mb-6 bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Security Built-in</div>
                <ul className="space-y-5 text-white/90 leading-relaxed">
                  <li className="flex gap-4 items-start"><span className="text-2xl flex-shrink-0 mt-1" aria-hidden>🔒</span><span>Security by default with JWT auth, Helmet, CSP/HSTS, and careful origin rules.</span></li>
                  <li className="flex gap-4 items-start"><span className="text-2xl flex-shrink-0 mt-1" aria-hidden>⚙️</span><span>Works across conditions with TURN validation, ICE restarts, and Socket.IO recovery.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Core Features" min={28} />
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard icon="🕒" title="Perfect Sync" text="Host controls propagate instantly with jitter smoothing and drift correction for seamless viewing." />
            <FeatureCard icon="📁" title="Any Source" text="Play local captures, screens, or shared streams with minimal setup and maximum compatibility." />
            <FeatureCard icon="💬" title="Lightweight Chat" text="Coordinate with peers without noisy overlays or heavy UI that distracts from content." />
            <FeatureCard icon="📶" title="Network Resilience" text="Auto‑retry flows keep sessions connected through flaky networks and connection drops." />
            <FeatureCard icon="🧩" title="Modular Core" text="Clear boundaries between media, signaling, auth, and UI layers for maintainable code." />
            <FeatureCard icon="🌙" title="Calm Aesthetic" text="Quiet gradients, subtle motion, and accessible contrast that works day or night." />
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="How It Works" min={28} />
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepBox icon="🔗" title="1. Connect" text="Join a room instantly or create one with optional password protection for privacy and security." />
            <StepBox icon="📤" title="2. Share" text="Upload media or share your screen directly in‑browser — no extra apps or downloads needed to get started." />
            <StepBox icon="🎬" title="3. Sync" text="All participants see the same frame with real‑time controls and integrated chat for seamless communication." />
          </div>
        </section>

        {/* Technology Stack */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Technology Stack" min={28} />
          <div className="max-w-7xl mx-auto">
            {/* Architecture Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              <ArchItem title="Frontend Stack" points={["React 18 + TypeScript", "Framer Motion animations", "TailwindCSS styling", "WebRTC peer connections"]} />
              <ArchItem title="Backend Stack" points={["Node.js + Express", "Socket.IO real‑time", "JWT authentication", "TURN server integration"]} />
              <ArchItem title="Infrastructure" points={["Docker deployment", "HTTPS/WSS everywhere", "Cloudflare optimization", "Automated CI/CD"]} />
            </div>
            {/* Tech Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <TechPill icon="⚛️" label="React 18" />
              <TechPill icon="🔵" label="TypeScript" />
              <TechPill icon="🟢" label="Node.js" />
              <TechPill icon="⚡" label="Socket.IO" />
              <TechPill icon="🎨" label="Tailwind" />
              <TechPill icon="🎬" label="Framer" />
              <TechPill icon="📡" label="WebRTC" />
              <TechPill icon="🔐" label="JWT Auth" />
              <TechPill icon="🐳" label="Docker" />
              <TechPill icon="☁️" label="Cloudflare" />
              <TechPill icon="🔒" label="HTTPS" />
              <TechPill icon="⚙️" label="Express" />
            </div>
          </div>
        </section>

        {/* The Story */}
        <section className="px-4 md:px-8 py-20">
          <div className="w-full text-center mb-6">
            <div className="mx-auto w-full h-[72px] flex items-center justify-center">
              <TextPressure
                text="The Story Behind AuraStream"
                className="select-none text-center"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true} weight={true} italic={true} alpha={false} flex={false} stroke={false} scale={false}
                textColor="#ffffff" minFontSize={28}
              />
            </div>
          </div>
          <div className="group relative max-w-5xl mx-auto rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
            <div className="rounded-3xl bg-white/6/80 border border-white/15 p-8 md:p-12 text-center backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
              <p className="text-white/90 text-lg leading-relaxed mb-8">
                AuraStream began from a simple belief: watching together should feel effortless and delightful. We were tired of tools
                that added friction—noisy UIs, unreliable sync, awkward recovery. AuraStream focuses on flow: calm visuals, thoughtful
                controls, and a resilient core that keeps you connected.
              </p>
              <p className="text-white/85 text-lg leading-relaxed">
                Under the hood, it quietly handles the hard parts: queued signaling if you go offline, HTTP fallbacks with retries,
                graceful ICE restarts, TURN validation and re‑validation, and state recovery on reconnect. The result is a premium
                experience that gets out of your way.
              </p>
            </div>
          </div>
        </section>

        {/* Meet The Creators */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Meet The Creators" min={28} />
          <div className="max-w-6xl mx-auto grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CreatorCard name="Saptarshi Ghosh" role="UI Design & Backend Architecture" img="/creators/Saptarshi_AuraStream.png" github="https://github.com/saptarshi0999" />
              <CreatorCard name="Sudip Mishra" role="Frontend Development & UX" img="/creators/Sudip_AuraStream.png" />
            </div>
          </div>
        </section>

        {/* Get Started */}
        <section className="px-4 md:px-8 py-16 pb-24">
          <SectionTitle text="Get Started" min={28} />
          <div className="max-w-2xl mx-auto text-center">
            <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
              <div className="rounded-3xl bg-white/6/80 border border-white/15 p-8 backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
                <p className="text-white/90 text-lg leading-relaxed mb-8">
                  Ready to experience seamless watching together? Start your first session or explore the codebase.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <StarBorder as="a" className={`${buttonBase} text-white/90 rounded-2xl bg-white/5 hover:bg-white/10`} color="#ffffff" speed="7s" thickness={1} href="#/home">
                    🚀 Start Watching
                  </StarBorder>
                  <StarBorder as="a" className={`${buttonBase} text-white/90 rounded-2xl bg-white/5 hover:bg-white/10`} color="#ffffff" speed="7s" thickness={1} href="https://github.com/eliot-99/AuraStream" target="_blank" rel="noreferrer">
                    🔗 GitHub Repository
                  </StarBorder>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}