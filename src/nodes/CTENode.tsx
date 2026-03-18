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
        rounded-lg border-2 border-cyan-500/50 bg-slate-800
        shadow-lg min-w-[280px] max-w-[320px] backdrop-blur-sm
      "
      style={{
        padding: '0',
        minHeight: '80px',
        background: '#164e63', // cyan-900 for minimap visibility
      }}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !border-cyan-400 !-top-1 !w-2.5 !h-2.5"
      />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-cyan-500/30 bg-cyan-500/10 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-cyan-200" style={{ fontSize: `${fontSize}px` }}>
              {data.cteName}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-600/50 rounded transition-colors"
            title={copied ? 'Copied!' : 'Copy CTE name'}
          >
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : 'text-slate-500'}`} />
          </button>
        </div>
        <span className="ml-auto text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded" style={{ fontSize: `${fontSize - 4}px` }}>
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
                    className="flex-1 text-cyan-100/90 font-mono truncate"
                    title={field}
                  >
                    {field}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-cyan-200/50 text-xs italic">(no fields)</p>
        )}
      </div>

      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !border-cyan-400 !-bottom-1 !w-2.5 !h-2.5"
      />
    </div>
  );
});

CTENode.displayName = 'CTENode';
