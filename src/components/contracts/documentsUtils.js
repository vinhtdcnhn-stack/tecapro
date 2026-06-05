// Pure helpers & formatters for the documents tab and its sub-components.

export function getCurrentUserId() {
  return localStorage.getItem('userId') || null
}

export function getFolderPath(folderList, targetId, path = []) {
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

export function flattenFolders(folderList, level = 0) {
  const result = []
  for (const folder of folderList) {
    result.push({ ...folder, level })
    if (folder.children?.length > 0) result.push(...flattenFolders(folder.children, level + 1))
  }
  return result
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('vi-VN')
}

export function getFileIcon(mimeType = '') {
  if (mimeType.includes('pdf')) return { emoji: '📄', color: '#dc2626' }
  if (mimeType.includes('word')) return { emoji: '📝', color: '#2563eb' }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { emoji: '📊', color: '#16a34a' }
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return { emoji: '📋', color: '#ea580c' }
  if (mimeType.includes('image')) return { emoji: '🖼️', color: '#7c3aed' }
  if (mimeType.includes('zip') || mimeType.includes('rar')) return { emoji: '📦', color: '#d97706' }
  return { emoji: '📁', color: '#6b7280' }
}
