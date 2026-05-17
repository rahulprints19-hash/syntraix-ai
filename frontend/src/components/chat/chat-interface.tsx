"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Download, Mic, Paperclip, RefreshCcw, Send, Share2, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aiModels } from "@/lib/ai";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionClient;
    webkitSpeechRecognition?: new () => SpeechRecognitionClient;
  }
}

type SpeechRecognitionClient = {
  continuous?: boolean;
  interimResults?: boolean;
  lang: string;
  onend?: (() => void) | null;
  onerror?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventClient) => void) | null;
  start: () => void;
};

type SpeechRecognitionEventClient = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type Role = "assistant" | "user";

type ChatMessage = {
  content: string;
  id: string;
  role: Role;
};

type ChatSummary = {
  id: string;
  title: string;
  updated_at: string;
};

const suggestions = [
  "Summarize the latest product idea and turn it into a launch plan.",
  "Write a React component with accessible keyboard interactions.",
  "Compare subscription plans and suggest a pricing strategy.",
  "Debug this error and explain the fix step by step."
];

function MarkdownMessage({ content }: { content: string }) {
  const components = useMemo<Components>(
    () => ({
      code({ children, className }) {
        const code = String(children).replace(/\n$/, "");
        const isInline = !className;
        if (isInline) {
          return <code className="rounded bg-white/10 px-1 py-0.5 text-cyan-100">{children}</code>;
        }
        return (
          <div className="group relative my-4 overflow-hidden rounded-lg border border-white/10 bg-slate-950/80">
            <button
              className="absolute right-2 top-2 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs text-slate-200 opacity-0 transition group-hover:opacity-100"
              onClick={() => void navigator.clipboard.writeText(code)}
              type="button"
            >
              Copy
            </button>
            <pre className="overflow-auto p-4 text-sm leading-6">
              <code className={className}>{children}</code>
            </pre>
          </div>
        );
      }
    }),
    []
  );

  return (
    <ReactMarkdown components={components} rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
}

export function ChatInterface({ initialPlan = "free" }: { initialPlan?: string }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(aiModels[0].id);
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileContext, setFileContext] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetch("/api/chats")
      .then((response) => response.json())
      .then((payload) => setChats(payload.chats ?? []))
      .catch(() => setChats([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const visibleChats = chats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));

  async function loadChat(nextChatId: string) {
    const response = await fetch(`/api/chats/${nextChatId}/messages`);
    const payload = await response.json();
    setChatId(nextChatId);
    setMessages(payload.messages ?? []);
  }

  function newChat() {
    setChatId(null);
    setMessages([]);
    setInput("");
  }

  async function sendMessage(nextInput = input) {
    const clean = nextInput.trim();
    if (!clean || isStreaming) return;

    const userMessage: ChatMessage = { content: clean, id: crypto.randomUUID(), role: "user" };
    const assistantMessage: ChatMessage = { content: "", id: crypto.randomUUID(), role: "assistant" };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          chatId,
          fileContext,
          messages: [...messages, userMessage].map(({ content, role }) => ({ content, role })),
          model
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: abortRef.current.signal
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "AI response failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let nextChatId = chatId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        if (chunk.startsWith("[[CHAT_ID:")) {
          const closing = chunk.indexOf("]]");
          nextChatId = chunk.slice(10, closing);
          setChatId(nextChatId);
          assistantText += chunk.slice(closing + 2);
        } else {
          assistantText += chunk;
        }
        setMessages((current) => current.map((item) => (item.id === assistantMessage.id ? { ...item, content: assistantText } : item)));
      }

      if (nextChatId) {
        void fetch("/api/chats")
          .then((response) => response.json())
          .then((payload) => setChats(payload.chats ?? []));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: error instanceof Error ? error.message : "Something went wrong." }
            : item
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  async function attachFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setFileContext(`File: ${file.name}\n\n${text.slice(0, 12000)}`);
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.onresult = (event: SpeechRecognitionEventClient) => {
      setInput(event.results[0][0].transcript);
    };
    recognition.start();
  }

  function speakLast() {
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    if (!last) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(last.content));
  }

  function exportChat() {
    const blob = new Blob([messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n")], {
      type: "text/markdown"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "syntrix-chat.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function shareChat() {
    const text = messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
    if (navigator.share) {
      await navigator.share({ text, title: "Syntrix AI chat" });
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <Button className="w-full" onClick={newChat}>New chat</Button>
        <input
          className="mt-4 h-10 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats"
          value={search}
        />
        <div className="mt-4 space-y-2">
          {visibleChats.map((chat) => (
            <button
              key={chat.id}
              className={cn("w-full rounded-lg px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/10", chat.id === chatId && "bg-cyan-300/10 text-cyan-100")}
              onClick={() => void loadChat(chat.id)}
              type="button"
            >
              {chat.title}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[calc(100vh-2rem)] flex-col rounded-lg border border-white/10 bg-slate-950/50">
        <header className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Current plan: {initialPlan.toUpperCase()}</p>
            <h1 className="text-xl font-semibold text-white">Syntrix AI Chat</h1>
          </div>
          <select
            className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white"
            onChange={(event) => setModel(event.target.value)}
            value={model}
          >
            {aiModels.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="mx-auto mt-16 max-w-3xl text-center">
              <h2 className="text-3xl font-semibold text-white">What should Syntrix solve?</h2>
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left text-sm leading-6 text-slate-300 hover:border-cyan-300/40"
                    onClick={() => void sendMessage(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-3xl rounded-lg p-4 text-sm leading-7", message.role === "user" ? "bg-cyan-300 text-slate-950" : "bg-white/[0.05] text-slate-200")}>
                  {message.content ? <MarkdownMessage content={message.content} /> : <span className="animate-pulse text-slate-400">Syntrix is thinking...</span>}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 p-4">
          {fileContext ? <p className="mb-2 text-xs text-cyan-200">File attached as context</p> : null}
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <Textarea
              className="min-h-20 border-0 bg-transparent focus:ring-0"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Message Syntrix AI..."
              value={input}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 px-3 text-slate-200 hover:bg-white/10">
                  <Paperclip className="size-4" />
                  <input className="hidden" onChange={(event) => void attachFile(event.target.files?.[0])} type="file" />
                </label>
                <Button onClick={startVoice} variant="secondary"><Mic className="size-4" /></Button>
                <Button disabled={!messages.length} onClick={speakLast} variant="secondary"><Volume2 className="size-4" /></Button>
                <Button disabled={!messages.length} onClick={exportChat} variant="secondary"><Download className="size-4" /></Button>
                <Button disabled={!messages.length} onClick={() => void shareChat()} variant="secondary"><Share2 className="size-4" /></Button>
                <Button disabled={!messages.length || isStreaming} onClick={() => void sendMessage(messages[messages.length - 2]?.content ?? input)} variant="secondary">
                  <RefreshCcw className="size-4" />
                </Button>
              </div>
              {isStreaming ? (
                <Button onClick={stopGenerating} variant="secondary"><Square className="mr-2 size-4" />Stop</Button>
              ) : (
                <Button disabled={!input.trim()} onClick={() => void sendMessage()}><Send className="mr-2 size-4" />Send</Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
