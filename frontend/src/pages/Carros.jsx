import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarCarros, descargarQRRevision } from "../api/carros";
import { useDialog } from "../context/DialogContext";

export default function Carros() {
  const { toast } = useDialog();
  const [carros, setCarros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listarCarros()
      .then(setCarros)
      .catch(() => setError("No se pudieron cargar los carros."))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error) return <div className="container"><p className="error">{error}</p></div>;

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Carros</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        Ítems asignados a los carros de bomberos, con su ubicación exacta (gaveta o
        compartimiento) y el historial de revisiones físicas.
      </p>

      {carros.length === 0 ? (
        <p className="muted">No hay ubicaciones de tipo CARRO registradas todavía.</p>
      ) : (
        <div className="stack">
          {carros.map((c) => (
            <div key={c.id} className="card">
              <div className="spread">
                <div>
                  <Link to={`/carros/${c.id}`} className="bombero-link">{c.nombre}</Link>
                  <div className="card-muted">
                    {c.total_items} ítem{c.total_items !== 1 ? "s" : ""}
                    {c.items_no_operativos > 0 && (
                      <span className="badge-danger" style={{ marginLeft: 8 }}>
                        {c.items_no_operativos} no operativo{c.items_no_operativos !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="card-detail">
                    {c.ultima_revision ? (
                      <>
                        Última revisión: {c.ultima_revision.fecha} por {c.ultima_revision.realizada_por}
                        {c.ultima_revision.fallas > 0 && (
                          <span className="badge-warning" style={{ marginLeft: 8 }}>
                            {c.ultima_revision.fallas} observación{c.ultima_revision.fallas !== 1 ? "es" : ""}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="badge-neutral">Sin revisiones registradas</span>
                    )}
                  </div>
                </div>
                <div className="row">
                  <Link to={`/carros/${c.id}`} className="btn-light">Ver ficha</Link>
                  <button
                    className="btn-light"
                    onClick={async () => {
                      try { await descargarQRRevision(c.id, c.nombre); }
                      catch { toast("No se pudo descargar el QR de revisión."); }
                    }}
                  >
                    QR de revisión
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
