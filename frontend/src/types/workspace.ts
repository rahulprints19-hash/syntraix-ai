export type WorkspaceView =
  | "dashboard"
  | "chat"
  | "editor"
  | "files"
  | "terminal"
  | "preview"
  | "agents"
  | "changes"
  | "memory"
  | "deploy"
  | "billing"
  | "apiKeys"
  | "marketplace"
  | "admin"
  | "settings";

export type ApiHealthState = "idle" | "checking" | "ready" | "degraded" | "offline";

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  services: Record<
    string,
    {
      status: string;
      detail: string;
    }
  >;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  category: string;
  recommended: boolean;
}

export interface ModelCatalogResponse {
  configured: boolean;
  default_model: string;
  models: ModelOption[];
  live_model_ids: string[];
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: SessionUser;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  root_path: string;
  created_at: string;
  updated_at: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children: FileNode[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  language: string;
}

export interface ChatThread {
  id: string;
  title: string;
  project_id: string | null;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface CommandResponse {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export interface PreviewResponse {
  entry_path: string;
  html: string;
  status: string;
}

export interface AgentStep {
  agent: string;
  task: string;
  status: string;
}

export interface AgentRunResponse {
  id: string;
  project_id: string;
  objective: string;
  model: string;
  status: string;
  created_at: string;
  updated_at: string;
  plan: AgentStep[];
  summary: string;
}

export interface MemoryItem {
  id: string;
  kind: string;
  content: string;
  created_at: string;
  score?: number | null;
}

export interface DeployFile {
  path: string;
  content: string;
}

export interface DeployExportResponse {
  targets: string[];
  files: DeployFile[];
}

export interface FileChange {
  path: string;
  action: "create" | "update";
  summary: string;
  original_content?: string | null;
  proposed_content: string;
}

export interface ProposeChangesResponse {
  objective: string;
  model: string;
  changes: FileChange[];
}

export interface ApplyChangesResponse {
  applied_paths: string[];
}

export interface PlanResponse {
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  monthly_credits: number;
  api_rate_limit_per_minute: number;
  features: string[];
  is_active: boolean;
}

export interface SubscriptionResponse {
  id: string;
  plan_code: string;
  status: string;
  provider: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface WalletTransactionResponse {
  id: string;
  kind: string;
  credits: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

export interface UsageEventResponse {
  id: string;
  feature: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  credits: number;
  status: string;
  created_at: string;
}

export interface InvoiceResponse {
  id: string;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  invoice_url: string;
  created_at: string;
}

export interface BillingOverviewResponse {
  plan: PlanResponse;
  subscription: SubscriptionResponse;
  wallet_balance: number;
  month_usage_credits: number;
  month_usage_events: number;
  recent_transactions: WalletTransactionResponse[];
  recent_usage: UsageEventResponse[];
  recent_invoices: InvoiceResponse[];
}

export interface CheckoutResponse {
  provider: string;
  status: string;
  checkout_url: string;
  message: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  status: string;
  rate_limit_per_minute: number;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeyCreateResponse {
  api_key: string;
  record: ApiKeyResponse;
}

export interface AdminOverviewResponse {
  users: number;
  active_users: number;
  suspended_users: number;
  monthly_revenue_cents: number;
  monthly_usage_credits: number;
  active_subscriptions: number;
  api_keys: number;
  errors_24h: number;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  plan_code: string;
  wallet_balance: number;
  created_at: string;
}
