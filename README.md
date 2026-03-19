# SqlLens


Instant SQL visualization — see your query structure at a glance. No data leaves your browser.

---

A professional-grade, **100% client-side** SQL visualizer. It transforms complex SQL queries into interactive, hierarchical dependency graphs. No data ever leaves your browser—**no AI APIs, no backend, and no third-party tracking.**

---

## What is this for?

Understanding **legacy SQL spaghetti** is one of the biggest time-sinks in data engineering. This tool is designed to:

* **Debug Complex Logic:** Instantly see which filters are applied to which tables without scrolling through 100 lines of code.
* **Audit Data Lineage:** Trace how CTEs and subqueries feed into your final result set.
* **Onboard Faster:** Help new developers visualize a database's "mental model" by seeing the physical relationships between tables.
* **Documentation:** Generate high-quality architectural diagrams of your code for PRs or internal wikis.

---

## Examples

### Example 1: Multi-Table E-Commerce Query


<img width="2574" height="3012" alt="small" src="https://github.com/user-attachments/assets/c1b1641b-256f-4d96-afa0-59b36eac3a1a" />




```sql
SELECT
    users.name AS customer_name,
    users.email AS customer_email,
    orders.id AS order_reference,
    orders.order_date,
    products.name AS product_name,
    categories.name AS category_name,
    order_items.quantity,
    order_items.price_at_purchase,
    (order_items.quantity * order_items.price_at_purchase) AS line_item_total,
    suppliers.company_name AS vendor,
    shipping_methods.method_name AS shipping_via,
    shipping_status.status_name AS delivery_status
FROM users
JOIN orders ON users.id = orders.user_id
JOIN order_items ON orders.id = order_items.order_id
JOIN products ON order_items.product_id = products.id
JOIN categories ON products.category_id = categories.id
JOIN suppliers ON products.supplier_id = suppliers.id
JOIN shipping_methods ON orders.shipping_method_id = shipping_methods.id
JOIN shipping_status ON orders.status_id = shipping_status.id
LEFT JOIN reviews ON users.id = reviews.user_id AND products.id = reviews.product_id
WHERE orders.order_date BETWEEN '2024-01-01' AND '2024-12-31'
  AND users.email LIKE '%@gmail.com'
  AND categories.name IN ('Electronics', 'Computers', 'Gadgets')
ORDER BY order_items.price_at_purchase DESC;
```

### Example 2: Legacy Monolithic CTE Engine: Complex Supply Chain Revenue Analytics Example


<img width="6400" height="4348" alt="bigquerfinal" src="https://github.com/user-attachments/assets/63780dca-ab8f-4c54-9d10-581af061e128" />



