import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { Download, Columns3, SplitSquareHorizontal } from 'lucide-react';
import { sqlToFlowNodes } from './utils/astToFlowMapper';
import { TableNode } from './nodes/TableNode';
import { CTENode } from './nodes/CTENode';
import { SubqueryNode } from './nodes/SubqueryNode';
import { SortNode } from './nodes/SortNode';
import { SettingsSidebar } from './components/SettingsSidebar';

// Default hardcoded query for the PoC
const DEFAULT_QUERY =
  'SELECT users.name, orders.total FROM users JOIN orders ON users.id = orders.user_id;';

function App() {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Layout settings
  const [rankSep, setRankSep] = useState(150);
  const [nodeSep, setNodeSep] = useState(100);
  const [edgeType, setEdgeType] = useState('smoothstep');
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pane state: 'editor' = editor fullscreen, 'viz' = viz fullscreen, null = split view
  const [expandedPane, setExpandedPane] = useState<'editor' | 'viz' | null>(null);

  // Register custom node types
  const nodeTypes = {
    tableNode: TableNode,
    cteNode: CTENode,
    subqueryNode: SubqueryNode,
    sortNode: SortNode,
  } as any; // TypeScript workaround for node type registration

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return nodes;
    }

    const query = searchQuery.toLowerCase();
    return nodes.map((node) => {
      const data = node.data as any;
      const tableName = data.tableName?.toLowerCase() || '';
      const alias = data.alias?.toLowerCase() || '';
      const cteName = data.cteName?.toLowerCase() || '';
      const displayName = alias || tableName || cteName;

      const matches = displayName.includes(query) ||
                     data.fields?.some((f: string) => f.toLowerCase().includes(query));

      return {
        ...node,
        style: matches
          ? node.style
          : { ...node.style, opacity: 0.3 },
      };
    });
  }, [nodes, searchQuery]);

  // Parse SQL and update flow (only triggered by button click)
  const parseAndUpdateFlow = useCallback(() => {
    try {
      setError(null);
      const { nodes: newNodes, edges: newEdges } = sqlToFlowNodes(
        sql,
        edgeType,
        showFilters,
        rankSep,
        nodeSep
      );
      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse SQL';
      setError(errorMessage);
      console.error('Parse error:', err);
    }
  }, [sql, edgeType, showFilters, rankSep, nodeSep, setNodes, setEdges]);

  // Initial parse on mount
  useEffect(() => {
    parseAndUpdateFlow();
  }, []);

  // Re-parse when layout settings change
  useEffect(() => {
    if (nodes.length > 0) {
      parseAndUpdateFlow();
    }
  }, [rankSep, nodeSep, edgeType, showFilters]);

  const handleEditorChange = (value: string | undefined) => {
    const newSql = value || '';
    setSql(newSql);
    // No auto-parsing - only update state
  };

  const handleVisualizeClick = () => {
    parseAndUpdateFlow();
  };

  const toggleEditor = () => {
    setExpandedPane(expandedPane === 'editor' ? null : 'editor');
  };

  const toggleViz = () => {
    setExpandedPane(expandedPane === 'viz' ? null : 'viz');
  };

  // Export the flow diagram as PNG
  const handleExportAsPng = useCallback(() => {
    setIsExporting(true);

    setTimeout(() => {
      const viewport = document.querySelector('.react-flow__viewport');

      if (!viewport) {
        console.error('Could not find React Flow viewport');
        setIsExporting(false);
        return;
      }

      toPng(viewport as HTMLElement, {
        backgroundColor: '#0f172a',
        cacheBust: true,
        quality: 1,
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'sql-flow-diagram.png';
          link.href = dataUrl;
          link.click();
          setIsExporting(false);
        })
        .catch((err) => {
          console.error('Failed to export diagram:', err);
          setIsExporting(false);
        });
    }, 100);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900">
      {/* Header */}
      <header className="flex h-12 items-center border-b border-slate-700 bg-slate-800 px-4">
        <h1 className="text-lg font-semibold text-indigo-400">
          Visual SQL Flow Mapper
        </h1>
        <span className="ml-3 rounded bg-indigo-900/50 px-2 py-0.5 text-xs text-indigo-300">
          Beta
        </span>
      </header>

      {/* Main Content: Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Monaco Editor */}
        <div
          className={`flex flex-col border-r border-slate-700 transition-all duration-300 ${
            expandedPane === 'editor' ? 'w-full' : expandedPane === 'viz' ? 'w-0 hidden' : 'w-1/2'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
            <span className="text-sm font-medium text-slate-300">SQL Editor</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">node-sql-parser</span>
              <button
                onClick={toggleEditor}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title={expandedPane === 'editor' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'editor' ? (
                  <SplitSquareHorizontal className="w-4 h-4" />
                ) : (
                  <Columns3 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex-1" onKeyDown={(e) => e.stopPropagation()}>
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme="vs-dark"
              value={sql}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
          {/* Visualize Button */}
          <div className="border-t border-slate-700 bg-slate-800 p-3">
            <button
              onClick={handleVisualizeClick}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
            >
              Visualize Query
            </button>
          </div>
        </div>

        {/* Right Pane: React Flow Canvas */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            expandedPane === 'viz' ? 'w-full' : expandedPane === 'editor' ? 'w-0 hidden' : 'w-1/2'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
            <span className="text-sm font-medium text-slate-300">Flow Visualization</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">dagre auto-layout</span>
              <button
                onClick={toggleViz}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title={expandedPane === 'viz' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'viz' ? (
                  <SplitSquareHorizontal className="w-4 h-4" />
                ) : (
                  <Columns3 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              defaultEdgeOptions={{
                animated: true,
              }}
              panOnScroll={false}
              panActivationKeyCode={null}
            >
              <Background color="#334155" gap={16} />
              <Controls
                className="!border-slate-700 !bg-slate-800"
                showZoom={true}
                showFitView={true}
                showInteractive={true}
              />
              <MiniMap
                className="!bg-slate-800 !border-slate-700"
                nodeColor={(node) => {
                  const type = node.type || '';
                  if (type === 'cteNode') return '#0891b2';
                  if (type === 'sortNode') return '#a855f7';
                  if (type === 'subqueryNode') return '#6366f1';
                  return '#1e293b';
                }}
                maskColor="rgba(0, 0, 0, 0.6)"
              />

              {/* Export PNG Button Panel */}
              <Panel position="top-right">
                <button
                  onClick={handleExportAsPng}
                  disabled={isExporting || nodes.length === 0}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg
                    bg-purple-600 hover:bg-purple-700 active:bg-purple-800
                    text-white text-sm font-medium
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors shadow-lg
                  "
                  title="Download diagram as PNG"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Exporting...' : 'Download PNG'}</span>
                </button>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      <SettingsSidebar
        onRankSepChange={setRankSep}
        onNodeSepChange={setNodeSep}
        onEdgeTypeChange={setEdgeType}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        currentEdgeType={edgeType}
        rankSep={rankSep}
        nodeSep={nodeSep}
        searchQuery={searchQuery}
      />

      {/* Error Banner */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 mx-auto max-w-2xl rounded-lg border border-red-900 bg-red-950/90 p-4 text-red-200 shadow-lg backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="text-red-400">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-300">SQL Parse Error</h3>
              <p className="mt-1 text-sm text-red-200/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {nodes.length === 0 && !error && (
        <div className="pointer-events-none absolute bottom-1/2 right-1/4 flex -translate-y-1/2 translate-x-1/2 flex-col items-center text-center text-slate-500">
          <svg
            className="mb-3 h-16 w-16 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
            />
          </svg>
          <p className="text-sm">No tables found in query</p>
        </div>
      )}
    </div>
  );
}

export default App;
