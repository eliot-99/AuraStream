// Minimal shims to satisfy TS during build when @types packages are absent
// Prefer installing @types/p5 and @types/three for better typing.
declare module 'p5' { const P5: any; export default P5; }
declare module 'three' { export const Scene: any; export const PerspectiveCamera: any; export const WebGLRenderer: any; export const BufferGeometry: any; export const Float32BufferAttribute: any; export const CanvasTexture: any; export const PointsMaterial: any; export const Points: any; export const PlaneGeometry: any; export const ShaderMaterial: any; export const Mesh: any; }

declare module 'ogl' { export const Renderer: any; export const Program: any; export const Triangle: any; export const Mesh: any; }

declare var require: any;