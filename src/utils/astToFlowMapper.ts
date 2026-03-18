import { Parser } from 'node-sql-parser';
import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

// Initialize parser
const parser = new Parser();

/**
 * Parse SQL string into AST
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

interface TableNode {
  name: string;
  alias?: string;
  fields: string[];
  filters: string[];
  isCTE: boolean;
  cteFields?: string[]; // Output fields if this is a CTE
}

interface JoinEdge {
  from: string;
  to: string;
  type: string;
}

interface SelectAST {
  type: 'select';
  columns?: any[];
  from?: any[];
  where?: any;
  orderby?: any;
  with?: any;
  [key: string]: any;
}

/**
 * Extract table name from various AST structures
 */
function extractTableName(item: any): string | null {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item.table) {
    if (typeof item.table === 'string') return item.table;
    if (item.table?.table) return item.table.table;
  }
  return null;
}

/**
 * Extract alias from FROM item
 */
function extractAlias(item: any): string | undefined {
  if (item?.as) return item.as;
  return undefined;
}

/**
 * Format value from AST
 */
function formatValue(value: any): string {
  if (!value) return '';
  if (value.type === 'single_quote_string') return `'${value.value}'`;
  if (value.type === 'number') return String(value.value);
  if (value.type === 'column_ref') {
    const table = value.table ? `${value.table}.` : '';
    return `${table}${value.column}`;
  }
  if (value.value !== undefined) return String(value.value);
  return '';
}

/**
 * Format WHERE condition
 */
function formatCondition(condition: any): string {
  if (!condition) return '';

  // Handle BETWEEN operator: { type: 'binary_expr', operator: 'BETWEEN', left: ..., right: { expr: [value1, value2] } }
  if (condition.type === 'binary_expr' && condition.operator === 'BETWEEN') {
    const left = formatValue(condition.left);
    const rightExprs = condition.right?.expr;
    if (Array.isArray(rightExprs) && rightExprs.length === 2) {
      const val1 = formatValue(rightExprs[0]);
      const val2 = formatValue(rightExprs[1]);
      return `${left} BETWEEN ${val1} AND ${val2}`;
    }
  }

  // Handle IN operator: { type: 'binary_expr', operator: 'IN', left: ..., right: { type: 'expr_list', value: [...] } }
  if (condition.type === 'binary_expr' && condition.operator === 'IN') {
    const left = formatValue(condition.left);
    const rightValues = condition.right?.value;
    if (Array.isArray(rightValues)) {
      const inList = rightValues.map(v => formatValue(v)).filter(v => v).join(', ');
      return `${left} IN (${inList})`;
    }
  }

  // Handle NOT IN
  if (condition.type === 'binary_expr' && condition.operator === 'NOT IN') {
    const left = formatValue(condition.left);
    const rightValues = condition.right?.value;
    if (Array.isArray(rightValues)) {
      const inList = rightValues.map(v => formatValue(v)).filter(v => v).join(', ');
      return `${left} NOT IN (${inList})`;
    }
  }

  // Handle regular binary expressions
  if (condition.type === 'binary_expr') {
    const left = formatValue(condition.left);
    const right = formatValue(condition.right);
    return `${left} ${condition.operator} ${right}`;
  }

  return formatValue(condition);
}

/**
 * Parse WITH clause to extract CTE definitions
 */
function extractCTEDefinitions(ast: SelectAST): Map<string, { fields: string[]; internalAST: any }> {
  const cteMap = new Map<string, { fields: string[]; internalAST: any }>();

  if (!ast.with || !ast.with.with) {
    return cteMap;
  }

  const withClauses = Array.isArray(ast.with.with) ? ast.with.with : [ast.with.with];

  for (const withClause of withClauses) {
    if (!withClause) continue;

    let cteName = '';
    let cteStatement = null;

    if (withClause.type === 'with') {
      cteName = withClause.name || '';
      cteStatement = withClause.statement;
    } else if (withClause.statement) {
      cteName = withClause.as?.name || withClause.name || '';
      cteStatement = withClause.statement;
    }

    if (!cteName || !cteStatement) continue;

    // Extract CTE output fields
    let outputFields: string[] = [];
    const columns = withClause.columns?.value || [];
    if (columns.length > 0) {
      outputFields = columns.map((c: any) => c.column || c);
    } else if (cteStatement.columns) {
      outputFields = cteStatement.columns.map((c: any) => {
        if (c.expr?.type === 'column_ref') {
          const table = c.expr.table ? `${c.expr.table}.` : '';
          return `${table}${c.expr.column}`;
        }
        return c.as || (c.expr?.column || '?');
      });
    }

    cteMap.set(cteName, { fields: outputFields, internalAST: cteStatement });
    console.log(`[CTE] ${cteName} -> ${outputFields.join(', ')}`);
  }

  return cteMap;
}

