import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-aura-bg font-montserrat">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Main loading content */}
      <div className="relative text-center">
        {/* Logo animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          {/* AuraStream text with animated letters */}
          <div className="relative">
            <motion.h1 
              className="text-6xl md:text-8xl font-bold mb-4 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              {['A', 'u', 'r', 'a', 'S', 't', 'r', 'e', 'a', 'm'].map((letter, index) => (
                <motion.span
                  key={index}
                  className="inline-block bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.3 + index * 0.1,
                    ease: "easeOut"
                  }}
                  whileHover={{ 
                    scale: 1.1,
                    textShadow: "0 0 20px rgba(56, 189, 248, 0.5)"
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.h1>

            {/* Glow effect behind the text */}
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 animate-pulse" />
          </div>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-white/60 font-light tracking-wider"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
          >
            Ambient Bliss, Shared or Solo
          </motion.p>
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2 }}
          className="space-y-6"
        >
          {/* Loading dots */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-cyan-400/80 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Loading text */}
          <motion.div
            className="text-white/50 text-sm font-light tracking-widest"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            INITIALIZING
          </motion.div>
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          className="absolute -inset-32 opacity-30"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-full h-full border border-dashed border-cyan-400/20 rounded-full" />
        </motion.div>

        <motion.div
          className="absolute -inset-48 opacity-20"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-full h-full border border-dashed border-blue-400/20 rounded-full" />
        </motion.div>
      </div>

      {/* Bottom security badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 2.5 }}
        className="absolute bottom-8 left-8 text-xs text-aura-ok font-light tracking-wide pulse-badge"
      >
        Encrypted & Secure
      </motion.div>
    </div>
  );
}