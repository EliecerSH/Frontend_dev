// src/components/Icons.jsx
// Iconos SVG en línea (reemplazan los emojis para un aspecto consistente).
import React from 'react';

const make = (children) =>
    function Icon({ size = 20, ...props }) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
                {...props}
            >
                {children}
            </svg>
        );
    };

export const IconBolt = make(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconCart = make(<><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6" /></>);
export const IconMenu = make(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconArrowLeft = make(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const IconBox = make(<><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>);
export const IconLock = make(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const IconBag = make(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>);
export const IconTruck = make(<><rect x="1" y="6" width="13" height="10" rx="1" /><path d="M14 10h4l3 3v3h-7" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>);
export const IconReturn = make(<><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></>);
export const IconShield = make(<><path d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>);
export const IconImage = make(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m3 17 5-4.5 4 3.5 3-2.5 6 5" /></>);