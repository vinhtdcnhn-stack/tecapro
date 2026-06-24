import { useState, useRef, useCallback } from 'react'
import { API } from '../../config/api'

// Curate bản gửi review của 1 đầu việc Đấu thầu (chỉ dùng khi ContractDocumentsTab nhận
// prop `review`). Đánh dấu LOẠI file/thư mục (không xoá), tải file THAY THẾ cho bản gốc,
// gỡ file thay thế. Mọi thao tác bỏ qua khoá "Hoàn thành" nhờ guard isItemReviewCurator.
export function useReviewCuration({ itemId, refreshFiles, refreshFolders }) {
  const inputId = `review-replacement-input-${itemId ?? 'x'}`
  const replaceTargetRef = useRef(null)   // file gốc đang được thay thế
  const [busy, setBusy] = useState(false)

  const toggleFileExclude = useCallback(async (file) => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/tender/checklist/file/${file.id}/review-exclude`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: !file.review_excluded }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Thất bại.') }
      await refreshFiles()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }, [refreshFiles])

  const toggleFolderExclude = useCallback(async (folder) => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/tender/checklist/folder/${folder.id}/review-exclude`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: !folder.review_excluded }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Thất bại.') }
      await refreshFolders()
      await refreshFiles()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }, [refreshFolders, refreshFiles])

  const deleteReplacement = useCallback(async (file) => {
    if (!confirm(`Gỡ tệp thay thế "${file.file_name}"? Bản gốc sẽ hiện lại trong tập review.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/tender/checklist/file/${file.id}/replacement`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Thất bại.') }
      await refreshFiles()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }, [refreshFiles])

  // Mở hộp thoại chọn tệp để thay thế cho 1 file gốc (input ẩn nhận diện qua id).
  const pickReplacement = useCallback((origFile) => {
    replaceTargetRef.current = origFile
    document.getElementById(inputId)?.click()
  }, [inputId])

  const onReplacementChosen = useCallback(async (e) => {
    const f = e.target.files?.[0]
    const orig = replaceTargetRef.current
    if (!f || !orig) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('replacesFileId', orig.id)
      fd.append('folderId', orig.folder_id ?? 'root')   // đặt cạnh bản gốc
      const res = await fetch(`${API}/tender/checklist/${itemId}/review/replacement`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Thất bại.') }
      await refreshFiles()
    } catch (err) { alert(err.message) } finally {
      setBusy(false)
      replaceTargetRef.current = null
      if (e.target) e.target.value = ''
    }
  }, [itemId, refreshFiles])

  return {
    inputId, busy,
    toggleFileExclude, toggleFolderExclude, deleteReplacement,
    pickReplacement, onReplacementChosen,
  }
}
