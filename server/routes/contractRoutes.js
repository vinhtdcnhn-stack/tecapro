import { Router } from 'express'
import * as contractController from '../controllers/contractController.js'

const router = Router()

router.get('/', contractController.getAllContracts)
router.post('/check-contract-no', contractController.checkContractNoDuplicate)
router.post('/', contractController.createContract)

export default router
