INSERT INTO products (sku, name, description, price, is_active) VALUES
  ('SKU-1001', 'Wireless Mouse', 'Ergonomic wireless mouse for office use.', 24.99, 1),
  ('SKU-1002', 'Mechanical Keyboard', 'Compact RGB keyboard with switch tuning.', 79.50, 1),
  ('SKU-1003', '27-inch Monitor', '4K IPS display with USB-C connectivity.', 329.99, 1),
  ('SKU-1004', 'USB-C Hub', '7-port USB-C docking hub for laptops.', 59.00, 1),
  ('SKU-1005', 'Laptop Stand', 'Aluminium adjustable stand for compact laptops.', 44.00, 1),
  ('SKU-1006', 'Webcam Pro', '1080p HD webcam with noise-reducing mic.', 89.99, 1),
  ('SKU-1007', '4TB SSD Drive', 'NVMe SSD for fast workstation storage.', 149.00, 1),
  ('SKU-1008', 'Office Chair', 'Ergonomic mesh chair with lumbar support.', 289.50, 1),
  ('SKU-1009', 'Desk Lamp', 'Adjustable LED desk lamp with touch control.', 38.75, 1),
  ('SKU-1010', 'Bluetooth Speaker', 'Portable wireless speaker with deep bass.', 64.99, 1),
  ('SKU-1011', 'Notebook Set', 'Premium 200-page notebook with pen set.', 18.50, 1),
  ('SKU-1012', 'Projector', 'Compact projector with 1080p support.', 429.00, 1),
  ('SKU-1013', 'Phone Tripod', 'Lightweight tripod for content creators.', 29.00, 0),
  ('SKU-1014', 'Mini Printer', 'Portable photo printer with mobile app support.', 109.50, 1),
  ('SKU-1015', 'Power Bank', '20,000 mAh rechargeable battery pack.', 54.95, 1)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO inventory (product_id, quantity_on_hand, reorder_level, updated_at)
SELECT id, CASE id
  WHEN 1 THEN 24
  WHEN 2 THEN 12
  WHEN 3 THEN 8
  WHEN 4 THEN 18
  WHEN 5 THEN 15
  WHEN 6 THEN 9
  WHEN 7 THEN 10
  WHEN 8 THEN 6
  WHEN 9 THEN 22
  WHEN 10 THEN 14
  WHEN 11 THEN 35
  WHEN 12 THEN 7
  WHEN 13 THEN 0
  WHEN 14 THEN 11
  WHEN 15 THEN 19
END, CASE id
  WHEN 1 THEN 8
  WHEN 2 THEN 5
  WHEN 3 THEN 4
  WHEN 4 THEN 6
  WHEN 5 THEN 6
  WHEN 6 THEN 5
  WHEN 7 THEN 4
  WHEN 8 THEN 5
  WHEN 9 THEN 8
  WHEN 10 THEN 5
  WHEN 11 THEN 10
  WHEN 12 THEN 4
  WHEN 13 THEN 5
  WHEN 14 THEN 7
  WHEN 15 THEN 7
END, NOW()
FROM products
ON DUPLICATE KEY UPDATE quantity_on_hand = quantity_on_hand;

INSERT INTO customers (name, email, phone, address) VALUES
  ('Ava Martinez', 'ava.martinez@example.com', '+1-415-555-0101', '245 Market Street, San Francisco, CA'),
  ('Noah Patel', 'noah.patel@example.com', '+1-720-555-0142', '88 Lake Avenue, Denver, CO'),
  ('Priya Sharma', 'priya.sharma@example.com', '+1-312-555-0198', '103 Oak Lane, Chicago, IL'),
  ('Lucas Brown', 'lucas.brown@example.com', '+1-206-555-0135', '77 Pine Road, Seattle, WA'),
  ('Emma Johnson', 'emma.johnson@example.com', '+1-646-555-0177', '301 Beacon Avenue, New York, NY')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO orders (order_number, customer_id, status, total_amount, created_at)
