import { useState } from "react";
import { importarExcel, importarParcial, descargarPlantilla, descargarPlantillaParcial } from "../api/importar";

export default function Importar() {
  const [archivo, setArchivo]       = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado]   = useState(null);
  const [error, setError]           = useState("");
  const [inputKey, setInputKey]     = useState(0);
  const [descargando, setDescargando] = useState(false);

  async function handleDescargarCompleta() {
    try {
      setDescargando(true);
      await descargarPlantilla();
    } catch {
      alert("No se pudo descargar la plantilla.");
    } finally {
      setDescargando(false);
    }
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
      <h2>Importar datos</h2>
      <p className="muted">Carga o actualiza datos del sistema mediante archivos Excel.</p>

      {/* ── CARGA COMPLETA ── */}
      <p className="importar-seccion-label">Carga completa</p>

      <div className="importar-aviso">
        <strong>Atención:</strong> Esta operación borrará y reemplazará <strong>todos</strong> los
        datos existentes (ítems, bomberos, ubicaciones y controles). Esta acción no se puede deshacer.
      </div>

      <div className="stack importar-zona">
        <div>
          <label className="importar-label" htmlFor="input-excel">
            {archivo ? archivo.name : "Seleccionar archivo .xlsx"}
          </label>
          <input
            key={inputKey}
            id="input-excel"
            type="file"
            accept=".xlsx,.xls"
            className="importar-input"
            onChange={(e) => { setArchivo(e.target.files[0] ?? null); setResultado(null); setError(""); }}
          />
        </div>

        {archivo && <p className="muted">{(archivo.size / 1024).toFixed(1)} KB</p>}

        <label className="importar-check">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
          Entiendo que se borrarán todos los datos actuales
        </label>

        <div className="row">
          <button className="btn" disabled={!archivo || !confirmado || importando} onClick={handleImportar}>
            {importando ? "Importando..." : "Importar datos"}
          </button>
          <button className="btn-light" disabled={descargando} onClick={handleDescargarCompleta}>
            {descargando ? "Descargando..." : "Descargar plantilla completa"}
          </button>
        </div>

        {error && <ErrorImport mensaje={error} />}

        {resultado && (
          <div className="importar-resumen">
            <p className="importar-resumen-titulo">Importación completada correctamente</p>
            <div className="reporte-grid">
              <div className="card"><div className="stat-number text-total">{resultado.bomberos}</div><div className="stat-label">Bomberos</div></div>
              <div className="card"><div className="stat-number text-total">{resultado.ubicaciones}</div><div className="stat-label">Ubicaciones</div></div>
              <div className="card"><div className="stat-number text-total">{resultado.items}</div><div className="stat-label">Ítems</div></div>
              <div className="card"><div className="stat-number text-total">{resultado.controles}</div><div className="stat-label">Controles</div></div>
            </div>
          </div>
        )}
      </div>

      {/* ── IMPORTACIÓN PARCIAL ── */}
      <hr className="importar-seccion-div" />
      <p className="importar-seccion-label">Importación parcial</p>
      <p className="muted">
        Agrega o actualiza solo una sección. No borra datos existentes — los registros con el mismo
        nombre/código se actualizan, los nuevos se insertan.
        Orden recomendado: <strong>Ubicaciones → Bomberos → Ítems</strong>.
      </p>

      <div className="stack importar-parcial-stack">
        <SeccionParcial
          titulo="Ubicaciones"
          descripcion="Upsert por nombre. Tipos válidos: BODEGA, SALA, CARRO, CASILLERO, CONTAINER, SALON, OTRO."
          seccion="ubicaciones"
        />
        <SeccionParcial
          titulo="Bomberos"
          descripcion="Upsert por nombre. Estados válidos: ACTIVO, INACTIVO."
          seccion="bomberos"
        />
        <SeccionParcial
          titulo="Ítems"
          descripcion="Upsert por código. Incluye hoja Controles (opcional, siempre aditiva)."
          seccion="items"
          nota="Los bomberos y ubicaciones referenciados deben existir en el sistema antes de importar."
        />
      </div>
    </div>
  );
}

function SeccionParcial({ titulo, descripcion, seccion, nota }) {
  const [archivo, setArchivo]         = useState(null);
  const [importando, setImportando]   = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [resultado, setResultado]     = useState(null);
  const [error, setError]             = useState("");
  const [inputKey, setInputKey]       = useState(0);

  async function handleDescargar() {
    try {
      setDescargando(true);
      await descargarPlantillaParcial(seccion);
    } catch {
      alert("No se pudo descargar la plantilla.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleImportar() {
    if (!archivo || importando) return;
    try {
      setImportando(true);
      setError("");
      setResultado(null);
      const data = await importarParcial(seccion, archivo);
      setResultado(data.resumen);
      setArchivo(null);
      setInputKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="card">
      <div className="spread">
        <div>
          <div className="card-title">{titulo}</div>
          <div className="card-muted">{descripcion}</div>
        </div>
        <button className="btn-light" disabled={descargando} onClick={handleDescargar}>
          {descargando ? "..." : "Plantilla"}
        </button>
      </div>

      <div className="importar-parcial-body">
        <label className="importar-label" htmlFor={`input-${seccion}`}>
          {archivo ? archivo.name : "Seleccionar .xlsx"}
        </label>
        <input
          key={inputKey}
          id={`input-${seccion}`}
          type="file"
          accept=".xlsx,.xls"
          className="importar-input"
          onChange={(e) => { setArchivo(e.target.files[0] ?? null); setResultado(null); setError(""); }}
        />
        <button className="btn" disabled={!archivo || importando} onClick={handleImportar}>
          {importando ? "Importando..." : "Importar"}
        </button>
      </div>

      {nota && <p className="muted importar-nota">{nota}</p>}
      {error && <ErrorImport mensaje={error} />}
      {resultado && <ResumenParcial resumen={resultado} />}
    </div>
  );
}

function ResumenParcial({ resumen }) {
  return (
    <div className="importar-parcial-resumen">
      {resumen.insertados > 0 && <span className="resultado-aprobado">{resumen.insertados} nuevos</span>}
      {resumen.actualizados > 0 && <span className="text-media">{resumen.actualizados} actualizados</span>}
      {resumen.insertados === 0 && resumen.actualizados === 0 && (
        <span className="muted">Sin cambios</span>
      )}
      {resumen.controles > 0 && <span className="muted">· {resumen.controles} controles agregados</span>}
    </div>
  );
}

function ErrorImport({ mensaje }) {
  const lineas = mensaje.split("\n");
  return (
    <div className="error importar-error">
      {lineas.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
