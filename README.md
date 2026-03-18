# Visual SQL Flow Mapper

A 100% client-side SQL query visualizer that parses SQL queries into an Abstract Syntax Tree (AST) and renders an interactive dependency graph showing table relationships, filters, and sorting.

![Visual SQL Flow Mapper](https://img.shields.io/badge/React-18.3-blue) ![Vite](https://img.shields.io/badge/Vite-6.0-purple) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

## Features

- **SQL Editor** - Monaco-powered editor with VS Code experience
- **AST Parsing** - Browser-based SQL parsing via `node-sql-parser`
- **Interactive Graph** - React Flow node visualization with dagre auto-layout
- **Predicate Pushdown** - WHERE clauses attached directly to the tables they filter
- **Smart JOIN Routing** - Edges connect based on actual ON clause relationships
- **ORDER BY Visualization** - Sort nodes showing column ordering
- **Collapsible Panes** - Fullscreen editor or visualization mode
- **PNG Export** - Download high-quality diagram exports
- **Dark Theme** - Easy on the eyes with Tailwind CSS styling

## Screenshot

```
┌─────────────────────┬─────────────────────┐
│   SQL Editor        │   Flow Graph        │
│                     │                     │
│ SELECT ...          │    ┌─────────┐       │
│ FROM ...            │    │  users  │       │
│ WHERE ...           │    │  📊     │───┐   │
│                     │    └─────────┘   │   │
│ [Visualize Query]   │                   ▼   │
│                     │    ┌─────────┐   │   │
│                     │    │ orders  │◄──┘   │
│                     │    │  📊     │       │
│                     │    │ ⚡filter│       │
│                     │    └─────────┘       │
│                     │           │         │
│                     │           ▼         │
│                     │    ┌─────────┐      │
│                     │    │  SORT   │      │
│                     │    │  📶     │      │
│                     │    └─────────┘      │
└─────────────────────┴─────────────────────┘
```

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/visual-sql-flow-mapper.git
cd visual-sql-flow-mapper
npm install
```

## Usage

```bash
npm run dev
```

Open [http://localhost:5174](http://localhost:5174)

1. **Write SQL** in the Monaco editor (left pane)
2. **Click "Visualize Query"** to generate the graph
3. **Explore** the interactive visualization (right pane)
4. **Export** as PNG using the download button

## Example Queries

### Simple JOIN with WHERE
```sql
SELECT users.name, orders.total
FROM users
JOIN orders ON users.id = orders.user_id
WHERE users.country = 'USA'
  AND orders.status = 'shipped';
```

### Multiple JOINs with BETWEEN and IN
```sql
SELECT u.name, o.total, p.name as product
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN products p ON o.product_id = p.id
WHERE o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
  AND o.status IN ('pending', 'shipped', 'delivered')
ORDER BY o.order_date DESC, u.name ASC;
```

### CTE with Subquery
```sql
WITH active_users AS (
  SELECT user_id, COUNT(*) as order_count
  FROM orders
  WHERE order_date >= '2024-01-01'
  GROUP BY user_id
)
SELECT u.name, au.order_count
FROM active_users au
JOIN users u ON au.user_id = u.id
ORDER BY au.order_count DESC;
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SQL Input Query                          │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              node-sql-parser (AST)                          │
│  - Parse SQL to Abstract Syntax Tree                        │
│  - Extract: tables, columns, JOINs, WHERE, ORDER BY        │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  AST Processing Layer                        │
│  - Smart edge routing (ON clause analysis)                  │
│  - Predicate pushdown (WHERE → tables)                      │
│  - Field extraction (SELECT clause)                         │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              ReactFlow Nodes + Edges                        │
│  - TableNode (with inline filters)                          │
│  - SortNode (ORDER BY columns)                              │
│  - Edges with JOIN labels                                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   dagre Layout Engine                        │
│  - Top-to-bottom graph layout                               │
│  - Automatic node positioning                               │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Interactive Visualization                       │
│  - Pan, zoom, drag nodes                                    │
│  - Collapsible panes                                        │
│  - PNG export                                               │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| [React](https://react.dev/) | 18.3 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 5.7 | Type safety |
| [Vite](https://vitejs.dev/) | 6.0 | Build tool |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4 | Styling |
| [@xyflow/react](https://reactflow.dev/) | 12.3 | Node graph |
| [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) | 4.6 | Code editor |
| [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) | 4.17 | SQL parser |
| [dagre](https://github.com/dagrejs/dagre) | 0.8 | Graph layout |
| [html-to-image](https://github.com/tsayen/dom-to-image) | 1.11 | PNG export |

## Project Structure

```
visual-sql-flow-mapper/
├── src/
│   ├── nodes/
│   │   ├── TableNode.tsx    # Table node with inline filters
│   │   ├── FilterNode.tsx   # (deprecated - using predicate pushdown)
│   │   └── SortNode.tsx     # ORDER BY visualization
│   ├── utils/
│   │   └── astToFlowMapper.ts  # AST → ReactFlow conversion
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind styles
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Supported SQL Features

- ✅ SELECT with column specification
- ✅ INNER/LEFT/RIGHT/FULL JOINs
- ✅ WHERE clause with:
  - Comparison operators (=, !=, <, >, <=, >=)
  - BETWEEN
  - IN / NOT IN
  - LIKE
  - IS NULL / IS NOT NULL
  - AND / OR combinations
- ✅ ORDER BY (ASC/DESC)
- ⚠️ CTEs (limited support)
- ⚠️ Subqueries (limited support)

## Browser Compatibility

Works in all modern browsers that support:
- ES2020+
- CSS Grid
- ResizeObserver

Tested on Chrome 120+, Firefox 121+, Edge 120+, Safari 17+.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## Acknowledgments

Built with:
- [Claude Code](https://claude.com/claude-code) - AI-assisted development
- [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) - SQL parsing in JavaScript
- [React Flow](https://reactflow.dev/) - Interactive node graphs
