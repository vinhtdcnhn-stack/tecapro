// Dán nhiều serial copy từ Excel vào ô nhập serial — dùng chung cho thẻ đợt giao hàng,
// modal Thêm linh kiện (Quản lý Serial) và ô serial HĐ nhập.

// Tách chuỗi dán từ Excel thành danh sách serial: copy theo CỘT → cách nhau bởi xuống
// dòng, copy theo HÀNG → cách nhau bởi Tab. Bỏ ô trống + bỏ trùng (không phân biệt
// hoa/thường, giữ thứ tự xuất hiện đầu tiên).
export function splitSerials(text) {
  const seen = new Set()
  const out = []
  for (const raw of String(text || '').split(/[\r\n\t]+/)) {
    const sn = raw.trim()
    const key = sn.toLowerCase()
    if (!sn || seen.has(key)) continue
    seen.add(key); out.push(sn)
  }
  return out
}

// Số dòng hiển thị của textarea serial: theo nội dung, tối đa `max` dòng.
export function serialRows(text, max = 6) {
  return Math.min(Math.max(String(text || '').split('\n').length, 1), max)
}

// Enter = lưu, Shift+Enter = xuống dòng (gõ tay serial tiếp theo).
export function enterToSubmit(submit) {
  return e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }
}

// Liệt kê gọn tối đa `max` mục cho hộp thoại.
export function shortList(list, max = 10) {
  return list.slice(0, max).map(s => `"${s}"`).join(', ') + (list.length > max ? `… (+${list.length - max})` : '')
}

// POST lần lượt từng serial (endpoint chỉ nhận 1 serial/lần). Không dừng khi 1 serial
// lỗi — gom lại để báo một lần và trả về cho ô nhập giữ lại.
export async function postSerialsEach(url, serialList) {
  const added = [], failed = [], errors = []
  for (const sn of serialList) {
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial_no: sn }),
      })
      const data = await res.json()
      if (!res.ok) { failed.push(sn); errors.push(data.error || `Lỗi thêm "${sn}"`); continue }
      added.push(data)
    } catch {
      failed.push(sn); errors.push(`Lỗi mạng khi thêm "${sn}"`)
    }
  }
  return { added, failed, errors }
}

// Câu báo kết quả sau khi thêm nhiều serial ('' nếu không có gì cần báo).
export function addResultMessage(total, { added, failed, errors }, extra = []) {
  const notes = []
  if (total > 1) notes.push(`Đã thêm ${added.length}/${total} serial.`)
  notes.push(...extra)
  if (errors.length) notes.push(`Không thêm được ${failed.length} serial:\n- ${errors.slice(0, 10).join('\n- ')}${errors.length > 10 ? '\n…' : ''}`)
  return (total > 1 || extra.length || errors.length) ? notes.join('\n\n') : ''
}
