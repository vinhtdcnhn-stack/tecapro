import { useState, useEffect, useCallback } from 'react'
import { API_BASE as API } from '../../config/api'

const PAGE_SIZE = 50

// Định dạng thời gian theo vi-VN (dd/mm/yyyy hh:mm:ss).
function fmtDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN')
}

// Nội dung tin nhắn được lưu dạng HTML (parse_mode=HTML). Bỏ thẻ + giải mã thực thể
// để hiển thị thuần văn bản cho dễ đọc trong bảng.
function plainText(s) {
  if (!s) return ''
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// Nhật ký gửi Telegram (chỉ admin). Tải dần theo trang, có nút làm mới.
export default function TelegramLogPanel() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/telegram-logs?page=${p}&pageSize=${PAGE_SIZE}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không tải được nhật ký.')
      setItems(prev => (p === 1 ? data.items : [...prev, ...data.items]))
      setTotal(data.total)
      setPage(p)
    } catch (e) {
      setError(e.message || 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loader async: setState sau await
    load(1)
  }, [load])

  const hasMore = items.length < total

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>NHẬT KÝ GỬI TELEGRAM</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#666', fontSize: '13px' }}>
            {total} bản ghi · tự xóa sau 3 ngày
          </span>
          <button className="add-btn" onClick={() => load(1)} disabled={loading}>
            🔄 Làm mới
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#c00', marginBottom: '10px' }}>{error}</div>}

      <div className="content-scrollable">
        <table className="user-table">
          <thead>
            <tr>
              <th style={{ whiteSpace: 'nowrap' }}>Thời gian</th>
              <th style={{ whiteSpace: 'nowrap' }}>Chat ID</th>
              <th style={{ whiteSpace: 'nowrap' }}>Trạng thái</th>
              <th>Nội dung</th>
              <th>Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  Chưa có nhật ký nào.
                </td>
              </tr>
            ) : (
              items.map(it => (
                <tr key={it.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(it.created_at)}</td>
                  <td>{it.chat_id || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: it.ok ? '#15803d' : '#c00' }}>
                    {it.ok ? '✅ Thành công' : '❌ Thất bại'}
                  </td>
                  <td style={{ maxWidth: '420px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {plainText(it.message)}
                  </td>
                  <td style={{ color: '#c00', maxWidth: '300px', wordBreak: 'break-word' }}>
                    {it.error || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        {hasMore ? (
          <button className="add-btn" onClick={() => load(page + 1)} disabled={loading}>
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </button>
        ) : (
          items.length > 0 && <span style={{ color: '#888', fontSize: '13px' }}>Đã hiển thị hết.</span>
        )}
      </div>
    </>
  )
}
