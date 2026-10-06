// src/pages/Orders.jsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../AuthConfig';
import { fetchOrdenes } from '../api/apiService';
import { formatPrice } from '../utils/format';
import { IconLock, IconBox } from '../components/Icons';

// Asigna un color al estado del pedido según su texto.
const estadoClase = (estado = '') => {
    const e = String(estado).toLowerCase();
    if (/cancel|rechaz|fall/.test(e)) return 'status-danger';
    if (/pend|proces|prepar|cre/.test(e)) return 'status-warning';
    if (/pag|complet|entreg|envi|confirm/.test(e)) return 'status-success';
    return 'status-neutral';
};

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
            <div className="page orders-page">
                <div className="empty-state">
                    <div className="empty-state-icon"><IconLock size={28} /></div>
                    <h3>Inicia sesión para ver tus pedidos</h3>
                    <button className="btn btn-primary" onClick={handleLogin}>Iniciar sesión</button>
                </div>
            </div>
        );
    }

    return (
        <div className="page orders-page">
            <header className="page-header"><h1>Mis pedidos</h1></header>

            {ordenRecienCreada && (
                <div className="alert alert-success" role="status">
                    Tu pedido #{ordenRecienCreada} fue registrado. Te llegará un correo de confirmación en breve.
                </div>
            )}

            {loading && <p className="state-message" role="status">Cargando pedidos…</p>}
            {error && <p className="state-message state-error">{error}</p>}

            {!loading && !error && ordenes.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon"><IconBox size={28} /></div>
                    <h3>Aún no tienes pedidos</h3>
                    <Link to="/" className="btn btn-primary">Ir al catálogo</Link>
                </div>
            )}

            {ordenes.length > 0 && (
                <ul className="order-list">
                    {ordenes.map((orden) => (
                        <li className="order-card" key={orden.id}>
                            <div className="order-card-main">
                                <strong className="order-card-id">Pedido #{orden.id}</strong>
                                <p className="order-card-meta">
                                    {new Date(orden.creadoEn).toLocaleString('es-CL')} · {orden.items.length} {orden.items.length === 1 ? 'ítem' : 'ítems'}
                                </p>
                            </div>
                            <span className={`status ${estadoClase(orden.estado)}`}>{orden.estado}</span>
                            <span className="order-card-total">{formatPrice(orden.total)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}