/**
 * Parse WHERE clause and extract filters
 */
function extractWhereFilters(ast: SelectAST): Map<string, string[]> {
  const filtersByTable = new Map<string, string[]>();

  if (!ast.where) return filtersByTable;

  function splitAnd(condition: any): any[] {
    if (condition?.type === 'binary_expr' && condition.operator === 'AND') {
      return [...splitAnd(condition.left), ...splitAnd(condition.right)];
    }
    return condition ? [condition] : [];
  }

  for (const cond of splitAnd(ast.where)) {
    const formatted = formatCondition(cond);
    if (cond.left?.type === 'column_ref' && cond.left.table) {
      const table = cond.left.table;
      if (!filtersByTable.has(table)) filtersByTable.set(table, []);
      filtersByTable.get(table)!.push(formatted);
    }
  }

  return filtersByTable;
}

/**
 * Map SELECT columns to their source tables/CTEs
 */
function mapColumnsToSources(ast: SelectAST, knownTables: Set<string>): Map<string, string[]> {
  const columnMap = new Map<string, string[]>(); // source -> columns

  if (!ast.columns) return columnMap;

  for (const col of ast.columns) {
    if (!col.expr) continue;

    let sourceTable: string | undefined = undefined;
    let columnName = '';

    if (col.expr.type === 'column_ref') {
      sourceTable = col.expr.table;
      columnName = col.expr.column;
    } else if (col.expr.type === 'star') {
      // * goes to all tables
      columnName = '*';
      for (const table of knownTables) {
        if (!columnMap.has(table)) columnMap.set(table, []);
        columnMap.get(table)!.push('*');
      }
      continue;
    } else {
      // Complex expression - try to find embedded column_ref
      const searchForColumnRef = (obj: any): void => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.type === 'column_ref' && obj.table) {
          if (!sourceTable) sourceTable = obj.table;
        }
        Object.values(obj).forEach(v => searchForColumnRef(v));
      };
      searchForColumnRef(col.expr);
      columnName = col.as || '(expression)';
    }

    const displayName = col.as ? `${columnName} AS ${col.as}` : columnName;

    if (sourceTable) {
      if (!columnMap.has(sourceTable)) columnMap.set(sourceTable, []);
      columnMap.get(sourceTable)!.push(displayName);
    }
  }

  console.log('[COLUMN MAP]', Object.fromEntries(columnMap));
  return columnMap;
}

/**
 * Process FROM clause to extract tables and JOINs
 */
