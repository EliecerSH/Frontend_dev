// src/utils/format.js
const clp = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
});

export const formatPrice = (value) => clp.format(Number(value) || 0);

export const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        return new Intl.DateTimeFormat('es-CL', {
            dateStyle: 'medium',
            timeStyle: 'medium',
        }).format(date);
    } catch {
        return String(dateStr);
    }
};
