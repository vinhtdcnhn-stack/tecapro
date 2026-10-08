import { Router } from 'express'
import * as contractController from '../controllers/contractController.js'
import { searchContractsByItem } from '../controllers/contractItemSearchController.js'
import { contractPermFromParam } from '../middleware/contractAccess.js'
import { loadContractPermissions } from '../auth/permissions.js'

const router = Router()

router.get('/', contractController.getAllContracts)
// Tìm HĐ theo tên hàng hóa trong bảng giá (đặt trước '/:id')
router.get('/search-items', searchContractsByItem)
// Quyền HĐ (lớp B) hiệu lực của user hiện tại trong HĐ này — FE dùng ẩn/hiện tab + section.
router.get('/:id/my-permissions', async (req, res, next) => {
  try {
    const perms = await loadContractPermissions(req.user.id, req.user.role, req.params.id)
    res.json({ perms })
  } catch (err) { next(err) }
})
router.get('/:id', contractController.getContractById)
router.post('/check-contract-no', contractController.checkContractNoDuplicate)
router.post('/', contractController.createContract)
// Sửa thông tin HĐ (gồm danh sách thành viên) — quyền co.info.manage (bootstrap = PM)
router.put('/:id', contractPermFromParam('co.info.manage', 'id'), contractController.updateContract)

export default router
