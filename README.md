# Visual SQL Flow Mapper

A professional-grade, **100% client-side** SQL visualizer. It transforms complex SQL queries into interactive, hierarchical dependency graphs. No data ever leaves your browser—**no AI APIs, no backend, and no third-party tracking.**

<img width="3080" height="3108" alt="sql-flow-diagram (11)" src="https://github.com/user-attachments/assets/a8a36c4a-8473-4285-afd1-57397641aee6" />


## What is this for?

Understanding **legacy SQL spaghetti** is one of the biggest time-sinks in data engineering. This tool is designed to:
* **Debug Complex Logic:** Instantly see which filters are applied to which tables without scrolling through 100 lines of code.
* **Audit Data Lineage:** Trace how CTEs and subqueries feed into your final result set.
* **Onboard Faster:** Help new developers visualize a database's "mental model" by seeing the physical relationships between tables.
* **Documentation:** Generate high-quality architectural diagrams of your code for PRs or internal wikis.

## Features

* **Local AST Parsing** – Uses `node-sql-parser` to build an Abstract Syntax Tree entirely in the browser.
* **CTE Lineage** – Automatically resolves and visualizes Common Table Expressions (WITH clauses) into a structured waterfall.
* **Interactive Graph** – Zoom, pan, and drag nodes with a hardware-accelerated UI powered by React Flow.
* **Predicate Pushdown** – Injects WHERE filters directly into the table nodes they affect for immediate debugging.
* **Professional Settings** – Control node spacing (Vertical/Horizontal), toggle edge styles (Smooth/Bezier), and hide/show filters.
* **Clean PNG Export** – High-resolution diagram downloads with UI elements (minimap/buttons) automatically hidden for the final image.
* **Monaco Editor** – Integrated VS Code editing experience with syntax highlighting and auto-indentation.

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | React 18 + TypeScript |
| **Graph Engine** | @xyflow/react (React Flow) |
| **SQL Parser** | node-sql-parser |
| **Layouting** | Dagre (Auto-layout engine) |
| **Styling** | Tailwind CSS |
| **Editor** | Monaco Editor |

## Quick Start

### 1. Installation
```bash
git clone https://github.com/YOUR_USERNAME/visual-sql-flow-mapper.git
cd visual-sql-flow-mapper
npm install
```

### 2. Development
```bash
npm run dev
```
Open **localhost:5173** to start mapping.

## Mapping Architecture

1.  **Input:** User pastes raw SQL into the Monaco Editor.
2.  **AST Generation:** The parser breaks the query into a structured JSON tree locally.
3.  **Logical Mapping:** A custom utility resolves aliases, builds the CTE hierarchy, and maps JOIN conditions to edges.
4.  **Layouting:** Dagre calculates X, Y coordinates to prevent node overlap.
5.  **Rendering:** React Flow renders custom TableNodes with integrated scrollbars for large schemas.

## Supported SQL

* **Joins:** INNER, LEFT, RIGHT, FULL, and CROSS JOIN.
* **Filtering:** BETWEEN, IN, LIKE, IS NULL, and nested AND/OR logic.
* **Virtual Tables:** Nested CTEs and Subqueries.
* **Sinks:** ORDER BY (ASC/DESC) and LIMIT visualization.
