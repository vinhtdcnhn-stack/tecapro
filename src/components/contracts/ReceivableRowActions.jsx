// ── Shared row action buttons ─────────────────────────────────────────────────

export default function RowActions({ row, onSave, onDelete }) {
  return (
    <div className="action-group">
      {row._dirty && (
        <button className="act save" onClick={() => onSave(row)} disabled={row._saving} title="Lưu">
          {row._saving
            ? <span className="spin">⟳</span>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          }
        </button>
      )}
      <button className="act delete" onClick={() => onDelete(row)} title="Xóa">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  )
}
