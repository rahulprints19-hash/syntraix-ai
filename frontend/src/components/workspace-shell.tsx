"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { apiRequest } from "@/lib/api";
import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  AgentRunResponse,
  AdminOverviewResponse,
  AdminUserResponse,
  ApplyChangesResponse,
  ApiKeyCreateResponse,
  ApiKeyResponse,
  BillingOverviewResponse,
  ChatMessage,
  ChatThread,
  CommandResponse,
  CheckoutResponse,
  DeployExportResponse,
  FileContentResponse,
  FileNode,
  HealthResponse,
  MemoryItem,
  ModelCatalogResponse,
  PreviewResponse,
  PlanResponse,
  ProposeChangesResponse,
  Project,
  WorkspaceView
} from "@/types/workspace";

import { CodeEditor } from "@/components/code-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const viewLabels: Array<{ id: WorkspaceView; label: string; description: string; group: string; glyph: string }> = [
  { id: "dashboard", label: "Dashboard", description: "Workspace, usage, and launch readiness.", group: "Command", glyph: "D" },
  { id: "chat", label: "Chat", description: "Streaming AI workspace with saved context.", group: "Command", glyph: "C" },
  { id: "memory", label: "Memory", description: "Long-term project memory and retrieval.", group: "Command", glyph: "M" },
  { id: "marketplace", label: "Tools", description: "Prompt templates and AI workflows.", group: "Command", glyph: "T" },
  { id: "editor", label: "Editor", description: "Monaco-powered file editing with save flow.", group: "Build", glyph: "E" },
  { id: "files", label: "Files", description: "Secure project-scoped file explorer.", group: "Build", glyph: "F" },
  { id: "terminal", label: "Terminal", description: "Project-root command execution.", group: "Build", glyph: ">" },
  { id: "preview", label: "Preview", description: "Live preview rendering.", group: "Build", glyph: "P" },
  { id: "agents", label: "Agents", description: "Planner, coder, debugger, and terminal loop.", group: "Build", glyph: "A" },
  { id: "changes", label: "Changes", description: "Review and apply generated code changes.", group: "Build", glyph: "G" },
  { id: "billing", label: "Billing", description: "Plans, wallet credits, invoices, and usage.", group: "Business", glyph: "$" },
  { id: "apiKeys", label: "API Keys", description: "Secure keys, rotation, revocation, and limits.", group: "Business", glyph: "K" },
  { id: "admin", label: "Admin", description: "Users, revenue, API monitoring, and moderation.", group: "Business", glyph: "AD" },
  { id: "settings", label: "Settings", description: "Profile, model, security, and deployment settings.", group: "Business", glyph: "S" }
];

const promptTemplates = [
  "Audit this repository and list the top production risks.",
  "Turn the selected file into a polished responsive UI.",
  "Generate tests for the current backend endpoint.",
  "Explain this project to a new engineer in five minutes."
];

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-4 animate-pulse rounded bg-white/10", className)} />;
}

function getFirstFile(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "file") {
      return node.path;
    }
    const nested = getFirstFile(node.children);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function useEventCallback<Args extends unknown[], Return>(
  callback: (...args: Args) => Return
): (...args: Args) => Return {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}

function FileTree({
  activePath,
  nodes,
  onSelect
}: {
  activePath: string | null;
  nodes: FileNode[];
  onSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div key={node.path}>
          <button
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
              activePath === node.path
                ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                : "border-white/8 bg-white/3 text-slate-300 hover:bg-white/8",
              node.type === "directory" ? "font-medium" : ""
            )}
            disabled={node.type === "directory"}
            onClick={() => {
              if (node.type === "file") {
                onSelect(node.path);
              }
            }}
            type="button"
          >
            {node.type === "directory" ? `/${node.name}` : node.name}
          </button>
          {node.type === "directory" && node.children.length > 0 ? (
            <div className="mt-2 space-y-2 pl-4">
              <FileTree activePath={activePath} nodes={node.children} onSelect={onSelect} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid size-10 place-items-center rounded-lg border border-cyan-300/30 bg-[radial-gradient(circle_at_35%_30%,rgba(94,234,212,0.9),rgba(14,165,233,0.18)_48%,rgba(15,23,42,0.78)_100%)] shadow-[0_0_34px_rgba(45,212,191,0.22)]",
        className
      )}
    >
      <span className="text-sm font-black text-white">S</span>
    </div>
  );
}