```sql
WITH
  customer_segments AS (
      SELECT
          c.customer_id,
          c.customer_name,
          c.email,
          c.tier,
          SUM(o.order_total) AS lifetime_value,
          COUNT(o.order_id) AS order_count,
          AVG(o.order_total) AS avg_order_value,
          ROW_NUMBER() OVER (PARTITION BY c.tier ORDER BY SUM(o.order_total) DESC) AS tier_rank
      FROM customers c
      INNER JOIN orders o ON c.customer_id = o.customer_id
      WHERE o.order_date >= '2023-01-01'
      GROUP BY c.customer_id, c.customer_name, c.email, c.tier
  ),
  product_performance AS (
      SELECT
          p.product_id,
          p.product_name,
          p.sku,
          p.base_price,
          p.cost,
          cat.category_id,
          cat.category_name,
          parent_cat.category_name AS parent_category,
          SUM(oi.quantity) AS total_sold,
          SUM(oi.quantity * oi.unit_price) AS gross_revenue,
          COUNT(DISTINCT oi.order_id) AS order_frequency,
          AVG(oi.unit_price) AS avg_selling_price,
          RANK() OVER (PARTITION BY cat.category_id ORDER BY SUM(oi.quantity * oi.unit_price) DESC) AS category_rank
      FROM products p
      INNER JOIN categories cat ON p.category_id = cat.category_id
      LEFT JOIN categories parent_cat ON cat.parent_category_id = parent_cat.category_id
      INNER JOIN order_items oi ON p.product_id = oi.product_id
      INNER JOIN orders o ON oi.order_id = o.order_id
      WHERE o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
      GROUP BY p.product_id, p.product_name, p.sku, p.base_price, p.cost,
                cat.category_id, cat.category_name, parent_cat.category_name
  ),

  inventory_analysis AS (
      SELECT
          w.warehouse_id,
          w.warehouse_name,
          w.location,
          w.warehouse_type,
          i.product_id,
          i.quantity_on_hand,
          i.reorder_level,
          i.last_restocked_date,
          CASE
              WHEN i.quantity_on_hand <= i.reorder_level THEN 'Critical'
              WHEN i.quantity_on_hand <= i.reorder_level * 2 THEN 'Low'
              ELSE 'Adequate'
          END AS stock_status,
          LAG(i.quantity_on_hand) OVER (PARTITION BY i.product_id, w.warehouse_id ORDER BY i.last_restocked_date) - i.quantity_on_hand AS stock_change
      FROM warehouses w
      INNER JOIN inventory i ON w.warehouse_id = i.warehouse_id
      WHERE w.is_active = TRUE
  ),

  supplier_metrics AS (
      SELECT
          s.supplier_id,
          s.company_name,
          s.country,
          s.rating AS supplier_rating,
          COUNT(DISTINCT po.purchase_order_id) AS total_orders,
          SUM(po.total_amount) AS total_spent,
          AVG(po.delivery_days) AS avg_delivery_days,
          COUNT(DISTINCT p.product_id) AS products_supplied,
          SUM(CASE WHEN po.status = 'Late' THEN 1 ELSE 0 END) AS late_deliveries
      FROM suppliers s
      INNER JOIN purchase_orders po ON s.supplier_id = po.supplier_id
      INNER JOIN purchase_order_items poi ON po.purchase_order_id = poi.purchase_order_id
      INNER JOIN products p ON poi.product_id = p.product_id
      WHERE po.order_date >= '2024-01-01'
      GROUP BY s.supplier_id, s.company_name, s.country, s.rating
  ),

  regional_sales AS (
      SELECT
          r.region_id,
          r.region_name,
          r.country,
          r.sales_manager,
          o.order_id,
          o.order_date,
          o.order_total,
          o.tax_amount,
          sm.shipping_method_name,
          sm.shipping_method_type,
          sm.base_rate,
          ss.status_name AS shipment_status,
          st.tracking_number,
          st.actual_delivery_date,
          DATEDIFF(st.actual_delivery_date, o.order_date) AS delivery_days
      FROM regions r
      INNER JOIN customers c ON r.region_id = c.region_id
      INNER JOIN orders o ON c.customer_id = o.customer_id
      LEFT JOIN shipping_methods sm ON o.shipping_method_id = sm.shipping_method_id
      LEFT JOIN shipments sh ON o.order_id = sh.order_id
      LEFT JOIN shipment_status ss ON sh.status_id = ss.status_id
      LEFT JOIN shipment_tracking st ON sh.shipment_id = st.shipment_id
      WHERE o.order_date >= '2024-01-01'
  ),

  campaign_attribution AS (
      SELECT
          cm.campaign_id,
          cm.campaign_name,
          cm.channel,
          cm.budget,
          cm.start_date,
          cm.end_date,
          COUNT(DISTINCT ca.customer_id) AS acquired_customers,
          SUM(o.order_total) AS attributed_revenue,
          SUM(cm.budget) / NULLIF(SUM(o.order_total), 0) AS cost_per_revenue_ratio
      FROM campaigns cm
      INNER JOIN campaign_attribution ca ON cm.campaign_id = ca.campaign_id
      INNER JOIN orders o ON ca.customer_id = o.customer_id
          AND o.order_date BETWEEN cm.start_date AND cm.end_date
      WHERE cm.is_active = TRUE
      GROUP BY cm.campaign_id, cm.campaign_name, cm.channel, cm.budget, cm.start_date, cm.end_date
  )

  SELECT
      cs.customer_id,
      cs.customer_name,
      cs.email,
      cs.tier AS customer_tier,
      cs.lifetime_value,
      cs.order_count,
      cs.avg_order_value,

      o.order_id,
      o.order_date,
      o.order_total,
      o.tax_amount,
      o.discount_amount,
      o.payment_status,

      pp.product_id,
      pp.product_name,
      pp.sku,
      pp.category_name,
      pp.parent_category,
      pp.base_price,
      pp.avg_selling_price,
      pp.total_sold,
      pp.category_rank,

      oi.quantity AS item_quantity,
      oi.unit_price,
      oi.discount_percentage,
      (oi.quantity * oi.unit_price * (1 - oi.discount_percentage/100)) AS net_item_total,

      ia.warehouse_name,
      ia.location AS warehouse_location,
      ia.quantity_on_hand,
      ia.stock_status,
      ia.reorder_level,

      sm.company_name AS supplier_name,
      sm.country AS supplier_country,
      sm.supplier_rating,
      sm.avg_delivery_days,
      sm.late_deliveries,

      rs.shipping_method_name,
      rs.shipping_method_type,
      rs.delivery_days,
      rs.shipment_status,
      st.tracking_number,

      rs.region_name,
      rs.country AS sales_country,
      rs.sales_manager,

      ca.campaign_name,
      ca.channel AS marketing_channel,

      CASE
          WHEN rs.delivery_days <= 3 THEN 'Excellent'
          WHEN rs.delivery_days <= 7 THEN 'Good'
          WHEN rs.delivery_days <= 14 THEN 'Acceptable'
          ELSE 'Poor'
      END AS delivery_rating,

      CASE
          WHEN cs.lifetime_value > 10000 THEN 'Platinum'
          WHEN cs.lifetime_value > 5000 THEN 'Gold'
          WHEN cs.lifetime_value > 1000 THEN 'Silver'
          ELSE 'Bronze'
      END AS calculated_segment,

      (oi.quantity * oi.unit_price * (1 - oi.discount_percentage/100)) -
          (pp.cost * oi.quantity) AS item_profit,

      CASE
          WHEN ia.stock_status = 'Critical' THEN 1
          WHEN ia.stock_status = 'Low' THEN 0.5
          ELSE 0
      END AS inventory_risk_score,

      COALESCE(rv.rating, 0) AS product_rating,
      rv.comment AS customer_review,

      COALESCE(s.ticket_count, 0) AS support_tickets,
      COALESCE(s.avg_resolution_hours, 0) AS avg_resolution_time,

      lp.points_balance,
      lp.tier_name AS loyalty_tier,
      lp.last_points_earned_date,

      pm.payment_method_name,
      pm.card_type,
      pm.is_wallet AS paid_with_wallet,

      cc.currency_code,
      cc.exchange_rate,
      (o.order_total * cc.exchange_rate) AS order_total_usd,

      CASE
          WHEN MONTH(o.order_date) IN (11, 12) THEN 'Holiday'
          WHEN MONTH(o.order_date) IN (6, 7, 8) THEN 'Summer'
          WHEN MONTH(o.order_date) IN (3, 4, 5) THEN 'Spring'
          ELSE 'Fall'
      END AS season

  FROM customer_segments cs
  INNER JOIN orders o ON cs.customer_id = o.customer_id
  INNER JOIN order_items oi ON o.order_id = oi.order_id
  INNER JOIN product_performance pp ON oi.product_id = pp.product_id
  LEFT JOIN inventory_analysis ia ON oi.product_id = ia.product_id
      AND ia.warehouse_id = (SELECT warehouse_id FROM warehouses WHERE is_primary = TRUE LIMIT 1)
  LEFT JOIN supplier_metrics sm ON pp.product_id IN (
      SELECT DISTINCT poi.product_id
      FROM purchase_order_items poi
      WHERE poi.purchase_order_id IN (
          SELECT purchase_order_id FROM purchase_orders WHERE supplier_id = sm.supplier_id
      )
  )
  LEFT JOIN regional_sales rs ON o.order_id = rs.order_id
  LEFT JOIN shipment_tracking st ON rs.shipment_id = st.shipment_id
  LEFT JOIN campaign_attribution ca ON o.order_id IN (
      SELECT o2.order_id
      FROM orders o2
      INNER JOIN campaign_attribution ca2 ON o2.customer_id = ca2.customer_id
      WHERE ca2.campaign_id = ca.campaign_id
  )
  LEFT JOIN reviews rv ON o.customer_id = rv.user_id AND oi.product_id = rv.product_id
  LEFT JOIN support_tickets s ON o.order_id = s.order_id
  LEFT JOIN loyalty_program lp ON cs.customer_id = lp.customer_id
  LEFT JOIN payment_methods pm ON o.payment_method_id = pm.payment_method_id
  LEFT JOIN currency_conversion cc ON o.currency_id = cc.currency_id
  FULL OUTER JOIN return_requests rr ON o.order_id = rr.order_id
  LEFT JOIN refund_requests rq ON rr.return_id = rq.return_id

  WHERE o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
      AND cs.lifetime_value > 500
      AND pp.category_name IN ('Electronics', 'Computers', 'Gadgets', 'Accessories')
      AND ia.stock_status IN ('Critical', 'Low', 'Adequate')
      AND sm.supplier_rating >= 4
      AND rs.country IN ('USA', 'Canada', 'UK', 'Germany', 'France')
      AND (rv.rating IS NULL OR rv.rating < 4)
      AND (s.ticket_count IS NULL OR s.ticket_count < 3)

  ORDER BY
      cs.lifetime_value DESC,
      o.order_date DESC,
      pp.category_rank ASC,
      item_profit DESC;
```

