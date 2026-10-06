import { Router } from 'express';
import {
  addPriceEntry,
  getProductPriceHistory,
  updatePriceEntry
} from '../controllers/priceController';

const router = Router();

// POST /api/prices - Registra un nuevo avistamiento de precio (inmutable, genera nuevo historial)
router.post('/', addPriceEntry);

// GET /api/prices/history/:barcode - Obtiene la serie de tiempo para graficar la evolución del precio
router.get('/history/:barcode', getProductPriceHistory);

// PUT /api/prices/:id - Corrige un precio registrado (sólo por quien lo registró)
router.put('/:id', updatePriceEntry);

export default router;

