import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import './ContractDocumentsTab.css'

import { getFolderPath } from './documentsUtils'
import { useDocumentUpload } from './useDocumentUpload'
import DocumentFolderTree from './DocumentFolderTree'
import DocumentFileTable from './DocumentFileTable'
import DocumentPreviewPanel from './DocumentPreviewPanel'
import { NewFolderModal, RenameFolderModal, DeleteFolderModal } from './DocumentModals'
import EditGuard from './EditGuard'
import { useCanEdit } from '../../context/ContractPermContext'

export default function ContractDocumentsTab({ contractId, basePath }) {
  // basePath overrides the default "contracts/{contractId}" prefix
  const resourcePath = basePath || `contracts/${contractId}`
  const [folders, setFolders] = useState([])
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [files, setFiles] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [previewFile, setPreviewFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const canEdit = useCanEdit()

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

  // ── Data loaders (khai báo TRƯỚC effect dùng chúng; memo theo resourcePath) ─

  const loadFolders = useCallback(async ({ expandParentId = null } = {}) => {
    try {
      const res = await fetch(`${API}/${resourcePath}/folders`)
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
  }, [resourcePath])

  const loadFiles = useCallback(async (folderId) => {
    try {
      const res = await fetch(`${API}/${resourcePath}/files?folderId=${folderId}`)
      const data = await res.json()
      setFiles(data)
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }, [resourcePath])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFolders() async: setState xảy ra SAU await
    loadFolders().finally(() => setLoading(false))
  }, [loadFolders])

  // loadFiles() async; các setState reset (files/preview/selection) là đồng bộ có chủ đích khi đổi thư mục.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedFolderId) {
      loadFiles(selectedFolderId)
    } else {
      setFiles([])
    }
    setPreviewFile(null)
    setSelectedFiles(new Set())
  }, [selectedFolderId, loadFiles])
  /* eslint-enable react-hooks/set-state-in-effect */

  const {
    uploadQueue, isUploading,
    fileInputKey, folderInputKey,
    uploadFiles,
    handleUploadFile, handleUploadFolder,
    handleFileChange, handleFolderChange,
  } = useDocumentUpload({ resourcePath, selectedFolderId, loadFolders, loadFiles })

  // ── Folder tree helpers ──────────────────────────────────────────────────

  const toggleFolderExpand = (folderId, e) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
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
      const res = await fetch(`${API}/${resourcePath}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: newFolderName, parentId: newFolderParentId || null })
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
      const res = await fetch(`${API}/folders/${renamingFolder.id}`, {
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
      const res = await fetch(`${API}/folders/${deletingFolder.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      if (String(selectedFolderId) === String(deletingFolder.id)) setSelectedFolderId(null)
      await loadFolders()
      setShowDeleteFolderConfirm(false)
      setDeletingFolder(null)
    } catch {
      alert('Không thể xóa thư mục.')
    }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  const handleDragOver = (e) => {
    e.preventDefault()
    if (canEdit && selectedFolderId) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (!canEdit) return // chỉ PM/admin được upload bằng kéo-thả
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

  const handleToggleFileSelect = (file, isSelected) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      isSelected ? next.delete(file.id) : next.add(file.id)
      return next
    })
  }

  const handleSelectAll = (e) => {
    setSelectedFiles(e.target.checked ? new Set(files.map(f => f.id)) : new Set())
  }

  const handleDownload = () => {
    if (selectedFiles.size === 0) { alert('Vui lòng chọn file cần download'); return }
    for (const fileId of selectedFiles) {
      window.open(`${API}/files/${fileId}/download`, '_blank')
    }
  }

  const handleDelete = async () => {
    if (selectedFiles.size === 0) { alert('Vui lòng chọn file cần xóa'); return }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedFiles.size} file đã chọn?`)) return
    try {
      for (const fileId of selectedFiles) {
        await fetch(`${API}/files/${fileId}`, { method: 'DELETE' })
      }
      if (previewFile && selectedFiles.has(previewFile.id)) setPreviewFile(null)
      setSelectedFiles(new Set())
      if (selectedFolderId) await loadFiles(selectedFolderId)
    } catch {
      alert('Không thể xóa file. Vui lòng thử lại.')
    }
  }

  const folderPath = selectedFolderId ? getFolderPath(folders, selectedFolderId) : null

  if (loading) return <div className="documents-loading">Đang tải...</div>

  return (
    <div className="contract-documents-tab">

      {/* ── Left panel: folder tree ─────────────────────────────────────── */}
      <div className="documents-left-panel">
        <div className="panel-header">
          <h3>Thư mục</h3>
          <EditGuard>
            <button className="btn-icon" onClick={handleCreateFolder} title="Tạo thư mục mới">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>
              </svg>
            </button>
          </EditGuard>
        </div>
        <div className="folder-tree">
          {folders.length === 0
            ? <div className="folder-tree-empty">Chưa có thư mục nào</div>
            : <DocumentFolderTree
                folders={folders}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onSelect={setSelectedFolderId}
                onToggleExpand={toggleFolderExpand}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
              />
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
              <EditGuard>
                <button className="btn-toolbar btn-upload" onClick={handleUploadFile} disabled={!selectedFolderId || isUploading}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                  {isUploading ? 'Đang upload...' : 'Upload'}
                </button>
                <button className="btn-toolbar btn-icon-only" onClick={handleUploadFolder} disabled={isUploading} title={selectedFolderId ? 'Upload thư mục vào đây' : 'Upload thư mục (tạo ở cấp gốc)'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 7h-3v3h-2v-3h-3v-2h3V8h2v3h3v2z"/></svg>
                </button>
                <input id="file-upload-input" type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} key={fileInputKey} />
                <input id="folder-upload-input" type="file" multiple style={{ display: 'none' }} onChange={handleFolderChange} key={folderInputKey} {...{ webkitdirectory: '' }} />
              </EditGuard>
            </div>
            <div className="toolbar-right">
              <button className="btn-toolbar btn-icon-only" onClick={handleDownload} disabled={selectedFiles.size === 0} title={`Download${selectedFiles.size > 1 ? ` (${selectedFiles.size})` : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
              <EditGuard>
                <button className="btn-toolbar btn-icon-only btn-delete" onClick={handleDelete} disabled={selectedFiles.size === 0} title={`Xóa${selectedFiles.size > 1 ? ` (${selectedFiles.size})` : ''}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </EditGuard>
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
              <DocumentFileTable
                files={files}
                selectedFiles={selectedFiles}
                previewFileId={previewFile?.id}
                onSelectAll={handleSelectAll}
                onFileClick={handleFileClick}
                onToggleSelect={handleToggleFileSelect}
              />
            )}
          </div>
        </div>

        {/* Preview panel — always visible */}
        <DocumentPreviewPanel file={previewFile} />
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {showNewFolderModal && (
        <NewFolderModal
          name={newFolderName}
          setName={setNewFolderName}
          parentId={newFolderParentId}
          setParentId={setNewFolderParentId}
          folders={folders}
          onConfirm={confirmCreateFolder}
          onClose={() => setShowNewFolderModal(false)}
        />
      )}

      {showRenameModal && (
        <RenameFolderModal
          value={renameFolderInput}
          setValue={setRenameFolderInput}
          onConfirm={confirmRenameFolder}
          onClose={() => setShowRenameModal(false)}
        />
      )}

      {showDeleteFolderConfirm && (
        <DeleteFolderModal
          folder={deletingFolder}
          onConfirm={confirmDeleteFolder}
          onClose={() => setShowDeleteFolderConfirm(false)}
        />
      )}
    </div>
  )
}
