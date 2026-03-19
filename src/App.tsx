import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  ReactFlow,
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
import { Download, Columns3, SplitSquareHorizontal, Settings, BarChart3 } from 'lucide-react';
import { sqlToFlowNodes } from './utils/astToFlowMapper';
import { TableNode } from './nodes/TableNode';
import { CTENode } from './nodes/CTENode';
import { SubqueryNode } from './nodes/SubqueryNode';
import { SortNode } from './nodes/SortNode';
import { SettingsSidebar } from './components/SettingsSidebar';
import { ScanSummary } from './components/ScanSummary';

// Default hardcoded query for the PoC
const DEFAULT_QUERY = `SELECT
    users.name AS customer_name,
    users.email AS customer_email,
    orders.id AS order_reference,
    orders.order_date,
    products.name AS product_name,
    categories.name AS category_name,
    order_items.quantity,
    order_items.price_at_purchase,
    (order_items.quantity * order_items.price_at_purchase) AS line_item_total,
    suppliers.company_name AS vendor,
    shipping_methods.method_name AS shipping_via,
    shipping_status.status_name AS delivery_status,
    reviews.rating AS customer_rating,
    reviews.comment AS customer_feedback
FROM users
JOIN orders ON users.id = orders.user_id
JOIN order_items ON orders.id = order_items.order_id
JOIN products ON order_items.product_id = products.id
JOIN categories ON products.category_id = categories.id
JOIN suppliers ON products.supplier_id = suppliers.id
JOIN shipping_methods ON orders.shipping_method_id = shipping_methods.id
JOIN shipping_status ON orders.status_id = shipping_status.id
LEFT JOIN reviews ON users.id = reviews.user_id AND products.id = reviews.product_id
WHERE orders.order_date BETWEEN '2024-01-01' AND '2024-12-31'
  AND users.email LIKE '%@gmail.com'
  AND categories.name IN ('Electronics', 'Computers', 'Gadgets')
  AND order_items.price_at_purchase > 500
  AND suppliers.country = 'USA'
  AND shipping_status.status_name != 'Cancelled'
  AND (reviews.rating < 3 OR reviews.rating IS NULL)
ORDER BY order_items.price_at_purchase DESC;`;

