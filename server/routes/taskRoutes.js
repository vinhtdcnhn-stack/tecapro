import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js'
import { getAttachments, uploadAttachment, deleteAttachment, upload } from '../controllers/taskAttachmentController.js'

const router = Router()

router.get('/contracts/:id/tasks',  getTasks)
router.post('/contracts/:id/tasks', createTask)
router.put('/tasks/:id',            updateTask)
router.delete('/tasks/:id',         deleteTask)

router.get('/tasks/:taskId/attachments',        getAttachments)
router.post('/tasks/:taskId/attachments',       upload.single('file'), uploadAttachment)
router.delete('/task-attachments/:id',          deleteAttachment)

export default router
