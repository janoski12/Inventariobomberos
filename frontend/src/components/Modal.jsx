export default function Modal({ open, title, children, onClose }) {
    if (!open) return null;

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
        >
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button className="modal-close" onClick={onClose} type="button">X</button>
                </div>

                <div className="modal-body">{children}</div>
            </div>
        </div>
    )
}