function App() {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Layout settings
  const [rankSep, setRankSep] = useState(130);
  const [nodeSep, setNodeSep] = useState(70);
  const [edgeType, setEdgeType] = useState('default');
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [multiColorJoins, setMultiColorJoins] = useState(true);

  // Pane state: 'editor' = editor fullscreen, 'viz' = viz fullscreen, null = split view
  const [expandedPane, setExpandedPane] = useState<'editor' | 'viz' | null>(null);

  // Settings sidebar state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Scan Summary panel state
  const [scanSummaryOpen, setScanSummaryOpen] = useState(false);

  // MiniMap toggle state
  const [showMiniMap, setShowMiniMap] = useState(true);

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
        nodeSep,
        fontSize,
        multiColorJoins
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
  }, [sql, edgeType, showFilters, rankSep, nodeSep, fontSize, multiColorJoins, setNodes, setEdges]);

  // Initial parse on mount
  useEffect(() => {
    parseAndUpdateFlow();
  }, []);

  // Re-parse when layout settings change
  useEffect(() => {
    if (nodes.length > 0) {
      parseAndUpdateFlow();
    }
  }, [rankSep, nodeSep, edgeType, showFilters, fontSize, multiColorJoins]);

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
        backgroundColor: '#0B0E14',
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
    <div className="flex h-screen w-screen flex-col" style={{ background: '#0B0E14' }}>
      {/* Header */}
      <header className="flex h-14 items-center justify-between px-6" style={{ borderBottom: '1px solid #30363D', background: '#0B0E14' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">SqlLens</h1>
              <p className="text-xs text-slate-500">Instant SQL Visualization</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{ background: '#161B22', border: '1px solid #30363D' }}>
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-slate-400">🔒 No data saved</span>
          </div>
          <a href="https://github.com/RishiMaddi1/visual-sql-flow-mapper" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border hover:bg-[#1C2128] hover:border-[#484F58]" style={{ background: '#161B22', borderColor: '#30363D', color: '#8B949E' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      {/* Main Content: Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Monaco Editor */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            expandedPane === 'editor' ? 'w-full' : expandedPane === 'viz' ? 'w-0 hidden' : 'w-[40%]'
          }`}
          style={{ borderRight: '1px solid #30363D' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #30363D', background: '#0B0E14' }}>
            <span className="text-sm font-medium text-slate-300">SQL Editor</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">node-sql-parser</span>
              <button
                onClick={toggleEditor}
                className="p-1.5 rounded-lg hover:bg-[#161B22] text-slate-500 hover:text-slate-300 transition-all"
                title={expandedPane === 'editor' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'editor' ? (
                  <SplitSquareHorizontal className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Columns3 className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
          <div className="flex-1" style={{ background: '#0B0E14' }} onKeyDown={(e) => e.stopPropagation()}>
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme="vs-dark"
              value={sql}
              onChange={handleEditorChange}
              beforeMount={(monaco) => {
                // Define custom theme matching our Deep Slate palette
                monaco.editor.defineTheme('deep-slate', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#0B0E14',
                    'editor.foreground': '#C9D1D9',
                    'editorLineNumber.foreground': '#484F58',
                    'editorLineNumber.activeForeground': '#8B949E',
                    'editor.selectionBackground': '#4F46E533',
                    'editor.inactiveSelectionBackground': '#4F46E522',
                    'editorCursor.foreground': '#818CF8',
                  },
                });
              }}
              onMount={(_editor, monaco) => {
                monaco.editor.setTheme('deep-slate');
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            />
          </div>
          {/* Visualize Button */}
          <div className="p-4" style={{ borderTop: '1px solid #30363D', background: '#0B0E14' }}>
            <button
              onClick={handleVisualizeClick}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20"
            >
              Visualize Query
            </button>
          </div>
        </div>

        {/* Right Pane: React Flow Canvas */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            expandedPane === 'viz' ? 'w-full' : expandedPane === 'editor' ? 'w-0 hidden' : 'w-[60%]'
          }`}
          style={{ background: '#0B0E14' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #30363D', background: '#0B0E14' }}>
            <span className="text-sm font-medium text-slate-300">Flow Visualization</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">dagre auto-layout</span>
              <button
                onClick={toggleViz}
                className="p-1.5 rounded-lg hover:bg-[#161B22] text-slate-500 hover:text-slate-300 transition-all"
                title={expandedPane === 'viz' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'viz' ? (
                  <SplitSquareHorizontal className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Columns3 className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
          <div className="flex-1 relative" style={{ background: '#0B0E14' }}>
            {/* Export Loading Overlay */}
            {isExporting && (
              <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: 'rgba(11, 14, 20, 0.95)' }}>
                <div className="flex flex-col items-center gap-4">
                  <svg className="w-12 h-12 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-100">Exporting Diagram</p>
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
              minZoom={0.1}
              maxZoom={2}
              panOnScroll={false}
              panActivationKeyCode={null}
            >
              <Controls
                showZoom={true}
                showFitView={true}
                showInteractive={true}
              />
              {showMiniMap && (
                <MiniMap
                  className="!border-[#30363D]"
                  nodeColor="#4F46E5"
                  maskColor="rgba(79, 70, 229, 0.15)"
                  pannable
                  zoomable
                />
              )}

              {/* MiniMap Toggle Button */}
              <Panel position="bottom-left">
                <button
                  onClick={() => setShowMiniMap(!showMiniMap)}
                  className="p-2 rounded-lg transition-all border"
                  style={{
                    background: '#161B22',
                    borderColor: '#30363D',
                    color: '#8B949E',
                  }}
                  title={showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showMiniMap ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    )}
                  </svg>
                </button>
              </Panel>

              {/* Export PNG and Settings Buttons Panel */}
              <Panel position="top-right">
                <div className="flex gap-2">
                  {/* Scan Summary Button */}
                  <button
                    onClick={() => setScanSummaryOpen(!scanSummaryOpen)}
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-lg transition-all border
                      ${scanSummaryOpen
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-500/20'
                        : 'hover:bg-[#1C2128] hover:border-[#484F58] hover:text-slate-300'
                      }
                    `}
                    style={scanSummaryOpen ? undefined : {
                      background: '#161B22',
                      borderColor: '#30363D',
                      color: '#8B949E',
                    }}
                    title="Scan Summary"
                  >
                    <BarChart3 className="w-5 h-5" strokeWidth={1.5} />
                  </button>

                  {/* Settings Button */}
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-lg transition-all border
                      ${settingsOpen
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-500/20'
                        : 'hover:bg-[#1C2128] hover:border-[#484F58] hover:text-slate-300'
                      }
                    `}
                    style={settingsOpen ? undefined : {
                      background: '#161B22',
                      borderColor: '#30363D',
                      color: '#8B949E',
                    }}
                    title="Layout Settings"
                  >
                    <Settings className="w-5 h-5" strokeWidth={1.5} />
                  </button>

                  {/* Download PNG Button */}
                  <button
                    onClick={handleExportAsPng}
                    disabled={isExporting || nodes.length === 0}
                    className="
                      flex items-center gap-2 px-4 py-2 rounded-lg
                      text-slate-200 text-sm font-medium
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                      transition-all border hover:bg-[#1C2128] hover:border-[#484F58]
                    "
                    style={{
                      background: '#161B22',
                      borderColor: '#30363D',
                    }}
                    title="Download diagram as PNG"
                  >
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">Download PNG</span>
                  </button>
                </div>
              </Panel>

              {/* Scan Summary Panel */}
              {scanSummaryOpen && (
                <Panel position="top-left">
                  <div className="w-72">
                    <ScanSummary nodes={nodes} edges={edges} />
                  </div>
                </Panel>
              )}
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
        onFontSizeChange={setFontSize}
        onMultiColorJoinsToggle={() => setMultiColorJoins(!multiColorJoins)}
        showFilters={showFilters}
        currentEdgeType={edgeType}
        rankSep={rankSep}
        nodeSep={nodeSep}
        searchQuery={searchQuery}
        fontSize={fontSize}
        multiColorJoins={multiColorJoins}
      />

      {/* Error Banner */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 mx-auto max-w-2xl rounded-lg p-4 text-slate-300 shadow-lg backdrop-blur-sm" style={{ border: '1px solid #30363D', background: 'rgba(13, 17, 23, 0.95)' }}>
          <div className="flex items-start gap-3">
            <span className="text-slate-500">
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
              <h3 className="font-semibold text-slate-200">SQL Parse Error</h3>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
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
          <p className="text-sm font-medium">No tables found in query</p>
        </div>
      )}
    </div>
  );
}

export default App;
