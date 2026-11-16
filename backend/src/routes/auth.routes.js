import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { changePasswordSchema, loginSchema, registerRestaurantSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerRestaurantSchema }), auth.registerRestaurant);
router.post('/login', authLimiter, validate({ body: loginSchema }), auth.login);
router.get('/me', protect, auth.me);
router.patch('/me/password', protect, validate({ body: changePasswordSchema }), auth.changePassword);

export default router;
