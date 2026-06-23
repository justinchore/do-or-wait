#!/usr/bin/env node
/**
 * One-shot installer: registers the "do-or-wait" MCP connector with the
 * Claude desktop app by merging an entry into claude_desktop_config.json.
 *
 *   node install.mjs
 *
 * Safe to re-run. It preserves any other servers already in the config and
 * backs the file up to claude_desktop_config.json.bak before writing.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appData =
  process.env.APPDATA ||
  join(process.env.HOME || process.env.USERPROFILE || "", "AppData", "Roaming");
const configDir = join(appData, "Claude");
const configPath = join(configDir, "claude_desktop_config.json");
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "server.js");

if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

let config = {};
if (existsSync(configPath)) {
  copyFileSync(configPath, configPath + ".bak");
  const raw = readFileSync(configPath, "utf8").trim();
  if (raw) {
    try {
      config = JSON.parse(raw);
    } catch (e) {
      console.error("\n✗ Your existing claude_desktop_config.json isn't valid JSON:");
      console.error("  " + e.message);
      console.error(
        "  A backup is at " + configPath + ".bak — fix or delete the file, then rerun.\n"
      );
      process.exit(1);
    }
  }
}

if (!config.mcpServers || typeof config.mcpServers !== "object") {
  config.mcpServers = {};
}
const existed = Object.prototype.hasOwnProperty.call(config.mcpServers, "do-or-wait");
config.mcpServers["do-or-wait"] = { command: "node", args: [serverPath] };

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

console.log("\n✓ " + (existed ? "Updated" : "Added") + " 'do-or-wait' in:");
console.log("  " + configPath);
if (existsSync(configPath + ".bak"))
  console.log("  (previous version backed up as claude_desktop_config.json.bak)");
console.log("  server: " + serverPath);
console.log(
  "\nOther servers in your config (if any) were left untouched." +
    "\nNow fully QUIT and reopen the Claude desktop app to load it.\n"
);
