import { Link } from "react-router-dom";

export default function NavBar() {
    return(
        <div className="row" style={{ marginBottom: 14 }}>
            <Link to="/" className="btn" style={{textDecoration: "none" }}>Buscar</Link>
            <Link to="/items/nuevo" className="btn" style={{textDecoration: "none" }}>Nuevo Item</Link>
            <Link to="/bomberos" className="btn" style={{textDecoration: "none" }}>Bomberos</Link>
            <Link to="/ubicaciones" className="btn" style={{textDecoration: "none" }}>Ubicaciones</Link>
            <Link to="/reportes" className="btn" style={{textDecoration: "none" }}>Reportes</Link>
        </div>
    );
}