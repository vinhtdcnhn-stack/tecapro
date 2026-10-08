/* eslint-disable react-refresh/only-export-components -- hook + component phân trang đi cùng nhau */
import { useState } from 'react'

export const PAGE_SIZE = 10

// Phân trang client-side cho các bảng báo cáo kế toán (thay cho bảng dài phải cuộn).
// Trả về { pageRows, offset, pager }: render pageRows, đánh STT = offset + i + 1, đặt
// {pager} ngay dưới bảng (null khi chỉ có 1 trang). Đổi số dòng (lọc/tìm kiếm) → về trang 1;
// làm mới ngầm cùng số dòng thì giữ nguyên trang đang xem.
export function usePaged(rows, size = PAGE_SIZE) {
  const total = rows.length
  const [page, setPage] = useState(1)
  const [lastTotal, setLastTotal] = useState(total)
  if (lastTotal !== total) { setLastTotal(total); setPage(1) }

  const pages = Math.max(1, Math.ceil(total / size))
  const cur = Math.min(page, pages)
  const offset = (cur - 1) * size
  const pageRows = rows.slice(offset, offset + size)
  const pager = pages > 1
    ? <AccPager page={cur} pages={pages} total={total} offset={offset} count={pageRows.length} onChange={setPage} />
    : null
  return { pageRows, offset, pager }
}

// Dãy số trang rút gọn: 1 … 4 5 6 … 12
function pageList(cur, pages) {
  const set = new Set([1, pages, cur - 1, cur, cur + 1].filter(p => p >= 1 && p <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap${p}`)
    out.push(p)
  })
  return out
}

function AccPager({ page, pages, total, offset, count, onChange }) {
  return (
    <div className="acc-pager">
      <span className="acc-pager-info">{offset + 1}–{offset + count} / {total} dòng</span>
      <div className="acc-pager-btns">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">‹</button>
        {pageList(page, pages).map(p => typeof p === 'number'
          ? <button type="button" key={p} className={p === page ? 'active' : ''} onClick={() => onChange(p)}>{p}</button>
          : <span key={p} className="acc-pager-gap">…</span>)}
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">›</button>
      </div>
    </div>
  )
}
