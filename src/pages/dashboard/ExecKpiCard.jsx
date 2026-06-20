// 1 thẻ KPI bấm được trên dashboard điều hành. Bấm → mở chi tiết full màn hình.
export default function ExecKpiCard({ icon, label, value, valueTitle, sub, accent, danger, onClick }) {
  return (
    <button
      type="button"
      className={`exec-card${danger ? ' exec-card--danger' : ''}`}
      style={accent ? { borderTopColor: accent } : undefined}
      onClick={onClick}
    >
      <div className="exec-card-top">
        <span className="exec-card-icon" style={accent ? { color: accent } : undefined}>{icon}</span>
        <span className="exec-card-more" aria-hidden="true">Xem chi tiết →</span>
      </div>
      <div className="exec-card-value" title={valueTitle || undefined}>{value}</div>
      <div className="exec-card-label">{label}</div>
      {sub != null && <div className="exec-card-sub">{sub}</div>}
    </button>
  )
}
