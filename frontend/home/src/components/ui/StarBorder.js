import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const StarBorder = ({ as, className = '', color = 'white', speed = '6s', thickness = 1, innerClassName, roundedClass, children, ...rest }) => {
    const Component = (as || 'button');
    const rounded = roundedClass || 'rounded-[20px]';
    return (_jsxs(Component, { className: `relative inline-block overflow-hidden ${rounded} ${className}`, ...rest, style: {
            padding: `${thickness}px 0`,
            ...rest?.style,
        }, children: [_jsx("div", { className: `absolute w-[300%] h-[50%] opacity-70 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0`, style: {
                    background: `radial-gradient(circle, ${color}, transparent 10%)`,
                    animationDuration: speed,
                } }), _jsx("div", { className: `absolute w-[300%] h-[50%] opacity-70 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0`, style: {
                    background: `radial-gradient(circle, ${color}, transparent 10%)`,
                    animationDuration: speed,
                } }), _jsx("div", { className: `relative z-10 bg-gradient-to-b from-black to-gray-900 border border-gray-800 text-white text-center text-[16px] py-[16px] px-[26px] ${rounded} ${innerClassName || ''}`, children: children })] }));
};
export default StarBorder;
