# QueryScan


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


<!-- PLACEHOLDER: Screenshot image here -->


```sql
-- E-commerce order analysis with customer and product data
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

### Example 2: Complex CTE-Based Analytics Query


<!-- PLACEHOLDER: Screenshot image here -->


```sql
-- Complex analytics with multiple CTEs
WITH customer_lifetime_value AS (
    SELECT
        customer_id,
        SUM(order_total) AS lifetime_value,
        COUNT(order_id) AS total_orders
    FROM orders
    WHERE order_date >= '2023-01-01'
    GROUP BY customer_id
),
product_performance AS (
    SELECT
        p.product_id,
        p.product_name,
        SUM(oi.quantity) AS total_sold,
        SUM(oi.quantity * oi.unit_price) AS revenue
    FROM products p
    JOIN order_items oi ON p.product_id = oi.product_id
    GROUP BY p.product_id, p.product_name
)
SELECT
    c.customer_name,
    c.email,
    clv.lifetime_value,
    clv.total_orders,
    pp.product_name,
    pp.total_sold,
    pp.revenue
FROM customers c
JOIN customer_lifetime_value clv ON c.customer_id = clv.customer_id
JOIN orders o ON c.customer_id = o.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN product_performance pp ON oi.product_id = pp.product_id
WHERE clv.lifetime_value > 1000
ORDER BY clv.lifetime_value DESC;
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
git clone https://github.com/YOUR_USERNAME/queryscan.git
cd queryscan
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
