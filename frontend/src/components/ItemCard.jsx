const CHIP_ESTADO = {
    OPERATIVO:     "chip chip--operativo",
    MANTENCION:    "chip chip--mantencion",
    FUERA_SERVICIO:"chip chip--fuera_servicio",
    BAJA:          "chip chip--baja",
};

const CHIP_CRIT = {
    ALTA:  "chip chip--alta",
    MEDIA: "chip chip--media",
    BAJA:  "chip chip--baja-crit",
};

export default function ItemCard({ item, onClick }) {
    return (
        <div className="card clickable" onClick={onClick}>
            <div className="spread">
                <div>
                    <span className="item-code">{item.codigo}</span>
                    <span className="item-desc">{item.descripcion}</span>
                </div>
                <div className="row">
                    <span className={CHIP_CRIT[item.criticidad] ?? "chip"}>
                        {item.criticidad}
                    </span>
                    <span className={CHIP_ESTADO[item.estado] ?? "chip"}>
                        {item.estado?.replace("_", " ")}
                    </span>
                </div>
            </div>
            <div className="card-detail">
                <span>{item.categoria ?? "—"}</span>
                {" · "}
                <span>{item.ubicacion_nombre ?? item.bombero_nombre ?? "Sin ubicar"}</span>
            </div>
        </div>
    );
}
