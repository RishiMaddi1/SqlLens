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
import './reactflow-custom.css';
import { toPng } from 'html-to-image';
import { Download, Columns3, SplitSquareHorizontal, Settings } from 'lucide-react';
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

  // Settings sidebar state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ReactFlow instance ref for fitView
  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null);

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

      // Fit view after nodes are updated
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ padding: 0.2, duration: 300 });
        }
      }, 50);
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

  // Export the flow diagram as PNG with "Clean Capture" method
  const handleExportAsPng = useCallback(async () => {
    if (!reactFlowInstance.current || nodes.length === 0) {
      return;
    }

    setIsExporting(true);

    // Small delay to allow loading overlay to render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Store current viewport for restoration
    const currentViewport = reactFlowInstance.current.getViewport();

    // Calculate exact bounding box of all nodes
    const bounds = reactFlowInstance.current.getNodesBounds(nodes);
    const padding = 60;
    const exportWidth = bounds.width + padding * 2;
    const exportHeight = bounds.height + padding * 2;

    // Hide UI elements before capture
    const elementsToHide = [
      ...document.querySelectorAll('.react-flow__minimap'),
      ...document.querySelectorAll('.react-flow__controls'),
      ...document.querySelectorAll('.react-flow__panel'),
    ];

    elementsToHide.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    // Wait for browser to remove elements from paint cycle
    await new Promise(resolve => setTimeout(resolve, 150));

    // Position viewport to capture exactly the node bounds
    reactFlowInstance.current.setViewport({
      x: -bounds.x + padding,
      y: -bounds.y + padding,
      zoom: 1,
    });

    // Another wait for viewport to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const flowElement = document.querySelector('.react-flow');
      if (!flowElement) {
        throw new Error('React Flow element not found');
      }

      // Generate clean PNG
      const dataUrl = await toPng(flowElement as HTMLElement, {
        backgroundColor: '#0f172a',
        cacheBust: true,
        quality: 1,
        pixelRatio: 2,
        width: exportWidth,
        height: exportHeight,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
          transform: 'none',
        },
        skipAutoScale: true,
      });

      // Trigger download
      const link = document.createElement('a');
      link.download = 'sql-flow-diagram.png';
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      // Restore UI elements
      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = '';
      });

      // Restore original viewport
      reactFlowInstance.current?.setViewport(currentViewport);

      // Small delay before hiding loading screen
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsExporting(false);
    }
  }, [nodes]);

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
          <div className="flex-1 relative">
            {/* Export Loading Overlay */}
            {isExporting && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <svg className="w-12 h-12 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">Exporting Diagram</p>
                    <p className="text-sm text-slate-400 mt-1">Please wait...</p>
                  </div>
                </div>
              </div>
            )}

            <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                reactFlowInstance.current = instance;
                // Initial fit view
                instance.fitView({ padding: 0.2, duration: 300 });
              }}
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
                showZoom={true}
                showFitView={true}
                showInteractive={true}
              />
              <MiniMap
                className="!bg-slate-900 !border-slate-700"
                nodeColor={(node) => {
                  const type = node.type || '';
                  if (type === 'cteNode') return '#0891b2'; // cyan-600
                  if (type === 'sortNode') return '#a855f7'; // purple-600
                  if (type === 'subqueryNode') return '#6366f1'; // indigo-600
                  return '#4f46e5'; // indigo-600 for tables
                }}
                maskColor="rgba(0, 0, 0, 0.7)"
                pannable
                zoomable
              />

              {/* Export PNG and Settings Buttons Panel */}
              <Panel position="top-right">
                <div className="flex gap-2">
                  {/* Settings Button */}
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-lg transition-all
                      ${settingsOpen
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-indigo-400'
                      }
                    `}
                    title="Layout Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  {/* Download PNG Button */}
                  <button
                    onClick={handleExportAsPng}
                    disabled={isExporting || nodes.length === 0}
                    className="
                      flex items-center gap-2 px-4 py-2 rounded-lg
                      bg-purple-600 hover:bg-purple-700 active:bg-purple-800
                      text-white text-sm font-medium
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors shadow-lg border border-purple-700
                    "
                    title="Download diagram as PNG"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download PNG</span>
                  </button>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
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
