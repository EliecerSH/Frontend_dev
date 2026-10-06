// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../AuthConfig';
import { useCart } from '../context/CartContext';
import { IconBolt, IconSearch, IconCart, IconMenu, IconClose } from './Icons';

const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;

export default function Navbar({ onSearch }) {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const activeAccount = accounts[0];
    const { itemCount } = useCart();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const closeMenu = () => setMenuOpen(false);

    const handleLogin = async () => {
        try {
            await instance.loginPopup(loginRequest);
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
        }
    };

    const handleLogout = () => {
        instance.logoutPopup({ postLogoutRedirectUri: window.location.origin });
    };

    const handleSubmitSearch = (e) => {
        e.preventDefault();
        onSearch?.(query.trim());
        navigate('/');
        closeMenu();
    };

    return (
        <header className="navbar">
            <div className="navbar-inner">
                <Link to="/" className="brand" onClick={closeMenu}>
                    <span className="brand-mark"><IconBolt size={16} /></span>
                    <span className="brand-name">Nexus<span className="brand-accent">Tech</span></span>
                </Link>

                <form className="navbar-search" onSubmit={handleSubmitSearch} role="search">
                    <input
                        type="search"
                        placeholder="Buscar notebooks, celulares, componentes…"
                        aria-label="Buscar productos"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" aria-label="Buscar">
                        <IconSearch size={18} />
                    </button>
                </form>

                <button
                    className="navbar-burger"
                    aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                    aria-expanded={menuOpen}
                    aria-controls="navbar-links"
                    onClick={() => setMenuOpen((v) => !v)}
                >
                    {menuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
                </button>

                <nav id="navbar-links" className={`navbar-links ${menuOpen ? 'open' : ''}`}>
                    <NavLink to="/" end className={navLinkClass} onClick={closeMenu}>Catálogo</NavLink>

                    {isAuthenticated && (
                        <NavLink to="/pedidos" className={navLinkClass} onClick={closeMenu}>Mis pedidos</NavLink>
                    )}

                    {isAuthenticated && (
                        <NavLink to="/admin" className={navLinkClass} onClick={closeMenu}>Administrar</NavLink>
                    )}

                    <NavLink to="/carrito" className={(s) => `${navLinkClass(s)} navbar-cart`} onClick={closeMenu}>
                        <IconCart size={19} />
                        Carrito
                        {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
                    </NavLink>

                    {isAuthenticated ? (
                        <div className="navbar-account">
                            <Link to="/cuenta" className="navbar-user" onClick={closeMenu}>
                                <span className="avatar">{activeAccount?.name?.charAt(0) || 'U'}</span>
                                <span className="navbar-user-name">{activeAccount?.name?.split(' ')[0]}</span>
                            </Link>
                            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                                Cerrar sesión
                            </button>
                        </div>
                    ) : (
                        <button className="btn btn-primary btn-sm" onClick={handleLogin}>
                            Iniciar sesión
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
}