function processFromClause(
  fromClause: any[] | undefined,
  knownCTEs: Set<string>,
  filtersByTable: Map<string, string[]>
): { tables: TableNode[]; joins: JoinEdge[] } {
  const tables: TableNode[] = [];
  const joins: JoinEdge[] = [];
  const tableAliasMap = new Map<string, string>(); // alias/real-name -> effective ID

  if (!fromClause || !Array.isArray(fromClause)) {
    return { tables, joins };
  }

  // First pass: create table nodes
  for (let i = 0; i < fromClause.length; i++) {
    const fromItem = fromClause[i];
    const realTableName = extractTableName(fromItem);
    const alias = extractAlias(fromItem);

    if (!realTableName) continue;

    const effectiveId = alias || realTableName;

    // Check if this is a CTE reference
    const isCTE = knownCTEs.has(realTableName);

    // Skip duplicate nodes (same effective ID already processed)
    if (tableAliasMap.has(effectiveId)) {
      console.log(`[SKIP] Duplicate table reference: ${effectiveId}`);
      continue;
    }

    tableAliasMap.set(effectiveId, effectiveId);
    if (alias && alias !== realTableName) {
      tableAliasMap.set(realTableName, effectiveId);
    }

    const filters = filtersByTable.get(realTableName) || filtersByTable.get(alias || '') || [];

    tables.push({
      name: realTableName,
      alias: alias,
      fields: [], // Will be populated from SELECT clause
      filters,
      isCTE,
    });
  }

  // Second pass: create JOIN edges
  for (let i = 1; i < fromClause.length; i++) {
    const fromItem = fromClause[i];
    const joinType = fromItem.join || 'JOIN';
    const targetAlias = extractAlias(fromItem) || extractTableName(fromItem);

    if (!targetAlias) continue;

    const targetId = tableAliasMap.get(targetAlias);
    if (!targetId) continue;

    let sourceId: string | null = null;

    // Find source from ON clause
    if (fromItem.on) {
      function findTableInExpr(expr: any): string | null {
        if (!expr) return null;
        if (expr.type === 'column_ref' && expr.table) {
          return tableAliasMap.get(expr.table) || null;
        }
        if (expr.left) {
          const left = findTableInExpr(expr.left);
          if (left) return left;
        }
        if (expr.right) {
          return findTableInExpr(expr.right);
        }
        return null;
      }
      sourceId = findTableInExpr(fromItem.on);
    }

    // Fallback: previous table
    if (!sourceId && i > 0) {
      const prevItem = fromClause[i - 1];
      const prevAlias = extractAlias(prevItem) || extractTableName(prevItem);
      if (prevAlias) {
        sourceId = tableAliasMap.get(prevAlias) || null;
      }
    }

    if (sourceId) {
      joins.push({
        from: sourceId,
        to: targetId,
        type: joinType,
      });
      console.log(`[JOIN] ${sourceId} --[${joinType}]--> ${targetId}`);
    }
  }

  return { tables, joins };
}

/**
 * Find the final table in the join chain (the one with no outgoing edges)
 */
function findFinalTable(tables: TableNode[], joins: JoinEdge[]): string | null {
  const hasOutgoing = new Set<string>();

  for (const join of joins) {
    hasOutgoing.add(join.from);
  }

  for (const table of tables) {
    const id = table.alias || table.name;
    if (!hasOutgoing.has(id)) {
      console.log(`[FINAL TABLE] ${id} (no outgoing edges)`);
      return id;
    }
  }

  return tables[tables.length - 1]?.alias || tables[tables.length - 1]?.name || null;
}

/**
 * Extract ORDER BY columns
 */
function extractOrderBy(ast: SelectAST): Array<{ column: string; direction: string }> {
  if (!ast.orderby) return [];

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

  return result;
}

/**
 * Apply dagre layout
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  rankSep: number = 150,
  nodeSep: number = 100
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB', nodesep: nodeSep, ranksep: rankSep });

  nodes.forEach((node) => {
    let h = 100;
    if (node.type === 'tableNode') {
      const data = node.data as { fields?: string[]; filters?: string[]; alias?: string };
      h = Math.max(100, 70 + (data.fields?.length || 0) * 24 + (data.filters?.length || 0) * 28);
      if (data.alias) h += 20;
    } else if (node.type === 'cteNode') {
      const data = node.data as { fields?: string[] };
      h = Math.max(80, 60 + (data.fields?.length || 0) * 24);
    } else if (node.type === 'sortNode') {
      const data = node.data as { sortColumns?: Array<{ column: string; direction: string }> };
      h = Math.max(80, 60 + (data.sortColumns?.length || 0) * 28);
    }
    dagreGraph.setNode(node.id, { width: 280, height: h });
  });

  edges.forEach((e) => {
    dagreGraph.setEdge(e.source, e.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id);
      return {
        ...node,
        position: { x: pos.x - 140, y: pos.y - pos.height / 2 },
      };
    }),
    edges,
  };
}

/**
 * Main conversion function
 */
