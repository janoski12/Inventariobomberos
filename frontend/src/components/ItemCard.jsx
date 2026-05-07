const CLASE_ESTADO = {
    OPERATIVO:     "text-operativo",
    MANTENCION:    "text-mantencion",
    FUERA_SERVICIO: "text-fuera-servicio",
    BAJA:          "text-baja-estado",
};

const CLASE_CRITICIDAD = {
    ALTA:  "text-alta",
    MEDIA: "text-media",
    BAJA:  "text-baja-crit",
};

export default function ItemCard({ item, onClick }) {
    return (
        <div className="card clickable" onClick={onClick}>
            <div className="spread">
                <div className="card-title">{item.codigo} — {item.descripcion}</div>
                <div className="row">
                    <span className={CLASE_CRITICIDAD[item.criticidad] ?? "card-muted"}>
                        {item.criticidad}
                    </span>
                    <span className={CLASE_ESTADO[item.estado] ?? "card-muted"}>
                        {item.estado}
                    </span>
                </div>
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
                <b>Cat:</b> {item.categoria ?? "—"} &nbsp;•&nbsp;
                <b>Ubicacion:</b> {item.ubicacion_nombre ?? "—"} &nbsp;•&nbsp;
                <b>Asignado:</b> {item.bombero_nombre ?? "—"}
            </div>
        </div>
    );
}
