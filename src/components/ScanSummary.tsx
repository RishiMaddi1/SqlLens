import { Database, GitBranch, Filter, FileCode, ArrowDownAZ, Layers } from 'lucide-react';

interface ScanSummaryProps {
  nodes: any[];
  edges: any[];
}

export function ScanSummary({ nodes, edges }: ScanSummaryProps) {
  // Calculate stats from nodes and edges
  const tableNodes = nodes.filter(n => n.type === 'tableNode');
  const cteNodes = nodes.filter(n => n.type === 'cteNode');
  const sortNode = nodes.find(n => n.type === 'sortNode');

  const stats = {
    tables: tableNodes.length,
    joins: edges.filter(e => e.label && e.label.includes('JOIN')).length,
    ctes: cteNodes.length,
    filters: tableNodes.reduce((sum, node) => {
      const data = node.data as any;
      return sum + (data.filters?.length || 0);
    }, 0),
    outputs: nodes.reduce((sum, node) => {
      const data = node.data as any;
      return sum + (data.fields?.length || 0);
    }, 0),
    hasSort: !!sortNode,
  };

  // Calculate query depth (longest path in the graph)
  const calculateDepth = () => {
    if (nodes.length === 0) return 0;

    // Build adjacency list
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach(node => {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    edges.forEach(edge => {
      const sources = adj.get(edge.source) || [];
      sources.push(edge.target);
      adj.set(edge.source, sources);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Find all root nodes (no incoming edges)
    const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);

    // BFS to find longest path
    let maxDepth = 0;
    const queue: { node: string; depth: number }[] = roots.map(r => ({ node: r.id, depth: 1 }));

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = adj.get(node) || [];
      neighbors.forEach(neighbor => {
        queue.push({ node: neighbor, depth: depth + 1 });
      });
    }

    return maxDepth;
  };

  const depth = calculateDepth();

  // Determine query type
  const getQueryType = () => {
    if (stats.ctes > 0) return 'CTE-based SELECT';
    if (stats.joins > 0) return `${stats.joins}-way JOIN`;
    if (stats.tables > 1) return 'Multi-table SELECT';
    return 'Simple SELECT';
  };

  return (
    <div className="rounded-lg border shadow-lg" style={{ background: '#161B22', borderColor: '#30363D' }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#30363D]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-semibold text-slate-200 text-sm">Scan Summary</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Tables */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#0D1117' }}>
            <Database className="w-4 h-4 text-indigo-400" strokeWidth={1.5} />
            <div>
              <div className="text-xs text-slate-500">Tables</div>
              <div className="text-lg font-semibold text-slate-200">{stats.tables}</div>
            </div>
          </div>

          {/* Joins */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#0D1117' }}>
            <GitBranch className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
            <div>
              <div className="text-xs text-slate-500">Joins</div>
              <div className="text-lg font-semibold text-slate-200">{stats.joins}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#0D1117' }}>
            <Filter className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            <div>
              <div className="text-xs text-slate-500">Filters</div>
              <div className="text-lg font-semibold text-slate-200">{stats.filters}</div>
            </div>
          </div>

          {/* CTEs */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#0D1117' }}>
            <FileCode className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
            <div>
              <div className="text-xs text-slate-500">CTEs</div>
              <div className="text-lg font-semibold text-slate-200">{stats.ctes}</div>
            </div>
          </div>

          {/* Outputs */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg col-span-2" style={{ background: '#0D1117' }}>
            <Layers className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
            <div className="flex-1">
              <div className="text-xs text-slate-500">Output Columns</div>
              <div className="text-lg font-semibold text-slate-200">{stats.outputs}</div>
            </div>
            {stats.hasSort && (
              <div className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                <ArrowDownAZ className="w-3 h-3" strokeWidth={1.5} />
                <span>SORTED</span>
              </div>
            )}
          </div>
        </div>

        {/* Query Info */}
        <div className="pt-3 border-t border-[#30363D] space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Query Type</span>
            <span className="text-slate-300 font-medium">{getQueryType()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Graph Depth</span>
            <span className="text-slate-300 font-medium">{depth} level{depth !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
