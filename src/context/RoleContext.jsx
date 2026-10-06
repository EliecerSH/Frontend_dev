// src/context/RoleContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { apiRequest } from '../AuthConfig';
import { extractRoles, isUserAdmin, parseJwt } from '../utils/auth';

const RoleContext = createContext({
    roles: [],
    isAdmin: false,
    loadingRole: false,
});

export function RoleProvider({ children }) {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const activeAccount = accounts[0] || instance.getActiveAccount();

    const [roles, setRoles] = useState(() => {
        if (!isAuthenticated || !activeAccount) return [];
        return extractRoles(activeAccount.idTokenClaims);
    });
    const [loadingRole, setLoadingRole] = useState(isAuthenticated);

    useEffect(() => {
        let isMounted = true;

        if (!isAuthenticated || !activeAccount) {
            setRoles([]);
            setLoadingRole(false);
            return;
        }

        // 1. Roles iniciales inmediatos desde los claims del ID Token almacenado en MSAL
        const idRoles = extractRoles(activeAccount.idTokenClaims);
        if (idRoles.length > 0) {
            setRoles(idRoles);
        }

        setLoadingRole(true);

        // 2. Extraer roles leyendo el Access Token decodificado silenciosamente
        const inspectAccessToken = async () => {
            const combinedRoles = new Set(idRoles);

            try {
                const tokenResponse = await instance.acquireTokenSilent({
                    ...apiRequest,
                    account: activeAccount,
                });

                if (tokenResponse?.accessToken) {
                    const tokenPayload = parseJwt(tokenResponse.accessToken);
                    const accessRoles = extractRoles(tokenPayload);
                    accessRoles.forEach((r) => combinedRoles.add(r));
                }
            } catch (err) {
                // Si la adquisición silenciosa falla, se conservan los roles de idTokenClaims
                console.debug('No fue posible leer el Access Token en segundo plano:', err);
            }

            if (isMounted) {
                setRoles(Array.from(combinedRoles));
                setLoadingRole(false);
            }
        };

        inspectAccessToken();

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, activeAccount, instance]);

    const isAdmin = useMemo(() => isUserAdmin(roles), [roles]);

    const value = useMemo(
        () => ({
            roles,
            isAdmin,
            loadingRole,
        }),
        [roles, isAdmin, loadingRole]
    );

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useUserRole() {
    const ctx = useContext(RoleContext);
    if (!ctx) {
        throw new Error('useUserRole debe usarse dentro de un <RoleProvider>');
    }
    return ctx;
}
