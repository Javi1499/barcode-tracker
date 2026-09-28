import { Router } from 'express';
import {
  lookupBarcode,
  searchCommunityDeals,
  submitBarcodeFeedback
} from '../controllers/productController';

const router = Router();

// GET /api/products/lookup/:barcode - Busca si un código ya fue registrado previamente
router.get('/lookup/:barcode', lookupBarcode);

// GET /api/products/community/search - Banco de códigos y búsqueda comunitaria de ofertas
router.get('/community/search', searchCommunityDeals);

// POST /api/products/feedback - Calificar o reportar si un código funciona o no en checador
router.post('/feedback', submitBarcodeFeedback);

export default router;
