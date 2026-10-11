const { z } = require('zod');

const paginationFields = {
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
};

const productSchema = z.object({
  sku: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  price: z.coerce.number().nonnegative(),
  is_active: z.boolean().optional()
});

const customerSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email(),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal(''))
});

const inventoryRestockSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  note: z.string().trim().max(255).optional().or(z.literal(''))
});

const inventoryAdjustmentSchema = z.object({
  quantity: z.coerce.number().int(),
  note: z.string().trim().min(3).max(255)
});

const orderItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive()
});

const createOrderSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  items: z.array(orderItemSchema).min(1)
});

const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'])
});

const productStatusSchema = z.object({
  isActive: z.boolean()
});

const numericIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().safe()
});

const productIdParamsSchema = z.object({
  productId: z.coerce.number().int().positive().safe()
});

const productListQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(255).optional().default(''),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all')
});

const customerListQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(255).optional().default('')
});

const orderListQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(255).optional().default(''),
  status: z.enum(['all', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional().default('all')
});

const inventoryListQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(255).optional().default(''),
  status: z.enum(['all', 'low', 'healthy', 'inactive']).optional().default('all')
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128)
});

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF')
});

const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(128).optional()
}).refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update' });

const userListQuerySchema = z.object({
  ...paginationFields,
  search: z.string().trim().max(255).optional().default(''),
  role: z.enum(['all', 'ADMIN', 'STAFF']).optional().default('all'),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all')
});

module.exports = {
  productSchema,
  customerSchema,
  inventoryRestockSchema,
  inventoryAdjustmentSchema,
  createOrderSchema,
  statusSchema,
  productStatusSchema,
  numericIdParamsSchema,
  productIdParamsSchema,
  productListQuerySchema,
  customerListQuerySchema,
  orderListQuerySchema,
  inventoryListQuerySchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  userListQuerySchema
};
