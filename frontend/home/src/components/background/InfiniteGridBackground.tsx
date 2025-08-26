import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Infinite zooming grid background (behind everything)
export default function InfiniteGridBackground() {
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

        // Render a crisp grid at a given scale
        float gridAt(vec2 p, float scale, float thickness) {
          p *= scale;
          // Centered cell coordinates
          vec2 g = abs(fract(p) - 0.5);
          float d = min(g.x, g.y);
          // Anti-aliasing using derivatives
          float aa = fwidth(d) + 1e-4;
          return 1.0 - smoothstep(thickness, thickness + aa, d);
        }

        void main() {
          // Centered coords with aspect correction
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= uAspect;

          // Smooth, slower infinite zoom using octave crossfade
          float z = uTime * 0.08;           // slower zoom speed
          float f = fract(z);
          // Ease in-out the fractional part to avoid sudden jumps
          float ef = smoothstep(0.0, 1.0, f);
          float base = floor(z);
          // Two adjacent octaves (powers of two)
          float scaleA = exp2((base + ef) * 2.5);  // moderate step per octave
          float scaleB = scaleA * 0.5;             // next octave

          float gA = gridAt(p, scaleA, 0.012);
          float gB = gridAt(p, scaleB, 0.012);

          // Smooth crossfade
          float grid = mix(gA, gB, ef);

          // Style: dim white lines over black
          vec3 col = mix(vec3(0.0), vec3(1.0), grid * 0.25);

          gl_FragColor = vec4(col, 1.0);
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

  return <div ref={mountRef} className="absolute inset-0 w-full h-full -z-30" aria-hidden="true" />;
}