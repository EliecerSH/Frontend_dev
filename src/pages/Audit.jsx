// src/pages/Audit.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { fetchAuditoria } from '../api/apiService';
import { useUserRole } from '../context/RoleContext';
import { formatDateTime } from '../utils/format';
import { IconActivity, IconCopy, IconRefresh, IconSearch, IconLock } from '../components/Icons';

// Asigna un estilo visual al badge según el tipo de evento
const getEventBadgeClass = (tipo = '') => {
    const t = String(tipo).toLowerCase();
    if (t.includes('orden') || t.includes('cread')) return 'badge-audit-order';
    if (t.includes('stock') || t.includes('inventario')) return 'badge-audit-stock';
    if (t.includes('error') || t.includes('fall')) return 'badge-audit-error';
    if (t.includes('usuario') || t.includes('user')) return 'badge-audit-user';
    return 'badge-audit-default';
};

export default function Audit() {
    const { instance } = useMsal();
    const { isAdmin, loadingRole } = useUserRole();

    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [tipoSeleccionado, setTipoSeleccionado] = useState('Todos');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [copiedId, setCopiedId] = useState(null);

    const cargarAuditoria = async () => {
        if (!isAdmin) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAuditoria(instance);
            setRegistros(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loadingRole && isAdmin) {
            cargarAuditoria();
        } else if (!loadingRole && !isAdmin) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, loadingRole]);

    // Tipos de evento únicos para el filtrado
    const tiposDisponibles = useMemo(() => {
        const set = new Set(registros.map((r) => r.tipoEvento).filter(Boolean));
        return ['Todos', ...Array.from(set)];
    }, [registros]);

    // Filtrado de eventos
    const registrosFiltrados = useMemo(() => {
        return registros.filter((reg) => {
            const coincideTipo = tipoSeleccionado === 'Todos' || reg.tipoEvento === tipoSeleccionado;
            const q = busqueda.trim().toLowerCase();
            const coincideBusqueda =
                !q ||
                String(reg.id).includes(q) ||
                (reg.tipoEvento && reg.tipoEvento.toLowerCase().includes(q)) ||
                (reg.payload && reg.payload.toLowerCase().includes(q));
            return coincideTipo && coincideBusqueda;
        });
    }, [registros, tipoSeleccionado, busqueda]);

    const toggleExpand = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCopyPayload = (id, payload) => {
        try {
            navigator.clipboard.writeText(payload);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // fallback
        }
    };

    const formatearJson = (jsonStr) => {
        try {
            const parsed = JSON.parse(jsonStr);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonStr;
        }
    };

    if (loadingRole) {
        return <div className="page state-message" role="status">Verificando permisos…</div>;
    }

    if (!isAdmin) {
        return (
            <div className="page audit-page">
                <div className="empty-state">
                    <div className="empty-state-icon"><IconLock size={28} /></div>
                    <h3>Acceso restringido</h3>
                    <p>Esta sección es de uso exclusivo para Administradores de la plataforma.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page audit-page">
            <header className="page-header audit-header">
                <div>
                    <h1>Auditoría del Sistema</h1>
                    <p>Trazabilidad de eventos asíncronos procesados desde RabbitMQ en el microservicio de auditoría.</p>
                </div>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={cargarAuditoria}
                    disabled={loading}
                    title="Actualizar eventos"
                >
                    <IconRefresh size={16} />
                    {loading ? 'Cargando…' : 'Refrescar'}
                </button>
            </header>

            {/* Métricas rápidas */}
            <div className="audit-metrics">
                <div className="card audit-metric-card">
                    <span className="metric-title">Total de Eventos</span>
                    <span className="metric-value">{registros.length}</span>
                </div>
                <div className="card audit-metric-card">
                    <span className="metric-title">Tipos Distintos</span>
                    <span className="metric-value">{tiposDisponibles.length > 1 ? tiposDisponibles.length - 1 : 0}</span>
                </div>
                <div className="card audit-metric-card">
                    <span className="metric-title">Último Evento</span>
                    <span className="metric-value metric-date">
                        {registros[0]?.recibidoEn ? formatDateTime(registros[0].recibidoEn) : 'Ninguno'}
                    </span>
                </div>
            </div>

            {/* Barra de herramientas y filtros */}
            <div className="audit-toolbar card">
                <div className="audit-search-box">
                    <IconSearch size={18} />
                    <input
                        type="search"
                        placeholder="Buscar por ID, routing key o contenido del JSON…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="category-chips" role="group" aria-label="Filtrar por tipo de evento">
                    {tiposDisponibles.map((tipo) => (
                        <button
                            key={tipo}
                            className={`chip ${tipoSeleccionado === tipo ? 'chip-active' : ''}`}
                            onClick={() => setTipoSeleccionado(tipo)}
                        >
                            {tipo}
                        </button>
                    ))}
                </div>
            </div>

            {loading && <p className="state-message" role="status">Cargando eventos de auditoría…</p>}
            {error && <p className="state-message state-error" role="alert">{error}</p>}

            {!loading && !error && registrosFiltrados.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon"><IconActivity size={28} /></div>
                    <h3>No se encontraron registros de auditoría</h3>
                    <p>
                        {busqueda || tipoSeleccionado !== 'Todos'
                            ? 'No hay eventos que coincidan con los criterios de búsqueda seleccionados.'
                            : 'Aún no hay eventos registrados en la base de datos de auditoría.'}
                    </p>
                </div>
            )}

            {!loading && !error && registrosFiltrados.length > 0 && (
                <div className="audit-list">
                    {registrosFiltrados.map((item) => {
                        const isExpanded = expandedIds.has(item.id);
                        return (
                            <article key={item.id} className="audit-card card">
                                <div className="audit-card-header">
                                    <div className="audit-card-meta">
                                        <span className="audit-id">#{item.id}</span>
                                        <span className={`audit-badge ${getEventBadgeClass(item.tipoEvento)}`}>
                                            {item.tipoEvento}
                                        </span>
                                    </div>
                                    <time className="audit-timestamp" dateTime={item.recibidoEn}>
                                        {formatDateTime(item.recibidoEn)}
                                    </time>
                                </div>

                                <div className="audit-card-body">
                                    <div className="audit-actions">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => toggleExpand(item.id)}
                                        >
                                            {isExpanded ? 'Ocultar Payload' : 'Ver Payload JSON'}
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleCopyPayload(item.id, item.payload)}
                                            title="Copiar JSON al portapapeles"
                                        >
                                            <IconCopy size={14} />
                                            {copiedId === item.id ? 'Copiado' : 'Copiar JSON'}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <pre className="audit-payload-code">
                                            <code>{formatearJson(item.payload)}</code>
                                        </pre>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
