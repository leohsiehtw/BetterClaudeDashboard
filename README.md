# ClaudeCode_Dashboard

[English](#english) · [繁體中文](#繁體中文)

## English

A Claude Code desktop mod: a live side pane showing plan limits (5h / 7d with reset times), context window and auto-compact threshold, turn stats, permission verdicts, subagents (status, elapsed time, output tokens) and a session log. Reopen it any time with the `Usage ▸` button above the prompt.

It only observes events: no model calls, zero tokens, never blocks or rewrites tool calls.

Install (plugin name: `claudecode-dashboard`):

```
claude plugin marketplace add <path-or-repo>
claude plugin install claudecode-dashboard@local-mods --scope user
```

Then run `/reload-plugins`. Desktop surface only.

Not available from the API, so not shown: per-subagent context size, the classifier's real verdict, a request count (turn count is used instead).

## 繁體中文

Claude Code 桌面版外掛：側邊即時面板，顯示方案用量（5 小時 / 7 天與重置時間）、context 視窗與自動壓縮門檻、回合統計、權限判定、subagent（狀態、經過時間、輸出 token）與 session 事件紀錄。隨時可用輸入框上方的 `Usage ▸` 按鈕重新打開。

只觀察事件：不呼叫模型、不耗 token、不阻擋也不改寫工具呼叫。

安裝（外掛名稱：`claudecode-dashboard`）：

```
claude plugin marketplace add <路徑或 repo>
claude plugin install claudecode-dashboard@local-mods --scope user
```

之後執行 `/reload-plugins`。僅支援桌面版。

API 拿不到所以不顯示：每個 subagent 的 context 大小、分類器的真正判定、請求數（以回合數代替）。
