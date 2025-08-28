import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import p5 from 'p5';
// Interactive ripple-like particles using p5.js
export default function P5Particles() {
    const ref = useRef(null);
    const p5Ref = useRef();
    useEffect(() => {
        const sketch = (s) => {
            let ripples = [];
            s.setup = () => {
                const c = s.createCanvas(ref.current.clientWidth, ref.current.clientHeight);
                c.parent(ref.current);
            };
            s.windowResized = () => {
                s.resizeCanvas(ref.current.clientWidth, ref.current.clientHeight);
            };
            s.draw = () => {
                s.clear(); // transparent canvas overlay
                // fade out background for trail effect
                s.noFill();
                s.stroke(255, 255 * 0.35);
                s.strokeWeight(1);
                ripples = ripples.filter(r => r.a > 0.02);
                for (const r of ripples) {
                    s.circle(r.x, r.y, r.r);
                    r.r += 0.8;
                    r.a *= 0.98;
                }
            };
            const emit = (x, y) => {
                ripples.push({ x, y, r: 2, a: 1 });
            };
            s.mouseMoved = () => emit(s.mouseX, s.mouseY);
            s.touchMoved = () => {
                emit(s.touches[0]?.x ?? s.mouseX, s.touches[0]?.y ?? s.mouseY);
                return false;
            };
        };
        p5Ref.current = new p5(sketch);
        return () => {
            p5Ref.current?.remove();
        };
    }, []);
    return _jsx("div", { ref: ref, className: "absolute inset-0 -z-10", "aria-hidden": "true" });
}
