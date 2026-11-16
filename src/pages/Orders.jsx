// src/pages/Orders.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../AuthConfig';
import { fetchOrdenes, iniciarPago, redirigirAWebpay, pagosHabilitados } from '../api/apiService';
import { useCart } from '../context/CartContext';
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

const ESTADOS_LEGIBLES = {
    PENDIENTE_PAGO: 'Pendiente de pago',
    PAGADA: 'Pagada',
    PAGO_RECHAZADO: 'Pago rechazado',
    PROCESADA: 'Procesada',
};

// Mensaje según el resultado que ms-pagos envía al redirigir desde Webpay
const RESULTADOS_PAGO = {
    AUTHORIZED: { type: 'success', text: (id) => `¡Pago aprobado! Tu pedido #${id} está confirmado. Te llegará un correo en breve.` },
    REJECTED: { type: 'error', text: (id) => `El pago del pedido #${id} fue rechazado por el banco. Puedes intentarlo nuevamente.` },
    CANCELLED: { type: 'error', text: (id) => `Cancelaste el pago del pedido #${id}. Puedes pagarlo cuando quieras desde esta página.` },
    ERROR: { type: 'error', text: () => 'No pudimos confirmar el resultado del pago. Revisa el estado del pedido antes de volver a pagar.' },
};

const sePuedePagar = (estado) => ['PENDIENTE_PAGO', 'PAGO_RECHAZADO'].includes(estado);

export default function Orders() {
    const isAuthenticated = useIsAuthenticated();
    const { instance } = useMsal();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { clearCart } = useCart();
    const ordenRecienCreada = location.state?.ordenRecienCreada;

    const [ordenes, setOrdenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resultadoPago, setResultadoPago] = useState(null);
    const [pagandoId, setPagandoId] = useState(null);
    const [errorPago, setErrorPago] = useState(null);
    const resultadoProcesado = useRef(false);
    const refreshTimer = useRef(null);

    const cargarOrdenes = useCallback(() => {
        return fetchOrdenes(instance)
            .then((data) => setOrdenes(data))
            .catch((err) => setError(err.message));
    }, [instance]);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        setLoading(true);
        cargarOrdenes().finally(() => setLoading(false));
    }, [isAuthenticated, cargarOrdenes]);

    // Retorno desde Webpay: /pedidos?paymentStatus=AUTHORIZED&orderId=123
    useEffect(() => {
        const status = searchParams.get('paymentStatus');
        if (!status || resultadoProcesado.current || !isAuthenticated) return;
        resultadoProcesado.current = true;
        const orderId = searchParams.get('orderId');
        const def = RESULTADOS_PAGO[status] || RESULTADOS_PAGO.ERROR;
        setResultadoPago({ type: def.type, text: def.text(orderId) });
        setSearchParams({}, { replace: true });

        if (status === 'AUTHORIZED') {
            clearCart();
            // ms-ordenes actualiza el estado de forma asíncrona (Kafka): se refresca la lista en unos segundos.
            // El timer vive en un ref: limpiar la query string re-ejecuta este efecto y no debe cancelarlo.
            refreshTimer.current = setTimeout(cargarOrdenes, 2500);
        }
    }, [searchParams, setSearchParams, isAuthenticated, clearCart, cargarOrdenes]);

    useEffect(() => () => clearTimeout(refreshTimer.current), []);

    const handlePagar = async (orden) => {
        setPagandoId(orden.id);
        setErrorPago(null);
        try {
            const pago = await iniciarPago(instance, orden.id);
            redirigirAWebpay(pago);
        } catch (err) {
            setErrorPago(err.message);
            setPagandoId(null);
        }
    };

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

            {resultadoPago && (
                <div className={`alert alert-${resultadoPago.type}`} role="status">{resultadoPago.text}</div>
            )}

            {ordenRecienCreada && !resultadoPago && (
                <div className="alert alert-success" role="status">
                    Tu pedido #{ordenRecienCreada} fue registrado. Te llegará un correo de confirmación en breve.
                </div>
            )}

            {errorPago && <div className="alert alert-error" role="alert">{errorPago}</div>}

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
                        <li
                            className={`order-card ${pagosHabilitados() && sePuedePagar(orden.estado) ? 'order-card-has-action' : ''}`}
                            key={orden.id}
                        >
                            <div className="order-card-main">
                                <strong className="order-card-id">Pedido #{orden.id}</strong>
                                <p className="order-card-meta">
                                    {new Date(orden.creadoEn).toLocaleString('es-CL')} · {orden.items.length} {orden.items.length === 1 ? 'ítem' : 'ítems'}
                                </p>
                            </div>
                            <span className={`status ${estadoClase(orden.estado)}`}>
                                {ESTADOS_LEGIBLES[orden.estado] || orden.estado}
                            </span>
                            <span className="order-card-total">{formatPrice(orden.total)}</span>
                            {pagosHabilitados() && sePuedePagar(orden.estado) && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handlePagar(orden)}
                                    disabled={pagandoId !== null}
                                >
                                    {pagandoId === orden.id ? 'Redirigiendo…' : 'Pagar con WebPay'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
