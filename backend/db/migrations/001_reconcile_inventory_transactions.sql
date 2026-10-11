USE stockflow_db;

START TRANSACTION;

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

COMMIT;
