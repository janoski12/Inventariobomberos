import { NavLink } from "react-router-dom";

export default function NavBar({ esAdmin }) {
    const cls = ({ isActive }) => "nav-link" + (isActive ? " nav-link--active" : "");
    return (
        <div className="navbar">
            <NavLink to="/" end className={cls}>Inventario</NavLink>
            <NavLink to="/items/nuevo" className={cls}>Nuevo Ítem</NavLink>
            <NavLink to="/bomberos" className={cls}>Bomberos</NavLink>
            <NavLink to="/ubicaciones" className={cls}>Ubicaciones</NavLink>
            <NavLink to="/carros" className={cls}>Carros</NavLink>
            <NavLink to="/trauma" className={cls}>Trauma</NavLink>
            <NavLink to="/reportes" className={cls}>Reportes</NavLink>
            <NavLink to="/importar" className={cls}>Importar</NavLink>
            {esAdmin && <NavLink to="/usuarios" className={cls}>Usuarios</NavLink>}
        </div>
    );
}
