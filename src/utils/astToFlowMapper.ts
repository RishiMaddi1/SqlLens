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
  fields?: string[]; // Join field names like "CG.CLAIM_SEQ_ID = CP.CLAIM_SEQ_ID"
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

  console.log('[DEBUG] ast.with:', JSON.stringify(ast.with, null, 2));

  // Handle different AST structures for WITH clause:
  // - Structure 1: ast.with = [{ name: {...}, stmt: {...} }]  (direct array)
  // - Structure 2: ast.with = { with: [...] }  (nested object)
  if (!ast.with) {
    console.log('[DEBUG] No WITH clause found');
    return cteMap;
  }

  let withClauses: any[];
  if (Array.isArray(ast.with)) {
    // Direct array structure
    withClauses = ast.with;
    console.log('[DEBUG] WITH clause is direct array, length:', withClauses.length);
  } else if (ast.with.with && Array.isArray(ast.with.with)) {
    // Nested object structure
    withClauses = ast.with.with;
    console.log('[DEBUG] WITH clause is nested object, length:', withClauses.length);
  } else {
    console.log('[DEBUG] WITH clause has unknown structure');
    return cteMap;
  }

  for (const withClause of withClauses) {
    if (!withClause) continue;

    let cteName = '';
    let cteStatement = null;

    // Handle different AST structures for CTE definitions
    // Structure 1: { name: { value: "name" }, stmt: { ... } }
    if (withClause.name?.value) {
      cteName = withClause.name.value;
      cteStatement = withClause.stmt;
    }
    // Structure 2: { type: 'with', name: "name", statement: { ... } }
    else if (withClause.type === 'with') {
      cteName = withClause.name || '';
      cteStatement = withClause.statement;
    }
    // Structure 3: { name: "name", stmt: { ... } }
    else if (withClause.stmt) {
      cteName = withClause.name || withClause.as?.name || '';
      cteStatement = withClause.stmt;
    }

    if (!cteName || !cteStatement) {
      console.log('[DEBUG] Skipping CTE clause, missing name or statement:', { cteName, hasStatement: !!cteStatement });
      continue;
    }

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
function mapColumnsToSources(
  ast: SelectAST,
  tableNameMap: Map<string, string> // lowercase -> canonical name
): Map<string, string[]> {
  const columnMap = new Map<string, string[]>(); // canonical source -> columns

  if (!ast.columns) return columnMap;

  // Helper to get canonical table name (case-insensitive)
  const getCanonicalName = (name: string): string | undefined => {
    if (!name) return undefined;
    const lowerKey = Array.from(tableNameMap.keys()).find(k => k.toLowerCase() === name.toLowerCase());
    return lowerKey ? tableNameMap.get(lowerKey) : name; // fallback to original if not found
  };

  for (const col of ast.columns) {
    if (!col.expr) continue;

    let sourceTable: string | undefined = undefined;
    let columnName = '';

    if (col.expr.type === 'column_ref') {
      sourceTable = col.expr.table;
      columnName = col.expr.column;
    } else if (col.expr.type === 'star') {
      // * goes to all tables (use canonical names)
      columnName = '*';
      for (const canonicalName of tableNameMap.values()) {
        if (!columnMap.has(canonicalName)) columnMap.set(canonicalName, []);
        columnMap.get(canonicalName)!.push('*');
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
      // Convert to canonical name for storage
      const canonicalTable = getCanonicalName(sourceTable);
      if (canonicalTable) {
        if (!columnMap.has(canonicalTable)) columnMap.set(canonicalTable, []);
        columnMap.get(canonicalTable)!.push(displayName);
      }
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
  const tableAliasMap = new Map<string, string>(); // lowercase alias/real-name -> effective ID

  // Helper function for case-insensitive lookup in tableAliasMap
  const getTableId = (name: string): string | undefined => {
    if (!name) return undefined;
    const lowerKey = Array.from(tableAliasMap.keys()).find(k => k.toLowerCase() === name.toLowerCase());
    return lowerKey ? tableAliasMap.get(lowerKey) : undefined;
  };

  if (!fromClause || !Array.isArray(fromClause)) {
    return { tables, joins };
  }

  // First pass: create table nodes and track their order
  const tableOrder = new Map<string, number>(); // Track order of appearance

  for (let i = 0; i < fromClause.length; i++) {
    const fromItem = fromClause[i];
    const realTableName = extractTableName(fromItem);
    const alias = extractAlias(fromItem);

    if (!realTableName) continue;

    const effectiveId = alias || realTableName;

    // Track the order this table appears
    if (!tableOrder.has(effectiveId)) {
      tableOrder.set(effectiveId, i);
    }

    // Check if this is a CTE reference (case-insensitive)
    const isCTE = Array.from(knownCTEs).some(cte => cte.toLowerCase() === realTableName.toLowerCase());

    // Skip duplicate nodes (same effective ID already processed) - case-insensitive check
    if (getTableId(effectiveId)) {
      console.log(`[SKIP] Duplicate table reference: ${effectiveId}`);
      continue;
    }

    tableAliasMap.set(effectiveId.toLowerCase(), effectiveId);
    if (alias && alias.toLowerCase() !== realTableName.toLowerCase()) {
      tableAliasMap.set(realTableName.toLowerCase(), effectiveId);
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

    const targetId = getTableId(targetAlias);
    if (!targetId) continue;

    let sourceId: string | null = null;
    const joinFields: string[] = []; // Extract join field names

    // Find source from ON clause - collect ALL tables, then pick the earliest one
    if (fromItem.on) {
      console.log(`[DEBUG] ON clause for ${targetId}:`, JSON.stringify(fromItem.on, null, 2));
      console.log(`[DEBUG] tableAliasMap entries:`, Array.from(tableAliasMap.entries()));

      const allTables: string[] = [];

      function findAllTablesInExpr(expr: any): void {
        if (!expr) return;
        console.log(`[DEBUG] Checking expr type:`, expr.type, 'table:', expr.table);

        // Extract join fields from equality comparisons
        if (expr.type === 'binary_expr' && expr.operator === '=') {
          const leftCol = expr.left;
          const rightCol = expr.right;

          if (leftCol?.type === 'column_ref' && rightCol?.type === 'column_ref') {
            // Both sides are column references - this is a join condition
            const leftTable = getTableId(leftCol.table);
            const rightTable = getTableId(rightCol.table);

            // Only include if one side is our target table
            if (leftTable === targetId || rightTable === targetId) {
              const otherTable = leftTable === targetId ? rightTable : leftTable;
              const targetField = leftTable === targetId ? leftCol.column : rightCol.column;
              const otherField = leftTable === targetId ? rightCol.column : leftCol.column;

              // Store as "other_table.field = target_table.field" (source first, then target)
              joinFields.push(`${otherTable}.${otherField} = ${targetId}.${targetField}`);

              // Track the other table for source detection
              if (otherTable && otherTable !== targetId && !allTables.includes(otherTable)) {
                allTables.push(otherTable);
              }
            }
          }
        }

        // Also check for direct column references (for OR conditions, etc.)
        if (expr.type === 'column_ref' && expr.table) {
          const tableId = getTableId(expr.table);
          if (tableId && tableId !== targetId && !allTables.includes(tableId)) {
            allTables.push(tableId);
          }
        }

        if (expr.left) findAllTablesInExpr(expr.left);
        if (expr.right) findAllTablesInExpr(expr.right);
      }

      findAllTablesInExpr(fromItem.on);

      console.log(`[DEBUG] Processing ${targetId}: found tables in ON clause:`, allTables);
      console.log(`[DEBUG] Join fields:`, joinFields);

      // Pick the table that appears earliest in the query order (most established)
      if (allTables.length > 0) {
        allTables.sort((a, b) => (tableOrder.get(a) || Infinity) - (tableOrder.get(b) || Infinity));
        sourceId = allTables[0];
      }
    }

    // Fallback: previous table
    if (!sourceId && i > 0) {
      const prevItem = fromClause[i - 1];
      const prevAlias = extractAlias(prevItem) || extractTableName(prevItem);
      if (prevAlias) {
        sourceId = getTableId(prevAlias) || null;
      }
    }

    if (sourceId) {
      joins.push({
        from: sourceId,
        to: targetId,
        type: joinType,
        fields: joinFields.length > 0 ? joinFields : undefined,
      });
      console.log(`[JOIN] ${sourceId} --[${joinType}]--> ${targetId}`, joinFields.length > 0 ? `on ${joinFields.join(', ')}` : '');
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
  console.log(`[CTE FOUND] ${cteMap.size} CTE(s)`, Array.from(cteMap.keys()));

  // Extract WHERE filters
  const filtersByTable = extractWhereFilters(ast);

  // Process FROM clause
  const { tables, joins } = processFromClause(ast.from, knownCTEs, filtersByTable);

  // Create a map of lowercase table names to canonical names for case-insensitive lookup
  const tableNameMap = new Map<string, string>();
  for (const table of tables) {
    const canonicalName = table.alias || table.name;
    tableNameMap.set(canonicalName.toLowerCase(), canonicalName);
    // Also map the real name (if different from alias) to canonical
    if (table.alias && table.alias !== table.name) {
      tableNameMap.set(table.name.toLowerCase(), canonicalName);
    }
  }

  // Map SELECT columns to their source tables
  const columnMap = mapColumnsToSources(ast, tableNameMap);

  // Create a map of join fields for each table (target table -> join fields)
  const joinFieldsMap = new Map<string, string[]>();
  for (const join of joins) {
    if (join.fields && join.fields.length > 0) {
      joinFieldsMap.set(join.to, join.fields);
    }
  }

  // Build nodes
  const allNodes: Node[] = [];
  const nodeIdMap = new Map<string, string>();

  for (const table of tables) {
    // Use alias as ID if exists, otherwise use table name
    const nodeId = table.alias || table.name;
    const fields = columnMap.get(nodeId) || [];
    const joinFields = joinFieldsMap.get(nodeId) || [];

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
        ...(table.isCTE ? { cteName: table.name } : { tableName: table.name }),
        alias: table.alias,
        fields: displayFields,
        filters: showFilters ? table.filters : [],
        joinFields: joinFields, // Add join fields to node data
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
      labelStyle: { fill: '#000000', fontSize: 11, fontWeight: 'bold' },
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
        labelStyle: { fill: '#000000', fontSize: 10, fontWeight: 'bold' },
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
