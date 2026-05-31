import { useState, useEffect } from 'react'
import './ContractDocumentsTab.css'

export default function ContractDocumentsTab({ contractId }) {
  const [folders, setFolders] = useState([])
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [files, setFiles] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [previewFile, setPreviewFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Mock data for demonstration
  const mockFolders = [
    {
      id: 1,
      folder_name: 'Hồ sơ thầu',
      parent_id: null,
      children: [
        { id: 2, folder_name: 'HSMT', parent_id: 1, children: [] },
        { id: 3, folder_name: 'HSDT', parent_id: 1, children: [] },
        { id: 4, folder_name: 'Làm rõ HSDT', parent_id: 1, children: [] }
      ]
    },
    {
      id: 5,
      folder_name: 'Hợp đồng bán',
      parent_id: null,
      children: [
        { id: 6, folder_name: 'Hợp đồng chính', parent_id: 5, children: [] },
        { id: 7, folder_name: 'Phụ lục', parent_id: 5, children: [] },
        { id: 8, folder_name: 'Bảo lãnh', parent_id: 5, children: [] }
      ]
    },
    {
      id: 9,
      folder_name: 'Hợp đồng nhập',
      parent_id: null,
      children: [
        { id: 10, folder_name: 'PO', parent_id: 9, children: [] },
        { id: 11, folder_name: 'Hợp đồng NCC', parent_id: 9, children: [] }
      ]
    },
    {
      id: 12,
      folder_name: 'Triển khai',
      parent_id: null,
      children: [
        { id: 13, folder_name: 'Shop Drawing', parent_id: 12, children: [] },
        { id: 14, folder_name: 'FAT', parent_id: 12, children: [] },
        { id: 15, folder_name: 'SAT', parent_id: 12, children: [] }
      ]
    },
    {
      id: 16,
      folder_name: 'Nghiệm thu',
      parent_id: null,
      children: [
        { id: 17, folder_name: 'Biên bản', parent_id: 16, children: [] },
        { id: 18, folder_name: 'Thanh lý', parent_id: 16, children: [] }
      ]
    },
    {
      id: 19,
      folder_name: 'Khác',
      parent_id: null,
      children: []
    }
  ]

  const mockFiles = {
    2: [
      { id: 1, file_name: 'HSMT_Quyet_dinh.pdf', file_size: 2548000, mime_type: 'application/pdf', uploaded_at: '2024-01-15 10:30:00', uploaded_by_name: 'Nguyễn Văn A' },
      { id: 2, file_name: 'HSMT_Yeu_cau_ky_thuat.docx', file_size: 1250000, mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploaded_at: '2024-01-16 14:20:00', uploaded_by_name: 'Trần Thị B' }
    ],
    3: [
      { id: 3, file_name: 'HSDT_De_xuat_ky_thuat.pdf', file_size: 5680000, mime_type: 'application/pdf', uploaded_at: '2024-01-20 09:15:00', uploaded_by_name: 'Nguyễn Văn A' },
      { id: 4, file_name: 'HSDT_Bao_gia.xlsx', file_size: 890000, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploaded_at: '2024-01-20 11:45:00', uploaded_by_name: 'Lê Văn C' }
    ],
    6: [
      { id: 5, file_name: 'Hop_dong_chinh.pdf', file_size: 3200000, mime_type: 'application/pdf', uploaded_at: '2024-02-01 08:00:00', uploaded_by_name: 'Nguyễn Văn A' },
      { id: 6, file_name: 'Hop_dong_scan.jpg', file_size: 4500000, mime_type: 'image/jpeg', uploaded_at: '2024-02-01 08:05:00', uploaded_by_name: 'Nguyễn Văn A' }
    ],
    13: [
      { id: 7, file_name: 'Shop_Drawing_A1.pdf', file_size: 8900000, mime_type: 'application/pdf', uploaded_at: '2024-02-15 16:30:00', uploaded_by_name: 'Phạm Văn D' },
      { id: 8, file_name: 'Ban_ve_chi_tiet.png', file_size: 2100000, mime_type: 'image/png', uploaded_at: '2024-02-16 10:00:00', uploaded_by_name: 'Phạm Văn D' }
    ],
    17: [
      { id: 9, file_name: 'BB_Nghiem_thu_giai_doan_1.pdf', file_size: 1800000, mime_type: 'application/pdf', uploaded_at: '2024-03-01 14:00:00', uploaded_by_name: 'Nguyễn Văn A' }
    ]
  }

  useEffect(() => {
    // Load folders (using mock data for now)
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
      // TODO: Replace with API call
      // const res = await fetch(`/api/contracts/${contractId}/folders`)
      // const data = await res.json()
      setFolders(mockFolders)
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  const loadFiles = async (folderId) => {
    try {
      // TODO: Replace with API call
      // const res = await fetch(`/api/folders/${folderId}/files`)
      // const data = await res.json()
      setFiles(mockFiles[folderId] || [])
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
    setShowNewFolderModal(true)
  }

  const confirmCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    try {
      // TODO: Replace with API call
      // await fetch(`/api/contracts/${contractId}/folders`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ folderName: newFolderName, parentId: selectedFolderId })
      // })
      
      // For mock, just add to local state
      const newFolder = {
        id: Date.now(),
        folder_name: newFolderName,
        parent_id: selectedFolderId,
        children: []
      }
      
      if (selectedFolderId) {
        // Add to subfolder
        const addToParent = (folders) => {
          return folders.map(f => {
            if (f.id === selectedFolderId) {
              return { ...f, children: [...f.children, newFolder] }
            }
            if (f.children && f.children.length > 0) {
              return { ...f, children: addToParent(f.children) }
            }
            return f
          })
        }
        setFolders(addToParent(folders))
      } else {
        // Add to root
        setFolders([...folders, newFolder])
      }
      
      setNewFolderName('')
      setShowNewFolderModal(false)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleUploadFile = () => {
    alert('Chức năng upload sẽ được triển khai sau')
  }

  const handleDownload = () => {
    if (selectedFiles.size === 0) {
      alert('Vui lòng chọn file cần download')
      return
    }
    alert('Chức năng download sẽ được triển khai sau')
  }

  const handleDelete = () => {
    if (selectedFiles.size === 0) {
      alert('Vui lòng chọn file cần xóa')
      return
    }
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedFiles.size} file đã chọn?`)) {
      alert('Chức năng xóa sẽ được triển khai sau')
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
              <button className="btn-toolbar" onClick={handleUploadFile}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                </svg>
                Upload
              </button>
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
                    src={`/mock/files/${previewFile.file_name}`}
                    className="pdf-preview"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={`/mock/files/${previewFile.file_name}`}
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