---

## Features

* **Local AST Parsing** – Uses `node-sql-parser` to build an Abstract Syntax Tree entirely in the browser.
* **CTE Lineage** – Automatically resolves and visualizes Common Table Expressions (WITH clauses) into a structured waterfall.
* **Interactive Graph** – Zoom, pan, and drag nodes with a hardware-accelerated UI powered by React Flow.
* **Predicate Pushdown** – Injects WHERE filters directly into the table nodes they affect for immediate debugging.
* **Scan Summary** – Instant overview of query complexity (tables, joins, filters, CTEs, depth).
* **Professional Settings** – Control node spacing (Vertical/Horizontal), toggle edge styles (Smooth/Bezier), and hide/show filters.
* **Clean PNG Export** – High-resolution diagram downloads with UI elements (minimap/buttons) automatically hidden for the final image.
* **Monaco Editor** – Integrated VS Code editing experience with syntax highlighting and auto-indentation.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | React 18 + TypeScript |
| **Graph Engine** | @xyflow/react (React Flow) |
| **SQL Parser** | node-sql-parser |
| **Layouting** | Dagre (Auto-layout engine) |
| **Styling** | Tailwind CSS |
| **Editor** | Monaco Editor |

---

## Quick Start

### 1. Installation
```bash
git clone https://github.com/YOUR_USERNAME/SqlLens.git
cd SqlLens
npm install
```

### 2. Development
```bash
npm run dev
```
Open **localhost:5173** to start scanning queries.

### 3. Build for Production
```bash
npm run build
```

---

## How It Works

1.  **Input:** User pastes raw SQL into the Monaco Editor.
2.  **AST Generation:** The parser breaks the query into a structured JSON tree locally.
3.  **Logical Mapping:** A custom utility resolves aliases, builds the CTE hierarchy, and maps JOIN conditions to edges.
4.  **Layouting:** Dagre calculates X, Y coordinates to prevent node overlap.
5.  **Rendering:** React Flow renders custom TableNodes with integrated scrollbars for large schemas.

---

## Supported SQL

* **Joins:** INNER, LEFT, RIGHT, FULL, and CROSS JOIN.
* **Filtering:** BETWEEN, IN, LIKE, IS NULL, and nested AND/OR logic.
* **Virtual Tables:** Nested CTEs and Subqueries.
* **Sinks:** ORDER BY (ASC/DESC) and LIMIT visualization.

---

## Privacy

🔒 **Your data never leaves this browser.** No cookies, no tracking, no servers. Refresh the page and everything is gone.

---

## License

MIT License — feel free to use this for your projects!