function Surface({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.68))] shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  accent = "cyan"
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "cyan" | "emerald" | "violet" | "amber" | "rose";
}) {
  const accents = {
    amber: "from-amber-300/20 to-white/0 text-amber-100",
    cyan: "from-cyan-300/20 to-white/0 text-cyan-100",
    emerald: "from-emerald-300/20 to-white/0 text-emerald-100",
    rose: "from-rose-300/20 to-white/0 text-rose-100",
    violet: "from-violet-300/20 to-white/0 text-violet-100"
  };

  return (
    <div className={cn("rounded-lg border border-white/10 bg-gradient-to-br p-4", accents[accent])}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={`${part}-${index}`} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-white/10 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-medium uppercase text-slate-400">{language || "code"}</span>
        <button
          className="rounded-md border border-white/10 bg-white/6 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
          onClick={copyCode}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-xs leading-6 text-cyan-50">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const segments = content.split("```");

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (index % 2 === 1) {
          const [firstLine = "", ...rest] = segment.split("\n");
          const hasLanguage = /^[A-Za-z0-9_+#.-]{1,24}$/.test(firstLine.trim());
          const language = hasLanguage ? firstLine.trim() : "text";
          const code = (hasLanguage ? rest.join("\n") : segment).trim();
          return <CodeBlock key={`${index}-${language}`} code={code} language={language} />;
        }

        return segment
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, paragraphIndex) => (
            <p key={`${index}-${paragraphIndex}`} className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
              <InlineMarkdown text={paragraph} />
            </p>
          ));
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="size-2 animate-pulse rounded-full bg-cyan-200" />
      <span className="size-2 animate-pulse rounded-full bg-cyan-200 [animation-delay:120ms]" />
      <span className="size-2 animate-pulse rounded-full bg-cyan-200 [animation-delay:240ms]" />
      <span>Syntrix is thinking</span>
    </div>
  );
}

export function WorkspaceShell() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const apiStatus = useWorkspaceStore((state) => state.apiStatus);
  const lastHealthCheckAt = useWorkspaceStore((state) => state.lastHealthCheckAt);
  const token = useWorkspaceStore((state) => state.token);
  const user = useWorkspaceStore((state) => state.user);
  const projects = useWorkspaceStore((state) => state.projects);
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const activeFilePath = useWorkspaceStore((state) => state.activeFilePath);
  const editorContent = useWorkspaceStore((state) => state.editorContent);
  const editorLanguage = useWorkspaceStore((state) => state.editorLanguage);
  const activeThreadId = useWorkspaceStore((state) => state.activeThreadId);
  const threads = useWorkspaceStore((state) => state.threads);
  const messages = useWorkspaceStore((state) => state.messages);
  const terminalResult = useWorkspaceStore((state) => state.terminalResult);
  const preview = useWorkspaceStore((state) => state.preview);
  const memories = useWorkspaceStore((state) => state.memories);
  const deployExport = useWorkspaceStore((state) => state.deployExport);
  const pendingChanges = useWorkspaceStore((state) => state.pendingChanges);
  const runtimeSocketReady = useWorkspaceStore((state) => state.runtimeSocketReady);

  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const setApiStatus = useWorkspaceStore((state) => state.setApiStatus);
  const setLastHealthCheckAt = useWorkspaceStore((state) => state.setLastHealthCheckAt);
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const setActiveProjectId = useWorkspaceStore((state) => state.setActiveProjectId);
  const setFileTree = useWorkspaceStore((state) => state.setFileTree);
  const setEditorState = useWorkspaceStore((state) => state.setEditorState);
  const setThreads = useWorkspaceStore((state) => state.setThreads);
  const setActiveThreadId = useWorkspaceStore((state) => state.setActiveThreadId);
  const setMessages = useWorkspaceStore((state) => state.setMessages);
  const appendMessage = useWorkspaceStore((state) => state.appendMessage);
  const updateLastAssistantMessage = useWorkspaceStore((state) => state.updateLastAssistantMessage);
  const setTerminalResult = useWorkspaceStore((state) => state.setTerminalResult);
  const setPreview = useWorkspaceStore((state) => state.setPreview);
  const setMemories = useWorkspaceStore((state) => state.setMemories);
  const setDeployExport = useWorkspaceStore((state) => state.setDeployExport);
  const setPendingChanges = useWorkspaceStore((state) => state.setPendingChanges);
  const setRuntimeSocketReady = useWorkspaceStore((state) => state.setRuntimeSocketReady);
  const clearSession = useWorkspaceStore((state) => state.clearSession);

  const [chatInput, setChatInput] = useState("");
  const [commandInput, setCommandInput] = useState("ls");
  const [memoryInput, setMemoryInput] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [agentObjective, setAgentObjective] = useState("Add a hero section animation and verify the preview.");
  const [newProjectName, setNewProjectName] = useState("");
  const [newFilePath, setNewFilePath] = useState("");
  const [newFolderPath, setNewFolderPath] = useState("");
  const [renameTargetPath, setRenameTargetPath] = useState("");
  const [deleteConfirmPath, setDeleteConfirmPath] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [changeObjective, setChangeObjective] = useState("Improve the current file and keep the existing style.");
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState("gpt-5.4-mini");
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [billingOverview, setBillingOverview] = useState<BillingOverviewResponse | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [apiKeyName, setApiKeyName] = useState("Production key");
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserResponse[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentRunResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isFileBusy, setIsFileBusy] = useState(false);
  const [isThreadBusy, setIsThreadBusy] = useState(false);
  const [isProposingChanges, setIsProposingChanges] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [isSaasLoading, setIsSaasLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const deferredEditorContent = useDeferredValue(editorContent);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects]
  );
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads]
  );
  const liveOnlyModelIds = useMemo(() => {
    const curatedIds = new Set(modelCatalog?.models.map((model) => model.id) ?? []);
    return modelCatalog?.live_model_ids.filter((modelId) => !curatedIds.has(modelId)) ?? [];
  }, [modelCatalog]);
  const selectedModelMeta = useMemo(
    () => modelCatalog?.models.find((model) => model.id === selectedModel) ?? null,
    [modelCatalog, selectedModel]
  );

  useEffect(() => {
    setThreadTitle(activeThread?.title ?? "");
  }, [activeThread?.id, activeThread?.title]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isChatting]);

  useEffect(() => {
    const storedModel = localStorage.getItem("syntrix-model");
    if (storedModel) {
      setSelectedModel(storedModel);
    }
  }, []);

  const refreshHealth = useEventCallback(async (signal: AbortSignal) => {
    setApiStatus("checking");
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/health`, { cache: "no-store", signal });
      const payload = (await response.json()) as HealthResponse;
      setApiStatus(payload.status === "ok" ? "ready" : "degraded");
      setLastHealthCheckAt(payload.timestamp);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setApiStatus("offline");
      setLastHealthCheckAt(null);
    }
  });

  const loadModelCatalog = useEventCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const catalog = await apiRequest<ModelCatalogResponse>("/ai/models", {}, token);
      setModelCatalog(catalog);
      const storedModel = localStorage.getItem("syntrix-model");
      const availableIds = new Set([
        ...catalog.models.map((model) => model.id),
        ...catalog.live_model_ids,
      ]);
      const nextModel = storedModel && availableIds.has(storedModel) ? storedModel : catalog.default_model;
      setSelectedModel(nextModel);
      localStorage.setItem("syntrix-model", nextModel);
    } catch {
      setModelCatalog(null);
    }
  });

  const loadSaasSurfaces = useEventCallback(async () => {
    if (!token) {
      return;
    }

    setIsSaasLoading(true);
    try {
      const [planList, billing, keyList] = await Promise.all([
        apiRequest<PlanResponse[]>("/billing/plans", {}, token),
        apiRequest<BillingOverviewResponse>("/billing/overview", {}, token),
        apiRequest<ApiKeyResponse[]>("/api-keys", {}, token)
      ]);
      setPlans(planList);
      setBillingOverview(billing);
      setApiKeys(keyList);

      try {
        const [overview, users] = await Promise.all([
          apiRequest<AdminOverviewResponse>("/admin/overview", {}, token),
          apiRequest<AdminUserResponse[]>("/admin/users", {}, token)
        ]);
        setAdminOverview(overview);
        setAdminUsers(users);
      } catch {
        setAdminOverview(null);
        setAdminUsers([]);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "SaaS dashboard failed to load.");
    } finally {
      setIsSaasLoading(false);
    }
  });

  const loadProjectResources = useEventCallback(async (projectId: string) => {
    if (!token) {
      return;
    }

    const [tree, previewPayload, threadList] = await Promise.all([
      apiRequest<FileNode[]>(`/projects/${projectId}/files/tree`, {}, token),
      apiRequest<PreviewResponse>(`/projects/${projectId}/preview`, {}, token),
      apiRequest<ChatThread[]>("/chat/threads", {}, token)
    ]);

    setFileTree(tree);
    setPreview(previewPayload);
    setThreads(threadList);

    const firstFile = getFirstFile(tree);
    if (firstFile) {
      const file = await apiRequest<FileContentResponse>(
        `/projects/${projectId}/files/content?path=${encodeURIComponent(firstFile)}`,
        {},
        token
      );
      setEditorState(file.path, file.content, file.language);
    }

    const firstThread = threadList.find((thread) => thread.project_id === projectId) ?? threadList[0] ?? null;
    if (firstThread) {
      setActiveThreadId(firstThread.id);
      const threadMessages = await apiRequest<ChatMessage[]>(`/chat/threads/${firstThread.id}/messages`, {}, token);
      setMessages(threadMessages);
    } else {
      setActiveThreadId(null);
      setMessages([]);
    }
    setStatusMessage(null);
  });

  const bootstrapWorkspace = useEventCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const projectList = await apiRequest<Project[]>("/projects", {}, token);
      setProjects(projectList);

      const nextProjectId = activeProjectId ?? projectList[0]?.id ?? null;
      if (nextProjectId) {
        setActiveProjectId(nextProjectId);
        await loadProjectResources(nextProjectId);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Workspace failed to load.");
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    void refreshHealth(controller.signal);
    return () => controller.abort();
  }, [refreshHealth]);

  useEffect(() => {
    void bootstrapWorkspace();
  }, [bootstrapWorkspace]);

  useEffect(() => {
    void loadModelCatalog();
  }, [loadModelCatalog]);

  useEffect(() => {
    void loadSaasSurfaces();
  }, [loadSaasSurfaces]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = new WebSocket(appConfig.wsUrl);
    socket.onopen = () => setRuntimeSocketReady(true);
    socket.onclose = () => setRuntimeSocketReady(false);
    socket.onerror = () => setRuntimeSocketReady(false);

    return () => socket.close();
  }, [setRuntimeSocketReady, token]);

  const loadFile = useEventCallback(async (path: string) => {
    if (!token || !activeProjectId) {
      return;
    }
    const file = await apiRequest<FileContentResponse>(
      `/projects/${activeProjectId}/files/content?path=${encodeURIComponent(path)}`,
      {},
      token
    );
    setEditorState(file.path, file.content, file.language);
    startTransition(() => setActiveView("editor"));
  });

  const saveFile = useEventCallback(async () => {
    if (!token || !activeProjectId || !activeFilePath) {
      return;
    }
    setIsSaving(true);
    try {
      await apiRequest<FileContentResponse>(
        `/projects/${activeProjectId}/files/write`,
        {
          method: "POST",
          body: JSON.stringify({ path: activeFilePath, content: editorContent })
        },
        token
      );
      setStatusMessage(`Saved ${activeFilePath}`);
      if (["index.html", "styles.css", "app.js"].includes(activeFilePath)) {
        const previewPayload = await apiRequest<PreviewResponse>(
          `/projects/${activeProjectId}/preview`,
          {},
          token
        );
        setPreview(previewPayload);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save file.");
    } finally {
      setIsSaving(false);
    }
  });

  const refreshFileTree = useEventCallback(async () => {
    if (!token || !activeProjectId) {
      return [];
    }

    const tree = await apiRequest<FileNode[]>(`/projects/${activeProjectId}/files/tree`, {}, token);
    setFileTree(tree);
    return tree;
  });

  const createFile = useEventCallback(async () => {
    if (!token || !activeProjectId || !newFilePath.trim()) {
      return;
    }

    setIsFileBusy(true);
    try {
      const file = await apiRequest<FileContentResponse>(
        `/projects/${activeProjectId}/files/write`,
        {
          method: "POST",
          body: JSON.stringify({ path: newFilePath.trim(), content: "" })
        },
        token
      );
      setNewFilePath("");
      await refreshFileTree();
      setEditorState(file.path, file.content, file.language);
      setStatusMessage(`Created ${file.path}`);
      startTransition(() => setActiveView("editor"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "File creation failed.");
    } finally {
      setIsFileBusy(false);
    }
  });

  const createFolder = useEventCallback(async () => {
    if (!token || !activeProjectId || !newFolderPath.trim()) {
      return;
    }

    setIsFileBusy(true);
    try {
      const tree = await apiRequest<FileNode[]>(
        `/projects/${activeProjectId}/files/directories`,
        {
          method: "POST",
          body: JSON.stringify({ path: newFolderPath.trim() })
        },
        token
      );
      setNewFolderPath("");
      setFileTree(tree);
      setStatusMessage("Folder created.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Folder creation failed.");
    } finally {
      setIsFileBusy(false);
    }
  });

  const renameActiveFile = useEventCallback(async () => {
    if (!token || !activeProjectId || !activeFilePath || !renameTargetPath.trim()) {
      return;
    }

    setIsFileBusy(true);
    try {
      const tree = await apiRequest<FileNode[]>(
        `/projects/${activeProjectId}/files/rename`,
        {
          method: "POST",
          body: JSON.stringify({ source_path: activeFilePath, target_path: renameTargetPath.trim() })
        },
        token
      );
      setFileTree(tree);
      const nextPath = renameTargetPath.trim();
      setRenameTargetPath("");
      await loadFile(nextPath);
      setStatusMessage(`Renamed to ${nextPath}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Rename failed.");
    } finally {
      setIsFileBusy(false);
    }
  });

  const deleteActiveFile = useEventCallback(async () => {
    if (!token || !activeProjectId || !activeFilePath) {
      return;
    }
    if (deleteConfirmPath.trim() !== activeFilePath) {
      setStatusMessage("Type the selected file path before deleting.");
      return;
    }

    setIsFileBusy(true);
    try {
      await apiRequest<void>(
        `/projects/${activeProjectId}/files?path=${encodeURIComponent(activeFilePath)}`,
        { method: "DELETE" },
        token
      );
      const tree = await refreshFileTree();
      const nextFile = getFirstFile(tree);
      if (nextFile) {
        await loadFile(nextFile);
      } else {
        setEditorState(null, "", "plaintext");
      }
      setDeleteConfirmPath("");
      setStatusMessage(`Deleted ${activeFilePath}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsFileBusy(false);
    }
  });

  const sendChat = useEventCallback(async () => {
    if (!token || !chatInput.trim()) {
      return;
    }
    setIsChatting(true);
    const currentMessage = chatInput.trim();
    setChatInput("");
    try {
      appendMessage({
        id: `local-user-${Date.now()}`,
        role: "user",
        content: currentMessage,
        created_at: new Date().toISOString()
      });

      const response = await fetch(`${appConfig.apiBaseUrl}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          thread_id: activeThreadId,
          model: selectedModel,
          message: currentMessage
        })
      });

      if (!response.ok || !response.body) {
        setStatusMessage("Chat stream failed.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let latestThreadId = activeThreadId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) {
            continue;
          }
          const payload = JSON.parse(line.slice(6)) as { type: string; delta?: string; threadId?: string };
          if (payload.threadId) {
            latestThreadId = payload.threadId;
            setActiveThreadId(payload.threadId);
          }
          if (payload.type === "delta" && payload.delta) {
            assistantText += payload.delta;
            updateLastAssistantMessage(assistantText, latestThreadId ?? "thread");
          }
        }
      }

      const threadList = await apiRequest<ChatThread[]>("/chat/threads", {}, token);
      setThreads(threadList);
      if (latestThreadId) {
        const threadMessages = await apiRequest<ChatMessage[]>(`/chat/threads/${latestThreadId}/messages`, {}, token);
        setMessages(threadMessages);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Chat stream failed.");
    } finally {
      setIsChatting(false);
    }
  });

  const renameThread = useEventCallback(async () => {
    if (!token || !activeThreadId || !threadTitle.trim()) {
      return;
    }

    setIsThreadBusy(true);
    try {
      const updated = await apiRequest<ChatThread>(
        `/chat/threads/${activeThreadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: threadTitle.trim() })
        },
        token
      );
      setThreads(threads.map((thread) => (thread.id === updated.id ? updated : thread)));
      setStatusMessage("Thread renamed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Thread rename failed.");
    } finally {
      setIsThreadBusy(false);
    }
  });

  const deleteThread = useEventCallback(async () => {
    if (!token || !activeThreadId) {
      return;
    }

    setIsThreadBusy(true);
    try {
      await apiRequest<void>(`/chat/threads/${activeThreadId}`, { method: "DELETE" }, token);
      const threadList = await apiRequest<ChatThread[]>("/chat/threads", {}, token);
      setThreads(threadList);
      const nextThread = threadList.find((thread) => thread.project_id === activeProjectId) ?? threadList[0] ?? null;
      setActiveThreadId(nextThread?.id ?? null);
      if (nextThread) {
        const threadMessages = await apiRequest<ChatMessage[]>(`/chat/threads/${nextThread.id}/messages`, {}, token);
        setMessages(threadMessages);
      } else {
        setMessages([]);
      }
      setStatusMessage("Thread deleted.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Thread delete failed.");
    } finally {
      setIsThreadBusy(false);
    }
  });

  const startNewChat = useEventCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setThreadTitle("");
    startTransition(() => setActiveView("chat"));
  });

  const selectThread = useEventCallback(async (threadId: string) => {
    if (!token) {
      return;
    }

    setIsThreadBusy(true);
    try {
      const threadMessages = await apiRequest<ChatMessage[]>(`/chat/threads/${threadId}/messages`, {}, token);
      setActiveThreadId(threadId);
      setMessages(threadMessages);
      startTransition(() => setActiveView("chat"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setIsThreadBusy(false);
    }
  });

  const attachFileToPrompt = useEventCallback((file: File | null) => {
    if (!file) {
      return;
    }
    setUploadedFileName(file.name);
    setChatInput((value) =>
      `${value}${value ? "\n\n" : ""}Analyze the attached file "${file.name}" and use it as context.`
    );
  });

  const startVoiceInput = useEventCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatusMessage("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setChatInput((value) => `${value}${value ? " " : ""}${transcript}`);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  });

  const speakLastAssistantMessage = useEventCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) {
      setStatusMessage("No assistant message to read.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(lastAssistant.content.slice(0, 3000)));
  });

  const exportConversation = useEventCallback(() => {
    const markdown = messages
      .map((message) => `## ${message.role.toUpperCase()}\n\n${message.content}`)
      .join("\n\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeThread?.title || "syntrix-chat"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  const shareConversation = useEventCallback(async () => {
    const summary = `${activeThread?.title || "Syntrix AI chat"}\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(summary);
      setStatusMessage("Share link copied.");
    } catch {
      setStatusMessage("Could not copy share link.");
    }
  });

  const applyPromptTemplate = useEventCallback((template: string) => {
    setChatInput(template);
    startTransition(() => setActiveView("chat"));
  });

  const runCommand = useEventCallback(async () => {
    if (!token || !activeProjectId || !commandInput.trim()) {
      return;
    }
    try {
      const result = await apiRequest<CommandResponse>(
        `/projects/${activeProjectId}/terminal/execute`,
        {
          method: "POST",
          body: JSON.stringify({ command: commandInput, timeout_seconds: 20 })
        },
        token
      );
      setTerminalResult(result);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Command failed.");
    }
  });

  const createProject = useEventCallback(async () => {
    if (!token || !newProjectName.trim()) {
      return;
    }
    try {
      const project = await apiRequest<Project>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({ name: newProjectName.trim(), description: "Created in Syntrix." })
        },
        token
      );
      setNewProjectName("");
      setProjects([project, ...projects]);
      setActiveProjectId(project.id);
      await loadProjectResources(project.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Project creation failed.");
    }
  });

  const runAgents = useEventCallback(async () => {
    if (!token || !activeProjectId) {
      return;
    }
    try {
      const result = await apiRequest<AgentRunResponse>(
        "/agents/run",
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId, objective: agentObjective, model: selectedModel, execute: false })
        },
        token
      );
      setAgentResult(result);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Agent run failed.");
    }
  });

  const proposeChanges = useEventCallback(async () => {
    if (!token || !activeProjectId || !changeObjective.trim()) {
      return;
    }

    setIsProposingChanges(true);
    try {
      const response = await apiRequest<ProposeChangesResponse>(
        `/projects/${activeProjectId}/changes/propose`,
        {
          method: "POST",
          body: JSON.stringify({
            objective: changeObjective.trim(),
            model: selectedModel,
            paths: activeFilePath ? [activeFilePath] : []
          })
        },
        token
      );
      setPendingChanges(response.changes);
      setStatusMessage(`${response.changes.length} proposed change${response.changes.length === 1 ? "" : "s"} ready.`);
      startTransition(() => setActiveView("changes"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Change proposal failed.");
    } finally {
      setIsProposingChanges(false);
    }
  });

  const updatePendingChange = (index: number, content: string) => {
    setPendingChanges(
      pendingChanges.map((change, currentIndex) =>
        currentIndex === index ? { ...change, proposed_content: content } : change
      )
    );
  };

  const removePendingChange = (index: number) => {
    setPendingChanges(pendingChanges.filter((_, currentIndex) => currentIndex !== index));
  };

  const applyChanges = useEventCallback(async () => {
    if (!token || !activeProjectId || pendingChanges.length === 0) {
      return;
    }

    setIsApplyingChanges(true);
    try {
      const response = await apiRequest<ApplyChangesResponse>(
        `/projects/${activeProjectId}/changes/apply`,
        {
          method: "POST",
          body: JSON.stringify({ changes: pendingChanges })
        },
        token
      );
      await refreshFileTree();
      const firstAppliedPath = response.applied_paths[0];
      if (firstAppliedPath) {
        await loadFile(firstAppliedPath);
      }
      const previewPayload = await apiRequest<PreviewResponse>(`/projects/${activeProjectId}/preview`, {}, token);
      setPreview(previewPayload);
      setPendingChanges([]);
      setStatusMessage(`${response.applied_paths.length} change${response.applied_paths.length === 1 ? "" : "s"} applied.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Apply changes failed.");
    } finally {
      setIsApplyingChanges(false);
    }
  });

  const storeMemory = useEventCallback(async () => {
    if (!token || !memoryInput.trim()) {
      return;
    }
    try {
      await apiRequest<MemoryItem>(
        "/memory",
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId, content: memoryInput.trim(), kind: "note" })
        },
        token
      );
      setMemoryInput("");
      setStatusMessage("Memory stored.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Memory save failed.");
    }
  });

  const searchMemory = useEventCallback(async () => {
    if (!token || !memoryQuery.trim()) {
      return;
    }
    try {
      const result = await apiRequest<MemoryItem[]>(
        `/memory/search?query=${encodeURIComponent(memoryQuery)}${activeProjectId ? `&project_id=${activeProjectId}` : ""}`,
        {},
        token
      );
      setMemories(result);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Memory search failed.");
    }
  });

  const exportDeploy = useEventCallback(async () => {
    if (!token || !activeProjectId) {
      return;
    }
    try {
      const result = await apiRequest<DeployExportResponse>(
        "/deploy/export",
        {
          method: "POST",
          body: JSON.stringify({ project_id: activeProjectId, targets: ["docker", "render", "vercel"] })
        },
        token
      );
      setDeployExport(result);
      setDeployStatus("Deployment files refreshed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Deployment export failed.");
    }
  });

  const startCheckout = useEventCallback(async (planCode: string, provider: "stripe" | "razorpay" | "internal") => {
    if (!token) {
      return;
    }
    try {
      const response = await apiRequest<CheckoutResponse>(
        "/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({ plan_code: planCode, provider })
        },
        token
      );
      setStatusMessage(response.message);
      if (response.checkout_url) {
        window.open(response.checkout_url, "_blank", "noopener,noreferrer");
      }
      await loadSaasSurfaces();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Checkout failed.");
    }
  });

  const topUpWallet = useEventCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const response = await apiRequest<BillingOverviewResponse>(
        "/billing/wallet/top-up",
        {
          method: "POST",
          body: JSON.stringify({ credits: 25000, reason: "Manual development top-up" })
        },
        token
      );
      setBillingOverview(response);
      setStatusMessage("Wallet topped up.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Wallet top-up failed.");
    }
  });

  const createApiKey = useEventCallback(async () => {
    if (!token || !apiKeyName.trim()) {
      return;
    }
    try {
      const response = await apiRequest<ApiKeyCreateResponse>(
        "/api-keys",
        {
          method: "POST",
          body: JSON.stringify({ name: apiKeyName.trim() })
        },
        token
      );
      setCreatedApiKey(response.api_key);
      setApiKeyName("Production key");
      await loadSaasSurfaces();
      setStatusMessage("API key created.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "API key creation failed.");
    }
  });

  const rotateApiKey = useEventCallback(async (apiKeyId: string) => {
    if (!token) {
      return;
    }
    try {
      const response = await apiRequest<ApiKeyCreateResponse>(
        `/api-keys/${apiKeyId}/rotate`,
        { method: "POST" },
        token
      );
      setCreatedApiKey(response.api_key);
      await loadSaasSurfaces();
      setStatusMessage("API key rotated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "API key rotation failed.");
    }
  });

  const revokeApiKey = useEventCallback(async (apiKeyId: string) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest<ApiKeyResponse>(`/api-keys/${apiKeyId}/revoke`, { method: "POST" }, token);
      await loadSaasSurfaces();
      setStatusMessage("API key revoked.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "API key revoke failed.");
    }
  });

  const updateAdminUserStatus = useEventCallback(async (userId: string, nextStatus: "active" | "suspended") => {
    if (!token) {
      return;
    }
    try {
      await apiRequest<AdminUserResponse>(
        `/admin/users/${userId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus, reason: nextStatus === "active" ? "" : "Manual admin action" })
        },
        token
      );
      await loadSaasSurfaces();
      setStatusMessage(`User ${nextStatus}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Admin action failed.");
    }
  });

  const activeViewMeta = viewLabels.find((view) => view.id === activeView);
  const healthText =
    apiStatus === "ready"
      ? "Online"
      : apiStatus === "checking"
        ? "Checking"
        : apiStatus === "degraded"
          ? "Degraded"
          : apiStatus === "offline"
            ? "Offline"
            : "Idle";
  const projectUpdatedAt = activeProject
    ? new Date(activeProject.updated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : null;
  const groupedViews = viewLabels.reduce<Record<string, typeof viewLabels>>((groups, view) => {
    groups[view.group] = [...(groups[view.group] ?? []), view];
    return groups;
  }, {});
  const currentPlanName = billingOverview?.plan.name ?? "Free";
  const walletBalance = billingOverview ? formatCredits(billingOverview.wallet_balance) : "0";
  const monthUsage = billingOverview ? formatCredits(billingOverview.month_usage_credits) : "0";
  const modelLabel = selectedModelMeta?.label ?? selectedModel;

  const changeSelectedModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("syntrix-model", modelId);
  };

  const logout = () => {
    clearSession();
    localStorage.removeItem("syntrix-token");
    localStorage.removeItem("syntrix-user");
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#050816_0%,#080b18_48%,#02040d_100%)] px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        <header className="sticky top-3 z-20 flex flex-col gap-4 rounded-lg border border-white/10 bg-slate-950/78 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-cyan-200">Syntrix AI</p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-white">
                {activeProject?.name ?? "Workspace"}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {user?.full_name || user?.email}
                {projectUpdatedAt ? ` - updated ${projectUpdatedAt}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={apiStatus === "offline" ? "danger" : apiStatus === "ready" ? "default" : "muted"}>
              API {healthText}
            </Badge>
            <Badge variant={runtimeSocketReady ? "default" : "muted"}>
              Socket {runtimeSocketReady ? "Live" : "Offline"}
            </Badge>
            <Badge variant={modelCatalog?.configured ? "default" : "muted"}>
              AI {modelCatalog?.configured ? "OpenAI" : "Local"}
            </Badge>
            <label className="sr-only" htmlFor="model-select">
              AI model
            </label>
            <select
              className="h-10 min-w-[170px] rounded-lg border border-white/12 bg-slate-950/70 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              id="model-select"
              onChange={(event) => changeSelectedModel(event.target.value)}
              value={selectedModel}
            >
              {modelCatalog?.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              )) ?? <option value={selectedModel}>{selectedModel}</option>}
              {liveOnlyModelIds.length > 0 ? (
                <optgroup label="Available from API">
                  {liveOnlyModelIds.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <a
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/12 bg-white/6 px-4 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              href="http://localhost:8000/docs"
              rel="noreferrer"
              target="_blank"
            >
              API Docs
            </a>
            <Button onClick={logout} variant="secondary">
              Sign out
            </Button>
          </div>
        </header>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[292px_minmax(0,1fr)] xl:grid-cols-[292px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
        <Card className="h-fit lg:sticky lg:top-28">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Command</CardTitle>
              <Button onClick={startNewChat} size="sm">
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <nav aria-label="Workspace tools" className="space-y-5">
              {Object.entries(groupedViews).map(([group, views]) => (
                <div key={group} className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">{group}</p>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                    {views.map((view) => (
                      <button
                        key={view.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition",
                          activeView === view.id
                            ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_10px_30px_rgba(34,211,238,0.08)]"
                            : "border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/8 hover:text-white"
                        )}
                        onClick={() => startTransition(() => setActiveView(view.id))}
                        type="button"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/6 text-[11px] text-cyan-100">
                          {view.glyph}
                        </span>
                        <span className="min-w-0 truncate">{view.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-6 space-y-2">
              <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">Chat history</p>
              {threads.length ? (
                threads.slice(0, 6).map((thread) => (
                  <button
                    key={thread.id}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                      activeThreadId === thread.id
                        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50"
                        : "border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/8"
                    )}
                    onClick={() => void selectThread(thread.id)}
                    type="button"
                  >
                    <span className="block truncate">{thread.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {new Date(thread.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">No saved chats yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              <label className="sr-only" htmlFor="project-select">
                Active project
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                id="project-select"
                onChange={(event) => {
                  const projectId = event.target.value;
                  setActiveProjectId(projectId);
                  void loadProjectResources(projectId);
                }}
                value={activeProjectId ?? ""}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createProject();
                }}
              >
                <label className="sr-only" htmlFor="new-project-name">
                  New project name
                </label>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  id="new-project-name"
                  maxLength={80}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="New project"
                  value={newProjectName}
                />
                <Button className="w-full" disabled={!newProjectName.trim()} type="submit" variant="secondary">
                  Create project
                </Button>
              </form>
              {activeProject ? (
                <p className="text-xs leading-6 text-slate-400">
                  Active project: {activeProject.name}
                  {activeProject.description ? ` - ${activeProject.description}` : ""}
                </p>
              ) : null}
          </CardContent>
        </Card>

        </aside>

        <div className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="space-y-0 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <CardTitle>{activeViewMeta?.label}</CardTitle>
                <CardDescription>{activeViewMeta?.description}</CardDescription>
              </div>
              {activeFilePath && activeView === "editor" ? (
                <Button className="mt-3 shrink-0 sm:mt-0" disabled={isSaving} onClick={saveFile}>
                  {isSaving ? "Saving..." : "Save file"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              {activeView === "dashboard" ? (
                <div className="space-y-4">
                  <Surface className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-cyan-200">Command center</p>
                        <h2 className="mt-2 text-3xl font-semibold text-white">
                          Welcome back, {user?.full_name || "builder"}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          {activeProject?.name ?? "Your workspace"} is connected to chat, files, billing, API keys,
                          and deployment assets.
                        </p>
                      </div>
                      <Button onClick={startNewChat}>Start with AI</Button>
                    </div>
                  </Surface>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricTile label="Plan" value={currentPlanName} detail={`${walletBalance} credits available`} accent="cyan" />
                    <MetricTile label="Usage" value={monthUsage} detail="credits this month" accent="violet" />
                    <MetricTile label="API keys" value={formatCredits(apiKeys.length)} detail="managed keys" accent="emerald" />
                    <MetricTile label="Revenue" value={formatMoney(adminOverview?.monthly_revenue_cents ?? 0, "USD")} detail="admin tracked MRR" accent="amber" />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Surface className="p-5">
                      <h3 className="text-lg font-semibold text-white">Launch readiness</h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {[
                          ["OpenAI connected", modelCatalog?.configured ? "Ready" : "Missing key"],
                          ["Database", apiStatus === "ready" ? "Healthy" : healthText],
                          ["WebSocket", runtimeSocketReady ? "Live" : "Idle"],
                          ["Billing", plans.length ? `${plans.length} plans` : "Loading"],
                          ["API management", `${apiKeys.length} keys`],
                          ["Admin controls", adminOverview ? "Enabled" : "Admin only"]
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                            <p className="text-sm font-medium text-white">{label}</p>
                            <p className="mt-1 text-sm text-slate-400">{value}</p>
                          </div>
                        ))}
                      </div>
                    </Surface>
                    <Surface className="p-5">
                      <h3 className="text-lg font-semibold text-white">Prompt templates</h3>
                      <div className="mt-4 space-y-2">
                        {promptTemplates.map((template) => (
                          <button
                            key={template}
                            className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left text-sm leading-6 text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                            onClick={() => applyPromptTemplate(template)}
                            type="button"
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                    </Surface>
                  </div>
                </div>
              ) : null}

              {activeView === "chat" ? (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
                  <div className="grid gap-3 border-b border-white/10 bg-white/[0.03] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                    <label className="sr-only" htmlFor="thread-title">
                      Thread title
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      disabled={!activeThreadId}
                      id="thread-title"
                      onChange={(event) => setThreadTitle(event.target.value)}
                      placeholder="Thread title"
                      value={threadTitle}
                    />
                    <Button disabled={isThreadBusy || !activeThreadId || !threadTitle.trim()} onClick={renameThread} variant="secondary">
                      Rename
                    </Button>
                    <Button disabled={isThreadBusy || !activeThreadId} onClick={deleteThread} variant="secondary">
                      Delete
                    </Button>
                    <Button disabled={messages.length === 0} onClick={exportConversation} variant="secondary">
                      Export
                    </Button>
                    <Button disabled={messages.length === 0} onClick={shareConversation} variant="secondary">
                      Share
                    </Button>
                  </div>
                  <div className="max-h-[62vh] min-h-[430px] space-y-5 overflow-y-auto p-4 md:p-6">
                    {messages.length === 0 ? (
                      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-10 text-center">
                        <LogoMark className="size-14" />
                        <h2 className="mt-5 text-2xl font-semibold text-white">How can Syntrix help today?</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          Ask for code, strategy, debugging, deployment, file analysis, or product design.
                        </p>
                        <div className="mt-6 grid w-full gap-3 md:grid-cols-2">
                          {promptTemplates.map((template) => (
                            <button
                              key={template}
                              className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left text-sm leading-6 text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                              onClick={() => applyPromptTemplate(template)}
                              type="button"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <article
                          key={`${message.id}-${message.created_at}`}
                          className={cn(
                            "mx-auto flex max-w-4xl gap-3",
                            message.role === "assistant"
                              ? "justify-start"
                              : "justify-end"
                          )}
                        >
                          {message.role === "assistant" ? <LogoMark className="mt-1 size-8" /> : null}
                          <div
                            className={cn(
                              "max-w-[860px] rounded-lg border px-4 py-3",
                              message.role === "assistant"
                                ? "border-cyan-300/16 bg-cyan-300/[0.07]"
                                : "border-white/10 bg-white/[0.07]"
                            )}
                          >
                            <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500">
                              {message.role === "assistant" ? "Syntrix AI" : "You"}
                            </p>
                            <MessageContent content={message.content} />
                          </div>
                        </article>
                      ))
                    )}
                    {isChatting ? (
                      <article className="mx-auto flex max-w-4xl gap-3">
                        <LogoMark className="mt-1 size-8" />
                        <div className="rounded-lg border border-cyan-300/16 bg-cyan-300/[0.07] px-4 py-3">
                          <TypingIndicator />
                        </div>
                      </article>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t border-white/10 bg-slate-950/70 p-3">
                    {uploadedFileName ? (
                      <div className="mb-3 inline-flex rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100">
                        File attached: {uploadedFileName}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                      <label className="sr-only" htmlFor="chat-input">
                        Message
                      </label>
                      <textarea
                        className="max-h-48 min-h-24 w-full resize-none rounded-md border border-transparent bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus-visible:border-cyan-300/30"
                        id="chat-input"
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendChat();
                          }
                        }}
                        placeholder="Message Syntrix AI..."
                        value={chatInput}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-2 pt-2">
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(event) => attachFileToPrompt(event.target.files?.[0] ?? null)}
                            type="file"
                          />
                          <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="ghost">
                            Attach
                          </Button>
                          <Button onClick={startVoiceInput} size="sm" variant={isListening ? "default" : "ghost"}>
                            {isListening ? "Listening" : "Mic"}
                          </Button>
                          <Button disabled={messages.length === 0} onClick={speakLastAssistantMessage} size="sm" variant="ghost">
                            Read
                          </Button>
                          <Button onClick={() => applyPromptTemplate(promptTemplates[0])} size="sm" variant="ghost">
                            Template
                          </Button>
                        </div>
                        <Button disabled={isChatting || !chatInput.trim()} onClick={sendChat}>
                          {isChatting ? "Sending" : "Send"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor="change-objective-from-chat">
                      Change objective
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="change-objective-from-chat"
                      onChange={(event) => setChangeObjective(event.target.value)}
                      placeholder="Generate code changes for..."
                      value={changeObjective}
                    />
                    <Button disabled={isProposingChanges || !changeObjective.trim()} onClick={proposeChanges} variant="secondary">
                      {isProposingChanges ? "Generating..." : "Propose changes"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeView === "editor" ? (
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 truncate font-medium text-white">{activeFilePath ?? "No file selected"}</p>
                    <p className="text-slate-400">{editorLanguage}</p>
                  </div>
                  <CodeEditor
                    language={editorLanguage}
                    onChange={(value) => setEditorState(activeFilePath, value, editorLanguage)}
                    value={deferredEditorContent}
                  />
                </div>
              ) : null}

              {activeView === "files" ? (
                <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                    <FileTree activePath={activeFilePath} nodes={fileTree} onSelect={(path) => void loadFile(path)} />
                  </div>
                  <div className="space-y-4 rounded-lg border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    <p className="font-medium text-white">{activeFilePath ?? "No file selected"}</p>
                    <p className="mt-2 text-slate-400">{editorLanguage}</p>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="sr-only" htmlFor="new-file-path">
                        New file path
                      </label>
                      <input
                        className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        id="new-file-path"
                        onChange={(event) => setNewFilePath(event.target.value)}
                        placeholder="src/new-file.ts"
                        value={newFilePath}
                      />
                      <Button disabled={isFileBusy || !newFilePath.trim()} onClick={createFile} variant="secondary">
                        New file
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="sr-only" htmlFor="new-folder-path">
                        New folder path
                      </label>
                      <input
                        className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        id="new-folder-path"
                        onChange={(event) => setNewFolderPath(event.target.value)}
                        placeholder="src/components"
                        value={newFolderPath}
                      />
                      <Button disabled={isFileBusy || !newFolderPath.trim()} onClick={createFolder} variant="secondary">
                        New folder
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="sr-only" htmlFor="rename-file-path">
                        Rename target
                      </label>
                      <input
                        className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        disabled={!activeFilePath}
                        id="rename-file-path"
                        onChange={(event) => setRenameTargetPath(event.target.value)}
                        placeholder={activeFilePath ? activeFilePath : "Select a file"}
                        value={renameTargetPath}
                      />
                      <Button disabled={isFileBusy || !activeFilePath || !renameTargetPath.trim()} onClick={renameActiveFile} variant="secondary">
                        Rename
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="sr-only" htmlFor="delete-file-path">
                        Delete confirmation
                      </label>
                      <input
                        className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        disabled={!activeFilePath}
                        id="delete-file-path"
                        onChange={(event) => setDeleteConfirmPath(event.target.value)}
                        placeholder={activeFilePath ? `Type ${activeFilePath}` : "Select a file"}
                        value={deleteConfirmPath}
                      />
                      <Button disabled={isFileBusy || !activeFilePath || deleteConfirmPath.trim() !== activeFilePath} onClick={deleteActiveFile} variant="secondary">
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeView === "terminal" ? (
                <div className="space-y-4">
                  <form
                    className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runCommand();
                    }}
                  >
                    <label className="sr-only" htmlFor="terminal-command">
                      Command
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="terminal-command"
                      onChange={(event) => setCommandInput(event.target.value)}
                      value={commandInput}
                    />
                    <Button disabled={!commandInput.trim()} type="submit" variant="secondary">
                      Run
                    </Button>
                  </form>
                  <div className="rounded-lg border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-200">
                    {terminalResult ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3 text-xs uppercase text-slate-400">
                          <span>Exit {terminalResult.exit_code}</span>
                          <span>{terminalResult.duration_ms} ms</span>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-cyan-100">
                          <code>{terminalResult.stdout || "(no stdout)"}</code>
                        </pre>
                        {terminalResult.stderr ? (
                          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-rose-200">
                            <code>{terminalResult.stderr}</code>
                          </pre>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-slate-400">No command output.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {activeView === "preview" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-slate-950/45 p-2">
                    <iframe
                      className="h-[520px] w-full rounded-md bg-white"
                      sandbox="allow-scripts"
                      srcDoc={preview?.html ?? "<html><body><h1>No preview available.</h1></body></html>"}
                      title="Project preview"
                    />
                  </div>
                  <p className="text-sm text-slate-400">
                    {preview?.entry_path ?? "No preview entry"}
                  </p>
                </div>
              ) : null}

              {activeView === "agents" ? (
                <div className="space-y-4">
                  <label className="sr-only" htmlFor="agent-objective">
                    Agent objective
                  </label>
                  <textarea
                    className="min-h-28 w-full rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                    id="agent-objective"
                    onChange={(event) => setAgentObjective(event.target.value)}
                    value={agentObjective}
                  />
                  <Button disabled={!agentObjective.trim()} onClick={runAgents}>Run agent loop</Button>
                  {agentResult ? (
                    <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-sm font-medium text-white">{agentResult.summary}</p>
                      {agentResult.plan.map((step) => (
                        <div key={`${step.agent}-${step.task}`} className="rounded-lg border border-white/8 bg-white/4 p-3">
                          <p className="text-sm font-medium text-white">{step.agent}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{step.task}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeView === "changes" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor="change-objective">
                      Change objective
                    </label>
                    <textarea
                      className="min-h-24 rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="change-objective"
                      onChange={(event) => setChangeObjective(event.target.value)}
                      value={changeObjective}
                    />
                    <Button className="h-full min-h-12" disabled={isProposingChanges || !changeObjective.trim()} onClick={proposeChanges}>
                      {isProposingChanges ? "Generating..." : "Generate"}
                    </Button>
                  </div>

                  {pendingChanges.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      <Button disabled={isApplyingChanges} onClick={applyChanges}>
                        {isApplyingChanges ? "Applying..." : "Apply changes"}
                      </Button>
                      <Button onClick={() => setPendingChanges([])} variant="secondary">
                        Clear
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {pendingChanges.length === 0 ? (
                      <p className="text-sm text-slate-400">No pending changes.</p>
                    ) : (
                      pendingChanges.map((change, index) => (
                        <article key={`${change.path}-${index}`} className="space-y-3 rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{change.path}</p>
                              <p className="mt-1 text-xs uppercase text-cyan-200">{change.action}</p>
                            </div>
                            <Button onClick={() => removePendingChange(index)} variant="secondary">
                              Remove
                            </Button>
                          </div>
                          <p className="text-sm leading-6 text-slate-300">{change.summary}</p>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Current</p>
                              <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                                <code>{change.original_content || "(new file)"}</code>
                              </pre>
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor={`proposed-change-${index}`}>
                                Proposed
                              </label>
                              <textarea
                                className="min-h-72 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                                id={`proposed-change-${index}`}
                                onChange={(event) => updatePendingChange(index, event.target.value)}
                                value={change.proposed_content}
                              />
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {activeView === "memory" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor="memory-input">
                      Memory
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="memory-input"
                      onChange={(event) => setMemoryInput(event.target.value)}
                      placeholder="Project note"
                      value={memoryInput}
                    />
                    <Button disabled={!memoryInput.trim()} onClick={storeMemory}>Store</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor="memory-search">
                      Search memory
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="memory-search"
                      onChange={(event) => setMemoryQuery(event.target.value)}
                      placeholder="Search"
                      value={memoryQuery}
                    />
                    <Button disabled={!memoryQuery.trim()} onClick={searchMemory} variant="secondary">
                      Search
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {memories.map((memory) => (
                      <div key={memory.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                        <p className="text-sm font-medium text-white">{memory.kind}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{memory.content}</p>
                        <p className="mt-2 text-xs text-cyan-200">
                          Score: {memory.score?.toFixed(3) ?? "n/a"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeView === "deploy" ? (
                <div className="space-y-4">
                  <Button onClick={exportDeploy}>Export assets</Button>
                  {deployStatus ? <p className="text-sm text-cyan-200">{deployStatus}</p> : null}
                  <div className="space-y-3">
                    {deployExport?.files?.length ? (
                      deployExport.files.map((file) => (
                        <div key={file.path} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <p className="text-sm font-medium text-white">{file.path}</p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">
                            <code>{file.content}</code>
                          </pre>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No deploy assets exported.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {activeView === "billing" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-xs uppercase text-slate-400">Plan</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {billingOverview?.plan.name ?? "Loading"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{billingOverview?.subscription.status ?? "pending"}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-xs uppercase text-slate-400">Wallet</p>
                      <p className="mt-2 text-2xl font-semibold text-cyan-100">
                        {billingOverview ? formatCredits(billingOverview.wallet_balance) : "0"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">available credits</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-xs uppercase text-slate-400">Usage</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {billingOverview ? formatCredits(billingOverview.month_usage_credits) : "0"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">credits this month</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-xs uppercase text-slate-400">Events</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {billingOverview ? formatCredits(billingOverview.month_usage_events) : "0"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">tracked requests</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void loadSaasSurfaces()} variant="secondary">
                      Refresh
                    </Button>
                    <Button onClick={topUpWallet} variant="secondary">
                      Dev top-up
                    </Button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    {isSaasLoading && plans.length === 0 ? (
                      <>
                        <SkeletonLine className="h-44" />
                        <SkeletonLine className="h-44" />
                        <SkeletonLine className="h-44" />
                      </>
                    ) : (
                      plans.map((plan) => (
                        <article key={plan.code} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-white">{plan.name}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-400">{plan.description}</p>
                            </div>
                            <Badge variant={billingOverview?.plan.code === plan.code ? "default" : "muted"}>
                              {billingOverview?.plan.code === plan.code ? "Current" : plan.code}
                            </Badge>
                          </div>
                          <p className="mt-4 text-2xl font-semibold text-cyan-100">
                            {plan.price_cents === 0 ? "Free" : `${formatMoney(plan.price_cents, plan.currency)}/mo`}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {formatCredits(plan.monthly_credits)} monthly credits
                          </p>
                          <ul className="mt-4 space-y-2 text-sm text-slate-300">
                            {plan.features.map((feature) => (
                              <li key={feature}>{feature}</li>
                            ))}
                          </ul>
                          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                            <Button onClick={() => void startCheckout(plan.code, "stripe")} variant="secondary">
                              Stripe
                            </Button>
                            <Button onClick={() => void startCheckout(plan.code, "razorpay")} variant="secondary">
                              Razorpay
                            </Button>
                            <Button onClick={() => void startCheckout(plan.code, "internal")} variant="secondary">
                              Activate
                            </Button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="font-medium text-white">Recent usage</p>
                      <div className="mt-3 space-y-2">
                        {billingOverview?.recent_usage.length ? (
                          billingOverview.recent_usage.map((event) => (
                            <div key={event.id} className="rounded-lg border border-white/8 bg-white/4 p-3 text-sm">
                              <p className="text-white">{event.feature} - {event.model}</p>
                              <p className="mt-1 text-slate-400">{event.credits} credits - {event.status}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">No tracked usage yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="font-medium text-white">Wallet ledger</p>
                      <div className="mt-3 space-y-2">
                        {billingOverview?.recent_transactions.length ? (
                          billingOverview.recent_transactions.map((transaction) => (
                            <div key={transaction.id} className="rounded-lg border border-white/8 bg-white/4 p-3 text-sm">
                              <p className="text-white">{transaction.reason}</p>
                              <p className="mt-1 text-slate-400">
                                {transaction.credits > 0 ? "+" : ""}{transaction.credits} credits - balance {transaction.balance_after}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">No wallet activity yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                      <p className="font-medium text-white">Invoices</p>
                      <div className="mt-3 space-y-2">
                        {billingOverview?.recent_invoices.length ? (
                          billingOverview.recent_invoices.map((invoice) => (
                            <div key={invoice.id} className="rounded-lg border border-white/8 bg-white/4 p-3 text-sm">
                              <p className="text-white">
                                {formatMoney(invoice.amount_cents, invoice.currency)} - {invoice.status}
                              </p>
                              <p className="mt-1 text-slate-400">{invoice.provider}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">No invoices yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeView === "apiKeys" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor="api-key-name">
                      API key name
                    </label>
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      id="api-key-name"
                      onChange={(event) => setApiKeyName(event.target.value)}
                      placeholder="Production key"
                      value={apiKeyName}
                    />
                    <Button disabled={!apiKeyName.trim()} onClick={createApiKey}>
                      Create key
                    </Button>
                  </div>

                  {createdApiKey ? (
                    <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-4">
                      <p className="text-sm font-medium text-cyan-100">New API key</p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-cyan-100">
                        <code>{createdApiKey}</code>
                      </pre>
                      <Button className="mt-3" onClick={() => setCreatedApiKey(null)} variant="secondary">
                        Hide
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {apiKeys.length === 0 ? (
                      <p className="text-sm text-slate-400">No API keys yet.</p>
                    ) : (
                      apiKeys.map((apiKey) => (
                        <article key={apiKey.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-medium text-white">{apiKey.name}</p>
                              <p className="mt-1 text-sm text-slate-400">
                                {apiKey.key_prefix}... - {apiKey.status} - {apiKey.rate_limit_per_minute}/min
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => void rotateApiKey(apiKey.id)} variant="secondary">
                                Rotate
                              </Button>
                              <Button disabled={apiKey.status !== "active"} onClick={() => void revokeApiKey(apiKey.id)} variant="secondary">
                                Revoke
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {activeView === "marketplace" ? (
                <div className="space-y-4">
                  <Surface className="p-5">
                    <h2 className="text-xl font-semibold text-white">AI tools marketplace</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Launch prebuilt workflows for code review, UI polish, image prompts, deployment, and analytics.
                    </p>
                  </Surface>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Code reviewer", "Find bugs, missing tests, and security risks.", promptTemplates[0]],
                      ["UI polish", "Upgrade a selected surface into a premium experience.", promptTemplates[1]],
                      ["Image prompt lab", "Create production-ready image generation prompts.", "Create a detailed image generation prompt for a premium Syntrix AI landing visual."],
                      ["Voice assistant", "Prepare voice-first answers and scripts.", "Turn this conversation into a spoken assistant script."],
                      ["Deployment copilot", "Generate Render, Vercel, and Docker release steps.", "Create a deployment checklist for this project."],
                      ["Analytics analyst", "Explain usage, revenue, and retention signals.", "Analyze the current billing and usage dashboard."]
                    ].map(([title, detail, template]) => (
                      <button
                        key={title}
                        className="rounded-lg border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                        onClick={() => applyPromptTemplate(template)}
                        type="button"
                      >
                        <p className="font-semibold text-white">{title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeView === "admin" ? (
                <div className="space-y-4">
                  {adminOverview ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Users", adminOverview.users],
                        ["Active", adminOverview.active_users],
                        ["Usage credits", adminOverview.monthly_usage_credits],
                        ["Errors 24h", adminOverview.errors_24h]
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <p className="text-xs uppercase text-slate-400">{label}</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{formatCredits(Number(value))}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">
                      Admin dashboard is available to configured admin users.
                    </div>
                  )}

                  {adminUsers.length > 0 ? (
                    <div className="space-y-3">
                      {adminUsers.map((adminUser) => (
                        <article key={adminUser.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{adminUser.email}</p>
                              <p className="mt-1 text-sm text-slate-400">
                                {adminUser.status} - {adminUser.role} - {adminUser.plan_code} - {formatCredits(adminUser.wallet_balance)} credits
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => void updateAdminUserStatus(adminUser.id, "active")} variant="secondary">
                                Activate
                              </Button>
                              <Button onClick={() => void updateAdminUserStatus(adminUser.id, "suspended")} variant="secondary">
                                Suspend
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeView === "settings" ? (
                <div className="space-y-4">
                  <Surface className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-white">Account settings</h2>
                        <p className="mt-2 text-sm text-slate-400">{user?.email}</p>
                      </div>
                      <Button onClick={logout} variant="secondary">Sign out</Button>
                    </div>
                  </Surface>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Surface className="p-5">
                      <h3 className="font-semibold text-white">Profile</h3>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <p>Name: {user?.full_name || "Not set"}</p>
                        <p>Email: {user?.email}</p>
                        <p>User ID: {user?.id}</p>
                      </div>
                    </Surface>
                    <Surface className="p-5">
                      <h3 className="font-semibold text-white">Security and providers</h3>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <p>JWT session: active</p>
                        <p>OpenAI: {modelCatalog?.configured ? "configured" : "not configured"}</p>
                        <p>Default model: {modelLabel}</p>
                        <p>Environment: Docker local</p>
                      </div>
                    </Surface>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2 xl:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent>
              <FileTree activePath={activeFilePath} nodes={fileTree} onSelect={(path) => void loadFile(path)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>Project: {activeProject?.name ?? "None"}</p>
              <p>Thread: {activeThreadId ?? "None"}</p>
              <p>File: {activeFilePath ?? "None"}</p>
              <p>Model: {selectedModelMeta?.label ?? selectedModel}</p>
              <p>Preview: {preview?.status ?? "Unavailable"}</p>
              <p>Last check: {lastHealthCheckAt ? new Date(lastHealthCheckAt).toLocaleTimeString() : "Pending"}</p>
              {statusMessage ? <p className="text-cyan-200">{statusMessage}</p> : null}
            </CardContent>
          </Card>
        </div>
        </section>
      </div>
    </main>
  );
}
