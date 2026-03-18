import { X, Search, Eye, EyeOff } from 'lucide-react';

interface SettingsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onRankSepChange: (value: number) => void;
  onNodeSepChange: (value: number) => void;
  onEdgeTypeChange: (type: string) => void;
  onShowFiltersToggle: () => void;
  onSearchChange: (query: string) => void;
  showFilters: boolean;
  currentEdgeType: string;
  rankSep: number;
  nodeSep: number;
  searchQuery: string;
}

export function SettingsSidebar({
  isOpen,
  onToggle,
  onRankSepChange,
  onNodeSepChange,
  onEdgeTypeChange,
  onShowFiltersToggle,
  onSearchChange,
  showFilters,
  currentEdgeType,
  rankSep,
  nodeSep,
  searchQuery,
}: SettingsSidebarProps) {
  const edgeTypes: { label: string; value: string }[] = [
    { label: 'Smooth Step', value: 'smoothstep' },
    { label: 'Straight', value: 'straight' },
    { label: 'Bezier', value: 'default' },
    { label: 'Simple Bezier', value: 'simplebezier' },
  ];

  return (
    <>
      {/* Sidebar Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-700
          shadow-2xl z-30 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200">Layout Settings</h2>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Node Spacing */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Node Spacing</h3>

              <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Vertical (Rank)</span>
                  <span className="font-mono text-indigo-400">{rankSep}px</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={rankSep}
                  onChange={(e) => onRankSepChange(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Horizontal (Node)</span>
                  <span className="font-mono text-indigo-400">{nodeSep}px</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={nodeSep}
                  onChange={(e) => onNodeSepChange(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Edge Type */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300">Edge Style</h3>
              <div className="space-y-2">
                {edgeTypes.map((edge) => (
                  <button
                    key={edge.value}
                    onClick={() => onEdgeTypeChange(edge.value)}
                    className={`
                      w-full px-3 py-2 text-left text-sm rounded-lg border transition-all
                      ${
                        currentEdgeType === edge.value
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                      }
                    `}
                  >
                    {edge.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300">View Options</h3>
              <button
                onClick={onShowFiltersToggle}
                className={`
                  w-full px-4 py-2.5 text-sm rounded-lg border flex items-center gap-2 transition-all
                  ${
                    showFilters
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }
                `}
              >
                {showFilters ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                <span>{showFilters ? 'Showing Filters' : 'Filters Hidden'}</span>
              </button>
            </div>

            {/* Search Nodes */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300">Search Nodes</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search table names..."
                  className="w-full pl-10 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg
                    text-slate-300 placeholder:text-slate-500
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={onToggle}
        />
      )}
    </>
  );
}
