/**
 * Oracle SQL Transpiler
 *
 * Converts Oracle SQL syntax to PostgreSQL-compatible syntax
 * This allows node-sql-parser to handle Oracle queries by transpiling them first.
 *
 * IMPORTANT: This module is ONLY used when Oracle dialect is selected.
 * All other dialects use the original SQL unchanged.
 */

/**
 * Transpile Oracle SQL to PostgreSQL-compatible SQL
 */
export function transpileOracleToPostgres(sql: string): string {
  let result = sql;

  // 1. Handle SYSDATE and CURRENT_DATE in SELECT clause
  // Remove columns like: SYSDATE AS current_timestamp, CURRENT_DATE AS today
  result = result.replace(/,\s*SYSDATE\s+AS\s+\w+/gi, '');
  result = result.replace(/SYSDATE\s+AS\s+\w+,\s*/gi, '');
  result = result.replace(/,\s*CURRENT_DATE\s+AS\s+\w+/gi, '');
  result = result.replace(/CURRENT_DATE\s+AS\s+\w+,\s*/gi, '');

  // 2. Replace Oracle functions with PostgreSQL equivalents
  // NVL -> COALESCE
  result = result.replace(/\bNVL\s*\(/gi, 'COALESCE(');

  // 3. Remove FROM DUAL (Oracle's dummy table)
  result = result.replace(/\s+FROM\s+DUAL\b/gi, ' ');

  // 4. Handle LISTAGG (Oracle's aggregation function)
  // Convert to a placeholder since PostgreSQL uses string_agg with different syntax
  result = result.replace(/LISTAGG\s*\([^)]+\)\s*WITHIN\s+GROUP\s*\([^)]+\)/gi, '\'LISTAGG\' AS aggregated_value');

  // 5. FETCH FIRST n ROWS ONLY -> LIMIT n
  result = result.replace(/FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY/gi, 'LIMIT $1');

  // 6. Remove ROWNUM (Oracle's row limit pseudo-column)
  result = result.replace(/,\s*ROWNUM\s+AS\s+\w+/gi, '');
  result = result.replace(/ROWNUM\s+AS\s+\w+,\s*/gi, '');
  result = result.replace(/ROWNUM\s+AS\s+\w+/gi, '');
  result = result.replace(/\bROWNUM\b/gi, '');

  // 7. Handle ADD_MONTHS (Oracle date function)
  // ADD_MONTHS(date, n) -> date + interval 'n months'
  result = result.replace(/ADD_MONTHS\s*\(([^,]+),\s*(\d+)\s*\)/gi, '($1 + INTERVAL \'$2 months\')');

  // 8. Handle TRUNC with date format (Oracle)
  // TRUNC(date, 'MONTH') -> DATE_TRUNC('month', date)
  result = result.replace(/TRUNC\s*\(([^,]+),\s*[\'"]MONTH[\'"]\s*\)/gi, 'DATE_TRUNC(\'month\', $1)');
  result = result.replace(/TRUNC\s*\(([^,]+),\s*[\'"]YEAR[\'"]\s*\)/gi, 'DATE_TRUNC(\'year\', $1)');

  // 9. Handle TO_DATE with format (Oracle)
  // TO_DATE('2024-01-01', 'YYYY-MM-DD') -> '2024-01-01'::date
  // This is a simplification - may need adjustment for complex cases
  result = result.replace(/TO_DATE\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*[\'"][^\'"]*[\'"]\s*\)/gi, '\'$1\'::date');

  // 10. Handle DECODE (Oracle's CASE shorthand) -> CASE
  // DECODE(col, val1, res1, val2, res2, default)
  // This is complex, so we'll do a basic replacement
  result = result.replace(
    /DECODE\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
    'CASE WHEN $1 = $2 THEN $3 WHEN $1 = $4 THEN $5 END'
  );

  // 11. Clean up extra whitespace and commas
  result = result.replace(/,\s*,/g, ',');  // Double commas
  result = result.replace(/\s+/g, ' ').trim();  // Extra whitespace

  return result;
}

/**
 * Check if a SQL query appears to be Oracle SQL
 * This is a heuristic check - not foolproof but helpful
 */
export function isLikelyOracleSQL(sql: string): boolean {
  const upperSQL = sql.toUpperCase();

  // Check for Oracle-specific keywords
  const oracleIndicators = [
    'FROM DUAL',
    'FETCH FIRST',
    'ROWNUM',
    'SYSDATE',
    'ADD_MONTHS',
    'LISTAGG',
    'TO_DATE(',
  ];

  return oracleIndicators.some(indicator => upperSQL.includes(indicator));
}

/**
 * Validate if transpiled SQL is syntactically reasonable
 * This is a basic check - real validation happens during parsing
 */
export function validateTranspiledSQL(sql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of sql) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
  }
  if (parenCount !== 0) {
    errors.push('Unbalanced parentheses');
  }

  // Check for empty SELECT
  if (/SELECT\s+(?:\s|;|$)/i.test(sql)) {
    errors.push('SELECT clause appears empty');
  }

  // Check for trailing commas
  if (/,\s*(?:FROM|WHERE|GROUP|ORDER|LIMIT|$)/i.test(sql)) {
    errors.push('Trailing comma detected');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
