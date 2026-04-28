INSERT INTO "AchievementDefinition" ("id", "code", "title", "description") VALUES
  ('achv_sales_25', 'SALES_25', 'Quarter Century Seller', 'Complete 25 successful sales.'),
  ('achv_sales_50', 'SALES_50', 'Half-Century Seller', 'Complete 50 successful sales.'),
  ('achv_sales_100', 'SALES_100', 'Century Seller', 'Complete 100 successful sales.'),
  ('achv_sales_250', 'SALES_250', 'Elite Seller 250', 'Complete 250 successful sales.'),
  ('achv_sales_500', 'SALES_500', 'Master Seller 500', 'Complete 500 successful sales.'),
  ('achv_sales_1000', 'SALES_1000', 'Legend Seller 1000', 'Complete 1000 successful sales.')
ON CONFLICT ("code") DO NOTHING;
