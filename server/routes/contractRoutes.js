import { Router } from 'express'
import * as contractController from '../controllers/contractController.js'
import { pmFromParam } from '../middleware/contractAccess.js'

const router = Router()

router.get('/', contractController.getAllContracts)
router.get('/:id', contractController.getContractById)
router.post('/check-contract-no', contractController.checkContractNoDuplicate)
router.post('/', contractController.createContract)
// Chỉ PM của HĐ (hoặc admin) được sửa — gồm cả danh sách thành viên
router.put('/:id', pmFromParam('id'), contractController.updateContract)

export default router
