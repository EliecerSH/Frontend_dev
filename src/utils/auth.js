// src/utils/auth.js

/**
 * Decodifica el payload de un token JWT en formato JSON.
 * Maneja cadenas en formato Base64Url de forma segura para navegadores.
 *
 * @param {string} token - Token JWT completo (ej: eyJhbGciOi...)
 * @returns {object|null} - Payload del token decodificado o null si no es válido.
 */
export function parseJwt(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(window.atob(base64));
        } catch {
            return null;
        }
    }
}

/**
 * Extrae una lista de roles normalizados a partir de los claims de un token (ID Token o Access Token).
 * Soporta múltiples convenciones de nombres de claims (roles, role, rol, extensiones o URIs de Azure/WS-Fed).
 *
 * @param {object} claims - Objeto con los claims del token decodificado.
 * @returns {string[]} - Arreglo de roles encontrados (ej: ['Admin'] o ['User']).
 */
export function extractRoles(claims) {
    if (!claims || typeof claims !== 'object') return [];

    const candidateKeys = [
        'roles',
        'role',
        'rol',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
        'extension_Role',
        'extension_rol',
    ];

    const found = [];

    for (const key of candidateKeys) {
        const val = claims[key];
        if (!val) continue;

        if (Array.isArray(val)) {
            for (const item of val) {
                if (typeof item === 'string') {
                    item.split(',').forEach((s) => {
                        const clean = s.trim();
                        if (clean) found.push(clean);
                    });
                }
            }
        } else if (typeof val === 'string') {
            val.split(',').forEach((s) => {
                const clean = s.trim();
                if (clean) found.push(clean);
            });
        }
    }

    return Array.from(new Set(found));
}

/**
 * Determina si dentro de la lista de roles proporcionada existe el rol de Administrador.
 * No distingue entre mayúsculas y minúsculas y valida variantes comunes ('Admin', 'Administrator', 'Administrador').
 *
 * @param {string[]} roles - Lista de roles del usuario.
 * @returns {boolean} - true si posee rol de Administrador, false en caso contrario.
 */
export function isUserAdmin(roles) {
    if (!roles || !Array.isArray(roles)) return false;
    return roles.some((r) => {
        const normalized = String(r).trim().toLowerCase();
        return (
            normalized === 'admin' ||
            normalized === 'administrator' ||
            normalized === 'administrador'
        );
    });
}
