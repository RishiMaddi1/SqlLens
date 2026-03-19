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
 * Helper function to parse DECODE arguments, handling nested parentheses
 */
function parseDecodeArguments(content: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    // Handle string literals
    if ((char === "'" || char === '"') && (i === 0 || content[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    // Track parentheses depth
    if (char === '(') depth++;
    if (char === ')') depth--;

    // Split by comma at top level
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Transpile Oracle SQL to PostgreSQL-compatible SQL
 */
export function transpileOracleToPostgres(sql: string): string {
  let result = sql;

  // 0. Strip SQL comments first (they can confuse the parsing)
  // Remove single-line comments --
  result = result.replace(/--.*$/gm, '');
  // Remove multi-line comments /* */
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Order matters! Some transformations need to happen before others

  // Normalize whitespace after comment removal
  result = result.replace(/\s+/g, ' ').trim();

  // 1. Handle DECODE (Oracle's CASE shorthand) -> CASE
  // Must do this early because DECODE contains commas that could confuse other regexes
  // Use a more flexible approach - match DECODE and convert it properly

  // Find all DECODE patterns and convert them
  result = result.replace(/DECODE\s*\(/gi, '___DECODE_START(');

  // Process each DECODE_START occurrence
  let decodeStartPos = result.indexOf('___DECODE_START(');
  while (decodeStartPos !== -1) {
    // Find the matching closing parenthesis
    let depth = 1;
    let pos = decodeStartPos + 17; // length of '___DECODE_START('
    let endPos = -1;

    while (pos < result.length && depth > 0) {
      if (result[pos] === '(') depth++;
      else if (result[pos] === ')') depth--;
      pos++;
    }

    if (depth === 0) {
      endPos = pos - 1;
      // Extract the DECODE content
      const decodeContent = result.substring(decodeStartPos + 17, endPos);

      // Parse the arguments (handling nested parentheses)
      const args = parseDecodeArguments(decodeContent);

      if (args.length >= 3) {
        const column = args[0];
        let caseExpr = 'CASE';

        // Process pairs: (val1, res1, val2, res2, ..., default)
        for (let i = 1; i < args.length - 1; i += 2) {
          const val = args[i];
          const res = args[i + 1];
          caseExpr += ` WHEN ${column} = ${val} THEN ${res}`;
        }

        // If odd number of remaining args, last one is default
        if ((args.length - 1) % 2 === 1) {
          caseExpr += ` ELSE ${args[args.length - 1]}`;
        }

        caseExpr += ' END';

        // Replace the original DECODE with the CASE expression
        const before = result.substring(0, decodeStartPos);
        const after = result.substring(endPos + 1);
        result = before + caseExpr + after;

        // Find next DECODE after the replaced content
        decodeStartPos = result.indexOf('___DECODE_START(', before.length + caseExpr.length);
      } else {
        // Skip to next DECODE if parsing failed
        decodeStartPos = result.indexOf('___DECODE_START(', endPos);
      }
    } else {
      // Could not find closing parenthesis, skip this DECODE
      decodeStartPos = result.indexOf('___DECODE_START(', decodeStartPos + 1);
    }
  }

  // 2. Replace Oracle functions with PostgreSQL equivalents
  // NVL -> COALESCE
  result = result.replace(/\bNVL\s*\(/gi, 'COALESCE(');

  // 3. Handle TRUNC - simple TRUNC(date) -> DATE_TRUNC('day', date)
  // TRUNC with function call or column
  result = result.replace(/\bTRUNC\s*\(\s*([^,)]+(?:\([^)]*\))?)\s*\)/gi, 'DATE_TRUNC(\'day\', $1)');

  // 4. Handle TABLE() function - convert to subquery placeholder
  // TABLE(package.function()) -> (SELECT 1) as table_result
  result = result.replace(/TABLE\s*\(\s*[^)]+\.\w+\s*\([^)]*\)\s*\)/gi, '(SELECT 1)');

  // 5. Handle SYSDATE - replace with CURRENT_TIMESTAMP (PostgreSQL equivalent)
  result = result.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');

  // 6. Handle JSON_OBJECT - convert to jsonb_build_object (PostgreSQL)
  // JSON_OBJECT('key' VALUE expr) -> jsonb_build_object('key', expr)
  result = result.replace(/JSON_OBJECT\s*\(/gi, 'JSONB_BUILD_OBJECT(');
  result = result.replace(/\s+VALUE\s+/gi, ', ');

  // 7. Remove FROM DUAL (Oracle's dummy table)
  result = result.replace(/\s+FROM\s+DUAL\b/gi, ' ');

  // 8. Handle LISTAGG (Oracle's aggregation function)
  // Convert to a placeholder since PostgreSQL uses string_agg with different syntax
  result = result.replace(/LISTAGG\s*\([^)]+\)\s*WITHIN\s+GROUP\s*\([^)]+\)/gi, '\'LISTAGG\' AS aggregated_value');

  // 9. FETCH FIRST n ROWS ONLY -> LIMIT n
  result = result.replace(/FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY/gi, 'LIMIT $1');

  // 10. Handle ROWNUM properly in WHERE clause
  // WHERE ROWNUM <= n -> LIMIT n (but this is tricky, we'll just remove ROWNUM references)
  // First, handle WHERE ROWNUM <= n pattern
  result = result.replace(/WHERE\s+.*?\s+ROWNUM\s*<=\s*(\d+)/gi, (match, _limit) => {
    // Remove ROWNUM condition but keep the rest
    return match.replace(/\s+AND\s+ROWNUM\s*<=\s*\d+/gi, '').replace(/ROWNUM\s*<=\s*\d+/gi, '');
  });
  // Remove standalone ROWNUM in SELECT list
  result = result.replace(/,\s*ROWNUM\s+AS\s+\w+/gi, '');
  result = result.replace(/ROWNUM\s+AS\s+\w+,\s*/gi, '');
  result = result.replace(/ROWNUM\s+AS\s+\w+/gi, '');
  result = result.replace(/\bROWNUM\b/gi, '');

  // 11. Handle ADD_MONTHS (Oracle date function)
  // ADD_MONTHS(date, n) -> date + interval 'n months'
  result = result.replace(/ADD_MONTHS\s*\(([^,]+),\s*(-?\d+)\s*\)/gi, '($1 + INTERVAL \'$2 months\')');

  // 12. Handle TO_DATE with format (Oracle)
  // TO_DATE('2024-01-01', 'YYYY-MM-DD') -> '2024-01-01'::date
  result = result.replace(/TO_DATE\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*[\'"][^\'"]*[\'"]\s*\)/gi, '\'$1\'::date');

  // 13. Clean up double commas (whitespace already normalized)
  result = result.replace(/,\s*,/g, ',');

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
    ' SYSDATE',  // with space to avoid matching IS_SYSDATE
    'ADD_MONTHS',
    'LISTAGG',
    'TO_DATE(',
    'DECODE(',
    'TRUNC(',
    'TABLE(',
    'JSON_OBJECT',
    'NVL(',
    'CONNECT BY',
    'START WITH',
    'LEVEL AS',
    'SYS_CONNECT_BY_PATH',
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
