import { create } from "zustand";

import type {
  ApiHealthState,
  ChatMessage,
  ChatThread,
  CommandResponse,
  DeployExportResponse,
  FileChange,
  FileNode,
  MemoryItem,
  PreviewResponse,
  Project,
  SessionUser,
  WorkspaceView
} from "@/types/workspace";

type WorkspaceState = {
  activeView: WorkspaceView;
  apiStatus: ApiHealthState;
  lastHealthCheckAt: string | null;
  token: string | null;
  user: SessionUser | null;
  projects: Project[];
  activeProjectId: string | null;
  fileTree: FileNode[];
  activeFilePath: string | null;
  editorContent: string;
  editorLanguage: string;
  threads: ChatThread[];
  activeThreadId: string | null;
  messages: ChatMessage[];
  terminalResult: CommandResponse | null;
  preview: PreviewResponse | null;
  memories: MemoryItem[];
  deployExport: DeployExportResponse | null;
  pendingChanges: FileChange[];
  runtimeSocketReady: boolean;
  setActiveView: (view: WorkspaceView) => void;
  setApiStatus: (status: ApiHealthState) => void;
  setLastHealthCheckAt: (timestamp: string | null) => void;
  setSession: (token: string, user: SessionUser) => void;
  clearSession: () => void;
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (projectId: string | null) => void;
  setFileTree: (fileTree: FileNode[]) => void;
  setEditorState: (path: string | null, content: string, language: string) => void;
  setThreads: (threads: ChatThread[]) => void;
  setActiveThreadId: (threadId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, threadId: string) => void;
  setTerminalResult: (result: CommandResponse | null) => void;
  setPreview: (preview: PreviewResponse | null) => void;
  setMemories: (memories: MemoryItem[]) => void;
  setDeployExport: (deployExport: DeployExportResponse | null) => void;
  setPendingChanges: (changes: FileChange[]) => void;
  setRuntimeSocketReady: (ready: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeView: "chat",
  apiStatus: "idle",
  lastHealthCheckAt: null,
  token: null,
  user: null,
  projects: [],
  activeProjectId: null,
  fileTree: [],
  activeFilePath: null,
  editorContent: "",
  editorLanguage: "plaintext",
  threads: [],
  activeThreadId: null,
  messages: [],
  terminalResult: null,
  preview: null,
  memories: [],
  deployExport: null,
  pendingChanges: [],
  runtimeSocketReady: false,
  setActiveView: (view) => set({ activeView: view }),
  setApiStatus: (status) => set({ apiStatus: status }),
  setLastHealthCheckAt: (timestamp) => set({ lastHealthCheckAt: timestamp }),
  setSession: (token, user) => set({ token, user }),
  clearSession: () =>
    set({
      token: null,
      user: null,
      projects: [],
      activeProjectId: null,
      fileTree: [],
      activeFilePath: null,
      editorContent: "",
      editorLanguage: "plaintext",
      threads: [],
      activeThreadId: null,
      messages: [],
      terminalResult: null,
      preview: null,
      memories: [],
      deployExport: null,
      pendingChanges: [],
      runtimeSocketReady: false
    }),
  setProjects: (projects) => set({ projects }),
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
  setFileTree: (fileTree) => set({ fileTree }),
  setEditorState: (path, content, language) =>
    set({ activeFilePath: path, editorContent: content, editorLanguage: language }),
  setThreads: (threads) => set({ threads }),
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),
  updateLastAssistantMessage: (content, threadId) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        lastMessage.content = content;
      } else {
        messages.push({
          id: `local-${threadId}`,
          role: "assistant",
          content,
          created_at: new Date().toISOString()
        });
      }
      return { messages };
    }),
  setTerminalResult: (result) => set({ terminalResult: result }),
  setPreview: (preview) => set({ preview }),
  setMemories: (memories) => set({ memories }),
  setDeployExport: (deployExport) => set({ deployExport }),
  setPendingChanges: (changes) => set({ pendingChanges: changes }),
  setRuntimeSocketReady: (ready) => set({ runtimeSocketReady: ready })
}));
