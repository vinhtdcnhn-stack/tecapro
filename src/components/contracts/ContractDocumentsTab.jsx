import { useState, useEffect } from 'react'
import './ContractDocumentsTab.css'

function getBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
}

const API_BASE_URL = getBaseUrl() + '/api'

export default function ContractDocumentsTab({ contractId }) {
  const [folders, setFolders] = useState([])
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [files, setFiles] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [previewFile, setPreviewFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    loadFolders()
    setLoading(false)
  }, [contractId])

  useEffect(() => {
    if (selectedFolderId) {
      loadFiles(selectedFolderId)
    } else {
      setFiles([])
    }
  }, [selectedFolderId])

  const loadFolders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/folders`)
      const data = await res.json()
      setFolders(data)
      
      // Auto-expand first level folders
      const firstLevelIds = data.map(f => f.id)
      setExpandedFolders(new Set(firstLevelIds))
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  const loadFiles = async (folderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/files?folderId=${folderId}`)
      const data = await res.json()
      setFiles(data)
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  const toggleFolderExpand = (folderId) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleFolderClick = (folderId) => {
    setSelectedFolderId(folderId)
    setSelectedFiles(new Set())
  }

  const handleFileClick = (file, event) => {
    if (event.ctrlKey || event.metaKey) {
      const newSelected = new Set(selectedFiles)
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id)
      } else {
        newSelected.add(file.id)
      }
      setSelectedFiles(newSelected)
    } else {
      setSelectedFiles(new Set([file.id]))
      openPreview(file)
    }
  }

  const openPreview = (file) => {
    setPreviewFile(file)
  }

  const closePreview = () => {
    setPreviewFile(null)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN')
  }

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('pdf')) return 'pdf'
    if (mimeType.includes('word')) return 'docx'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx'
    if (mimeType.includes('image')) return 'image'
    if (mimeType.includes('zip')) return 'zip'
    return 'file'
  }

  const canPreview = (mimeType) => {
    return mimeType.includes('pdf') || mimeType.includes('image')
  }

  const handleCreateFolder = () => {
    setNewFolderParentId(selectedFolderId || '')
    setShowNewFolderModal(true)
  }

  const confirmCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          folderName: newFolderName, 
          parentId: newFolderParentId || null 
        })
      })

      console.log('status=', res.status)

      const data = await res.json()

      console.log('response=', data)

      if (!res.ok) {
        throw new Error(data.error || 'Create folder failed')
      }

      // Reload folders to get the new one
      await loadFolders()

      setNewFolderName('')
      setNewFolderParentId('')
      setShowNewFolderModal(false)
    } catch (error) {
      console.error('Failed to create folder:', error)
      alert('Không thể tạo thư mục. Vui lòng thử lại.')
    }
  }

  const handleUploadFile = () => {
    document.getElementById('file-upload-input').click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!selectedFolderId) {
      alert('Vui lòng chọn thư mục để upload file')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folderId', selectedFolderId)

      const res = await fetch(`${API_BASE_URL}/contracts/${contractId}/files/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      // Reload files after upload
      await loadFiles(selectedFolderId)

      // Reset file input
      setFileInputKey(prev => prev + 1)
    } catch (error) {
      console.error('Failed to upload file:', error)
      alert(`Không thể upload file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    if (selectedFiles.size === 0) {
      alert('Vui lòng chọn file cần download')
      return
    }

    // Download first selected file (for multiple files, would need zip)
    const fileId = Array.from(selectedFiles)[0]
    const file = files.find(f => f.id === fileId)

    if (file) {
      // Open download in new tab/window
      window.open(`${API_BASE_URL}/files/${file.id}/download`, '_blank')
    }
  }

  const handleDelete = async () => {
    if (selectedFiles.size === 0) {
      alert('Vui lòng chọn file cần xóa')
      return
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedFiles.size} file đã chọn?`)) {
      return
    }

    try {
      // Delete each selected file
      for (const fileId of selectedFiles) {
        await fetch(`${API_BASE_URL}/files/${fileId}`, {
          method: 'DELETE'
        })
      }

      // Reload files after deletion
      if (selectedFolderId) {
        await loadFiles(selectedFolderId)
      }

      setSelectedFiles(new Set())
    } catch (error) {
      console.error('Failed to delete files:', error)
      alert('Không thể xóa file. Vui lòng thử lại.')
    }
  }

  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map(folder => (
      <div key={folder.id} className="folder-tree-item">
        <div
          className={`folder-node ${selectedFolderId === folder.id ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFolderClick(folder.id)}
        >
          <button
            className={`expand-btn ${folder.children && folder.children.length > 0 ? 'visible' : ''} ${expandedFolders.has(folder.id) ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleFolderExpand(folder.id)
            }}
            disabled={!folder.children || folder.children.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l6 4-6 4V4z"/>
            </svg>
          </button>
          <svg className="folder-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span className="folder-name">{folder.folder_name}</span>
        </div>
        {folder.children && folder.children.length > 0 && expandedFolders.has(folder.id) && (
          <div className="folder-children">
            {renderFolderTree(folder.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  if (loading) {
    return <div className="documents-loading">Đang tải...</div>
  }

  return (
    <div className="contract-documents-tab">
      {/* Left Panel - Folder Tree */}
      <div className="documents-left-panel">
        <div className="panel-header">
          <h3>Thư mục</h3>
          <button className="btn-icon" onClick={handleCreateFolder} title="Tạo thư mục">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
        <div className="folder-tree">
          {renderFolderTree(folders)}
        </div>
      </div>

      {/* Right Panel - File List */}
      <div className="documents-right-panel">
        <div className="documents-main-content">
          {/* Toolbar */}
          <div className="documents-toolbar">
            <div className="toolbar-left">
              <button className="btn-toolbar" onClick={handleUploadFile} disabled={!selectedFolderId || uploading}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                </svg>
                {uploading ? 'Đang upload...' : 'Upload'}
              </button>
              <input
                id="file-upload-input"
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                key={fileInputKey}
              />
              <button className="btn-toolbar" onClick={handleCreateFolder}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Tạo thư mục
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn-toolbar" onClick={handleDownload} disabled={selectedFiles.size === 0}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Download
              </button>
              <button className="btn-toolbar btn-delete" onClick={handleDelete} disabled={selectedFiles.size === 0}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Xóa
              </button>
            </div>
          </div>

          {/* File Table */}
          <div className="documents-table-container">
            <table className="documents-table">
              <thead>
                <tr>
                  <th className="col-select"></th>
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
                      Thư mục này chưa có file nào
                    </td>
                  </tr>
                ) : (
                  files.map(file => (
                    <tr
                      key={file.id}
                      className={`${selectedFiles.has(file.id) ? 'selected' : ''} ${canPreview(file.mime_type) ? 'previewable' : ''}`}
                      onClick={(e) => handleFileClick(file, e)}
                    >
                      <td className="col-select">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            const newSelected = new Set(selectedFiles)
                            if (newSelected.has(file.id)) {
                              newSelected.delete(file.id)
                            } else {
                              newSelected.add(file.id)
                            }
                            setSelectedFiles(newSelected)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="col-name">
                        <div className="file-info">
                          <span className={`file-icon icon-${getFileIcon(file.mime_type)}`}>
                            {getFileIcon(file.mime_type) === 'pdf' && '📄'}
                            {getFileIcon(file.mime_type) === 'docx' && '📝'}
                            {getFileIcon(file.mime_type) === 'xlsx' && '📊'}
                            {getFileIcon(file.mime_type) === 'image' && '🖼️'}
                            {getFileIcon(file.mime_type) === 'zip' && '📦'}
                            {getFileIcon(file.mime_type) === 'file' && '📁'}
                          </span>
                          <span className="file-name-text">{file.file_name}</span>
                        </div>
                      </td>
                      <td className="col-size">{formatFileSize(file.file_size)}</td>
                      <td className="col-date">{formatDate(file.uploaded_at)}</td>
                      <td className="col-uploader">{file.uploaded_by_name || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Panel - Preview */}
        {previewFile && (
          <div className="documents-preview-panel">
            <div className="preview-header">
              <span className="preview-title">{previewFile.file_name}</span>
              <button className="btn-close-preview" onClick={closePreview}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="preview-content">
              {canPreview(previewFile.mime_type) ? (
                previewFile.mime_type.includes('pdf') ? (
                  <iframe
                    src={`${API_BASE_URL}/files/${previewFile.id}/view`}
                    className="pdf-preview"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={`${API_BASE_URL}/files/${previewFile.id}/view`}
                    alt={previewFile.file_name}
                    className="image-preview"
                  />
                )
              ) : (
                <div className="no-preview">
                  <div className="file-type-icon">
                    {getFileIcon(previewFile.mime_type) === 'docx' && '📝'}
                    {getFileIcon(previewFile.mime_type) === 'xlsx' && '📊'}
                    {getFileIcon(previewFile.mime_type) === 'zip' && '📦'}
                  </div>
                  <p>Không thể xem trước file này</p>
                  <button className="btn-download-file" onClick={handleDownload}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Tạo thư mục mới</h3>
            <div className="form-group">
              <label>Tên thư mục</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nhập tên thư mục..."
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && confirmCreateFolder()}
              />
            </div>
            <div className="form-group">
              <label>Thư mục cha (tùy chọn)</label>
              <select
                value={newFolderParentId}
                onChange={(e) => setNewFolderParentId(e.target.value)}
              >
                <option value="">-- Thư mục gốc --</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.folder_name}
                  </option>
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
    </div>
  )
}
