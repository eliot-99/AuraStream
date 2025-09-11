import React, { useRef } from 'react';
import StarBorder from '../components/ui/StarBorder';
import Particles from '../components/background/Particles';
import { 
  SiReact, SiTypescript, SiNodedotjs, SiSocketdotio, SiTailwindcss, 
  SiFramer, SiExpress, SiMongodb, SiJsonwebtokens, SiVercel, 
  SiRender, SiVite, SiNpm 
} from 'react-icons/si';
import { 
  MdSecurity, MdWebAsset, MdVideoCall, MdSync, MdFolder, MdChat, MdSignalWifi4Bar, MdExtension, MdDarkMode,
  MdVideoSettings, MdOutlineNavigateNext, MdAccountCircle, MdLogin, MdLockReset, MdCreate, MdOutlineMeetingRoom,
  MdPerson, MdGroup, MdShare, MdChatBubbleOutline, MdCloud
} from 'react-icons/md';
import { 
  FaLock, FaCloud, FaCode, FaShieldAlt, FaUser
} from 'react-icons/fa';

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

// Eye-catching Creator Card with full-cover image background
function CreatorCard({ name, role, img, github, linkedin }: { name: string; role: string; img: string; github?: string; linkedin?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
  };
  
  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  return (
    <div 
      ref={cardRef}
      className="group relative overflow-hidden rounded-3xl border border-white/20 transition-all duration-500 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-500/20 h-80"
      style={{ transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Full cover background image */}
      <div className="absolute inset-0">
        <img 
          src={img} 
          alt={name} 
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
      </div>
      
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 group-hover:from-black/95 group-hover:via-black/50 transition-all duration-500" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-purple-600/20 to-blue-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Floating orbs animation */}
      <div className="absolute inset-0 overflow-hidden opacity-50">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-r from-violet-400/30 to-purple-400/30 rounded-full blur-xl group-hover:animate-pulse" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-gradient-to-r from-blue-400/20 to-violet-400/20 rounded-full blur-xl group-hover:animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
      
      {/* Content positioned at the bottom */}
      <div className="relative z-10 p-6 h-full flex flex-col justify-end">
        {/* Bottom section with name, role, and social icons */}
        <div className="space-y-4 text-center">
          <h3 className="text-2xl font-bold text-white drop-shadow-lg group-hover:text-violet-200 transition-all duration-500 transform group-hover:scale-105">
            {name}
          </h3>
          <div className="relative">
            <p className="text-white/90 text-sm font-medium drop-shadow-md group-hover:text-white transition-colors duration-300">
              {role}
            </p>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-violet-400 to-purple-400 group-hover:w-full transition-all duration-500" />
          </div>
          
          {/* Social icons positioned below name/role */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="transform transition-all duration-300 group-hover:scale-110 group-hover:-rotate-12">
              <SocialIcon type="github" href={github} label={`${name} GitHub`} />
            </div>
            <div className="w-px h-6 bg-white/40 group-hover:bg-violet-400/80 transition-colors duration-300" />
            <div className="transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
              <SocialIcon type="linkedin" href={linkedin} label={`${name} LinkedIn`} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Glowing border effect */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 rounded-3xl border border-violet-500/50 animate-pulse" />
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-violet-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-violet-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

// Minimalistic Why Card component
function WhyCard({ title, items }: { title: string; items: Array<{ icon: React.ReactNode; text: string }> }) {
  return (
    <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-white mb-6 group-hover:text-white transition-colors duration-300">
        {title}
      </h3>
      <ul className="space-y-4">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3 items-start text-white/70 group-hover:text-white/85 transition-colors duration-300">
            <div className="text-white/80 group-hover:text-white transition-colors duration-300 flex-shrink-0 mt-0.5">
              {item.icon}
            </div>
            <span className="leading-relaxed">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Minimalistic StepBox component for "How It Works" section
function StepBox({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1">
      <div className="text-white/80 group-hover:text-white transition-colors duration-300 mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-white mb-3 group-hover:text-white transition-colors duration-300">
        {title}
      </h3>
      <p className="text-white/70 leading-relaxed group-hover:text-white/85 transition-colors duration-300 text-sm">
        {text}
      </p>
    </div>
  );
}

// Enhanced Circular Tech Logo Component
function CircularTechLogo({ icon, label, color, index }: { icon: React.ReactNode; label: string; color: string; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * 8;
    const ry = (0.5 - px) * 8;
    el.style.setProperty('--mx', `${px}`);
    el.style.setProperty('--my', `${py}`);
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(20px)`;
  };
  
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  };

  return (
    <div 
      ref={ref}
      className="group relative flex flex-col items-center cursor-pointer"
      style={{ 
        transformStyle: 'preserve-3d', 
        transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        animationDelay: `${index * 100}ms`
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Animated Ring Background */}
      <div className="absolute inset-0 w-20 h-20 rounded-full opacity-20 animate-pulse" 
        style={{ 
          background: `conic-gradient(from 0deg, ${color}, transparent, ${color})`,
          animation: `spin 8s linear infinite`
        }} 
      />
      
      {/* Main Circular Container */}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-lg flex items-center justify-center overflow-hidden group-hover:scale-110 group-hover:border-white/40 transition-all duration-300">
        
        {/* Rotating Border Effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `conic-gradient(from 0deg, ${color}, transparent, ${color})`,
            mask: 'radial-gradient(circle at center, transparent 70%, black 72%)',
            animation: 'spin 3s linear infinite'
          }}
        />
        
        {/* Inner Glow */}
        <div 
          className="absolute inset-2 rounded-full opacity-30 group-hover:opacity-60 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at center, ${color}40, transparent 70%)`
          }}
        />
        
        {/* Stars Layer */}
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-40 group-hover:opacity-70 transition-opacity duration-300">
          <div className="w-full h-full tech-stars-layer" />
        </div>
        
        {/* Spotlight Effect */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%), ${color}60, transparent 60%)`
          }}
        />
        
        {/* Icon */}
        <div className="relative z-10 text-2xl group-hover:scale-110 transition-transform duration-300 filter group-hover:drop-shadow-lg">
          {icon}
        </div>
      </div>
      
      {/* Label */}
      <div className="mt-3 text-center">
        <div className="text-white/90 text-sm font-medium group-hover:text-white transition-colors duration-300">
          {label}
        </div>
      </div>
    </div>
  );
}

// Simple Tech Card component for the 3 main feature cards
function TechCard({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1">
      <div className="flex items-center mb-4">
        <div className="text-white/80 group-hover:text-white transition-colors duration-300 mr-3 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h4 className="text-xl font-semibold text-white group-hover:text-white transition-colors duration-300">
          {title}
        </h4>
      </div>
      <ul className="space-y-2">
        {points.map((point, index) => (
          <li key={index} className="flex items-start text-white/70 group-hover:text-white/85 transition-colors duration-300 text-sm">
            <span className="text-violet-400 mr-2 mt-1">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Enhanced Architecture Card Component  
function EnhancedArchItem({ title, points, icon, gradient }: { title: string; points: string[]; icon: string; gradient: string }) {
  return (
    <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/25 via-white/10 to-transparent">
      <div className="rounded-3xl bg-white/6 border border-white/15 p-8 backdrop-blur-md transition-all duration-500 group-hover:-translate-y-2 group-hover:bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.25)] group-hover:shadow-[0_20px_80px_rgba(0,0,0,0.4)] overflow-hidden">
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
          <div className="w-full h-full" style={{ 
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, white 2px, white 4px)` 
          }} />
        </div>
        
        {/* Animated Gradient Overlay */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-3xl"
          style={{ background: gradient }}
        />
        
        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
              {icon}
            </div>
            <div className="text-white font-bold text-xl bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
              {title}
            </div>
          </div>
          
          <ul className="space-y-3">
            {points.map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-white/85 leading-relaxed group-hover:text-white/95 transition-colors duration-300">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-blue-400 mt-2 flex-shrink-0 group-hover:scale-125 transition-transform duration-300" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Section title wrapper with consistent spacing
function SectionTitle({ text }: { text: string }) {
  return (
    <div className="w-full text-center mb-12">
      <h2 className="text-3xl md:text-4xl font-bold text-white bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
        {text}
      </h2>
    </div>
  );
}

// Minimalistic Feature card with subtle effects
function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1">
      <div className="flex items-start gap-4">
        <div className="text-white/80 group-hover:text-white transition-colors duration-300 flex-shrink-0 mt-1">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium text-lg mb-2 group-hover:text-white transition-colors duration-300">
            {title}
          </h3>
          <p className="text-white/70 leading-relaxed group-hover:text-white/85 transition-colors duration-300">
            {text}
          </p>
        </div>
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

      {/* Page styles: stars layer for bento and tech components */}
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
        
        .tech-stars-layer { position: relative; width: 100%; height: 100%; background: transparent; }
        .tech-stars-layer::before, .tech-stars-layer::after {
          content: ""; position: absolute; inset: 0; background-repeat: repeat; opacity: 0.8;
        }
        .tech-stars-layer::before {
          background-image: radial-gradient(1px 1px at 10px 15px, rgba(255,255,255,0.8) 99%, transparent 100%),
                            radial-gradient(0.5px 0.5px at 30px 40px, rgba(255,255,255,0.6) 99%, transparent 100%),
                            radial-gradient(1px 1px at 60px 20px, rgba(255,255,255,0.7) 99%, transparent 100%);
          background-size: 80px 80px;
          animation: techTwinkle 3s linear infinite;
        }
        .tech-stars-layer::after {
          background-image: radial-gradient(0.8px 0.8px at 20px 10px, rgba(255,255,255,0.6) 99%, transparent 100%),
                            radial-gradient(0.5px 0.5px at 50px 50px, rgba(255,255,255,0.5) 99%, transparent 100%),
                            radial-gradient(1px 1px at 70px 30px, rgba(255,255,255,0.7) 99%, transparent 100%);
          background-size: 100px 100px;
          animation: techTwinkle 4s linear infinite reverse;
        }
        
        @keyframes twinkle { 
          0% { transform: translateY(0px); } 
          50% { transform: translateY(-1px); } 
          100% { transform: translateY(0px); } 
        }
        
        @keyframes techTwinkle { 
          0% { transform: translateX(0px) translateY(0px); } 
          33% { transform: translateX(0.5px) translateY(-0.5px); } 
          66% { transform: translateX(-0.5px) translateY(0.5px); } 
          100% { transform: translateX(0px) translateY(0px); } 
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        main::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>

      {/* Content (scrollbar hidden) */}
      <main className="relative z-10 overflow-y-auto max-h-screen [scrollbar-width:none] [-ms-overflow-style:none]">
        
        {/* Hero Title Section */}
        <section className="px-4 md:px-8 pt-20 pb-16">
          <div className="text-center w-full max-w-[64rem] mx-auto">
            {/* Main Title */}
            <div className="mx-auto w-full max-w-[48rem] flex items-center justify-center">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                About AuraStream
              </h1>
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
          <SectionTitle text="Why AuraStream" />
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <WhyCard 
              title="Experience First"
              items={[
                {
                  icon: <MdVideoSettings size={20} />,
                  text: "Zero‑clutter UI and ambient visuals that keep the focus on your media content."
                },
                {
                  icon: <MdOutlineNavigateNext size={20} />,
                  text: "Resilient sync with queued signaling, HTTP fallbacks, and fast state recovery."
                }
              ]}
            />
            <WhyCard 
              title="Security Built-in"
              items={[
                {
                  icon: <FaLock size={16} />,
                  text: "Security by default with JWT auth, Helmet, CSP/HSTS, and careful origin rules."
                },
                {
                  icon: <FaShieldAlt size={16} />,
                  text: "Works across conditions with TURN validation, ICE restarts, and Socket.IO recovery."
                }
              ]}
            />
          </div>
        </section>

        {/* Core Features */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Core Features" />
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard icon={<MdSync size={24} />} title="Perfect Sync" text="Host controls propagate instantly with jitter smoothing and drift correction for seamless viewing." />
            <FeatureCard icon={<MdFolder size={24} />} title="Any Source" text="Play local captures, screens, or shared streams with minimal setup and maximum compatibility." />
            <FeatureCard icon={<MdChat size={24} />} title="Lightweight Chat" text="Coordinate with peers without noisy overlays or heavy UI that distracts from content." />
            <FeatureCard icon={<MdSignalWifi4Bar size={24} />} title="Network Resilience" text="Auto‑retry flows keep sessions connected through flaky networks and connection drops." />
            <FeatureCard icon={<MdExtension size={24} />} title="Modular Core" text="Clear boundaries between media, signaling, auth, and UI layers for maintainable code." />
            <FeatureCard icon={<MdDarkMode size={24} />} title="Calm Aesthetic" text="Quiet gradients, subtle motion, and accessible contrast that works day or night." />
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="How It Works" />
          
          {/* Account Management */}
          <div className="max-w-7xl mx-auto mb-16">
            <h3 className="text-2xl md:text-3xl font-semibold text-white mb-8 text-center bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Account Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <StepBox icon={<MdAccountCircle size={24} />} title="Sign Up" text="Create your account with email and secure password. Verify your email to activate full features and room creation privileges." />
              <StepBox icon={<MdLogin size={24} />} title="Log In" text="Access your account securely with email and password. Stay logged in across sessions for seamless room access." />
              <StepBox icon={<MdLockReset size={24} />} title="Forgot Password" text="Reset your password easily with email verification. Secure recovery process ensures account safety and quick restoration." />
            </div>
          </div>

          {/* Room Operations */}
          <div className="max-w-7xl mx-auto mb-16">
            <h3 className="text-2xl md:text-3xl font-semibold text-white mb-8 text-center bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Room Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <StepBox icon={<MdCreate size={24} />} title="Create Room" text="Set up a new viewing room with custom name and optional password protection. Configure privacy settings and sharing permissions." />
              <StepBox icon={<MdOutlineMeetingRoom size={24} />} title="Join Room" text="Enter existing rooms using room code or direct link. Password-protected rooms require authentication for secure access." />
            </div>
          </div>

          {/* Watching Experience */}
          <div className="max-w-7xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-semibold text-white mb-8 text-center bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Watching Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StepBox icon={<MdPerson size={24} />} title="Watch Alone" text="Upload and enjoy your media privately. Full control over playback with high-quality streaming and responsive interface." />
              <StepBox icon={<MdGroup size={24} />} title="Watch Together" text="Synchronized viewing with friends. Real-time playback control sharing ensures everyone sees the same moment simultaneously." />
              <StepBox icon={<MdShare size={24} />} title="Share Content" text="Upload media files or share your screen directly. Supports multiple formats with instant streaming to all participants." />
              <StepBox icon={<MdChatBubbleOutline size={24} />} title="Interactive Chat" text="Communicate with viewers through integrated chat. Lightweight messaging without disrupting the viewing experience." />
            </div>
          </div>
        </section>

        {/* Technology Stack */}
        <section className="px-4 md:px-8 py-20 relative overflow-hidden">
          <SectionTitle text="Technology Stack" />
          
          {/* Floating Background Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-gradient-to-r from-violet-500/10 to-pink-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '4s' }} />
          </div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            
            {/* Architecture Overview with Simple Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
              <TechCard 
                icon={<SiReact size={24} />}
                title="Frontend Stack"
                points={["React 18 + TypeScript", "Vite build system", "Framer Motion animations", "TailwindCSS styling"]}
              />
              <TechCard 
                icon={<SiNodedotjs size={24} />}
                title="Backend Stack"
                points={["Node.js + Express", "Socket.IO real‑time", "MongoDB database", "JWT authentication"]}
              />
              <TechCard 
                icon={<MdCloud size={24} />}
                title="Deployment"
                points={["Vercel (Frontend)", "Render (Backend)", "MongoDB Atlas", "HTTPS everywhere"]}
              />
            </div>

            {/* Tech Stack Showcase */}
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-semibold text-white mb-8 bg-gradient-to-r from-white via-violet-200 to-blue-200 bg-clip-text text-transparent">
                Built With Modern Technologies
              </h3>
            </div>

            {/* Circular Tech Logos Grid */}
            <div className="space-y-8">
              {/* First two rows - full grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-8 md:gap-12 justify-items-center">
                <CircularTechLogo icon={<SiReact size={24} />} label="React 18" color="#61DAFB" index={0} />
                <CircularTechLogo icon={<SiTypescript size={24} />} label="TypeScript" color="#3178C6" index={1} />
                <CircularTechLogo icon={<SiNodedotjs size={24} />} label="Node.js" color="#68D391" index={2} />
                <CircularTechLogo icon={<SiSocketdotio size={24} />} label="Socket.IO" color="#000000" index={3} />
                <CircularTechLogo icon={<SiTailwindcss size={24} />} label="Tailwind" color="#06B6D4" index={4} />
                <CircularTechLogo icon={<SiFramer size={24} />} label="Framer" color="#0055FF" index={5} />
                <CircularTechLogo icon={<MdVideoCall size={24} />} label="WebRTC" color="#FF6B6B" index={6} />
                <CircularTechLogo icon={<SiJsonwebtokens size={24} />} label="JWT" color="#FB7185" index={7} />
              </div>
              
              {/* Bottom row - centered 4 technologies */}
              <div className="flex justify-center">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 md:gap-12 justify-items-center">
                  <CircularTechLogo icon={<SiMongodb size={24} />} label="MongoDB" color="#47A248" index={8} />
                  <CircularTechLogo icon={<SiVercel size={24} />} label="Vercel" color="#000000" index={9} />
                  <CircularTechLogo icon={<SiRender size={24} />} label="Render" color="#46E3B7" index={10} />
                  <CircularTechLogo icon={<SiVite size={24} />} label="Vite" color="#646CFF" index={11} />
                </div>
              </div>
            </div>


          </div>
        </section>

        {/* The Story */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="The Story Behind AuraStream" />
          <div className="max-w-5xl mx-auto">
            <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-8 md:p-12 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1">
              <div className="space-y-6">
                <p className="text-white/85 text-lg leading-relaxed group-hover:text-white/90 transition-colors duration-300">
                  AuraStream began from a simple belief: watching together should feel effortless and delightful. We were tired of tools
                  that added friction—noisy UIs, unreliable sync, awkward recovery. AuraStream focuses on flow: calm visuals, thoughtful
                  controls, and a resilient core that keeps you connected.
                </p>
                <p className="text-white/80 text-lg leading-relaxed group-hover:text-white/85 transition-colors duration-300">
                  Under the hood, it quietly handles the hard parts: queued signaling if you go offline, HTTP fallbacks with retries,
                  graceful ICE restarts, TURN validation and re‑validation, and state recovery on reconnect. The result is a premium
                  experience that gets out of your way.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Meet The Creators */}
        <section className="px-4 md:px-8 py-20">
          <SectionTitle text="Meet The Creators" />
          <div className="max-w-6xl mx-auto grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CreatorCard 
                name="Saptarshi Ghosh" 
                role="UI Design & Backend Architecture" 
                img="/creators/Saptarshi_AuraStream.png" 
                github="https://github.com/saptarshi0999"
                linkedin="https://www.linkedin.com/in/saptarshi-ghosh-b31080258/"
              />
              <CreatorCard 
                name="Sudip Mishra" 
                role="Frontend Development & UX" 
                img="/creators/Sudip_AuraStream.png"
                github="https://github.com/SudipMishra2004"
                linkedin="https://www.linkedin.com/in/sudip-mishra-98530928b/"
              />
            </div>
          </div>
        </section>

        {/* Get Started */}
        <section className="px-4 md:px-8 py-16 pb-24">
          <SectionTitle text="Get Started" />
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Start Watching Card */}
              <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1 text-center">
                <div className="flex justify-center mb-6">
                  <div className="text-white/80 group-hover:text-white transition-colors duration-300 group-hover:scale-110 transition-transform duration-300">
                    <MdVideoCall size={48} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 group-hover:text-white transition-colors duration-300">
                  Start Watching
                </h3>
                <p className="text-white/70 leading-relaxed group-hover:text-white/85 transition-colors duration-300 text-sm mb-6">
                  Jump right in and create your first room. Experience seamless synchronized streaming with friends.
                </p>
                <a 
                  href="#/home"
                  className="inline-flex items-center px-6 py-3 text-white/90 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 font-medium border border-white/20 hover:border-white/30"
                >
                  🚀 Launch App
                </a>
              </div>

              {/* GitHub Repository Card */}
              <div className="group relative rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-white/20 hover:-translate-y-1 text-center">
                <div className="flex justify-center mb-6">
                  <div className="text-white/80 group-hover:text-white transition-colors duration-300 group-hover:scale-110 transition-transform duration-300">
                    <FaCode size={48} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 group-hover:text-white transition-colors duration-300">
                  Explore Code
                </h3>
                <p className="text-white/70 leading-relaxed group-hover:text-white/85 transition-colors duration-300 text-sm mb-6">
                  Dive into the source code. Contribute, learn, or deploy your own instance of AuraStream.
                </p>
                <a 
                  href="https://github.com/eliot-99/AuraStream"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-6 py-3 text-white/90 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 font-medium border border-white/20 hover:border-white/30"
                >
                  🔗 View on GitHub
                </a>
              </div>

            </div>
          </div>
        </section>

      </main>
    </div>
  );
}