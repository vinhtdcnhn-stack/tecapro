import { useState, useCallback, useRef } from 'react'

// Hook hiển thị hộp thoại nhập mật khẩu (ô che) cho thao tác nhạy cảm như MỞ KHÓA đợt.
// Dùng:
//   const { promptPassword, passwordModal } = usePasswordPrompt()
//   const pw = await promptPassword({ title, message })   // null nếu hủy
//   if (pw == null) return
//   ... gửi pw lên server, nếu sai có thể gọi lại promptPassword(...)
// Nhớ render {passwordModal} trong JSX.
export default function usePasswordPrompt() {
  const [state, setState] = useState(null)  // null | { title, message }
  const [value, setValue] = useState('')
  const [busy, setBusy]   = useState(false)
  const resolver = useRef(null)

  const promptPassword = useCallback((opts = {}) => {
    setValue('')
    setBusy(false)
    setState({
      title: opts.title || 'Xác nhận mật khẩu',
      message: opts.message || 'Nhập mật khẩu của bạn để xác nhận thao tác này.',
    })
    return new Promise((resolve) => { resolver.current = resolve })
  }, [])

  const finish = useCallback((result) => {
    const r = resolver.current
    resolver.current = null
    setState(null)
    setBusy(false)
    if (r) r(result)
  }, [])

  const submit = useCallback(() => {
    if (busy || !value) return
    setBusy(true)
    finish(value)
  }, [busy, value, finish])

  const passwordModal = state && (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => finish(null)}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: 380, maxWidth: '92%', padding: '22px 24px', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>🔓 {state.title}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{state.message}</div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') finish(null) }}
          placeholder="Mật khẩu"
          style={{ width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => finish(null)}
            style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Hủy
          </button>
          <button onClick={submit} disabled={busy || !value}
            style={{ padding: '8px 16px', background: (busy || !value) ? '#9ca3af' : 'var(--brand, #16a34a)', color: '#fff', border: 'none', borderRadius: 8, cursor: (busy || !value) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )

  return { promptPassword, passwordModal }
}
