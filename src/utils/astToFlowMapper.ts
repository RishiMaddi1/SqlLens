import { Parser } from 'node-sql-parser';
import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

// Initialize parser
const parser = new Parser();

// Type for column reference in AST
interface ColumnRef {
  type: 'column_ref';
  table?: string;
  column: string;
}

// Type for a column in the SELECT clause
interface ASTColumn {
  expr: ColumnRef | { type: string; [key: string]: any };
  as?: string | null;
}

// Type for ON condition
interface OnCondition {
  type: string;
  left?: ColumnRef;
  right?: ColumnRef;
  left?: any;
  right?: any;
}

// Type for FROM item with potential JOIN
interface FromItem {
  table: string | { table: string };
  join?: string;
  on?: OnCondition;
  [key: string]: any;
}

// Type for SELECT AST
interface SelectAST {
  type: 'select';
  columns?: ASTColumn[];
  from?: FromItem[];
  where?: any;
  orderby?: any;
  [key: string]: any;
}

// Result of parsing a WHERE condition
interface ParsedCondition {
  text: string;
  table?: string;
}

/**
 * Parse SQL string into AST using node-sql-parser
 */
export function parseSQL(sql: string): any {
  try {
    const result = parser.astify(sql, { database: 'postgresql' });
    console.log('Parsed AST:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('SQL Parse Error:', error);
    throw error;
  }
}

/**
 * Extract table name from various possible structures
 */
function extractTableName(item: string | { table: string } | ColumnRef | any): string | null {
  if (typeof item === 'string') {
    return item;
  }
  if (item?.table) {
    if (typeof item.table === 'string') {
      return item.table;
    }
    if (item.table?.table) {
      return item.table.table;
    }
  }
  if (item?.column && item?.table) {
    return item.table;
  }
  return null;
}

/**
 * Parse a binary expression (ON condition) to extract left and right table references
 */
function extractTablesFromOnCondition(on: OnCondition): { leftTable?: string; rightTable?: string } | null {
  if (!on || on.type !== 'binary_expr') {
    return null;
  }

  let leftTable: string | undefined;
  let rightTable: string | undefined;

  if (on.left) {
    if (on.left.type === 'column_ref' && on.left.table) {
      leftTable = on.left.table;
    } else if (on.left.type === 'binary_expr') {
      const nested = extractTablesFromOnCondition(on.left);
      leftTable = nested?.leftTable;
    }
  }

  if (on.right) {
    if (on.right.type === 'column_ref' && on.right.table) {
      rightTable = on.right.table;
    } else if (on.right.type === 'binary_expr') {
      const nested = extractTablesFromOnCondition(on.right);
      rightTable = nested?.rightTable;
    }
  }

  if (leftTable || rightTable) {
    return { leftTable, rightTable };
  }

  return null;
}

/**
 * Format a single value from the AST into a string
 */
function formatValue(value: any): string {
  if (!value) return '';

  switch (value.type) {
    case 'single_quote_string':
    case 'double_quote_string':
      return `'${value.value}'`;

    case 'number':
      return String(value.value);

    case 'null':
      return 'NULL';

    case 'bool':
      return value.value ? 'TRUE' : 'FALSE';

    case 'column_ref':
      const table = value.table ? `${value.table}.` : '';
      return `${table}${value.column}`;

    case 'star':
      return '*';

    default:
      if (value.value !== undefined) {
        return String(value.value);
      }
      if (value.type) {
        // For complex expressions, return a readable placeholder
        return `(${value.type})`;
      }
      return '';
  }
}

/**
 * Recursively format a WHERE condition into a readable string
 * Handles BETWEEN, IN, and other complex operators
 */
function formatCondition(condition: any): string {
  if (!condition) return '';

  // Handle AND/OR - these should be split at a higher level
  if (condition.type === 'binary_expr' && (condition.operator === 'AND' || condition.operator === 'OR')) {
    const left = formatCondition(condition.left);
    const right = formatCondition(condition.right);
    return `${left} ${condition.operator} ${right}`;
  }

  // Handle BETWEEN: "expr BETWEEN low AND high"
  if (condition.type === 'binary_expr' && condition.operator === 'BETWEEN') {
    const left = formatValue(condition.left);
    // Between typically has: { left, operator: 'BETWEEN', right: { type: 'expr_list', value: [low, high] } }
    if (condition.right && condition.right.type === 'expr_list') {
      const values = condition.right.value || [];
      const low = formatValue(values[0]);
      const high = formatValue(values[1]);
      return `${left} BETWEEN ${low} AND ${high}`;
    }
    // Alternative format: right is a binary_expr with AND
    const right = formatCondition(condition.right);
    return `${left} BETWEEN ${right}`;
  }

  // Handle IN: "expr IN (value1, value2, ...)"
  if (condition.type === 'binary_expr' && (condition.operator === 'IN' || condition.operator === 'NOT IN')) {
    const left = formatValue(condition.left);
    if (condition.right && condition.right.type === 'expr_list') {
      const values = condition.right.value || [];
      const valueList = values.map(formatValue).join(', ');
      return `${left} ${condition.operator} (${valueList})`;
    }
    const right = formatCondition(condition.right);
    return `${left} ${condition.operator} (${right})`;
  }

  // Handle LIKE
  if (condition.type === 'binary_expr' && condition.operator === 'LIKE') {
    const left = formatValue(condition.left);
    const right = formatValue(condition.right);
    return `${left} LIKE ${right}`;
  }

  // Handle IS NULL / IS NOT NULL
  if (condition.type === 'unary_expr' && (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL')) {
    const left = formatValue(condition.left);
    return `${left} ${condition.operator}`;
  }

  // Handle standard binary operators: =, !=, <, >, <=, >=, etc.
  if (condition.type === 'binary_expr') {
    const left = formatValue(condition.left);
    const right = formatValue(condition.right);
    const op = condition.operator || '';
    return `${left} ${op} ${right}`;
  }

  // Handle function calls and other expressions
  if (condition.type === 'function') {
    const args = condition.args?.value?.map(formatValue).join(', ') || '';
    return `${condition.name}(${args})`;
  }

  // Handle column references
  if (condition.type === 'column_ref') {
    return formatValue(condition);
  }

  // Handle literal values
  return formatValue(condition);
}

/**
 * Extract the table referenced in a condition
 * Returns the table name if the condition references a single table, undefined otherwise
 */
function extractTableFromCondition(condition: any): string | undefined {
  if (!condition) return undefined;

  // Check left side for table reference
  if (condition.left) {
    if (condition.left.type === 'column_ref' && condition.left.table) {
      return condition.left.table;
    }
    // Recurse for nested conditions
    const leftTable = extractTableFromCondition(condition.left);
    if (leftTable) return leftTable;
  }

  // Check right side for table reference (for IN lists, etc.)
  if (condition.right) {
    if (condition.right.type === 'column_ref' && condition.right.table) {
      return condition.right.table;
    }
    // Don't recurse into right for operators like IN since right is just a value list
    if (condition.operator !== 'IN' && condition.operator !== 'NOT IN' && condition.operator !== 'BETWEEN') {
      const rightTable = extractTableFromCondition(condition.right);
      if (rightTable) return rightTable;
    }
  }

  // For IN lists and BETWEEN, check the left side again (it's the column being filtered)
  if ((condition.operator === 'IN' || condition.operator === 'NOT IN' || condition.operator === 'BETWEEN') && condition.left) {
    if (condition.left.type === 'column_ref' && condition.left.table) {
      return condition.left.table;
    }
  }

  return undefined;
}

/**
 * Parse WHERE clause and extract conditions by table (Predicate Pushdown)
 */
function extractWhereConditionsByTable(ast: SelectAST): Map<string, string[]> {
  const filtersByTable = new Map<string, string[]>();

  if (!ast.where) {
    return filtersByTable;
  }

  console.log('WHERE clause:', ast.where);

  // Split AND conditions into individual conditions
  function splitAndConditions(condition: any): any[] {
    if (!condition) return [];

    // If this is an AND operation, split it
    if (condition.type === 'binary_expr' && condition.operator === 'AND') {
      return [
        ...splitAndConditions(condition.left),
        ...splitAndConditions(condition.right),
      ];
    }

    // Otherwise, return as a single condition
    return [condition];
  }

  const conditions = splitAndConditions(ast.where);
  console.log('Split conditions:', conditions.length);

  for (const cond of conditions) {
    const formatted = formatCondition(cond);
    const table = extractTableFromCondition(cond);

    console.log(`Condition: "${formatted}" -> Table: ${table || 'multi-table'}`);

    // Only attach to single-table filters
    if (table && formatted) {
      if (!filtersByTable.has(table)) {
        filtersByTable.set(table, []);
      }
      filtersByTable.get(table)!.push(formatted);
    }
  }

  console.log('Filters by table:', Object.fromEntries(filtersByTable));
  return filtersByTable;
}

/**
 * Extract fields from the SELECT clause, grouped by table
 */
function extractFieldsByTable(ast: SelectAST): Map<string, string[]> {
  const fieldsByTable = new Map<string, string[]>();

  if (!ast.columns || ast.columns.length === 0) {
    return fieldsByTable;
  }

  for (const col of ast.columns) {
    let tableName: string | null = null;
    let fieldName: string = '';

    if (col.expr) {
      if (col.expr.type === 'column_ref') {
        tableName = col.expr.table || null;
        fieldName = col.expr.column;
      } else if (col.expr.type === 'star') {
        tableName = null;
        fieldName = '*';
      } else {
        const searchForColumnRef = (obj: any): void => {
          if (!obj || typeof obj !== 'object') return;
          if (obj.type === 'column_ref' && obj.table) {
            if (!tableName) tableName = obj.table;
            if (!fieldName) fieldName = obj.column;
          }
          Object.values(obj).forEach(v => searchForColumnRef(v));
        };
        searchForColumnRef(col.expr);
        fieldName = fieldName || (col.as || '(expression)');
      }
    }

    if (col.as) {
      fieldName = col.as;
    }

    if (tableName && fieldName) {
      if (!fieldsByTable.has(tableName)) {
        fieldsByTable.set(tableName, []);
      }
      fieldsByTable.get(tableName)!.push(fieldName);
    } else if (fieldName === '*') {
      fieldsByTable.set('*', ['*']);
    }
  }

  console.log('Fields by table:', Object.fromEntries(fieldsByTable));
  return fieldsByTable;
}

/**
 * Extract ORDER BY columns and directions
 */
function extractOrderByColumns(ast: SelectAST): Array<{ column: string; direction: string }> {
  if (!ast.orderby) return [];

  console.log('ORDER BY clause:', ast.orderby);

  const result: Array<{ column: string; direction: string }> = [];
  const orderByItems = Array.isArray(ast.orderby) ? ast.orderby : [ast.orderby];

  for (const item of orderByItems) {
    if (!item) continue;

    let column = '';
    let direction = 'ASC';

    if (item.type === 'column_ref') {
      const table = item.table ? `${item.table}.` : '';
      column = `${table}${item.column}`;
    } else if (item.expr && item.expr.type === 'column_ref') {
      const table = item.expr.table ? `${item.expr.table}.` : '';
      column = `${table}${item.expr.column}`;
    }

    if (item.type === 'ASC' || item.type === 'DESC') {
      direction = item.type.toUpperCase();
    }

    if (column) {
      result.push({ column, direction });
    }
  }

  console.log('Extracted ORDER BY:', result);
  return result;
}

/**
 * Extract tables, JOINs, and fields from the AST
 */
export function extractTablesJoinsAndFields(
  ast: SelectAST,
  filtersByTable: Map<string, string[]>
): {
  tables: Set<string>;
  joins: Array<{ from: string; to: string; type: string }>;
  fieldsByTable: Map<string, string[]>;
} {
  const tables = new Set<string>();
  const joins: Array<{ from: string; to: string; type: string }> = [];

  const fieldsByTable = extractFieldsByTable(ast);

  if (ast.from && Array.isArray(ast.from)) {
    console.log('FROM items:', ast.from);

    for (let i = 0; i < ast.from.length; i++) {
      const fromItem = ast.from[i];
      const tableName = extractTableName(fromItem);

      if (tableName) {
        tables.add(tableName);
      }

      if (fromItem.join && fromItem.on) {
        const tableRefs = extractTablesFromOnCondition(fromItem.on);

        if (tableRefs?.leftTable && tableRefs?.rightTable) {
          joins.push({
            from: tableRefs.leftTable,
            to: tableRefs.rightTable,
            type: fromItem.join || 'JOIN',
          });

          tables.add(tableRefs.leftTable);
          tables.add(tableRefs.rightTable);

          console.log(`Smart edge: ${tableRefs.leftTable} → ${tableRefs.rightTable} (${fromItem.join})`);
        } else if (tableName && i > 0) {
          const prevTable = extractTableName(ast.from[i - 1]);
          if (prevTable) {
            joins.push({
              from: prevTable,
              to: tableName,
              type: fromItem.join || 'JOIN',
            });
            console.log(`Fallback edge: ${prevTable} → ${tableName} (${fromItem.join})`);
          }
        }
      }
    }
  }

  console.log('Final tables:', Array.from(tables));
  console.log('Final joins:', joins);

  return { tables, joins, fieldsByTable };
}

/**
 * Find leaf nodes (tables with no outgoing edges)
 */
function findLeafNodes(tableNames: string[], joins: Array<{ from: string; to: string }>): string[] {
  const hasOutgoing = new Set<string>();

  for (const join of joins) {
    hasOutgoing.add(join.from);
  }

  const leafNodes = tableNames.filter(name => !hasOutgoing.has(name));

  console.log('Leaf nodes (no outgoing edges):', leafNodes);
  return leafNodes;
}

/**
 * Apply dagre layout with TOP-to-BOTTOM direction
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });

  nodes.forEach((node) => {
    let nodeHeight = 100;
    let nodeWidth = 240;

    if (node.type === 'tableNode') {
      const fieldCount = node.data.fields?.length || 0;
      const filterCount = node.data.filters?.length || 0;
      nodeHeight = Math.max(100, 70 + fieldCount * 24 + filterCount * 28);
    } else if (node.type === 'sortNode') {
      const sortCount = node.data.sortColumns?.length || 0;
      nodeHeight = Math.max(80, 60 + sortCount * 28);
    }

    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Main conversion function: SQL → AST → ReactFlow nodes & edges
 * Now with Predicate Pushdown for WHERE conditions
 */
export function sqlToFlowNodes(sql: string): { nodes: Node[]; edges: Edge[] } {
  const astResult = parseSQL(sql);

  if (!astResult) {
    return { nodes: [], edges: [] };
  }

  const ast = Array.isArray(astResult) ? astResult[0] : astResult;

  if (!ast || ast.type !== 'select') {
    return { nodes: [], edges: [] };
  }

  // Extract WHERE conditions by table (Predicate Pushdown)
  const filtersByTable = extractWhereConditionsByTable(ast);

  // Extract tables, JOINs, and fields
  const { tables, joins, fieldsByTable } = extractTablesJoinsAndFields(ast, filtersByTable);

  // Handle wildcard (*)
  const hasWildcard = fieldsByTable.has('*');
  const allFieldList = hasWildcard ? ['*'] : [];

  // Create table nodes with inline filters
  const tableNodes: Node[] = Array.from(tables).map((tableName) => {
    const fields = fieldsByTable.get(tableName) || allFieldList;
    const filters = filtersByTable.get(tableName) || [];

    return {
      id: tableName,
      type: 'tableNode',
      data: {
        tableName,
        fields,
        filters,
      },
      position: { x: 0, y: 0 },
    };
  });

  // Create table edges (JOINs)
  const tableEdges: Edge[] = joins.map((join, index) => ({
    id: `edge-${index}`,
    source: join.from,
    target: join.to,
    label: join.type,
    type: 'smoothstep',
    animated: true,
    style: {
      stroke: '#60a5fa',
      strokeWidth: 2,
    },
    labelStyle: {
      fill: '#94a3b8',
      fontSize: 11,
      fontWeight: 500,
    },
    labelBgStyle: {
      fill: '#1e293b',
      fillOpacity: 0.9,
    },
  }));

  let allNodes = [...tableNodes];
  let allEdges = [...tableEdges];

  // Extract ORDER BY and create SortNode
  const orderByColumns = extractOrderByColumns(ast);

  if (orderByColumns.length > 0) {
    const sortNodeId = 'sort-0';
    const sortNode: Node = {
      id: sortNodeId,
      type: 'sortNode',
      data: {
        sortColumns: orderByColumns,
      },
      position: { x: 0, y: 0 },
    };
    allNodes.push(sortNode);

    // Connect leaf nodes to sort
    const leafNodes = findLeafNodes(Array.from(tables), joins);
    leafNodes.forEach((leafName, index) => {
      allEdges.push({
        id: `edge-leaf-sort-${index}`,
        source: leafName,
        target: sortNodeId,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#a855f7',
          strokeWidth: 2,
        },
      });
    });
  }

  console.log('=== FINAL RESULTS ===');
  console.log('Nodes:', allNodes.length, 'Edges:', allEdges.length);
  console.log('====================');

  // Apply vertical layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(
    allNodes,
    allEdges
  );

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
