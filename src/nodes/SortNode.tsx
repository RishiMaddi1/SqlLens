import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

interface SortNodeData {
  sortColumns: Array<{ column: string; direction: string }>;
}

export const SortNode = memo((props: NodeProps) => {
  const data = props.data as unknown as SortNodeData;

  return (
    <div
      className="
        rounded-lg border-2 border-purple-500/50 bg-purple-950/30
        shadow-xl min-w-[220px] max-w-[320px] backdrop-blur-sm
      "
      style={{
        padding: '0',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !border-purple-400 !-top-1 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-purple-500/30 bg-purple-500/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-purple-400">📶</span>
          <span className="font-bold text-purple-200 text-sm uppercase tracking-wide">
            ORDER BY
          </span>
        </div>
      </div>

      {/* Sort Columns List */}
      <div className="px-4 py-3">
        {data.sortColumns.length > 0 ? (
          <ul className="space-y-2">
            {data.sortColumns.map((sort: { column: string; direction: string }, index: number) => (
              <li
                key={index}
                className="text-purple-100/90 text-xs flex items-center justify-between gap-2 font-mono bg-purple-950/50 px-2 py-1.5 rounded"
              >
                <span className="flex items-center gap-2">
                  <span className="text-purple-500">↕</span>
                  <span>{sort.column}</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    sort.direction === 'DESC'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-green-500/20 text-green-300'
                  }`}
                >
                  {sort.direction}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-purple-200/50 text-xs italic">(no sort order)</p>
        )}
      </div>

      {/* No output handle - this is the final node */}
    </div>
  );
});

SortNode.displayName = 'SortNode';
