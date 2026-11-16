import { Router } from 'express';
import authRoutes from './auth.routes.js';
import publicRoutes from './public.routes.js';
import staffRoutes from './staff.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.use('/staff', staffRoutes);
router.use('/admin', adminRoutes);

export default router;
