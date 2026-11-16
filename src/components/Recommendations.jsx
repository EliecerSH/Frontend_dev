// src/components/Recommendations.jsx
// Bloque de recomendaciones servido por ms-recomendaciones (Backend_dev03).
// - modo "home": personalizadas si hay sesión (con fallback a populares), populares si no.
// - modo "similares": "otros clientes también vieron" para la ficha de un producto.
import React, { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import {
    fetchMisRecomendaciones,
    fetchPopulares,
    fetchSimilares,
    recomendacionesHabilitadas,
} from '../api/apiService';
import ProductCard from './ProductCard';

const aProducto = (r) => ({
    id: r.productoId,
    nombre: r.nombre,
    categoria: r.categoria,
    precio: r.precio,
    stock: r.stock,
    imagenUrl: r.imagenUrl,
});

export default function Recommendations({ modo = 'home', productoId, limit = 4, onAddToCart, addingId }) {
    const isAuthenticated = useIsAuthenticated();
    const { instance } = useMsal();
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!recomendacionesHabilitadas()) return;
        let activo = true;
        const cargar = async () => {
            if (modo === 'similares') return fetchSimilares(productoId, limit);
            if (isAuthenticated) {
                try {
                    return await fetchMisRecomendaciones(instance, limit);
                } catch {
                    return fetchPopulares(limit);
                }
            }
            return fetchPopulares(limit);
        };
        cargar()
            .then((res) => activo && setData(res))
            // Las recomendaciones son opcionales: si el servicio falla, el bloque simplemente no se muestra
            .catch(() => activo && setData(null));
        return () => {
            activo = false;
        };
    }, [modo, productoId, limit, isAuthenticated, instance]);

    if (!data || !data.items || data.items.length === 0) return null;

    const titulo = modo === 'similares'
        ? 'También te puede interesar'
        : data.estrategia === 'PERSONALIZADA' ? 'Recomendado para ti' : 'Lo más popular';
    const subtitulo = modo === 'similares'
        ? 'Basado en lo que vieron otros clientes'
        : data.estrategia === 'PERSONALIZADA' ? 'Según lo que has visto y comprado' : 'Lo que más miran y compran nuestros clientes';

    return (
        <section className="reco-section" aria-label={titulo}>
            <div className="section-head">
                <h2>{titulo}</h2>
                <p>{subtitulo}</p>
            </div>
            <div className="reco-grid">
                {data.items.map((r) => (
                    <div className="reco-item" key={r.productoId}>
                        {r.motivo && <span className="reco-reason">{r.motivo}</span>}
                        <ProductCard
                            producto={aProducto(r)}
                            onAddToCart={onAddToCart}
                            adding={addingId === r.productoId}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
