import { Router } from 'express';
import { addPriceEntry, getProductPriceHistory } from '../controllers/priceController';

const router = Router();

// POST /api/prices - Registra un nuevo avistamiento de precio (inmutable, genera nuevo historial)
router.post('/', addPriceEntry);

// GET /api/prices/history/:barcode - Obtiene la serie de tiempo para graficar la evolución del precio
router.get('/history/:barcode', getProductPriceHistory);

export default router;
