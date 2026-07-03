import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask, reorderTasks, transferTask, getAssignmentLog } from '../controllers/taskController.js'
import { getAttachments, uploadAttachment, deleteAttachment, upload } from '../controllers/taskAttachmentController.js'
import { getEntries, addEntry, deleteEntry, getUnreadCount, addEntryImage, uploadEntryImage } from '../controllers/taskEntryController.js'
import { pmVia, canCreateTask, canWriteTask, canReorderTasks, canTransferTask } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ
router.get('/contracts/:id/tasks',  getTasks)
router.post('/contracts/:id/tasks', canCreateTask('id'), createTask)
router.put('/contracts/:id/tasks/reorder', canReorderTasks('id'), reorderTasks)
router.put('/tasks/:id',            canWriteTask('id'), updateTask)
router.put('/tasks/:id/transfer',   canTransferTask('id'), transferTask)
router.get('/tasks/:id/assignment-log', getAssignmentLog)
router.delete('/tasks/:id',         canWriteTask('id'), deleteTask)

router.get('/tasks/:taskId/attachments',        getAttachments)
// Guard trước multer để request không có quyền không ghi file ra đĩa
router.post('/tasks/:taskId/attachments',       pmVia('task', 'taskId'), upload.single('file'), uploadAttachment)
router.delete('/task-attachments/:id',          pmVia('taskAttachment'), deleteAttachment)

// Tổng số mục chưa đọc của user trên mọi việc HĐ liên quan (cho cảnh báo nền đỏ toàn trang).
router.get('/contract-tasks/unread-count',      getUnreadCount)

// Dòng thời gian trao đổi của việc (báo cáo/chỉ đạo/quyết định/trao đổi):
// đọc mở (tự ghi mốc đã đọc); thêm/xóa gác theo vai trò trong controller.
router.get('/tasks/:taskId/entries',            getEntries)
router.post('/tasks/:taskId/entries',           addEntry)
router.delete('/task-entries/:id',              deleteEntry)
// Đính ảnh cho một mục dòng thời gian (quyền gác trong controller theo tác giả/PM).
router.post('/task-entries/:id/images',         uploadEntryImage.single('image'), addEntryImage)

export default router
