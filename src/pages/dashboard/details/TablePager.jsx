// Thanh phân trang dùng chung cho các bảng chi tiết ở dashboard điều hành.
// Client-side: dữ liệu đã tải sẵn, chỉ cắt trang để bảng không quá dài.
export default function TablePager({ page, pageCount, total, from, to, onChange }) {
  if (pageCount <= 1) return null
  // Dải số trang gọn: luôn có trang đầu/cuối + 2 trang quanh trang hiện tại, chỗ đứt là '…'.
  const nums = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  return (
    <div className="exec-pager">
      <span className="exec-pager-info">Hiển thị {from}–{to} / {total} hợp đồng</span>
      <div className="exec-pager-btns">
        <button type="button" className="exec-pager-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Trước</button>
        {nums.map((n, i) => n === '…'
          ? <span key={`gap${i}`} className="exec-pager-gap">…</span>
          : (
            <button
              key={n} type="button"
              className={`exec-pager-btn${n === page ? ' is-active' : ''}`}
              onClick={() => onChange(n)}
            >{n}</button>
          ))}
        <button type="button" className="exec-pager-btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Sau ›</button>
      </div>
    </div>
  )
}
