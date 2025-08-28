import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// WebGL gradient plane that fully covers the viewport, with CSS blur applied
export default function WebGLGradient() {
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
    const uniforms: { uTime: { value: number }; uAspect: { value: number } } = {
      uTime: { value: 0 },
      uAspect: { value: 1 }
    };

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
        
        // Iñigo Quílez palette for smooth color cycling
        vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
          return a + b * cos(6.28318 * (c * t + d));
        }

        void main() {
          // Normalize UV to centered coordinates and correct aspect
          vec2 p = vUv * 2.0 - 1.0; // [-1,1]
          p.x *= uAspect;

          float time = uTime * 0.6; // faster
          float r = length(p);
          float theta = atan(p.y, p.x);

          // Stronger swirl with exponential falloff so center is slow, edges faster
          float swirl = theta + time * (0.3 + 0.9 * smoothstep(0.1, 1.2, r)) + r * 6.0;

          // Smooth parameter combining swirl and radial bands
          float t = fract(swirl / (6.28318) + 0.20 * sin(8.0 * r - time * 1.2));

          // Smooth palette
          vec3 col = palette(t,
            vec3(0.45),                // base
            vec3(0.55),                // amplitude
            vec3(1.0, 1.0, 1.0),       // frequency per channel
            vec3(0.00, 0.33, 0.67)     // phase shift per channel
          );

          // Extra mixing via subtle hue shift by radius
          col *= 0.9 + 0.1 * cos(10.0 * r - time * 0.5);

          // Lower opacity more so grid shows clearly
          gl_FragColor = vec4(col, 0.22);
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
      uniforms.uAspect.value = w / h; // keep circles circular
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

  // scale slightly to hide blur edges
  return <div ref={mountRef} className="absolute inset-0 w-full h-full -z-20" style={{ filter: 'blur(14px)', transform: 'scale(1.06)' }} aria-hidden="true" />;
}