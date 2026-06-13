import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js'
import { getAttachments, uploadAttachment, deleteAttachment, upload } from '../controllers/taskAttachmentController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ (F-11)
router.get('/contracts/:id/tasks',  getTasks)
router.post('/contracts/:id/tasks', pmFromParam('id'), createTask)
router.put('/tasks/:id',            pmVia('task'), updateTask)
router.delete('/tasks/:id',         pmVia('task'), deleteTask)

router.get('/tasks/:taskId/attachments',        getAttachments)
// Guard trước multer để request không có quyền không ghi file ra đĩa
router.post('/tasks/:taskId/attachments',       pmVia('task', 'taskId'), upload.single('file'), uploadAttachment)
router.delete('/task-attachments/:id',          pmVia('taskAttachment'), deleteAttachment)

export default router
