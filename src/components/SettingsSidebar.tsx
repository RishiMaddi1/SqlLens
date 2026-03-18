import { X, Search, Eye, EyeOff, Type } from 'lucide-react';

interface SettingsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onRankSepChange: (value: number) => void;
  onNodeSepChange: (value: number) => void;
  onEdgeTypeChange: (type: string) => void;
  onShowFiltersToggle: () => void;
  onSearchChange: (query: string) => void;
  onFontSizeChange: (value: number) => void;
  onMultiColorJoinsToggle: () => void;
  showFilters: boolean;
  currentEdgeType: string;
  rankSep: number;
  nodeSep: number;
  searchQuery: string;
  fontSize: number;
  multiColorJoins: boolean;
}

export function SettingsSidebar({
  isOpen,
  onToggle,
  onRankSepChange,
  onNodeSepChange,
  onEdgeTypeChange,
  onShowFiltersToggle,
  onSearchChange,
  onFontSizeChange,
  onMultiColorJoinsToggle,
  showFilters,
  currentEdgeType,
  rankSep,
  nodeSep,
  searchQuery,
  fontSize,
  multiColorJoins,
}: SettingsSidebarProps) {
  const edgeTypes: { label: string; value: string }[] = [
    { label: 'Bezier', value: 'default' },
    { label: 'Smooth Step', value: 'smoothstep' },
    { label: 'Straight', value: 'straight' },
    { label: 'Simple Bezier', value: 'simplebezier' },
  ];

  return (
    <>
      {/* Sidebar Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 backdrop-blur-md
          shadow-2xl z-30 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{
          background: 'rgba(11, 14, 20, 0.95)',
          borderLeft: '1px solid #30363D',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363D' }}>
            <h2 className="text-lg font-semibold text-slate-200">Layout Settings</h2>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
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
                  min="40"
                  max="200"
                  step="5"
                  value={rankSep}
                  onChange={(e) => onRankSepChange(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: '#161B22' }}
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Horizontal (Node)</span>
                  <span className="font-mono text-indigo-400">{nodeSep}px</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="150"
                  step="5"
                  value={nodeSep}
                  onChange={(e) => onNodeSepChange(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: '#161B22' }}
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
                          : 'bg-[#161B22] border-[#30363D] text-slate-300 hover:bg-[#1C2128] hover:border-[#484F58]'
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
                      : 'bg-[#161B22] border-[#30363D] text-slate-300 hover:bg-[#1C2128] hover:border-[#484F58]'
                  }
                `}
              >
                {showFilters ? (
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                )}
                <span>{showFilters ? 'Showing Filters' : 'Filters Hidden'}</span>
              </button>
              <button
                onClick={onMultiColorJoinsToggle}
                className={`
                  w-full px-4 py-2.5 text-sm rounded-lg border flex items-center gap-2 transition-all
                  ${
                    multiColorJoins
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-[#161B22] border-[#30363D] text-slate-300 hover:bg-[#1C2128] hover:border-[#484F58]'
                  }
                `}
              >
                <div className={`w-4 h-4 rounded-full ${multiColorJoins ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400' : 'bg-slate-600'}`} />
                <span>{multiColorJoins ? 'Multi-Color Joins' : 'Single-Color Joins'}</span>
              </button>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Type className="w-4 h-4" strokeWidth={1.5} />
                Font Size
              </h3>
              <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Text Size</span>
                  <span className="font-mono text-indigo-400">{fontSize}px</span>
                </label>
                <input
                  type="range"
                  min="11"
                  max="18"
                  step="1"
                  value={fontSize}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: '#161B22' }}
                />
              </div>
            </div>

            {/* Search Nodes */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300">Search Nodes</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search table names..."
                  className="w-full pl-10 pr-3 py-2 text-sm bg-[#161B22] border border-[#30363D] rounded-lg
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
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
          onClick={onToggle}
        />
      )}
    </>
  );
}
