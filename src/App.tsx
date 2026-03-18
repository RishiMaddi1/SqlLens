import { useState, useCallback, useEffect, useRef } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { sqlToFlowNodes } from './utils/astToFlowMapper';
import { TableNode } from './nodes/TableNode';
import { SortNode } from './nodes/SortNode';

// Default hardcoded query for the PoC
const DEFAULT_QUERY =
  'SELECT users.name, orders.total FROM users JOIN orders ON users.id = orders.user_id;';

function App() {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Pane state: 'editor' = editor fullscreen, 'viz' = viz fullscreen, null = split view
  const [expandedPane, setExpandedPane] = useState<'editor' | 'viz' | null>(null);

  // Register custom node types
  const nodeTypes = {
    tableNode: TableNode,
    sortNode: SortNode,
  };

  // Parse SQL and update flow (only triggered by button click)
  const parseAndUpdateFlow = useCallback((sqlText: string) => {
    try {
      setError(null);
      const { nodes: newNodes, edges: newEdges } = sqlToFlowNodes(sqlText);
      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse SQL';
      setError(errorMessage);
      console.error('Parse error:', err);
    }
  }, [setNodes, setEdges]);

  // Initial parse on mount
  useEffect(() => {
    parseAndUpdateFlow(sql);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    const newSql = value || '';
    setSql(newSql);
    // No auto-parsing - only update state
  };

  const handleVisualizeClick = () => {
    parseAndUpdateFlow(sql);
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

    // Small delay to ensure UI is ready
    setTimeout(() => {
      const viewport = document.querySelector('.react-flow__viewport');

      if (!viewport) {
        console.error('Could not find React Flow viewport');
        setIsExporting(false);
        return;
      }

      toPng(viewport as HTMLElement, {
        backgroundColor: '#0f172a', // Match our gray-900 background
        cacheBust: true,
        quality: 1,
        pixelRatio: 2, // Higher resolution
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
    <div className="flex h-screen w-screen flex-col bg-gray-900">
      {/* Header */}
      <header className="flex h-12 items-center border-b border-gray-700 bg-gray-800 px-4">
        <h1 className="text-lg font-semibold text-blue-400">
          Visual SQL Flow Mapper
        </h1>
        <span className="ml-3 rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-300">
          PoC
        </span>
      </header>

      {/* Main Content: Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Monaco Editor */}
        <div
          className={`flex flex-col border-r border-gray-700 transition-all duration-300 ${
            expandedPane === 'editor' ? 'w-full' : expandedPane === 'viz' ? 'w-0 hidden' : 'w-1/2'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-2">
            <span className="text-sm font-medium text-gray-300">SQL Editor</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">node-sql-parser</span>
              <button
                onClick={toggleEditor}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={expandedPane === 'editor' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'editor' ? (
                  // Split view icon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                ) : (
                  // Fullscreen icon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
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
          <div className="border-t border-gray-700 bg-gray-800 p-3">
            <button
              onClick={handleVisualizeClick}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
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
          <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-2">
            <span className="text-sm font-medium text-gray-300">Flow Visualization</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">dagre auto-layout</span>
              <button
                onClick={toggleViz}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={expandedPane === 'viz' ? 'Split View' : 'Fullscreen'}
              >
                {expandedPane === 'viz' ? (
                  // Split view icon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                ) : (
                  // Fullscreen icon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              defaultEdgeOptions={{
                animated: true,
              }}
              // Disable spacebar panning to prevent interference with Monaco editor
              panOnScroll={false}
              panActivationKeyCode={null}
            >
              <Background color="#374151" gap={16} />
              <Controls
                className="!border-gray-700 !bg-gray-800"
                showZoom={true}
                showFitView={true}
                showInteractive={true}
              />
              <MiniMap
                className="!bg-gray-800 !border-gray-700"
                nodeColor="#1e293b"
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
                  {isExporting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8m0 0l4-4m-4 4l4-4m8 0l4 4m0-8v8m0 0l-4 4m4-4l-4-4" />
                      </svg>
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download PNG</span>
                    </>
                  )}
                </button>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>

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
        <div className="pointer-events-none absolute bottom-1/2 right-1/4 flex -translate-y-1/2 translate-x-1/2 flex-col items-center text-center text-gray-500">
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
