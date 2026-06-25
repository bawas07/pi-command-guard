import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// ─── Config ──────────────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "rm -rf",          label: "recursive force delete" },
  { pattern: "rm -fr",          label: "recursive force delete" },
  { pattern: "DROP TABLE",      label: "SQL table drop" },
  { pattern: "DROP DATABASE",   label: "SQL database drop" },
  { pattern: "TRUNCATE TABLE",  label: "SQL table truncate" },
  { pattern: "git push --force",label: "force push (rewrites history)" },
  { pattern: "git push -f",     label: "force push (rewrites history)" },
  { pattern: "chmod -R 777",    label: "recursive world-write permissions" },
  { pattern: "chmod 777",       label: "world-write permissions" },
  { pattern: "> /dev/sda",      label: "disk overwrite" },
  { pattern: "dd if=",          label: "raw disk operation" },
  { pattern: "mkfs",            label: "filesystem format" },
  { pattern: ":(){:|:&};:",     label: "fork bomb" },
  { pattern: "shutdown",        label: "system shutdown" },
  { pattern: "reboot",          label: "system reboot" },
  { pattern: "kill -9 1",       label: "kill init process" },
  { pattern: "sudo ",           label: "superuser execution" },
];

const PROTECTED_GLOBS: { pattern: RegExp; label: string }[] = [
  { pattern: /\.env($|\.|\/)/i,           label: ".env file" },
  { pattern: /\.env\.(local|prod|production|staging)/i, label: "environment config" },
  { pattern: /secrets?\.(json|yaml|yml|toml)/i,         label: "secrets file" },
  { pattern: /\.(pem|key|p12|pfx|crt|cer)$/i,           label: "certificate/key file" },
  { pattern: /id_rsa|id_ed25519|id_ecdsa/i,             label: "SSH private key" },
  { pattern: /\.kubeconfig/i,             label: "kubeconfig file" },
  { pattern: /credentials(\.json|\.yaml|\.toml)?$/i,    label: "credentials file" },
  { pattern: /node_modules\//,            label: "node_modules (use npm instead)" },
  { pattern: /\.git\/objects\//,          label: "git object store" },
];

const THINKING_ICONS: Record<string, string> = {
  off:     "○",
  minimal: "◔",
  low:     "◑",
  medium:  "◕",
  high:    "●",
  xhigh:   "⬤",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchDangerous(command: string): { pattern: string; label: string } | null {
  const upper = command.toUpperCase();
  for (const d of DANGEROUS_PATTERNS) {
    if (upper.includes(d.pattern.toUpperCase())) return d;
  }
  return null;
}

function matchProtected(path: string): { pattern: RegExp; label: string } | null {
  for (const p of PROTECTED_GLOBS) {
    if (p.pattern.test(path)) return p;
  }
  return null;
}

function shortModel(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

  // ── 1. Bash dangerous command guard ────────────────────────────────────────
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command ?? "";
    const hit = matchDangerous(command);

    if (hit) {
      const ok = await ctx.ui.confirm(
        `⚠️  Dangerous command detected`,
        `Pattern: ${hit.pattern}\nRisk: ${hit.label}\n\nAllow execution?`,
        { timeout: 30000 }
      );
      if (!ok) {
        return {
          block: true,
          reason: `Blocked by command-guard: "${hit.pattern}" (${hit.label})`,
        };
      }
    }
  });

  // ── 2. Protected file write/edit guard ─────────────────────────────────────
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("write", event) && !isToolCallEventType("edit", event)) return;

    const path: string =
      (event.input as { path?: string }).path ?? "";

    const hit = matchProtected(path);

    if (hit) {
      const op = event.toolName === "write" ? "write to" : "edit";
      const ok = await ctx.ui.confirm(
        `🔒  Protected file`,
        `Attempting to ${op}: ${path}\nProtection: ${hit.label}\n\nAllow?`,
        { timeout: 30000 }
      );
      if (!ok) {
        return {
          block: true,
          reason: `Blocked by command-guard: protected file "${path}" (${hit.label})`,
        };
      }
    }
  });

  // ── 3. Thinking level footer indicator ─────────────────────────────────────
  pi.on("thinking_level_select", async (event, ctx) => {
    const icon = THINKING_ICONS[event.level] ?? "?";
    ctx.ui.setStatus("thinking", `${icon} ${event.level}`);
  });

  // ── 4. Model switch footer indicator ───────────────────────────────────────
  pi.on("model_select", async (event, ctx) => {
    const name = shortModel(event.model.id);
    ctx.ui.setStatus("model", `⬡ ${name}`);

    if (event.previousModel) {
      const prev = shortModel(event.previousModel.id);
      ctx.ui.notify(`Model: ${prev} → ${name}`, "info");
    }
  });

  // ── 5. Initialise footer on session start ──────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    const level = pi.getThinkingLevel();
    const icon  = THINKING_ICONS[level] ?? "?";
    ctx.ui.setStatus("thinking", `${icon} ${level}`);

    // model status will be set once model_select fires;
    // set a placeholder for the first session
    ctx.ui.setStatus("model", "⬡ loading...");
  });

  // ── 6. /guard-status command ───────────────────────────────────────────────
  pi.registerCommand("guard-status", {
    description: "Show command-guard config: protected patterns and dangerous commands",
    handler: async (_args, ctx) => {
      const dangerList = DANGEROUS_PATTERNS
        .map((d) => `  • ${d.pattern}  (${d.label})`)
        .join("\n");
      const protectList = PROTECTED_GLOBS
        .map((p) => `  • ${p.pattern.source}  (${p.label})`)
        .join("\n");

      ctx.ui.notify(
        `command-guard active\n\nDangerous bash patterns:\n${dangerList}\n\nProtected file patterns:\n${protectList}`,
        "info"
      );
    },
  });

 // ── 7. Theme toggle shortcut ───────────────────────────────────────────────
  pi.registerShortcut("ctrl+shift+l", {
    description: "Toggle moonfang dark/light theme",
    handler: async (ctx) => {
      const themes = ctx.ui.getAllThemes();
      const current = themes.find(t => ["moonfang", "moonfang-light"].includes(t.name) &&
        t.name === (ctx.ui.getAllThemes().find(x => x.name === "moonfang") ? "moonfang" : "moonfang-light"));
      const next = current?.name === "moonfang" ? "moonfang-light" : "moonfang";
      ctx.ui.setTheme(next);
      ctx.ui.notify(`Theme: ${next}`, "info");
    },
  });
}
