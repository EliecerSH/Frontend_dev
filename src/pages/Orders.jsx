// src/pages/Orders.jsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../AuthConfig';
import { fetchOrdenes } from '../api/apiService';
import { formatPrice } from '../utils/format';

export default function Orders() {
    const isAuthenticated = useIsAuthenticated();
    const { instance } = useMsal();
    const location = useLocation();
    const ordenRecienCreada = location.state?.ordenRecienCreada;

    const [ordenes, setOrdenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        let activo = true;
        setLoading(true);
        fetchOrdenes(instance)
            .then((data) => activo && setOrdenes(data))
            .catch((err) => activo && setError(err.message))
            .finally(() => activo && setLoading(false));
        return () => {
            activo = false;
        };
    }, [instance, isAuthenticated]);

    const handleLogin = async () => {
        try {
            await instance.loginPopup(loginRequest);
        } catch (err) {
            console.error(err);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="page cart-page">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Inicia sesión para ver tus pedidos</h3>
                    <button className="btn btn-primary" onClick={handleLogin}>Iniciar sesión</button>
                </div>
            </div>
        );
    }

    return (
        <div className="page cart-page">
            <h1>Mis pedidos</h1>

            {ordenRecienCreada && (
                <p className="state-message" style={{ color: 'green' }}>
                    ¡Tu pedido #{ordenRecienCreada} fue registrado! Te llegará un correo de confirmación en breve.
                </p>
            )}

            {loading && <p className="state-message">Cargando pedidos…</p>}
            {error && <p className="state-message state-error">{error}</p>}

            {!loading && !error && ordenes.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <h3>Aún no tienes pedidos</h3>
                    <Link to="/" className="btn btn-primary">Ir al catálogo</Link>
                </div>
            )}

            {ordenes.length > 0 && (
                <div className="cart-items">
                    {ordenes.map((orden) => (
                        <div className="cart-item" key={orden.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div className="cart-item-end" style={{ justifyContent: 'space-between', display: 'flex' }}>
                                <strong>Pedido #{orden.id}</strong>
                                <span>{orden.estado}</span>
                            </div>
                            <p className="cart-item-price">
                                {new Date(orden.creadoEn).toLocaleString('es-CL')} · {orden.items.length} ítem(s)
                            </p>
                            <span className="cart-item-subtotal">{formatPrice(orden.total)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}