import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { Database, Copy, Filter } from 'lucide-react';

interface TableNodeData {
  tableName: string;
  alias?: string;
  fields: string[];
  filters?: string[];
  fontSize?: number;
}

export const TableNode = memo((props: NodeProps) => {
  const data = props.data as unknown as TableNodeData;
  const fontSize = data.fontSize || 14;
  const hasFilters = data.filters && data.filters.length > 0;
  const hasAlias = data.alias && data.alias !== data.tableName;
  const needsScroll = data.fields.length > 12 || (data.filters?.length || 0) > 8;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const sqlSegment = hasAlias
      ? `${data.tableName} AS ${data.alias}`
      : data.tableName;
    navigator.clipboard.writeText(sqlSegment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`
        rounded-lg border shadow-lg min-w-[280px] max-w-[320px]
        ${hasFilters ? 'border-indigo-500/50 bg-slate-800' : 'border-slate-600 bg-slate-800'}
      `}
      style={{
        padding: '0',
        minHeight: hasFilters ? 'auto' : '80px',
        background: hasFilters ? '#1e293b' : '#1e293b',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!border-slate-500 !-top-1 !w-2.5 !h-2.5 ${
          hasFilters ? '!bg-indigo-500' : '!bg-slate-500'
        }`}
      />

      {/* Table Name Header */}
      <div
        className={`
          px-4 py-2.5 border-b rounded-t-lg
          ${hasFilters ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-slate-600 bg-slate-700/50'}
        `}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-200" style={{ fontSize: `${fontSize}px` }}>
                {data.tableName}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-slate-600/50 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy table name'}
            >
              <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : 'text-slate-500'}`} />
            </button>
          </div>
          {hasAlias && (
            <div className="flex items-center gap-1.5 ml-6">
              <span className="text-slate-500" style={{ fontSize: `${fontSize - 2}px` }}>as</span>
              <code className="text-indigo-400 bg-slate-900/50 px-1.5 py-0.5 rounded" style={{ fontSize: `${fontSize - 2}px` }}>
                {data.alias}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Fields List - Scrollable if needed */}
      <div className="px-4 py-3">
        {data.fields.length > 0 ? (
          <div
            className={`space-y-1.5 ${needsScroll ? 'max-h-[300px] overflow-y-auto pr-2' : ''}`}
            style={
              needsScroll
                ? {
                    scrollbarWidth: '6px' as any,
                    scrollbarColor: '#475569 #1e293b' as any,
                  }
                : undefined
            }
          >
            <ul className="space-y-1.5">
              {data.fields.map((field: string, index: number) => (
                <li
                  key={index}
                  className="group flex items-center gap-2"
                  style={{ fontSize: `${fontSize - 2}px` }}
                >
                  <span className="text-slate-500">•</span>
                  <code
                    className="flex-1 text-slate-400 font-mono truncate"
                    title={field}
                  >
                    {field}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-slate-500 text-xs italic">(no fields)</p>
        )}
      </div>

      {/* Inline Filters Section */}
      {hasFilters && (
        <div className="px-3 py-2 border-t border-indigo-500/30 bg-indigo-950/30 rounded-b-lg">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Filter className="w-3 h-3 text-indigo-400" />
            <span className="text-indigo-300 font-semibold uppercase tracking-wide" style={{ fontSize: `${fontSize - 4}px` }}>
              Filtered by
            </span>
          </div>
          <div
            className={`max-h-[150px] overflow-y-auto pr-1 space-y-1 ${
              (data.filters?.length || 0) > 5
                ? 'scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800'
                : ''
            }`}
          >
            {data.filters!.map((filter: string, index: number) => (
              <code
                key={index}
                className="block text-indigo-200/90 font-mono bg-slate-900/50 px-2 py-1 rounded truncate"
                style={{ fontSize: `${fontSize - 4}px` }}
                title={filter}
              >
                {filter}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!border-slate-500 !-bottom-1 !w-2.5 !h-2.5 ${
          hasFilters ? '!bg-indigo-500' : '!bg-blue-500'
        }`}
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';