VALUES
  ('ORD-1001', 1, 'DELIVERED', 129.48, '2025-01-15 09:00:00'),
  ('ORD-1002', 2, 'CONFIRMED', 388.99, '2025-02-10 15:30:00'),
  ('ORD-1003', 3, 'SHIPPED', 326.99, '2025-03-05 11:15:00'),
  ('ORD-1004', 4, 'PENDING', 101.99, '2025-04-02 13:00:00'),
  ('ORD-1005', 5, 'CANCELLED', 64.99, '2025-05-14 17:45:00')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT seed.order_id, seed.product_id, seed.quantity, seed.unit_price, seed.line_total
FROM (
  SELECT 1 AS order_id, 1 AS product_id, 2 AS quantity, 24.99 AS unit_price, 49.98 AS line_total UNION ALL
  SELECT 1, 2, 1, 79.50, 79.50 UNION ALL
  SELECT 2, 3, 1, 329.99, 329.99 UNION ALL
  SELECT 2, 4, 1, 59.00, 59.00 UNION ALL
  SELECT 3, 5, 2, 44.00, 88.00 UNION ALL
  SELECT 3, 6, 1, 89.99, 89.99 UNION ALL
  SELECT 3, 7, 1, 149.00, 149.00 UNION ALL
  SELECT 4, 11, 2, 18.50, 37.00 UNION ALL
  SELECT 4, 10, 1, 64.99, 64.99 UNION ALL
  SELECT 5, 10, 1, 64.99, 64.99
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM order_items AS existing
  WHERE existing.order_id = seed.order_id AND existing.product_id = seed.product_id
);

UPDATE orders AS o
JOIN (
  SELECT order_id, SUM(line_total) AS item_total
  FROM order_items
  GROUP BY order_id
) AS totals ON totals.order_id = o.id
SET o.total_amount = totals.item_total
WHERE o.order_number IN ('ORD-1001', 'ORD-1002', 'ORD-1003', 'ORD-1004', 'ORD-1005');

INSERT INTO inventory_transactions (product_id, change_qty, reason, order_id, note, created_at)
SELECT seed.product_id, seed.change_qty, seed.reason, seed.order_id, seed.note, seed.created_at
FROM (
  SELECT 1 AS product_id, -2 AS change_qty, 'ORDER' AS reason, 1 AS order_id, 'Order ORD-1001' AS note, '2025-01-15 09:00:00' AS created_at UNION ALL
  SELECT 2, -1, 'ORDER', 1, 'Order ORD-1001', '2025-01-15 09:00:00' UNION ALL
  SELECT 3, -1, 'ORDER', 2, 'Order ORD-1002', '2025-02-10 15:30:00' UNION ALL
  SELECT 4, -1, 'ORDER', 2, 'Order ORD-1002', '2025-02-10 15:30:00' UNION ALL
  SELECT 5, -2, 'ORDER', 3, 'Order ORD-1003', '2025-03-05 11:15:00' UNION ALL
  SELECT 6, -1, 'ORDER', 3, 'Order ORD-1003', '2025-03-05 11:15:00' UNION ALL
  SELECT 7, -1, 'ORDER', 3, 'Order ORD-1003', '2025-03-05 11:15:00' UNION ALL
  SELECT 11, -2, 'ORDER', 4, 'Order ORD-1004', '2025-04-02 13:00:00' UNION ALL
  SELECT 10, -1, 'ORDER', 4, 'Order ORD-1004', '2025-04-02 13:00:00' UNION ALL
  SELECT 10, 1, 'CANCEL', 5, 'Cancelled order ORD-1005', '2025-05-14 17:45:00'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_transactions AS existing
  WHERE existing.order_id = seed.order_id
    AND existing.product_id = seed.product_id
    AND existing.reason = seed.reason
);

INSERT INTO inventory_transactions (product_id, change_qty, reason, order_id, note)
SELECT balances.product_id,
       balances.quantity_on_hand - balances.recorded_qty,
       'ADJUSTMENT',
       NULL,
       'Opening balance reconciliation'
FROM (
  SELECT i.product_id,
         i.quantity_on_hand,
         COALESCE(SUM(t.change_qty), 0) AS recorded_qty
  FROM inventory AS i
  LEFT JOIN inventory_transactions AS t ON t.product_id = i.product_id
  GROUP BY i.product_id, i.quantity_on_hand
) AS balances
WHERE balances.quantity_on_hand <> balances.recorded_qty;
