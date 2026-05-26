import { useEffect, useRef, useState } from "react";

export default function CreatableSelect({ value, onChange, options = [], placeholder = "" }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const containerRef        = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const search   = (query || value || "").toLowerCase();
  const filtered = options.filter(o => o.toLowerCase().includes(search));
  const showCreate =
    query.trim() &&
    !options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  function select(val) {
    onChange(val);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="cs-wrap">
      <input
        className="input cs-input"
        value={open ? query : value}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div className="cs-dropdown">
          {filtered.map(o => (
            <div
              key={o}
              className={`cs-option${o === value ? " cs-option--active" : ""}`}
              onMouseDown={() => select(o)}
            >
              {o}
            </div>
          ))}
          {showCreate && (
            <div className="cs-option cs-option--create" onMouseDown={() => select(query.trim())}>
              + Crear &ldquo;{query.trim()}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
