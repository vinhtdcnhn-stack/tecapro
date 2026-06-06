import { useState } from 'react'
import { API } from '../../config/api'
import { getCurrentUserId } from './documentsUtils'

export function useDocumentUpload({ resourcePath, selectedFolderId, loadFolders, loadFiles }) {
  const [fileInputKey, setFileInputKey] = useState(0)
  const [folderInputKey, setFolderInputKey] = useState(0)
  const [uploadQueue, setUploadQueue] = useState([])

  const isUploading = uploadQueue.some(q => q.status === 'pending' || q.status === 'uploading')

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
        const res = await fetch(`${API}/${resourcePath}/files/upload`, { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
      } catch {
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item))
      }
    }
    await loadFiles(selectedFolderId)
    setTimeout(() => setUploadQueue([]), 3000)
  }

  const uploadFolder = async (files) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const folderIdMap = new Map()
    folderIdMap.set('', selectedFolderId)

    const folderPaths = new Set()
    for (const f of fileArray) {
      const parts = f.webkitRelativePath.split('/')
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join('/'))
      }
    }
    const sortedPaths = Array.from(folderPaths).sort(
      (a, b) => a.split('/').length - b.split('/').length
    )

    for (const path of sortedPaths) {
      const parts = path.split('/')
      const folderName = parts[parts.length - 1]
      const parentPath = parts.slice(0, -1).join('/')
      const parentId = folderIdMap.get(parentPath) ?? selectedFolderId
      try {
        const res = await fetch(`${API}/${resourcePath}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderName, parentId, userId: getCurrentUserId() })
        })
        const data = await res.json()
        if (res.ok && data.id) folderIdMap.set(path, data.id)
      } catch { /* skip on error */ }
    }

    const items = fileArray.map(f => ({ name: f.webkitRelativePath || f.name, status: 'pending', file: f }))
    setUploadQueue(items)
    for (let i = 0; i < items.length; i++) {
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))
      try {
        const relPath = items[i].file.webkitRelativePath
        const folderPath = relPath.split('/').slice(0, -1).join('/')
        const targetFolderId = folderIdMap.get(folderPath) ?? selectedFolderId
        const formData = new FormData()
        formData.append('file', items[i].file)
        formData.append('folderId', targetFolderId)
        formData.append('userId', getCurrentUserId() || '')
        const res = await fetch(`${API}/${resourcePath}/files/upload`, { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
      } catch {
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item))
      }
    }

    await loadFolders()
    await loadFiles(selectedFolderId)
    setTimeout(() => setUploadQueue([]), 3000)
  }

  const handleUploadFile = () => document.getElementById('file-upload-input').click()
  const handleUploadFolder = () => document.getElementById('folder-upload-input').click()

  const handleFileChange = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    if (!selectedFolderId) { alert('Vui lòng chọn thư mục để upload file'); return }
    await uploadFiles(files)
    setFileInputKey(prev => prev + 1)
  }

  const handleFolderChange = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    if (!selectedFolderId) { alert('Vui lòng chọn thư mục để upload vào'); return }
    await uploadFolder(files)
    setFolderInputKey(prev => prev + 1)
  }

  return {
    uploadQueue, isUploading,
    fileInputKey, folderInputKey,
    handleUploadFile, handleUploadFolder,
    handleFileChange, handleFolderChange,
  }
}
