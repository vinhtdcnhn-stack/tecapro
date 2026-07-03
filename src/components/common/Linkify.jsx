import { useNavigate } from 'react-router-dom'
import { parseDeepLink } from './deepLink'

// Bắt URL tuyệt đối hoặc đường dẫn nội bộ trần lẫn trong văn bản (mô tả, ghi chú...).
const URL_RE = /(https?:\/\/[^\s]+|\/qlda\/\d+(?:\?[^\s]*)?)/g

// Biến văn bản có chứa link thành các thẻ <a> click được. Link nào phân giải ra đường
// dẫn nội bộ (parseDeepLink) sẽ điều hướng trong SPA — nhảy đúng vị trí ngay TAB HIỆN
// TẠI (không mở tab mới, không reload) qua react-router; link ngoài mở tab mới.
//   onNavigate — gọi trước khi navigate nội bộ (vd đóng drawer đang mở).
export default function Linkify({ text, onNavigate }) {
  const navigate = useNavigate()
  const s = String(text ?? '')
  const parts = s.split(URL_RE)
  return parts.map((part, i) => {
    // split có nhóm bắt → phần tử lẻ là URL/path khớp, phần tử chẵn là văn bản thường.
    if (i % 2 === 0) return part
    const internal = parseDeepLink(part)
    if (internal) {
      return (
        <a
          key={i}
          href={internal}
          onClick={(e) => { e.preventDefault(); onNavigate?.(); navigate(internal) }}
        >
          {part}
        </a>
      )
    }
    return <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>
  })
}
