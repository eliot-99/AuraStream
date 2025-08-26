import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Subtle white circular particles ONLY (transparent background)
export default function WebGLBackdrop() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    const mount = mountRef.current!;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 2.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // White circular particles (non-interactive)
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * 4.5;   // x
      positions[idx + 1] = (Math.random() - 0.5) * 3.0; // y
      positions[idx + 2] = (Math.random() - 0.5) * 0.2; // z small spread
    }
    const pgeom = new THREE.BufferGeometry();
    pgeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Create a small circular texture for round points
    const size = 64;
    const circleCanvas = document.createElement('canvas');
    circleCanvas.width = size; circleCanvas.height = size;
    const ctx = circleCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size*0.4, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(circleCanvas);

    const pmaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.0,              // pixels (since sizeAttenuation=false)
      sizeAttenuation: false, // keep constant pixel size
      transparent: true,
      opacity: 0.35,
      map: tex,
      alphaTest: 0.5,
      depthWrite: false
    });

    const particles = new THREE.Points(pgeom, pmaterial);
    scene.add(particles);

    const onResize = () => {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    onResize();

    const tick = () => {
      particles.rotation.y += 0.0008;
      particles.rotation.x += 0.0002;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current!);
      ro.disconnect();
      mount.removeChild(renderer.domElement);
      pgeom.dispose();
      pmaterial.dispose();
      renderer.dispose();
      tex.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full -z-10" aria-hidden="true" />;
}