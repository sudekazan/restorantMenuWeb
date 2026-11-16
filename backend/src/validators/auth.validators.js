import { z } from 'zod';
import { email, password } from './common.js';

export const registerRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(80),
  email,
  password,
  phone: z.string().trim().max(20).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Şifre gerekli.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});
