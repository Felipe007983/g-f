/**
 * Modal de confirmação reutilizável.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary', // primary | success | danger
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-modal-icon confirm-modal-icon--${variant}`} aria-hidden>
          {variant === 'danger' ? '!' : variant === 'success' ? '✓' : '?'}
        </div>
        <h2 id="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message">{message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${
              variant === 'danger'
                ? 'btn-danger'
                : variant === 'success'
                  ? 'btn-success'
                  : 'btn-primary'
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
