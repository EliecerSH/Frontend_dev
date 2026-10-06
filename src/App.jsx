import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import Account from './pages/Account'
import Admin from './pages/Admin'
import Audit from './pages/Audit'
import { useUserRole } from './context/RoleContext'

function AdminRoute({ children }) {
  const { isAdmin, loadingRole } = useUserRole();

  if (loadingRole) {
    return <div className="page state-message" role="status">Verificando permisos…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="page state-message state-error" role="alert">
        Acceso restringido: Se requieren permisos de Administrador para acceder a esta sección.
      </div>
    );
  }

  return children;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="app-shell">
      <Navbar onSearch={setSearchQuery} />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home searchQuery={searchQuery} />} />
          <Route path="/producto/:id" element={<ProductDetail />} />
          <Route path="/carrito" element={<Cart />} />
          <Route
            path="/pedidos"
            element={
              <>
                <AuthenticatedTemplate>
                  <Orders />
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                  <div className="page state-message">Inicia sesión para ver tus pedidos.</div>
                </UnauthenticatedTemplate>
              </>
            }
          />
          <Route
            path="/cuenta"
            element={
              <>
                <AuthenticatedTemplate>
                  <Account />
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                  <div className="page state-message">Inicia sesión para ver tu cuenta.</div>
                </UnauthenticatedTemplate>
              </>
            }
          />
          <Route
            path="/admin"
            element={
              <>
                <AuthenticatedTemplate>
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                  <div className="page state-message">Inicia sesión para administrar el catálogo.</div>
                </UnauthenticatedTemplate>
              </>
            }
          />
          <Route
            path="/auditoria"
            element={
              <>
                <AuthenticatedTemplate>
                  <AdminRoute>
                    <Audit />
                  </AdminRoute>
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                  <div className="page state-message">Inicia sesión como Administrador para ver los registros de auditoría.</div>
                </UnauthenticatedTemplate>
              </>
            }
          />
          <Route path="*" element={<div className="page state-message">Página no encontrada.</div>} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}