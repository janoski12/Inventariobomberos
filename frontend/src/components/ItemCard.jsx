export default function ItemCard({ item, onClick }) {

    return (
        <div className="card clickable" onClick={onClick}>
            <div className="spread">
                <div className="card-title">
                    {item.codigo} - {item.descripcion}
                </div>
                <div className="muted">{item.estado}</div>
            </div>
                <div className="card-muted" style={{ marginTop: 6}}>
                    <b>Ubicacion:</b> {item.ubicacion_nombre ?? "      "} &nbsp;•&nbsp;
                    <b>Asignado:</b> {item.bombero_nombre ?? "      "}
                </div>
        </div>
    );
}