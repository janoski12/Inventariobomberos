import { NavLink } from "react-router-dom";
import { useState } from "react";

// Lista unica de enlaces: se usa tanto en la barra horizontal (escritorio)
// como en el menu lateral (celular), para que nunca queden desincronizados.
const LINKS = [
    { to: "/", label: "Inventario", end: true },
    { to: "/items/nuevo", label: "Nuevo Ítem" },
    { to: "/bomberos", label: "Bomberos" },
    { to: "/ubicaciones", label: "Ubicaciones" },
    { to: "/carros", label: "Carros" },
    { to: "/trauma", label: "Trauma" },
    { to: "/reportes", label: "Reportes" },
    { to: "/importar", label: "Importar" },
];

export default function NavBar({ esAdmin }) {
    const [open, setOpen] = useState(false);
    const cls       = ({ isActive }) => "nav-link" + (isActive ? " nav-link--active" : "");
    const clsDrawer = ({ isActive }) => "nav-drawer-link" + (isActive ? " nav-drawer-link--active" : "");

    const links = esAdmin ? [...LINKS, { to: "/usuarios", label: "Usuarios" }] : LINKS;

    return (
        <>
            {/* Barra horizontal: visible en escritorio. En celular se oculta por CSS
                y en su lugar queda solo el boton de hamburguesa. */}
            <div className="navbar">
                {links.map((l) => (
                    <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>
                ))}
                <button
                    className="nav-hamburger"
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Abrir menú"
                >
                    ☰
                </button>
            </div>

            {/* Menu lateral: solo aparece en celular (el boton que lo abre esta oculto en escritorio) */}
            {open && (
                <div className="nav-drawer-backdrop" onClick={() => setOpen(false)}>
                    <div className="nav-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="nav-drawer-header">
                            <span className="app-header-badge">CBT10</span>
                            <button className="modal-close" type="button" onClick={() => setOpen(false)}>X</button>
                        </div>
                        <div className="nav-drawer-links">
                            {links.map((l) => (
                                <NavLink
                                    key={l.to}
                                    to={l.to}
                                    end={l.end}
                                    className={clsDrawer}
                                    onClick={() => setOpen(false)}
                                >
                                    {l.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
