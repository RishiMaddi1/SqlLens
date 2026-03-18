import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { FileCode, Copy } from 'lucide-react';

interface CTENodeData {
  cteName: string;
  fields: string[];
  fontSize?: number;
}

export const CTENode = memo((props: NodeProps) => {
  const data = props.data as unknown as CTENodeData;
  const fontSize = data.fontSize || 14;
  const needsScroll = data.fields.length > 10;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.cteName);
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
        minHeight: '80px',
        background: '#161B22',
        borderTop: '2px solid #22D3EE',
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !border-[#484F58] !-top-1 !w-2.5 !h-2.5"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#30363D] rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
            <span className="font-semibold text-slate-200" style={{ fontSize: `${fontSize}px` }}>
              {data.cteName}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-600/50 rounded transition-colors"
            title={copied ? 'Copied!' : 'Copy CTE name'}
          >
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : 'text-slate-500'}`} strokeWidth={1.5} />
          </button>
        </div>
        <span className="ml-auto text-cyan-400 bg-[#0D1117]/50 px-2 py-0.5 rounded" style={{ fontSize: `${fontSize - 4}px` }}>
          CTE
        </span>
      </div>

      {/* Fields List */}
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
                  <span className="text-cyan-500">•</span>
                  <code
                    className="flex-1 text-slate-300 font-mono truncate"
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

      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !border-[#484F58] !-bottom-1 !w-2.5 !h-2.5"
      />
    </div>
  );
});

CTENode.displayName = 'CTENode';
