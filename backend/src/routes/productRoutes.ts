import { Router } from 'express';
import {
  lookupBarcode,
  searchCommunityDeals,
  submitBarcodeFeedback,
  updateProduct
} from '../controllers/productController';

const router = Router();

// GET /api/products/lookup/:barcode - Busca si un código ya fue registrado previamente
router.get('/lookup/:barcode', lookupBarcode);

// GET /api/products/community/search - Banco de códigos y búsqueda comunitaria de ofertas
router.get('/community/search', searchCommunityDeals);

// POST /api/products/feedback - Calificar o reportar si un código funciona o no en checador
router.post('/feedback', submitBarcodeFeedback);

// PUT /api/products/:id - Editar nombre o datos del producto (sólo por su creador)
router.put('/:id', updateProduct);

export default router;

