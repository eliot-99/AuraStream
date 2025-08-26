import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import "./Lightning.css";

export type LightningParams = {
  hue: number;
  xOffset: number;
  speed: number;
  intensity: number;
  size: number;
};

export type LightningHandle = {
  setParams: (next: Partial<LightningParams>) => void;
};

const DEFAULTS: LightningParams = {
  hue: 230,
  xOffset: 0,
  speed: 1,
  intensity: 1,
  size: 1,
};

interface Props extends Partial<LightningParams> {
  qualityScale?: number; // 0.5..1: render scale vs CSS size
  horizontal?: boolean;  // if true, align beam horizontally
}

const Lightning = forwardRef<LightningHandle, Props>(({ 
  hue = DEFAULTS.hue,
  xOffset = DEFAULTS.xOffset,
  speed = DEFAULTS.speed,
  intensity = DEFAULTS.intensity,
  size = DEFAULTS.size,
  qualityScale = 1,
  horizontal = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<{ [k: string]: WebGLUniformLocation | null }>({});
  const paramsRef = useRef<LightningParams>({ hue, xOffset, speed, intensity, size });
  const startTimeRef = useRef<number>(0);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    setParams(next) {
      paramsRef.current = { ...paramsRef.current, ...next };
    },
  }), []);

  // Initialize WebGL once
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) { console.error("WebGL not supported"); return; }
    glRef.current = gl;

    const resize = () => {
      const scale = Math.max(0.5, Math.min(1, qualityScale));
      const w = Math.floor(canvas.clientWidth * scale);
      const h = Math.floor(canvas.clientHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const vsrc = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;

    // Reduced OCTAVE_COUNT for performance; tuned color brightness
    const fsrc = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      uniform float uHorizontal; // 1.0 => horizontal, 0.0 => vertical
      #define OCTAVE_COUNT 6
      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }
      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      mat2 r2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash12(i);
        float b=hash12(i+vec2(1.,0.));
        float c=hash12(i+vec2(0.,1.));
        float d=hash12(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v=0., a=0.5; 
        for(int i=0;i<OCTAVE_COUNT;i++){
          v += a * noise(p);
          p = r2(0.45) * p * 2.0;
          a *= 0.5;
        }
        return v;
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv = 2.0*uv - 1.0;
        // aspect-correct, then rotate if horizontal requested
        uv.x *= iResolution.x / iResolution.y;
        if(uHorizontal > 0.5){ uv = uv.yx; }
        uv.x += uXOffset;
        uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
        float dist = max(1e-3, abs(uv.x));
        vec3 base = hsv2rgb(vec3(uHue/360.0, 0.75, 0.9));
        float spark = 0.07 / dist;
        vec3 col = base * spark * uIntensity;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (src: string, type: number) => {
      const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
      return sh;
    };
    const vs = compile(vsrc, gl.VERTEX_SHADER); if (!vs) return;
    const fs = compile(fsrc, gl.FRAGMENT_SHADER); if (!fs) return;

    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);
    programRef.current = prog;

    const verts = new Float32Array([ -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1 ]);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPosition"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uniformsRef.current.iResolution = gl.getUniformLocation(prog, "iResolution");
    uniformsRef.current.iTime = gl.getUniformLocation(prog, "iTime");
    uniformsRef.current.uHue = gl.getUniformLocation(prog, "uHue");
    uniformsRef.current.uXOffset = gl.getUniformLocation(prog, "uXOffset");
    uniformsRef.current.uSpeed = gl.getUniformLocation(prog, "uSpeed");
    uniformsRef.current.uIntensity = gl.getUniformLocation(prog, "uIntensity");
    uniformsRef.current.uSize = gl.getUniformLocation(prog, "uSize");
    uniformsRef.current.uHorizontal = gl.getUniformLocation(prog, "uHorizontal");

    startTimeRef.current = performance.now();

    const render = () => {
      if (!gl || !programRef.current) return;
      // iResolution in pixels (framebuffer size)
      gl.uniform2f(uniformsRef.current.iResolution, canvas.width, canvas.height);
      const t = (performance.now() - startTimeRef.current) / 1000;
      gl.uniform1f(uniformsRef.current.iTime, t);
      const p = paramsRef.current;
      gl.uniform1f(uniformsRef.current.uHue, p.hue);
      gl.uniform1f(uniformsRef.current.uXOffset, p.xOffset);
      gl.uniform1f(uniformsRef.current.uSpeed, p.speed);
      gl.uniform1f(uniformsRef.current.uIntensity, p.intensity);
      gl.uniform1f(uniformsRef.current.uSize, p.size);
      gl.uniform1f(uniformsRef.current.uHorizontal, horizontal ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    return () => { window.removeEventListener("resize", onResize); };
  }, [qualityScale]);

  // Update initial params on prop change without rerendering GL
  useEffect(() => { paramsRef.current = { ...paramsRef.current, hue, xOffset, speed, intensity, size }; }, [hue, xOffset, speed, intensity, size]);

  return <canvas ref={canvasRef} className="lightning-container" />;
});

export default Lightning;