export function sqlToFlowNodes(
  sql: string,
  edgeType: string = 'smoothstep',
  showFilters: boolean = true,
  rankSep: number = 150,
  nodeSep: number = 100,
  fontSize: number = 14,
  multiColorJoins: boolean = true
): { nodes: Node[]; edges: Edge[] } {
  console.log('========================================');
  console.log('SQL TO FLOW NODES');
  console.log('========================================');

  const astResult = parseSQL(sql);

  if (!astResult) {
    return { nodes: [], edges: [] };
  }

  const ast = Array.isArray(astResult) ? astResult[0] : astResult;

  if (!ast || ast.type !== 'select') {
    return { nodes: [], edges: [] };
  }

  console.log('[MODE] Processing query...');

  // Extract CTE definitions
  const cteMap = extractCTEDefinitions(ast);
  const knownCTEs = new Set(cteMap.keys());

  // Extract WHERE filters
  const filtersByTable = extractWhereFilters(ast);

  // Process FROM clause
  const { tables, joins } = processFromClause(ast.from, knownCTEs, filtersByTable);

  // Map known tables
  const knownTables = new Set<string>();
  for (const table of tables) {
    knownTables.add(table.alias || table.name);
  }

  // Map SELECT columns to their source tables
  const columnMap = mapColumnsToSources(ast, knownTables);

  // Build nodes
  const allNodes: Node[] = [];
  const nodeIdMap = new Map<string, string>();

  for (const table of tables) {
    // Use alias as ID if exists, otherwise use table name
    const nodeId = table.alias || table.name;
    const fields = columnMap.get(nodeId) || [];

    // If this is a CTE, also include its output fields
    let displayFields = fields;
    if (table.isCTE) {
      const cteInfo = cteMap.get(table.name);
      if (cteInfo && fields.length === 0) {
        displayFields = cteInfo.fields;
      }
    }

    allNodes.push({
      id: nodeId,
      type: table.isCTE ? 'cteNode' : 'tableNode',
      data: {
        tableName: table.name,
        alias: table.alias,
        fields: displayFields,
        filters: showFilters ? table.filters : [],
        fontSize: fontSize,
        nodeColor: table.isCTE ? '#06b6d4' : '#10b981', // cyan or emerald
      },
      position: { x: 0, y: 0 },
      style: {
        background: '#ffffff',
      },
    });

    nodeIdMap.set(nodeId, nodeId);
    if (table.alias) {
      nodeIdMap.set(table.name, nodeId);
    }

    console.log(`[NODE] ${nodeId} (${table.isCTE ? 'CTE' : 'Table'}) - Fields: ${displayFields.join(', ')}`);
  }

  // Build edges
  const allEdges: Edge[] = [];

  // Color palette for multi-color joins
  const joinColors = [
    '#10b981', // emerald-500
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
  ];
  let colorIndex = 0;

  for (const join of joins) {
    const edgeColor = multiColorJoins
      ? joinColors[colorIndex % joinColors.length]
      : '#cbd5e1'; // slate-300 for light theme

    allEdges.push({
      id: `edge-${join.from}-${join.to}`,
      source: join.from,
      target: join.to,
      label: join.type,
      type: edgeType,
      animated: false,
      style: { stroke: edgeColor, strokeWidth: 1.5 },
      labelStyle: { fill: '#64748b', fontSize: 11 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#e2e8f0', strokeWidth: 1 },
    });

    if (multiColorJoins) {
      colorIndex++;
    }
  }

  // ORDER BY - single edge from final table
  const orderBy = extractOrderBy(ast);
  if (orderBy.length > 0) {
    const sortNodeId = 'sort-0';
    allNodes.push({
      id: sortNodeId,
      type: 'sortNode',
      data: { sortColumns: orderBy, fontSize: fontSize },
      position: { x: 0, y: 0 },
      style: {
        background: '#ffffff',
      },
    });

    const finalTableId = findFinalTable(tables, joins);
    if (finalTableId) {
      allEdges.push({
        id: `edge-to-sort`,
        source: finalTableId,
        target: sortNodeId,
        type: edgeType,
        animated: false,
        style: { stroke: '#a855f7', strokeWidth: 1.5 },
        label: 'ORDER BY',
        labelStyle: { fill: '#7c3aed', fontSize: 10 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#e9d5ff', strokeWidth: 1 },
      });
      console.log(`[ORDER BY] Connected to ${finalTableId}`);
    }
  }

  console.log(`[RESULT] ${allNodes.length} nodes, ${allEdges.length} edges`);
  console.log('========================================');

  // Apply layout
  const { nodes: layoutedNodes } = applyDagreLayout(allNodes, allEdges, rankSep, nodeSep);

  return { nodes: layoutedNodes, edges: allEdges };
}
