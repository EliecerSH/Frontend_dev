// src/pages/Orders.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../AuthConfig';
import {
    fetchOrdenes,
    iniciarPago,
    redirigirAWebpay,
    pagosHabilitados,
    eliminarOrden,
    probarIntentoPago,
} from '../api/apiService';
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

// Demo del antifraude (velocity check): visible salvo que VITE_DEMO_ANTIFRAUDE=false
const DEMO_ANTIFRAUDE = import.meta.env.VITE_DEMO_ANTIFRAUDE !== 'false';
const SOLICITUDES_DEMO = 5;
const PAUSA_DEMO_MS = 400;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const [eliminandoId, setEliminandoId] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [demoOrdenId, setDemoOrdenId] = useState('');
    const [demoResultados, setDemoResultados] = useState([]);
    const [demoCorriendo, setDemoCorriendo] = useState(false);
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

    const handleEliminar = async (orden) => {
        if (!window.confirm(`¿Eliminar el pedido #${orden.id}? Esta acción no se puede deshacer.`)) return;
        setEliminandoId(orden.id);
        setErrorPago(null);
        setAviso(null);
        try {
            await eliminarOrden(instance, orden.id);
            setOrdenes((prev) => prev.filter((o) => o.id !== orden.id));
            setAviso(`Pedido #${orden.id} eliminado.`);
        } catch (err) {
            setErrorPago(err.message);
        } finally {
            setEliminandoId(null);
        }
    };

    // Envía varias solicitudes de pago seguidas para la MISMA orden, sin ir a Webpay.
    // Con 3 intentos en 10 s el velocity check (Kafka: pagos.intentos) bloquea al usuario 30 min,
    // y las solicitudes siguientes responden 429.
    const handleDemoAntifraude = async () => {
        const orderId = Number(demoOrdenId || ordenesPagables[0]?.id);
        if (!orderId) return;
        setDemoCorriendo(true);
        setDemoResultados([]);
        for (let i = 1; i <= SOLICITUDES_DEMO; i++) {
            let r;
            try {
                r = await probarIntentoPago(instance, orderId);
            } catch (err) {
                r = { status: 0, ok: false, mensaje: err.message };
            }
            setDemoResultados((prev) => [...prev, { n: i, ...r }]);
            if (i < SOLICITUDES_DEMO) await esperar(PAUSA_DEMO_MS);
        }
        setDemoCorriendo(false);
    };

    const ordenesPagables = ordenes.filter((o) => sePuedePagar(o.estado));
    const demoBloqueado = demoResultados.some((r) => r.status === 429);

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
            {aviso && <div className="alert alert-success" role="status">{aviso}</div>}

            {pagosHabilitados() && DEMO_ANTIFRAUDE && ordenesPagables.length > 0 && (
                <section className="fraud-demo" aria-label="Prueba del antifraude">
                    <div className="fraud-demo-head">
                        <div>
                            <h2>Prueba del antifraude</h2>
                            <p>
                                Envía {SOLICITUDES_DEMO} solicitudes de pago seguidas para un pedido, sin ir a WebPay.
                                Con 3 intentos en 10 segundos tu usuario queda bloqueado para pagar durante 30 minutos.
                            </p>
                        </div>
                        <div className="fraud-demo-controls">
                            <select
                                value={demoOrdenId || ordenesPagables[0]?.id}
                                onChange={(e) => setDemoOrdenId(e.target.value)}
                                disabled={demoCorriendo}
                                aria-label="Pedido para la prueba"
                            >
                                {ordenesPagables.map((o) => (
                                    <option key={o.id} value={o.id}>Pedido #{o.id} · {formatPrice(o.total)}</option>
                                ))}
                            </select>
                            <button className="btn btn-secondary btn-sm" onClick={handleDemoAntifraude} disabled={demoCorriendo}>
                                {demoCorriendo ? 'Enviando…' : `Enviar ${SOLICITUDES_DEMO} solicitudes`}
                            </button>
                        </div>
                    </div>
                    {demoResultados.length > 0 && (
                        <ol className="fraud-demo-results">
                            {demoResultados.map((r) => (
                                <li key={r.n} className={r.status === 429 ? 'is-blocked' : r.ok ? 'is-ok' : 'is-error'}>
                                    <span className="fraud-demo-code">{r.status || '—'}</span>
                                    <span>
                                        Solicitud {r.n}: {r.mensaje}
                                        {r.bloqueadoHasta && ` (hasta las ${new Date(r.bloqueadoHasta).toLocaleTimeString('es-CL')})`}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                    {!demoCorriendo && demoResultados.length > 0 && (
                        <p className="fraud-demo-note">
                            {demoBloqueado
                                ? 'El velocity check bloqueó al usuario. Revisa los tópicos pagos.intentos y pagos.alertas-fraude en Kafka UI, y el evento pedidos360.pago.bloqueado en Auditoría.'
                                : 'No hubo bloqueo: puede que el antifraude aún no procesara los intentos. Espera 10 segundos y vuelve a intentarlo.'}
                        </p>
                    )}
                </section>
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
                        <li
                            className={`order-card ${sePuedePagar(orden.estado) ? 'order-card-has-action' : ''}`}
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
                            {sePuedePagar(orden.estado) && (
                                <div className="order-card-actions">
                                    {pagosHabilitados() && (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handlePagar(orden)}
                                            disabled={pagandoId !== null || eliminandoId !== null}
                                        >
                                            {pagandoId === orden.id ? 'Redirigiendo…' : 'Pagar con WebPay'}
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleEliminar(orden)}
                                        disabled={pagandoId !== null || eliminandoId !== null}
                                    >
                                        {eliminandoId === orden.id ? 'Eliminando…' : 'Eliminar'}
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
