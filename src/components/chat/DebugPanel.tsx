import { useState } from "react";
import { ChevronDown, ChevronRight, Bug } from "lucide-react";

export interface DebugEntry {
  toolName: string;
  args: any;
  result: any;
  requestUri?: string;
}

export function DebugPanel({ logs }: { logs: DebugEntry[] }) {
  const [open, setOpen] = useState(false);

  if (!logs.length) return null;

  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Răspunsuri API ({logs.length})</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 ml-auto" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2 space-y-3 max-h-[400px] overflow-y-auto">
          {logs.map((log, i) => (
            <DebugEntryCard key={i} entry={log} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function DebugEntryCard({ entry, index }: { entry: DebugEntry; index: number }) {
  const [showArgs, setShowArgs] = useState(false);
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs">
      <div className="font-semibold text-foreground mb-1">
        {index + 1}. {entry.toolName}
      </div>

      {entry.requestUri && (
        <div className="mb-1.5 px-1 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground break-all">
          {entry.requestUri}
        </div>
      )}

      <button
        onClick={() => setShowArgs(!showArgs)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-1"
      >
        {showArgs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Parametri cerere
      </button>
      {showArgs && (
        <pre className="bg-muted rounded p-2 overflow-x-auto text-[10px] leading-relaxed mb-2 max-h-[200px] overflow-y-auto">
          {JSON.stringify(entry.args, null, 2)}
        </pre>
      )}

      <button
        onClick={() => setShowResult(!showResult)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-1"
      >
        {showResult ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Response
      </button>
      {showResult && (
        <pre className="bg-muted rounded p-2 overflow-x-auto text-[10px] leading-relaxed max-h-[300px] overflow-y-auto">
          {JSON.stringify(entry.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
