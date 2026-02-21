export default function SearchBar({ value, onChange, placeholder = "Buscar..." }) {
    return (
        <input
            className="searchbar"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    );
}