// src/components/ProductImage.jsx
import React, { useState } from 'react';
import { IconImage } from './Icons';

// Muestra la imagen del producto; si no existe o falla la carga, cae a un
// placeholder (sin depender de recursos externos).
export default function ProductImage({ src, alt, className = '' }) {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <div className={`product-image placeholder ${className}`} role="img" aria-label={alt}>
                <IconImage size={40} />
            </div>
        );
    }

    return (
        <div className={`product-image ${className}`}>
            <img src={src} alt={alt} onError={() => setFailed(true)} loading="lazy" />
        </div>
    );
}