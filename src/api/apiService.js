// src/api/apiService.js
// Capa de acceso a los microservicios: productos, carrito, usuarios, órdenes, auditoría,
// pagos (Webpay) y recomendaciones.
import { apiRequest, ENDPOINTS } from '../AuthConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Obtiene el access token del usuario activo (silencioso, con fallback a popup)
export const getAccessToken = async (msalInstance) => {
    const activeAccount = msalInstance.getActiveAccount();
    if (!activeAccount) throw new Error('No hay un usuario autenticado.');

    const request = { ...apiRequest, account: activeAccount };

    try {
        const response = await msalInstance.acquireTokenSilent(request);
        return response.accessToken;
    } catch (error) {
        const response = await msalInstance.acquireTokenPopup(request);
        return response.accessToken;
    }
};

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

// Lee el cuerpo de una respuesta de error de forma segura (puede venir vacío o no ser JSON)
const parseError = async (res, fallback) => {
    try {
        const data = await res.json();
        return data?.mensaje || data?.message || data?.error || fallback;
    } catch {
        return fallback;
    }
};

// ---------------------------------------------------------------------------
// MS-PRODUCTOS
// ---------------------------------------------------------------------------

// GET /productos -> catálogo completo (público)
export const fetchProductos = async () => {
    const res = await fetch(ENDPOINTS.PRODUCTOS);
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener los productos'));
    return res.json();
};

// GET /productos/{id} (público)
export const fetchProductoPorId = async (id) => {
    const res = await fetch(`${ENDPOINTS.PRODUCTOS}/${id}`);
    if (!res.ok) throw new Error(await parseError(res, 'Producto no encontrado'));
    return res.json();
};

// GET /productos/categoria/{categoria} (público)
export const fetchProductosPorCategoria = async (categoria) => {
    const res = await fetch(`${ENDPOINTS.PRODUCTOS}/categoria/${encodeURIComponent(categoria)}`);
    if (!res.ok) throw new Error(await parseError(res, 'Error al filtrar por categoría'));
    return res.json();
};

// POST /productos (protegido)
export const crearProducto = async (msalInstance, producto) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.PRODUCTOS, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(producto),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al crear el producto'));
    return res.json();
};

// PUT /productos/{id} (protegido)
export const actualizarProducto = async (msalInstance, id, producto) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.PRODUCTOS}/${id}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(producto),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al actualizar el producto'));
    return res.json();
};

// DELETE /productos/{id} (protegido)
export const eliminarProducto = async (msalInstance, id) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.PRODUCTOS}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al eliminar el producto'));
    return true;
};

// ---------------------------------------------------------------------------
// MS-CARRITO (todo protegido)
// ---------------------------------------------------------------------------

// GET /carrito
export const fetchCarrito = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.CARRITO, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener el carrito'));
    return res.json();
};

// POST /carrito/items -> suma "cantidad" al producto (lo crea si no existía)
export const agregarAlCarrito = async (msalInstance, productoId, cantidad) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.CARRITO}/items`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ productoId, cantidad }),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al agregar el producto al carrito'));
    return res.json();
};

// DELETE /carrito/items/{productoId}
export const eliminarDelCarrito = async (msalInstance, productoId) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.CARRITO}/items/${productoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al eliminar el producto del carrito'));
    return res.json();
};

// El backend no expone un PUT para fijar una cantidad absoluta: solo sabe "sumar".
// Para editar la cantidad desde la UI, se elimina el ítem y se vuelve a agregar
// con la cantidad final deseada.
export const actualizarCantidadCarrito = async (msalInstance, productoId, nuevaCantidad) => {
    await eliminarDelCarrito(msalInstance, productoId);
    if (nuevaCantidad > 0) {
        return agregarAlCarrito(msalInstance, productoId, nuevaCantidad);
    }
    return fetchCarrito(msalInstance);
};

// DELETE /carrito -> vacía todo el carrito
export const vaciarCarrito = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.CARRITO, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al vaciar el carrito'));
    return true;
};

// ---------------------------------------------------------------------------
// MS-ORDENES (todo protegido)
// ---------------------------------------------------------------------------

// POST /ordenes -> registra formalmente la orden a partir del snapshot del carrito.
// Dispara el flujo asíncrono: descuento de stock, envío de correo y auditoría.
export const crearOrden = async (msalInstance, items) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.ORDENES, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
            items: items.map((it) => ({
                productoId: it.productoId,
                cantidad: it.cantidad,
                precioUnitario: it.precioUnitario,
            })),
        }),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al procesar la orden'));
    return res.json();
};

// GET /ordenes -> historial de compras del usuario autenticado
export const fetchOrdenes = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.ORDENES, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener tus pedidos'));
    return res.json();
};

// ---------------------------------------------------------------------------
// MS-USUARIOS (todo protegido, salvo lo indicado)
// ---------------------------------------------------------------------------

// GET /usuarios/me -> claims del JWT (siempre disponible si hay sesión)
export const fetchClaimsUsuario = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.USUARIOS}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener el usuario autenticado'));
    return res.json();
};

// GET /usuarios/me/perfil -> perfil del usuario autenticado (por su OID de Azure). null si aún no existe
export const fetchMiPerfil = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.USUARIOS}/me/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener el perfil'));
    return res.json();
};

// GET /usuarios/{id}
export const fetchUsuario = async (msalInstance, id) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.USUARIOS}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al obtener el perfil'));
    return res.json();
};

// POST /usuarios -> registra el perfil (rol y azureOid se fuerzan en el backend)
export const registrarUsuario = async (msalInstance, datosPerfil) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(ENDPOINTS.USUARIOS, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(datosPerfil),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al registrar el perfil'));
    return res.json();
};

// PUT /usuarios/{id}
export const actualizarUsuario = async (msalInstance, id, datosPerfil) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.USUARIOS}/${id}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(datosPerfil),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al actualizar el perfil'));
    return res.json();
};

// ---------------------------------------------------------------------------
// MS-AUDITORIA (protegido - solo rol Admin)
// ---------------------------------------------------------------------------

const getAuditoriaUrl = () => {
    const raw = (ENDPOINTS.AUDITORIA || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    if (raw.endsWith('/auditoria')) return raw;
    return `${raw}/api/v1/auditoria`;
};

// GET /api/v1/auditoria -> registros ordenados por recibidoEn descendente
export const fetchAuditoria = async (msalInstance) => {
    const token = await getAccessToken(msalInstance);
    const url = getAuditoriaUrl();
    if (!url) {
        throw new Error('La URL del microservicio de auditoría no está configurada (VITE_MS_AUDITORIA_URL).');
    }

    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        if (res.status === 403) {
            throw new Error('Acceso denegado por el microservicio: Se requiere el rol Admin en el token para ver la auditoría.');
        }
        throw new Error(await parseError(res, 'Error al obtener los registros de auditoría'));
    }

    return res.json();
};

// DELETE /ordenes/{id} -> elimina un pedido no pagado (PENDIENTE_PAGO o PAGO_RECHAZADO)
export const eliminarOrden = async (msalInstance, ordenId) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.ORDENES}/${ordenId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'No se pudo eliminar el pedido'));
};

// ---------------------------------------------------------------------------
// MS-PAGOS (Backend_dev03) - Webpay Plus + antifraude
// ---------------------------------------------------------------------------

export const pagosHabilitados = () => Boolean((ENDPOINTS.PAGOS || '').trim());

// POST /api/pagos/iniciar -> { orderId, url, token }. El monto lo calcula el backend desde ms-ordenes.
// 429 = bloqueo antifraude (demasiados intentos seguidos).
export const iniciarPago = async (msalInstance, orderId) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.PAGOS}/iniciar`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ orderId }),
    });
    if (!res.ok) {
        const mensaje = await parseError(res, 'No se pudo iniciar el pago');
        const error = new Error(mensaje);
        error.status = res.status;
        throw error;
    }
    return res.json();
};

