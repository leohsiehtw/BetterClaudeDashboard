# ClaudeCode_Dashboard

[English](#english) · [繁體中文](#繁體中文)

## English

<p align="center"><img src="docs/screenshot.png" alt="ClaudeCode_Dashboard" width="280"></p>

A resource monitor for Claude Code on desktop. It lives in a side pane and shows live usage, context, permissions and subagents without leaving the app. It only observes events: no model calls, zero tokens, and it never blocks or rewrites tool calls.

### Features

- **Plan limits**: 5-hour and 7-day usage bars with reset countdowns.
- **Session**: model, permission mode, effort, turn count, cost, uptime, context bar, auto-compact threshold and the largest context categories.
- **Turn**: live turn timer, tool calls, edits, errors, last turn duration, session totals.
- **Permissions**: allow / ask / deny counts, file / shell / other split, top tools.
- **Subagents**: one card each with name, description, status, elapsed time, output tokens and model.
- **Session log**: the last 12 events (tools, permissions, turns, subagents).
- **Animated mascot**: a pixel-style critter that sleeps and looks around when idle, and while Claude works rotates through typing on a laptop, pacing, hopping and reading. A spinner marks the running turn and live subagents. Drawn as SVG on desktop, text fallback elsewhere.
- **Reopenable**: the `Usage ▸` button above the prompt brings the pane back after closing it.
- Works in light and dark mode, text wraps in a narrow pane.

### Install

Plugin name: `claudecode-dashboard`.

```
claude plugin marketplace add <path-or-repo>
claude plugin install claudecode-dashboard@local-mods --scope user
```

Then run `/reload-plugins`. Desktop surface is the target; other surfaces get the text fallback.

### Limits

Not exposed by the API, so not shown: per-subagent context size, the classifier's real verdict, a request count (turn count is used instead). "Pending" counts asked calls that have not finished, including the tool's own run time.

## 繁體中文

<p align="center"><img src="docs/screenshot.png" alt="ClaudeCode_Dashboard" width="280"></p>

Claude Code 桌面版的資源監視器。放在側邊面板，不離開 app 就能即時看用量、context、權限和 subagent。只觀察事件：不呼叫模型、不耗 token，也不阻擋或改寫工具呼叫。

### 功能

- **方案用量**：5 小時與 7 天用量條，附重置倒數。
- **Session**：模型、權限模式、effort、回合數、費用、運行時間、context 條、自動壓縮門檻、佔用最多的 context 類別。
- **Turn**：本回合即時計時、工具呼叫數、編輯數、錯誤數、上一回合耗時、整個 session 累計。
- **Permissions**：允許 / 詢問 / 拒絕次數、檔案 / shell / 其他分類、前幾名工具。
- **Subagents**：每個一張卡，顯示名稱、說明、狀態、經過時間、輸出 token 與模型。
- **Session log**：最近 12 筆事件（工具、權限、回合、subagent）。
- **會動的吉祥物**：像素風小生物，閒置時睡覺、東張西望，Claude 工作時輪流表演用筆電打字、踱步、跳躍、看書。進行中的回合和 subagent 前有轉動的 spinner。桌面版用 SVG 繪製，其他環境退回文字版。
- **可重開**：關掉面板後，用輸入框上方的 `Usage ▸` 按鈕重新打開。
- 淺色與深色模式都可讀，窄面板文字會自動換行。

### 安裝

外掛名稱：`claudecode-dashboard`。

```
claude plugin marketplace add <路徑或 repo>
claude plugin install claudecode-dashboard@local-mods --scope user
```

之後執行 `/reload-plugins`。以桌面版為主，其他環境使用文字版吉祥物。

### 限制

API 拿不到所以不顯示：每個 subagent 的 context 大小、分類器的真正判定、請求數（以回合數代替）。「等待」是判為詢問但尚未結束的呼叫數，包含工具本身執行的時間。
