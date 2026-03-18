import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { ArrowDownAZ } from 'lucide-react';

interface SortNodeData {
  sortColumns: Array<{ column: string; direction: string }>;
}

export const SortNode = memo((props: NodeProps) => {
  const data = props.data as unknown as SortNodeData;
  const needsScroll = data.sortColumns.length > 8;

  return (
    <div
      className="
        rounded-lg border-2 border-purple-500/50 bg-slate-800
        shadow-lg min-w-[280px] max-w-[320px] backdrop-blur-sm
      "
      style={{
        padding: '0',
        minHeight: '80px',
        background: '#581c87', // purple-900 for minimap visibility
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !border-purple-400 !-top-1 !w-2.5 !h-2.5"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-purple-500/30 bg-purple-500/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <ArrowDownAZ className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-purple-200 text-sm uppercase tracking-wide">
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
                className="flex items-center justify-between gap-2 text-xs bg-slate-900/50 px-3 py-2 rounded"
              >
                <code
                  className="flex-1 text-purple-100/90 font-mono truncate"
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
          <p className="text-purple-200/50 text-xs italic">(no sort)</p>
        )}
      </div>
    </div>
  );
});

SortNode.displayName = 'SortNode';
