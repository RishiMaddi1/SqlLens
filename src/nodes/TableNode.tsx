import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { Database, Copy, Filter } from 'lucide-react';

interface TableNodeData {
  tableName: string;
  alias?: string;
  fields: string[];
  filters?: string[];
  joinFields?: string[];
  fontSize?: number;
}

export const TableNode = memo((props: NodeProps) => {
  const data = props.data as unknown as TableNodeData;
  const fontSize = data.fontSize || 14;
  const hasFilters = data.filters && data.filters.length > 0;
  const hasJoinFields = data.joinFields && data.joinFields.length > 0;
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
      className="
        rounded-lg border shadow-lg min-w-[280px] max-w-[320px]
        border-[#30363D]
      "
      style={{
        padding: '0',
        minHeight: hasFilters ? 'auto' : '80px',
        background: '#161B22',
        borderTop: '2px solid #818CF8',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!border-[#484F58] !-top-1 !w-2.5 !h-2.5 ${
          hasFilters ? '!bg-amber-500' : '!bg-slate-500'
        }`}
      />

      {/* Table Name Header */}
      <div
        className="
          px-4 py-2.5 rounded-t-lg
          border-b border-[#30363D]
        "
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              <span className="font-semibold text-slate-200" style={{ fontSize: `${fontSize}px` }}>
                {data.tableName}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-slate-600/50 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy table name'}
            >
              <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : 'text-slate-500'}`} strokeWidth={1.5} />
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

      {/* Join Fields Section */}
      {hasJoinFields && (
        <div className="px-3 py-2 border-b border-[#30363D]" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
          <div className="space-y-1">
            {data.joinFields!.map((joinField: string, index: number) => (
              <code
                key={index}
                className="block text-indigo-300/90 font-mono bg-[#0D1117]/50 px-2 py-1 rounded truncate"
                style={{ fontSize: `${fontSize - 3}px` }}
                title={joinField}
              >
                {joinField}
              </code>
            ))}
          </div>
        </div>
      )}

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
        <div className="px-3 py-2 border-t border-[#30363D] rounded-b-lg" style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Filter className="w-3 h-3 text-amber-400" strokeWidth={1.5} />
            <span className="text-amber-400 font-semibold uppercase tracking-wide" style={{ fontSize: `${fontSize - 4}px` }}>
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
                className="block text-amber-200/90 font-mono bg-[#0D1117]/50 px-2 py-1 rounded truncate"
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
        className={`!border-[#484F58] !-bottom-1 !w-2.5 !h-2.5 ${
          hasFilters ? '!bg-amber-500' : '!bg-slate-500'
        }`}
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';
