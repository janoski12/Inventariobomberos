import { useState } from "react";
import { importarExcel } from "../api/importar";

export default function Importar() {
  const [archivo, setArchivo]       = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado]   = useState(null);
  const [error, setError]           = useState("");
  const [inputKey, setInputKey]     = useState(0);

  function seleccionarArchivo(e) {
    const file = e.target.files[0] ?? null;
    setArchivo(file);
    setResultado(null);
    setError("");
  }

  async function handleImportar() {
    if (!archivo || !confirmado || importando) return;
    try {
      setImportando(true);
      setError("");
      setResultado(null);
      const data = await importarExcel(archivo);
      setResultado(data.resumen);
      setArchivo(null);
      setConfirmado(false);
      setInputKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="container">
      <h2>Importar desde Excel</h2>
      <p className="muted">Carga la plantilla completada para reemplazar todos los datos del sistema.</p>

      <div className="importar-aviso">
        <strong>Atención:</strong> Esta operación borrará y reemplazará <strong>todos</strong> los
        datos existentes (ítems, bomberos, ubicaciones y controles). Esta acción no se puede deshacer.
      </div>

      <div className="stack importar-zona">
        <div>
          <label className="importar-label" htmlFor="input-excel">
            {archivo ? `📄 ${archivo.name}` : "Seleccionar archivo .xlsx"}
          </label>
          <input
            key={inputKey}
            id="input-excel"
            type="file"
            accept=".xlsx,.xls"
            className="importar-input"
            onChange={seleccionarArchivo}
          />
        </div>

        {archivo && (
          <p className="muted">{(archivo.size / 1024).toFixed(1)} KB</p>
        )}

        <label className="importar-check">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
          />
          Entiendo que se borrarán todos los datos actuales
        </label>

        <div>
          <button
            className="btn"
            disabled={!archivo || !confirmado || importando}
            onClick={handleImportar}
          >
            {importando ? "Importando..." : "Importar datos"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {resultado && (
          <div className="importar-resumen">
            <p className="importar-resumen-titulo">Importación completada correctamente</p>
            <div className="reporte-grid">
              <div className="card">
                <div className="stat-number text-total">{resultado.bomberos}</div>
                <div className="stat-label">Bomberos importados</div>
              </div>
              <div className="card">
                <div className="stat-number text-total">{resultado.ubicaciones}</div>
                <div className="stat-label">Ubicaciones importadas</div>
              </div>
              <div className="card">
                <div className="stat-number text-total">{resultado.items}</div>
                <div className="stat-label">Ítems importados</div>
              </div>
              <div className="card">
                <div className="stat-number text-total">{resultado.controles}</div>
                <div className="stat-label">Controles importados</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
