import { useEffect, useRef, useState } from 'react'

// Đồng bộ một thanh cuộn ngang "nổi" (sticky ở đầu bảng) với vùng cuộn thật của
// bảng, để người dùng kéo ngang xem bảng rộng mà không phải cuộn xuống đáy bảng.
//
// Trả về:
//  - topRef:  gắn vào phần tử thanh cuộn nổi (overflow-x:auto)
//  - bodyRef: gắn vào vùng cuộn thật chứa bảng (.boq-table-wrapper)
//  - width:   bề rộng nội dung (scrollWidth) để đặt cho ruột thanh nổi
//  - needed:  bảng có tràn ngang hay không (để ẩn thanh nổi khi không cần)
//  - onTop / onBody: handler onScroll đồng bộ 2 chiều
export default function useSyncedHScroll(deps = []) {
  const topRef = useRef(null)
  const bodyRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [needed, setNeeded] = useState(false)

  // Đo bề rộng nội dung để đặt cho thanh nổi + biết có tràn ngang không
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => {
      setWidth(body.scrollWidth)
      setNeeded(body.scrollWidth > body.clientWidth + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(body)
    if (body.firstElementChild) ro.observe(body.firstElementChild)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Đồng bộ scrollLeft 2 chiều (cờ syncing tránh vòng lặp)
  const syncing = useRef(false)
  const onTop = () => {
    if (syncing.current) return
    syncing.current = true
    if (bodyRef.current && topRef.current) bodyRef.current.scrollLeft = topRef.current.scrollLeft
    syncing.current = false
  }
  const onBody = () => {
    if (syncing.current) return
    syncing.current = true
    if (bodyRef.current && topRef.current) topRef.current.scrollLeft = bodyRef.current.scrollLeft
    syncing.current = false
  }

  return { topRef, bodyRef, width, needed, onTop, onBody }
}
