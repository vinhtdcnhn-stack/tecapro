import { Router } from 'express'
import * as contractController from '../controllers/contractController.js'

const router = Router()

router.get('/', contractController.getAllContracts)

export default router
