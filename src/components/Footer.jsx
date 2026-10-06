// src/components/Footer.jsx
import React from 'react';
import { IconBolt } from './Icons';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <div className="brand">
                        <span className="brand-mark"><IconBolt size={16} /></span>
                        <span className="brand-name">Nexus<span className="brand-accent">Tech</span></span>
                    </div>
                    <p>Tecnología y electrónica al mejor precio.</p>
                </div>
                <div className="footer-col">
                    <h4>Categorías</h4>
                    <ul>
                        <li>Notebooks</li>
                        <li>Celulares</li>
                        <li>Componentes</li>
                        <li>Audio</li>
                        <li>Gaming</li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Ayuda</h4>
                    <ul>
                        <li>Envíos</li>
                        <li>Cambios y devoluciones</li>
                        <li>Garantía</li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                © {new Date().getFullYear()} NexusTech. Todos los derechos reservados.
            </div>
        </footer>
    );
}