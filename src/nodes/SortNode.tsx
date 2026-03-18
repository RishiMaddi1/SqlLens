import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { ArrowDownAZ } from 'lucide-react';

interface SortNodeData {
  sortColumns: Array<{ column: string; direction: string }>;
  fontSize?: number;
}

export const SortNode = memo((props: NodeProps) => {
  const data = props.data as unknown as SortNodeData;
  const fontSize = data.fontSize || 14;
  const needsScroll = data.sortColumns.length > 8;

  return (
    <div
      className="
        rounded-lg border shadow-lg min-w-[280px] max-w-[320px]
        border-[#30363D]
      "
      style={{
        padding: '0',
        minHeight: '80px',
        background: '#161B22',
        borderTop: '2px solid #A78BFA',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !border-[#484F58] !-top-1 !w-2.5 !h-2.5"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#30363D] rounded-t-lg">
        <div className="flex items-center gap-2">
          <ArrowDownAZ className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
          <span className="font-semibold text-slate-200 text-sm uppercase tracking-wide" style={{ fontSize: `${fontSize}px` }}>
            ORDER BY
          </span>
        </div>
      </div>

      {/* Sort Columns List */}
      <div className="px-4 py-3">
        {data.sortColumns.length > 0 ? (
          <div
            className={`space-y-2 ${needsScroll ? 'max-h-[300px] overflow-y-auto pr-2' : ''}`}
            style={
              needsScroll
                ? {
                    scrollbarWidth: '6px' as any,
                    scrollbarColor: '#475569 #1e293b' as any,
                  }
                : undefined
            }
          >
            {data.sortColumns.map((sort: { column: string; direction: string }, index: number) => (
              <li
                key={index}
                className="flex items-center justify-between gap-2 text-xs bg-[#0D1117]/50 px-3 py-2 rounded border border-[#30363D]"
                style={{ fontSize: `${fontSize - 2}px` }}
              >
                <code
                  className="flex-1 text-slate-300 font-mono truncate"
                  title={sort.column}
                >
                  {sort.column}
                </code>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                    sort.direction === 'DESC'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-green-500/20 text-green-300'
                  }`}
                >
                  {sort.direction}
                </span>
              </li>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-xs italic">(no sort)</p>
        )}
      </div>
    </div>
  );
});

SortNode.displayName = 'SortNode';
