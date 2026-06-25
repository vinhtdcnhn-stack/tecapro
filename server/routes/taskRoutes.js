import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask, reorderTasks, transferTask, getAssignmentLog } from '../controllers/taskController.js'
import { getAttachments, uploadAttachment, deleteAttachment, upload } from '../controllers/taskAttachmentController.js'
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

export default router
