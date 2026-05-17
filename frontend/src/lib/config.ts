export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Syntrix AI",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/api/v1/chat/ws"
};
