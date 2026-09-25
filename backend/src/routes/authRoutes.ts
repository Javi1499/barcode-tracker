import { Router } from 'express';
import { socialLogin, getUserProfile } from '../controllers/authController';

const router = Router();

// Endpoint de login/registro social con Google, Facebook y Apple
router.post('/social-login', socialLogin);

// Endpoint de consulta de perfil de cazador
router.get('/profile/:id', getUserProfile);

export default router;
