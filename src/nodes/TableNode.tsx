import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

interface TableNodeData {
  tableName: string;
  fields: string[];
  filters?: string[];
}

export const TableNode = memo(({ data }: NodeProps<TableNodeData>) => {
  const hasFilters = data.filters && data.filters.length > 0;

  return (
    <div
      className={`
        rounded-lg border shadow-xl min-w-[200px] max-w-[280px]
        ${hasFilters ? 'border-orange-500/50 bg-slate-800' : 'border-slate-600 bg-slate-800'}
      `}
      style={{
        padding: '0',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!border-slate-400 !-top-1 !w-3 !h-3 ${
          hasFilters ? '!bg-orange-500' : '!bg-slate-500'
        }`}
      />

      {/* Table Name Header */}
      <div
        className={`
          px-4 py-3 border-b rounded-t-lg
          ${hasFilters ? 'border-orange-500/30 bg-orange-500/10' : 'border-slate-600 bg-slate-700/50'}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-bold text-slate-100 text-sm">
            {data.tableName}
          </span>
          {hasFilters && (
            <span className="ml-auto text-orange-400" title="Has filters">
              🔍
            </span>
          )}
        </div>
      </div>

      {/* Fields List */}
      <div className="px-4 py-3">
        {data.fields.length > 0 ? (
          <ul className="space-y-1.5">
            {data.fields.map((field, index) => (
              <li
                key={index}
                className="text-slate-400 text-xs flex items-center gap-2"
              >
                <span className="text-slate-500">•</span>
                <span className="font-mono">{field}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-xs italic">(no fields selected)</p>
        )}
      </div>

      {/* Inline Filters Section */}
      {hasFilters && (
        <div
          className="
            px-3 py-2 border-t border-orange-500/30 bg-orange-950/30
            rounded-b-lg
          "
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-orange-400 text-xs">⚡</span>
            <span className="text-orange-300 text-[10px] font-semibold uppercase tracking-wide">
              Filtered by
            </span>
          </div>
          <ul className="space-y-1">
            {data.filters!.map((filter, index) => (
              <li
                key={index}
                className="text-orange-100/80 text-[10px] font-mono bg-orange-950/50 px-2 py-1 rounded truncate"
                title={filter}
              >
                {filter}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!border-slate-400 !-bottom-1 !w-3 !h-3 ${
          hasFilters ? '!bg-orange-500' : '!bg-blue-500'
        }`}
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';
