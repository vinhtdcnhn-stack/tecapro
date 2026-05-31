import { Router } from 'express'
import * as contractController from '../controllers/contractController.js'

const router = Router()

router.get('/', contractController.getAllContracts)
router.get('/:id', contractController.getContractById)
router.post('/check-contract-no', contractController.checkContractNoDuplicate)
router.post('/', contractController.createContract)
router.put('/:id', contractController.updateContract)

export default router
