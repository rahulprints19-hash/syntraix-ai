"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-white/10 bg-slate-950/60 text-sm text-slate-400">
      Loading Monaco editor...
    </div>
  )
});

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-white/10">
      <MonacoEditor
        height="min(60vh, 520px)"
        language={language}
        value={value}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on"
        }}
        onChange={(nextValue) => onChange(nextValue ?? "")}
      />
    </div>
  );
}
