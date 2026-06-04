/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext(null);

export function DialogProvider({ children }) {
  const [toasts, setToasts]         = useState([]);
  const [confirmState, setConfirm]  = useState(null);

  const toast = useCallback((message, type = "error") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const confirm = useCallback((message) => (
    new Promise(resolve => setConfirm({ message, resolve }))
  ), []);

  function settle(result) {
    confirmState?.resolve(result);
    setConfirm(null);
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* ── Modal de confirmación ── */}
      {confirmState && (
        <div className="modal-backdrop" onClick={() => settle(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <p className="confirm-message">{confirmState.message}</p>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-light" onClick={() => settle(false)}>Cancelar</button>
              <button className="btn-danger"  onClick={() => settle(true)}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDialog() {
  return useContext(Ctx);
}
