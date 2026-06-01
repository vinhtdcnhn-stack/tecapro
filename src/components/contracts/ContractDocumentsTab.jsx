import { useState, useEffect } from 'react'
import './ContractDocumentsTab.css'

function getBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
}
const API_BASE_URL = getBaseUrl() + '/api'

function getCurrentUserId() {
  return localStorage.getItem('userId') || null
}

export default function ContractDocumentsTab({ contractId }) {
  const [folders, setFolders] = useState([])
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [files, setFiles] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [previewFile, setPreviewFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [fileInputKey, setFileInputKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])

  // Create folder
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState('')

  // Rename folder
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [renameFolderInput, setRenameFolderInput] = useState('')

  // Delete folder
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(null)

  const isUploading = uploadQueue.some(q => q.status === 'pending' || q.status === 'uploading')

  useEffect(() => {
    loadFolders().finally(() => setLoading(false))
  }, [contractId])

  useEffect(() => {
    if (selectedFolderId) {
      loadFiles(selectedFolderId)
    } else {
      setFiles([])
    }
    setPreviewFile(null)
    setSelectedFiles(new Set())
  }, [selectedFolderId])

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadFolders = async ({ expandParentId = null } = {}) => {
    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/folders`)
      const data = await res.json()
      setFolders(data)
      setExpandedFolders(prev => {
        const firstLevelIds = data.map(f => f.id)
        const next = new Set([...firstLevelIds, ...prev])
        if (expandParentId) next.add(expandParentId)
        return next
      })
    } catch (err) {
      console.error('Failed to load folders:', err)
    }
  }

  const loadFiles = async (folderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/files?folderId=${folderId}`)
      const data = await res.json()
      setFiles(data)
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }

  // ── Folder tree helpers ──────────────────────────────────────────────────

  const toggleFolderExpand = (folderId, e) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
  }

  const getFolderPath = (folderList, targetId, path = []) => {
    for (const folder of folderList) {
      const current = [...path, { id: folder.id, name: folder.folder_name }]
      if (String(folder.id) === String(targetId)) return current
      if (folder.children?.length > 0) {
        const found = getFolderPath(folder.children, targetId, current)
        if (found) return found
      }
    }
    return null
  }

  const flattenFolders = (folderList, level = 0) => {
    const result = []
    for (const folder of folderList) {
      result.push({ ...folder, level })
      if (folder.children?.length > 0) result.push(...flattenFolders(folder.children, level + 1))
    }
    return result
  }

  // ── Create folder ────────────────────────────────────────────────────────

  const handleCreateFolder = () => {
    setNewFolderName('')
    setNewFolderParentId(selectedFolderId || '')
    setShowNewFolderModal(true)
  }

  const confirmCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: newFolderName, parentId: newFolderParentId || null, userId: getCurrentUserId() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await loadFolders({ expandParentId: newFolderParentId || null })
      setNewFolderName('')
      setNewFolderParentId('')
      setShowNewFolderModal(false)
    } catch {
      alert('Không thể tạo thư mục. Vui lòng thử lại.')
    }
  }

  // ── Rename folder ────────────────────────────────────────────────────────

  const handleRenameFolder = (folder, e) => {
    e.stopPropagation()
    setRenamingFolder(folder)
    setRenameFolderInput(folder.folder_name)
    setShowRenameModal(true)
  }

  const confirmRenameFolder = async () => {
    if (!renameFolderInput.trim() || !renamingFolder) return
    try {
      const res = await fetch(`${API_BASE_URL}/folders/${renamingFolder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: renameFolderInput })
      })
      if (!res.ok) throw new Error('Failed')
      await loadFolders()
      setShowRenameModal(false)
      setRenamingFolder(null)
    } catch {
      alert('Không thể đổi tên thư mục.')
    }
  }

  // ── Delete folder ────────────────────────────────────────────────────────

  const handleDeleteFolder = (folder, e) => {
    e.stopPropagation()
    setDeletingFolder(folder)
    setShowDeleteFolderConfirm(true)
  }

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return
    try {
      const res = await fetch(`${API_BASE_URL}/folders/${deletingFolder.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      if (String(selectedFolderId) === String(deletingFolder.id)) setSelectedFolderId(null)
      await loadFolders()
      setShowDeleteFolderConfirm(false)
      setDeletingFolder(null)
    } catch {
      alert('Không thể xóa thư mục.')
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────

  const uploadFiles = async (fileList) => {
    const items = Array.from(fileList).map(f => ({ name: f.name, status: 'pending', file: f }))
    setUploadQueue(items)
    for (let i = 0; i < items.length; i++) {
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))
      try {
        const formData = new FormData()
        formData.append('file', items[i].file)
        formData.append('folderId', selectedFolderId)
        formData.append('userId', getCurrentUserId() || '')
        const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/files/upload`, {
          method: 'POST',
          body: formData
        })
        if (!res.ok) throw new Error('Upload failed')
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
      } catch {
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item))
      }
    }
    await loadFiles(selectedFolderId)
    setTimeout(() => setUploadQueue([]), 3000)
  }

  const handleUploadFile = () => document.getElementById('file-upload-input').click()

  const handleFileChange = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    if (!selectedFolderId) { alert('Vui lòng chọn thư mục để upload file'); return }
    await uploadFiles(files)
    setFileInputKey(prev => prev + 1)
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  const handleDragOver = (e) => {
    e.preventDefault()
    if (selectedFolderId) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (!selectedFolderId) { alert('Vui lòng chọn thư mục để upload file'); return }
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files)
  }

  // ── File operations ──────────────────────────────────────────────────────

  const handleFileClick = (file, event) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => {
        const next = new Set(prev)
        next.has(file.id) ? next.delete(file.id) : next.add(file.id)
        return next
      })
    } else {
      setSelectedFiles(new Set([file.id]))
      const canPreview = file.mime_type?.includes('pdf') || file.mime_type?.includes('image')
      setPreviewFile(canPreview ? file : null)
    }
  }

  const handleSelectAll = (e) => {
    setSelectedFiles(e.target.checked ? new Set(files.map(f => f.id)) : new Set())
  }

  const handleDownload = () => {
    if (selectedFiles.size === 0) { alert('Vui lòng chọn file cần download'); return }
    for (const fileId of selectedFiles) {
      window.open(`${API_BASE_URL}/files/${fileId}/download`, '_blank')
    }
  }

  const handleDelete = async () => {
    if (selectedFiles.size === 0) { alert('Vui lòng chọn file cần xóa'); return }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedFiles.size} file đã chọn?`)) return
    try {
      for (const fileId of selectedFiles) {
        await fetch(`${API_BASE_URL}/files/${fileId}`, { method: 'DELETE' })
      }
      if (previewFile && selectedFiles.has(previewFile.id)) setPreviewFile(null)
      setSelectedFiles(new Set())
      if (selectedFolderId) await loadFiles(selectedFolderId)
    } catch {
      alert('Không thể xóa file. Vui lòng thử lại.')
    }
  }

  // ── Formatters ───────────────────────────────────────────────────────────

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('vi-VN')
  }

  const getFileIcon = (mimeType = '') => {
    if (mimeType.includes('pdf')) return { emoji: '📄', color: '#dc2626' }
    if (mimeType.includes('word')) return { emoji: '📝', color: '#2563eb' }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { emoji: '📊', color: '#16a34a' }
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return { emoji: '📋', color: '#ea580c' }
    if (mimeType.includes('image')) return { emoji: '🖼️', color: '#7c3aed' }
    if (mimeType.includes('zip') || mimeType.includes('rar')) return { emoji: '📦', color: '#d97706' }
    return { emoji: '📁', color: '#6b7280' }
  }

  // ── Folder tree renderer ─────────────────────────────────────────────────

  const renderFolderTree = (folderList, level = 0) => folderList.map(folder => (
    <div key={folder.id} className="folder-tree-item">
      <div
        className={`folder-node ${String(selectedFolderId) === String(folder.id) ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 6}px` }}
        onClick={() => setSelectedFolderId(folder.id)}
      >
        <button
          className={`expand-btn ${folder.children?.length > 0 ? 'visible' : ''} ${expandedFolders.has(folder.id) ? 'expanded' : ''}`}
          onClick={(e) => toggleFolderExpand(folder.id, e)}
          disabled={!folder.children?.length}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l6 4-6 4V4z"/></svg>
        </button>
        <svg className="folder-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <span className="folder-name">{folder.folder_name}</span>
        <div className="folder-actions">
          <button className="folder-action-btn" title="Đổi tên" onClick={(e) => handleRenameFolder(folder, e)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button className="folder-action-btn folder-action-delete" title="Xóa" onClick={(e) => handleDeleteFolder(folder, e)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
      {folder.children?.length > 0 && expandedFolders.has(folder.id) && (
        <div className="folder-children">{renderFolderTree(folder.children, level + 1)}</div>
      )}
    </div>
  ))

  const folderPath = selectedFolderId ? getFolderPath(folders, selectedFolderId) : null

  if (loading) return <div className="documents-loading">Đang tải...</div>

  return (
    <div className="contract-documents-tab">

      {/* ── Left panel: folder tree ─────────────────────────────────────── */}
      <div className="documents-left-panel">
        <div className="panel-header">
          <h3>Thư mục</h3>
          <button className="btn-icon" onClick={handleCreateFolder} title="Tạo thư mục mới">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>
            </svg>
          </button>
        </div>
        <div className="folder-tree">
          {folders.length === 0
            ? <div className="folder-tree-empty">Chưa có thư mục nào</div>
            : renderFolderTree(folders)
          }
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="documents-right-panel">

        {/* Main content block */}
        <div className="documents-main-content">

          {/* Toolbar */}
          <div className="documents-toolbar">
            <div className="toolbar-left">
              <button className="btn-toolbar btn-upload" onClick={handleUploadFile} disabled={!selectedFolderId || isUploading}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                {isUploading ? 'Đang upload...' : 'Upload'}
              </button>
              <input id="file-upload-input" type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} key={fileInputKey} />
              <button className="btn-toolbar" onClick={handleCreateFolder}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>
                </svg>
                Tạo thư mục
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn-toolbar" onClick={handleDownload} disabled={selectedFiles.size === 0}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download{selectedFiles.size > 1 ? ` (${selectedFiles.size})` : ''}
              </button>
              <button className="btn-toolbar btn-delete" onClick={handleDelete} disabled={selectedFiles.size === 0}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Xóa{selectedFiles.size > 1 ? ` (${selectedFiles.size})` : ''}
              </button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="documents-breadcrumb">
            <span className="breadcrumb-home" onClick={() => setSelectedFolderId(null)} title="Gốc">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </span>
            {folderPath?.map((item, idx) => (
              <span key={item.id} className="breadcrumb-segment">
                <span className="breadcrumb-sep">/</span>
                <span
                  className={`breadcrumb-item ${idx === folderPath.length - 1 ? 'active' : ''}`}
                  onClick={() => setSelectedFolderId(item.id)}
                >
                  {item.name}
                </span>
              </span>
            ))}
          </div>

          {/* Upload queue */}
          {uploadQueue.length > 0 && (
            <div className="upload-queue">
              {uploadQueue.map((item, idx) => (
                <div key={idx} className={`upload-queue-item upload-queue-item--${item.status}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>
                  <span className="upload-queue-name">{item.name}</span>
                  <span className="upload-queue-status">
                    {item.status === 'pending' && 'Chờ...'}
                    {item.status === 'uploading' && 'Đang tải...'}
                    {item.status === 'done' && '✓ Xong'}
                    {item.status === 'error' && '✗ Lỗi'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone + file table */}
          <div
            className={`documents-table-container ${isDragging ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="drop-overlay">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                <span>Thả file để upload vào thư mục đang chọn</span>
              </div>
            )}

            {!selectedFolderId ? (
              <div className="no-folder-selected">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
                <p>Chọn một thư mục để xem và quản lý file</p>
              </div>
            ) : (
              <table className="documents-table">
                <thead>
                  <tr>
                    <th className="col-select">
                      <input
                        type="checkbox"
                        checked={files.length > 0 && selectedFiles.size === files.length}
                        onChange={handleSelectAll}
                        title="Chọn tất cả"
                      />
                    </th>
                    <th className="col-name">Tên file</th>
                    <th className="col-size">Kích thước</th>
                    <th className="col-date">Ngày tải</th>
                    <th className="col-uploader">Người tải</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-message">
                        Thư mục này chưa có file nào. Kéo thả hoặc nhấn Upload để thêm.
                      </td>
                    </tr>
                  ) : files.map(file => {
                    const icon = getFileIcon(file.mime_type)
                    const isSelected = selectedFiles.has(file.id)
                    const isPreviewing = previewFile?.id === file.id
                    return (
                      <tr
                        key={file.id}
                        className={`${isSelected ? 'selected' : ''} ${isPreviewing ? 'previewing' : ''}`}
                        onClick={(e) => handleFileClick(file, e)}
                      >
                        <td className="col-select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              setSelectedFiles(prev => {
                                const next = new Set(prev)
                                isSelected ? next.delete(file.id) : next.add(file.id)
                                return next
                              })
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="col-name">
                          <div className="file-info">
                            <span className="file-icon" style={{ color: icon.color }}>{icon.emoji}</span>
                            <span className="file-name-text" title={file.file_name}>{file.file_name}</span>
                          </div>
                        </td>
                        <td className="col-size">{formatFileSize(file.file_size)}</td>
                        <td className="col-date">{formatDate(file.uploaded_at)}</td>
                        <td className="col-uploader">{file.uploaded_by_name || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Preview panel (PDF / image) */}
        {previewFile && (
          <div className="documents-preview-panel">
            <div className="preview-header">
              <div className="preview-title-area">
                <span style={{ color: getFileIcon(previewFile.mime_type).color, fontSize: 16 }}>
                  {getFileIcon(previewFile.mime_type).emoji}
                </span>
                <span className="preview-title">{previewFile.file_name}</span>
              </div>
              <div className="preview-header-actions">
                <button
                  className="btn-toolbar"
                  style={{ padding: '5px 11px', fontSize: 12 }}
                  onClick={() => window.open(`${API_BASE_URL}/files/${previewFile.id}/download`, '_blank')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  Download
                </button>
                <button className="btn-close-preview" onClick={() => setPreviewFile(null)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="preview-content">
              {previewFile.mime_type?.includes('pdf') ? (
                <iframe src={`${API_BASE_URL}/files/${previewFile.id}/view`} className="pdf-preview" title={previewFile.file_name} />
              ) : (
                <img src={`${API_BASE_URL}/files/${previewFile.id}/view`} alt={previewFile.file_name} className="image-preview" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Tạo thư mục mới</h3>
            <div className="form-group">
              <label>Tên thư mục</label>
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nhập tên thư mục..." autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()} />
            </div>
            <div className="form-group">
              <label>Thư mục cha</label>
              <select value={newFolderParentId} onChange={(e) => setNewFolderParentId(e.target.value)}>
                <option value="">-- Thư mục gốc --</option>
                {flattenFolders(folders).map(f => (
                  <option key={f.id} value={f.id}>{'　'.repeat(f.level)}{f.folder_name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowNewFolderModal(false)}>Hủy</button>
              <button className="btn-confirm" onClick={confirmCreateFolder}>Tạo</button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Đổi tên thư mục</h3>
            <div className="form-group">
              <label>Tên mới</label>
              <input type="text" value={renameFolderInput} onChange={(e) => setRenameFolderInput(e.target.value)}
                autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmRenameFolder()} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRenameModal(false)}>Hủy</button>
              <button className="btn-confirm" onClick={confirmRenameFolder}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteFolderConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteFolderConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Xóa thư mục</h3>
            <p className="confirm-message">
              Bạn có chắc muốn xóa thư mục <strong>"{deletingFolder?.folder_name}"</strong>?<br />
              Tất cả thư mục con và file bên trong cũng sẽ bị xóa.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteFolderConfirm(false)}>Hủy</button>
              <button className="btn-confirm btn-danger" onClick={confirmDeleteFolder}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
