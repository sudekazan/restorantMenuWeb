import { Router } from 'express';
import * as category from '../controllers/category.controller.js';
import * as product from '../controllers/product.controller.js';
import * as table from '../controllers/table.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { authorize, protect, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { uploadProductImage } from '../middlewares/upload.js';
import { idParam } from '../validators/common.js';
import {
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  productCreateSchema,
  productListQuery,
  productUpdateSchema,
} from '../validators/menu.validators.js';
import { tableBulkCreateSchema, tableCreateSchema, tableQrPdfQuery, tableUpdateSchema } from '../validators/table.validators.js';
import {
  reportQuery,
  restaurantIyzicoSchema,
  restaurantUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
} from '../validators/admin.validators.js';

/** Yönetici uçları: /api/v1/admin/... */
const router = Router();
router.use(protect, requireTenant, authorize('admin', 'manager'));

const id = validate({ params: idParam });
const ownerOnly = authorize('admin');

// Restoran ayarları
router.get('/restaurant', admin.getMyRestaurant);
router.patch('/restaurant', ownerOnly, validate({ body: restaurantUpdateSchema }), admin.updateMyRestaurant);
router.patch('/restaurant/iyzico', ownerOnly, validate({ body: restaurantIyzicoSchema }), admin.updateRestaurantIyzico);

// Kategoriler
router.get('/categories', category.listCategories);
router.post('/categories', validate({ body: categoryCreateSchema }), category.createCategory);
router.patch('/categories/reorder', validate({ body: categoryReorderSchema }), category.reorderCategories);
router.get('/categories/:id', id, category.getCategory);
router.patch('/categories/:id', validate({ params: idParam, body: categoryUpdateSchema }), category.updateCategory);
router.delete('/categories/:id', id, category.deleteCategory);

// Ürünler
router.get('/products', validate({ query: productListQuery }), product.listProducts);
router.post('/products', validate({ body: productCreateSchema }), product.createProduct);
router.get('/products/:id', id, product.getProduct);
router.patch('/products/:id', validate({ params: idParam, body: productUpdateSchema }), product.updateProduct);
router.delete('/products/:id', id, product.deleteProduct);
router.post('/products/:id/image', id, uploadProductImage, product.uploadImage);

// Masalar & QR
router.get('/tables', table.listTables);
router.post('/tables', validate({ body: tableCreateSchema }), table.createTable);
router.post('/tables/bulk', validate({ body: tableBulkCreateSchema }), table.bulkCreateTables);
router.get('/tables/qr/pdf', validate({ query: tableQrPdfQuery }), table.bulkQrPdf);
router.get('/tables/:id', id, table.getTable);
router.patch('/tables/:id', validate({ params: idParam, body: tableUpdateSchema }), table.updateTable);
router.delete('/tables/:id', id, table.deleteTable);
router.post('/tables/:id/rotate-qr', id, table.rotateQr);
router.get('/tables/:id/qr/png', id, table.tableQrPng);
router.get('/tables/:id/qr/pdf', id, table.tableQrPdf);

// Personel
router.get('/users', ownerOnly, admin.listUsers);
router.post('/users', ownerOnly, validate({ body: userCreateSchema }), admin.createUser);
router.patch('/users/:id', ownerOnly, validate({ params: idParam, body: userUpdateSchema }), admin.updateUser);
router.delete('/users/:id', ownerOnly, id, admin.deactivateUser);

// Raporlar
router.get('/reports/summary', validate({ query: reportQuery }), admin.getSummary);

export default router;
