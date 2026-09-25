import { Router } from 'express';
import { lookupBarcode, searchCommunityDeals } from '../controllers/productController';

const router = Router();

// GET /api/products/lookup/:barcode - Busca si un código ya fue registrado previamente
router.get('/lookup/:barcode', lookupBarcode);

// GET /api/products/community/search - Banco de códigos y búsqueda comunitaria de ofertas
router.get('/community/search', searchCommunityDeals);

export default router;
