import { Router } from 'express';
import {
  socialLogin,
  getUserProfile,
  registerWithEmail,
  loginWithEmail
} from '../controllers/authController';

const router = Router();

// Registro e inicio de sesión seguro con correo electrónico y contraseña
router.post('/register', registerWithEmail);
router.post('/login', loginWithEmail);

// Endpoint de login/registro social con Google, Facebook y Apple
router.post('/social-login', socialLogin);

// Endpoint de consulta de perfil de cazador
router.get('/profile/:id', getUserProfile);

export default router;
