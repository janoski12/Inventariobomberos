import { useEffect, useId, useState } from "react";
import { obtenerGavetas } from "../api/items";

// Input de texto libre para la gaveta/compartimiento de un item dentro de un
// carro, con sugerencias (datalist) de las gavetas ya usadas en ese carro.
// Sigue permitiendo escribir una gaveta nueva: solo ayuda a elegir una ya
// existente en vez de retipearla (y terminar con variantes tipo "Gaveta g1"
// vs "Gaveta 1" referiéndose al mismo compartimiento).
export default function GavetaInput({ ubicacionId, value, onChange, placeholder }) {
  const listId = useId();
  const [gavetas, setGavetas] = useState([]);

  // No hace falta limpiar gavetas cuando no hay ubicacionId: este componente
  // solo se monta cuando ya hay un carro elegido (ver los "esCarro" en los
  // formularios que lo usan).
  useEffect(() => {
    if (!ubicacionId) return;
    obtenerGavetas(ubicacionId).catch(() => []).then(setGavetas);
  }, [ubicacionId]);

  return (
    <>
      <input
        className="input"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {gavetas.map((g) => <option key={g} value={g} />)}
      </datalist>
    </>
  );
}
