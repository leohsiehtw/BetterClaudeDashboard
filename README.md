# usage-dashboard

Claude Code desktop mod: a live side pane (reopen via the `Usage ▸` button above the prompt) showing plan limits (5h/7d), context, turn stats, permission verdicts, subagents and a session log. Observe-only, no model calls, zero tokens.

Install:

```
claude plugin marketplace add <path-or-repo>
claude plugin install usage-dashboard@local-mods --scope user
```

Then `/reload-plugins`. Desktop surface only; some counters (classifier verdicts, per-subagent context) are not exposed by the API.
