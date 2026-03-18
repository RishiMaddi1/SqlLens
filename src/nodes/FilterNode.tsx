import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

interface FilterNodeData {
  conditions: string[];
}

export const FilterNode = memo(({ data }: NodeProps<FilterNodeData>) => {
  return (
    <div
      className="
        rounded-lg border-2 border-amber-500/50 bg-amber-950/30
        shadow-xl min-w-[220px] max-w-[320px] backdrop-blur-sm
      "
      style={{
        padding: '0',
      }}
    >
      {/* Input Handle (top) - can have multiple inputs */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !border-amber-400 !-top-1 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-amber-500/30 bg-amber-500/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">🔍</span>
          <span className="font-bold text-amber-200 text-sm uppercase tracking-wide">
            WHERE
          </span>
        </div>
      </div>

      {/* Conditions List */}
      <div className="px-4 py-3">
        {data.conditions.length > 0 ? (
          <ul className="space-y-2">
            {data.conditions.map((condition, index) => (
              <li
                key={index}
                className="text-amber-100/90 text-xs flex items-start gap-2 font-mono bg-amber-950/50 px-2 py-1.5 rounded"
              >
                <span className="text-amber-500 mt-0.5">⚡</span>
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-amber-200/50 text-xs italic">(no conditions)</p>
        )}
      </div>

      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-500 !border-amber-400 !-bottom-1 !w-3 !h-3"
      />
    </div>
  );
});

FilterNode.displayName = 'FilterNode';
