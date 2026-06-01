import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js'

const router = Router()

router.get('/contracts/:id/tasks',  getTasks)
router.post('/contracts/:id/tasks', createTask)
router.put('/tasks/:id',            updateTask)
router.delete('/tasks/:id',         deleteTask)

export default router