// Solo para la demo del antifraude: hace la misma llamada que iniciarPago pero NO lanza error
// ni redirige a Webpay; devuelve el código HTTP y el mensaje para mostrarlos en pantalla.
export const probarIntentoPago = async (msalInstance, orderId) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.PAGOS}/iniciar`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ orderId }),
    });
    let data = null;
    try {
        data = await res.json();
    } catch {
        /* sin cuerpo */
    }
    return {
        status: res.status,
        ok: res.ok,
        mensaje: data?.message || data?.mensaje || (res.ok ? 'Transacción Webpay lista' : res.statusText),
        bloqueadoHasta: data?.blockedUntil || null,
    };
};

// Webpay exige un POST de formulario con el campo token_ws (no GET, no fetch).
export const redirigirAWebpay = ({ url, token }) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token_ws';
    input.value = token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
};

// GET /api/pagos/orden/{orderId} -> estado del pago (null si la orden aún no tiene pago)
export const fetchEstadoPago = async (msalInstance, orderId) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.PAGOS}/orden/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await parseError(res, 'No se pudo consultar el pago'));
    return res.json();
};

// ---------------------------------------------------------------------------
// MS-RECOMENDACIONES (Backend_dev03)
// ---------------------------------------------------------------------------

export const recomendacionesHabilitadas = () => Boolean((ENDPOINTS.RECOMENDACIONES || '').trim());

// GET /me (autenticado) -> { estrategia, items: [...] }
export const fetchMisRecomendaciones = async (msalInstance, limit = 8) => {
    const token = await getAccessToken(msalInstance);
    const res = await fetch(`${ENDPOINTS.RECOMENDACIONES}/me?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await parseError(res, 'No se pudieron cargar las recomendaciones'));
    return res.json();
};

// GET /populares (público)
export const fetchPopulares = async (limit = 8) => {
    const res = await fetch(`${ENDPOINTS.RECOMENDACIONES}/populares?limit=${limit}`);
    if (!res.ok) throw new Error(await parseError(res, 'No se pudieron cargar los productos populares'));
    return res.json();
};

// GET /productos/{id}/similares (público)
export const fetchSimilares = async (productoId, limit = 4) => {
    const res = await fetch(`${ENDPOINTS.RECOMENDACIONES}/productos/${productoId}/similares?limit=${limit}`);
    if (!res.ok) throw new Error(await parseError(res, 'No se pudieron cargar productos similares'));
    return res.json();
};

// POST /interacciones { productoId, accion: VISTA | CARRITO }. "Fire and forget": un fallo
// del motor de recomendaciones nunca debe interrumpir la compra.
export const registrarInteraccion = async (msalInstance, productoId, accion) => {
    if (!recomendacionesHabilitadas()) return;
    try {
        const token = await getAccessToken(msalInstance);
        await fetch(`${ENDPOINTS.RECOMENDACIONES}/interacciones`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ productoId, accion }),
        });
    } catch (err) {
        console.warn('No se pudo registrar la interacción', err);
    }
};
