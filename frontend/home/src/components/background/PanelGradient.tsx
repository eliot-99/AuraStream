import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Tornado-like gradient rendered only inside its container (panel)
export default function PanelGradient() {
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

    const geometry = new THREE.PlaneGeometry(1, 1);
    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 }
    } as const;

    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uTime;
        uniform float uAspect;
        varying vec2 vUv;

        vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
          return a + b * cos(6.28318 * (c * t + d));
        }

        // Explicit 4-color gradient: blue -> violet -> pink -> red -> blue
        vec3 gradient4(float t) {
          vec3 blue   = vec3(0.20, 0.40, 0.95);
          vec3 violet = vec3(0.55, 0.30, 0.95);
          vec3 pink   = vec3(0.95, 0.45, 0.80);
          vec3 red    = vec3(0.95, 0.25, 0.25);
          float seg = fract(t) * 4.0;
          int i = int(floor(seg));
          float f = fract(seg);
          if (i == 0) return mix(blue, violet, f);
          if (i == 1) return mix(violet, pink, f);
          if (i == 2) return mix(pink, red, f);
          return mix(red, blue, f);
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= uAspect;

          float time = uTime * 0.45; // slightly slower
          float r = length(p);
          float theta = atan(p.y, p.x);

          float swirl = theta + time * (0.25 + 0.8 * smoothstep(0.1, 1.2, r)) + r * 5.0;
          float t = fract(swirl / (6.28318) + 0.18 * sin(7.0 * r - time * 1.0));

          vec3 col = gradient4(t);
          col *= 0.92 + 0.08 * cos(8.0 * r - time * 0.5);

          gl_FragColor = vec4(col, 0.35);
        }
      `
    });

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const updatePlaneScale = (w: number, h: number) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const dist = camera.position.z;
      const vFov = (camera.fov * Math.PI) / 180;
      const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
      const visibleWidth = visibleHeight * camera.aspect;
      plane.scale.set(visibleWidth, visibleHeight, 1);
    };

    const onResize = () => {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      uniforms.uAspect.value = w / h;
      updatePlaneScale(w, h);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    onResize();

    const tick = (time: number) => {
      uniforms.uTime.value = time * 0.001;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current!);
      ro.disconnect();
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 -z-10"
      style={{ filter: 'blur(12px)', transform: 'scale(1.04)' }}
      aria-hidden="true"
    />
  );
}