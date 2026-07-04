import { auditRowAttrs } from './rowAudit'

// Danh sách thẻ dùng chung thay cho bảng rộng trên mobile (tái dùng CSS .mcards/.mcard
// trong contracts/MobileEditSheet.css). Khai báo gọn:
//   title(item)  -> tiêu đề thẻ (bắt buộc)
//   value(item)  -> giá trị canh phải ở dòng đầu (tùy chọn, vd trạng thái/vai trò)
//   meta(item)   -> mảng node hiển thị thành các chip xám bên dưới (tùy chọn)
//   badges(item) -> mảng { text, cls } nhãn nhỏ cạnh tiêu đề (tùy chọn)
//   render(item) -> escape hatch: tự vẽ toàn bộ ruột thẻ (bỏ qua title/value/meta)
//   onCardClick  -> chạm thẻ (mở modal/sheet sửa). Không truyền = thẻ chỉ để xem.
//   audit        -> { table, id(item) } gắn data-attr cho RowAuditViewer (Ctrl+Shift+H)
export default function MobileCardList({
  items, getKey = (it) => it.id, onCardClick, emptyText = 'Chưa có dữ liệu.',
  title, value, meta, badges, render, audit, footer,
}) {
  if (!items || items.length === 0) {
    return <div className="mcards-empty">{emptyText}</div>
  }
  return (
    <div className="mcards">
      {items.map((it, i) => {
        const metaItems = meta ? meta(it) : null
        const badgeItems = badges ? badges(it) : null
        return (
          <div
            key={getKey(it, i)}
            {...(audit ? auditRowAttrs(audit.table, audit.id(it)) : {})}
            className={`mcard${onCardClick ? '' : ' mcard--static'}`}
            onClick={onCardClick ? () => onCardClick(it) : undefined}
          >
            {render ? render(it) : (
              <>
                <div className="mcard-head">
                  {badgeItems && badgeItems.filter(Boolean).map((b, bi) => (
                    <span key={bi} className={`mcard-badge ${b.cls || ''}`.trim()}>{b.text}</span>
                  ))}
                  <span className="mcard-title">{title(it)}</span>
                  {value && <span className="mcard-amount">{value(it)}</span>}
                </div>
                {metaItems && metaItems.filter(v => v != null && v !== '').length > 0 && (
                  <div className="mcard-meta">
                    {metaItems.filter(v => v != null && v !== '').map((m, mi) => (
                      <span key={mi}>{m}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
      {footer}
    </div>
  )
}
