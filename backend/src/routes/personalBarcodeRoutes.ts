import { Router } from 'express';
import {
  getPersonalBarcodes,
  savePersonalBarcode,
  updatePersonalBarcode,
  deletePersonalBarcode,
  publishPersonalBarcode
} from '../controllers/personalBarcodeController';

const router = Router();

// GET /api/personal-barcodes?userId=... - Listar códigos del banco personal
router.get('/', getPersonalBarcodes);

// POST /api/personal-barcodes - Guardar código privado en el banco personal
router.post('/', savePersonalBarcode);

// PUT /api/personal-barcodes/:id - Actualizar datos del código en banco personal
router.put('/:id', updatePersonalBarcode);

// DELETE /api/personal-barcodes/:id - Eliminar código de banco personal
router.delete('/:id', deletePersonalBarcode);

// POST /api/personal-barcodes/:id/publish - Publicar código a la comunidad
router.post('/:id/publish', publishPersonalBarcode);

export default router;
