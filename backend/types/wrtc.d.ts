// Minimal declaration to satisfy TypeScript when dynamically importing 'wrtc'
declare module 'wrtc' {
  export const RTCPeerConnection: any;
  export const RTCSessionDescription: any;
  export const RTCIceCandidate: any;
  const _default: any;
  export default _default;
}