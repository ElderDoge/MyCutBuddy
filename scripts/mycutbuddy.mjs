#!/usr/bin/env node

// packages/mycutbuddy-cli/src/core/args.ts
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

// packages/mycutbuddy-cli/src/core/errors.ts
var EXIT_STATUS = {
  success: 0,
  internal: 1,
  local_input: 2,
  business_rejection: 3,
  authentication: 4,
  transient: 5
}, CliError = class extends Error {
  constructor(kind, code, message, options = {}) {
    super(message), this.name = "CliError", this.kind = kind, this.code = code, this.details = options.details, this.retryable = options.retryable ?? kind === "transient";
  }
};
function localInputError(code, message, details) {
  return new CliError("local_input", code, message, { details });
}
function businessRejection(code, message, details) {
  return new CliError("business_rejection", code, message, { details, retryable: !1 });
}
function authenticationError(code, message, details) {
  return new CliError("authentication", code, message, { details, retryable: !1 });
}
function transientError(code, message, details) {
  return new CliError("transient", code, message, { details, retryable: !0 });
}
function isCliError(error) {
  return error instanceof CliError;
}
function toCliError(error) {
  if (isCliError(error))
    return error;
  let message = error instanceof Error ? error.message : String(error);
  return new CliError("internal", "internal_error", `\u547D\u4EE4\u6267\u884C\u5931\u8D25\uFF1A${message}`);
}

// packages/mycutbuddy-cli/src/core/enums.ts
var MATERIAL_LIBRARY_TYPES = ["primary", "talking_head", "voiceover"], EDITING_FORMS = ["narration", "talking_head_segment", "talking_head_full"], PRESET_TYPES = ["dialogue_subtitle_style", "global_subtitle_style"], CREDIT_TRANSACTION_TYPES = [
  "purchase",
  "consumption",
  "refund",
  "bonus",
  "adjustment"
], NARRATION_AUDIO_SOURCES = ["tts", "upload"], MATERIAL_SHOT_MODES = ["single", "multi", "mixed"], MATERIAL_IMPORT_DIRECTORY_CONTRACT_VERSION = "material-import-directory.v1", TASK_PAGE_SIZES = [20, 30, 50], DEFAULT_TASK_PAGE_SIZE = 20, MAX_BATCH_ROWS = 200;
function isMaterialLibraryType(value) {
  return typeof value == "string" && MATERIAL_LIBRARY_TYPES.includes(value);
}

// packages/mycutbuddy-cli/src/core/args.ts
var COMMON_OPTIONS = {
  site: { type: "string" },
  format: { type: "string" },
  pretty: { type: "boolean" },
  timeout: { type: "string" },
  help: { type: "boolean" },
  version: { type: "boolean" }
}, DEFAULT_TIMEOUT_MS = 2e4, MAXIMUM_TIMEOUT_SECONDS = 600;
function mergeOptions(command) {
  return { ...COMMON_OPTIONS, ...command };
}
function parseCommandLine(argv, options) {
  try {
    let parsed = parseArgs({
      args: [...argv],
      options: mergeOptions(options),
      allowPositionals: !0,
      strict: !0
    });
    return { values: parsed.values, positionals: parsed.positionals };
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    throw localInputError("invalid_arguments", `\u547D\u4EE4\u884C\u53C2\u6570\u65E0\u6548\uFF1A${message}`);
  }
}
function optionString(values, name) {
  let value = values[name];
  if (value !== void 0) {
    if (typeof value != "string")
      throw localInputError("invalid_arguments", `\u53C2\u6570 --${name} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u3002`);
    return value;
  }
}
function optionStrings(values, name) {
  let value = values[name];
  return value === void 0 ? [] : (Array.isArray(value) ? value : [value]).map((entry) => {
    if (typeof entry != "string" || entry.trim().length === 0)
      throw localInputError("invalid_arguments", `\u53C2\u6570 --${name} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u3002`);
    return entry.trim();
  });
}
function requiredStringOption(values, name, hint) {
  let value = optionString(values, name);
  if (value === void 0 || value.trim().length === 0)
    throw localInputError("missing_argument", `\u7F3A\u5C11\u5FC5\u586B\u53C2\u6570 --${name}\uFF1A${hint}`);
  return value.trim();
}
function optionFlag(values, name) {
  return values[name] === !0;
}
function optionEnum(values, name, allowed) {
  let raw = optionString(values, name);
  if (raw !== void 0) {
    if (!allowed.includes(raw))
      throw localInputError(
        "invalid_arguments",
        `\u53C2\u6570 --${name} \u53EA\u652F\u6301\uFF1A${allowed.join("\u3001")}\u3002`
      );
    return raw;
  }
}
function requiredEnumOption(values, name, allowed, hint) {
  let value = optionEnum(values, name, allowed);
  if (value === void 0)
    throw localInputError(
      "missing_argument",
      `\u7F3A\u5C11\u5FC5\u586B\u53C2\u6570 --${name}\uFF1A${hint}\uFF08\u53EF\u9009\u503C\uFF1A${allowed.join("\u3001")}\uFF09`
    );
  return value;
}
function optionInteger(values, name, options) {
  let raw = optionString(values, name);
  if (raw === void 0)
    return options.fallback;
  if (!/^[0-9]{1,9}$/.test(raw.trim()))
    throw localInputError("invalid_arguments", `\u53C2\u6570 --${name} \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570\u3002`);
  let parsed = Number.parseInt(raw.trim(), 10);
  if (parsed < options.minimum || parsed > options.maximum)
    throw localInputError(
      "invalid_arguments",
      `\u53C2\u6570 --${name} \u5FC5\u987B\u5728 ${options.minimum} \u5230 ${options.maximum} \u4E4B\u95F4\u3002`
    );
  return parsed;
}
function optionPageSize(values) {
  let value = optionInteger(values, "page-size", {
    fallback: DEFAULT_TASK_PAGE_SIZE,
    minimum: 1,
    maximum: 50
  });
  if (!TASK_PAGE_SIZES.includes(value))
    throw localInputError(
      "invalid_arguments",
      `\u53C2\u6570 --page-size \u53EA\u652F\u6301\uFF1A${TASK_PAGE_SIZES.join("\u3001")}\u3002`
    );
  return value;
}
function optionTimeoutMs(values) {
  let seconds = optionInteger(values, "timeout", { fallback: 0, minimum: 1, maximum: MAXIMUM_TIMEOUT_SECONDS });
  return seconds === 0 ? DEFAULT_TIMEOUT_MS : seconds * 1e3;
}
function optionFormat(values) {
  let raw = optionString(values, "format");
  if (raw === void 0 || raw === "json")
    return "json";
  if (raw === "human")
    return "human";
  throw localInputError("invalid_arguments", "\u53C2\u6570 --format \u53EA\u652F\u6301 json \u6216 human\u3002");
}
function readJsonText(text, source) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw localInputError("invalid_payload", `${source} \u4E0D\u662F\u5408\u6CD5 JSON\u3002`);
  }
  if (parsed === null || typeof parsed != "object" || Array.isArray(parsed))
    throw localInputError("invalid_payload", `${source} \u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002`);
  return parsed;
}
function readPayload(values, options) {
  let inline = optionString(values, "input"), file = optionString(values, "input-file");
  if (inline !== void 0 && file !== void 0)
    throw localInputError("invalid_arguments", "\u4E0D\u80FD\u540C\u65F6\u4F7F\u7528 --input \u4E0E --input-file\u3002");
  if (inline === void 0 && file === void 0) {
    if (!options.required)
      return {};
    throw localInputError("missing_argument", `\u7F3A\u5C11\u4E1A\u52A1\u8F93\u5165\uFF1A\u8BF7\u7528 --input \u6216 --input-file \u63D0\u4F9B${options.hint}\u3002`);
  }
  if (inline !== void 0)
    return readJsonText(inline, "--input");
  let path = file.trim(), text;
  try {
    text = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    throw localInputError("invalid_payload", `\u65E0\u6CD5\u8BFB\u53D6 --input-file\uFF1A${message}`);
  }
  return readJsonText(text, `--input-file ${path}`);
}

// packages/mycutbuddy-cli/src/core/credentials.ts
import { chmodSync, mkdirSync, readFileSync as readFileSync2, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// libs/auth/agent-authorization-config.ts
var AGENT_AUTHORIZATION_CLIENT_ID = "mycutbuddy-agent", AGENT_AUTHORIZATION_SCOPE = "mycutbuddy:user", AGENT_AUTHORIZATION_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code", AGENT_AUTHORIZATION_TOKEN_PREFIX = "mcb_";
var AGENT_AUTHORIZATION_USER_CODE_LENGTH = 8, AGENT_AUTHORIZATION_USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var DEVICE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/, USER_CODE_BODY_PATTERN = new RegExp(`^[${AGENT_AUTHORIZATION_USER_CODE_ALPHABET}]{${AGENT_AUTHORIZATION_USER_CODE_LENGTH}}$`), ACCESS_TOKEN_PATTERN = new RegExp(`^${AGENT_AUTHORIZATION_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);
function isAgentAccessTokenShape(value) {
  return ACCESS_TOKEN_PATTERN.test(value);
}
function isAgentDeviceCodeShape(value) {
  return DEVICE_CODE_PATTERN.test(value);
}

// packages/mycutbuddy-cli/src/core/credentials.ts
var STORE_VERSION = 1, STORE_DIRECTORY_MODE = 448, STORE_FILE_MODE = 384, FORBIDDEN_PERMISSION_BITS = 63;
function emptyStore() {
  return { version: STORE_VERSION, sites: {} };
}
function permissionsOf(path) {
  return statSync(path).mode & 511;
}
var CredentialStore = class {
  constructor(home) {
    this.home = home;
  }
  /** `MYCUTBUDDY_CLI_HOME` overrides the default `~/.mycutbuddy` location. */
  static defaultHome(env) {
    let override = env.MYCUTBUDDY_CLI_HOME;
    return typeof override == "string" && override.trim().length > 0 ? override.trim() : join(homedir(), ".mycutbuddy");
  }
  get filePath() {
    return join(this.home, "credentials.json");
  }
  read(site) {
    let credential = this.load().sites[site];
    return credential === void 0 ? null : (assertUsableCredential(credential, site), credential);
  }
  list() {
    return Object.values(this.load().sites).sort((left, right) => left.site.localeCompare(right.site));
  }
  save(credential) {
    let store = this.load();
    store.sites[credential.site] = credential, this.write(store);
  }
  /** Removes the site entry. Returns whether an entry existed; never touches another site. */
  remove(site) {
    let store = this.load();
    return store.sites[site] === void 0 ? !1 : (delete store.sites[site], this.write(store), !0);
  }
  load() {
    let raw;
    try {
      raw = readFileSync2(this.filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT")
        return emptyStore();
      throw localInputError("credential_store_unreadable", `\u672C\u673A\u51ED\u636E\u6587\u4EF6\u65E0\u6CD5\u8BFB\u53D6\uFF1A${this.filePath}`);
    }
    if (process.platform !== "win32" && permissionsOf(this.filePath) & FORBIDDEN_PERMISSION_BITS)
      throw localInputError(
        "credential_store_insecure",
        `\u672C\u673A\u51ED\u636E\u6587\u4EF6\u6743\u9650\u4E0D\u5B89\u5168\uFF08\u9700\u8981\u4EC5\u672C\u4EBA\u53EF\u8BFB\u5199\uFF09\uFF1A${this.filePath}\u3002\u8BF7\u5220\u9664\u8BE5\u6587\u4EF6\u540E\u91CD\u65B0\u6388\u6743\u3002`
      );
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw localInputError("credential_store_invalid", `\u672C\u673A\u51ED\u636E\u6587\u4EF6\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${this.filePath}`);
    }
    if (parsed === null || typeof parsed != "object" || Array.isArray(parsed))
      throw localInputError("credential_store_invalid", `\u672C\u673A\u51ED\u636E\u6587\u4EF6\u5185\u5BB9\u65E0\u6548\uFF1A${this.filePath}`);
    let store = parsed;
    if (store.version !== STORE_VERSION || store.sites === null || typeof store.sites != "object")
      throw localInputError("credential_store_invalid", `\u672C\u673A\u51ED\u636E\u6587\u4EF6\u7248\u672C\u4E0D\u53D7\u652F\u6301\uFF1A${this.filePath}`);
    return store;
  }
  /**
   * Atomic owner-only write: the temporary file is created with `0600` next to the target and
   * renamed over it, so a reader never observes a partially written store.
   */
  write(store) {
    mkdirSync(dirname(this.filePath), { recursive: !0, mode: STORE_DIRECTORY_MODE });
    let temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}
`, { mode: STORE_FILE_MODE }), chmodSync(temporaryPath, STORE_FILE_MODE), renameSync(temporaryPath, this.filePath);
    } catch (error) {
      throw rmSync(temporaryPath, { force: !0 }), error;
    }
  }
};
function assertUsableCredential(credential, site) {
  if (!(credential.site === site && typeof credential.access_token == "string" && isAgentAccessTokenShape(credential.access_token) && typeof credential.credential_id == "string" && typeof credential.expires_at == "string"))
    throw localInputError(
      "credential_store_invalid",
      `\u7AD9\u70B9 ${site} \u7684\u672C\u673A\u51ED\u636E\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u6267\u884C\u6388\u6743\u547D\u4EE4\u3002`
    );
}

// packages/mycutbuddy-cli/src/core/redaction.ts
var ACCESS_TOKEN_PATTERN2 = new RegExp(`${AGENT_AUTHORIZATION_TOKEN_PREFIX}[A-Za-z0-9_-]{8,}`, "g"), AUTHORIZATION_HEADER_PATTERN = /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, REDACTED = "[\u5DF2\u9690\u85CF]";
function redactText(text) {
  return text.replace(ACCESS_TOKEN_PATTERN2, REDACTED).replace(AUTHORIZATION_HEADER_PATTERN, REDACTED);
}
function sanitizeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return redactText(raw);
  }
  return url.username = "", url.password = "", url.search = "", url.hash = "", url.toString();
}
function sanitizeValue(value) {
  if (typeof value == "string")
    return redactText(value);
  if (Array.isArray(value))
    return value.map(sanitizeValue);
  if (value instanceof Date)
    return value.toISOString();
  if (value !== null && typeof value == "object") {
    let result = {};
    for (let [key, item] of Object.entries(value))
      result[key] = sanitizeValue(item);
    return result;
  }
  return value;
}
function redactSecrets(value) {
  return sanitizeValue(value);
}

// packages/mycutbuddy-cli/src/core/routes.ts
var SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/, PROJECT = "/api/projects/{projectId}", REQUEST = `${PROJECT}/billing-submissions/{requestId}`, SINGLE_TRACK = `${PROJECT}/single-track`, STYLE_IMPORT = `${PROJECT}/subtitle-style-imports/{importId}`, UPLOAD = "/api/materials/{projectId}/uploads", UPLOAD_SESSION = `${UPLOAD}/{uploadId}`, CLI_ROUTES = {
  "project.list": { method: "GET", path: "/api/projects" },
  "project.create": { method: "POST", path: "/api/projects" },
  "project.get": { method: "GET", path: PROJECT },
  "project.rename": { method: "PATCH", path: PROJECT },
  "project.delete": { method: "DELETE", path: PROJECT },
  "material.directory": { method: "GET", path: "/api/materials/{projectId}/management" },
  "material.manage": { method: "POST", path: "/api/materials/{projectId}/management" },
  "material.import-failure.dismiss": { method: "POST", path: "/api/materials/{projectId}/import-failure/dismiss" },
  // Direct upload client surface. `page_id` is the client session token of one run, not a browser
  // page; the node status report and the tus authorization callback are never CLI routes.
  "material.upload.preview": { method: "POST", path: `${UPLOAD}/preview` },
  "material.upload.admit": { method: "POST", path: UPLOAD },
  "material.upload.get": { method: "GET", path: UPLOAD_SESSION },
  "material.upload.heartbeat": { method: "POST", path: `${UPLOAD_SESSION}/heartbeat` },
  "material.upload.complete": { method: "POST", path: `${UPLOAD_SESSION}/complete` },
  "material.upload.terminate": { method: "POST", path: `${UPLOAD_SESSION}/terminate` },
  "preset.style.list": { method: "GET", path: `${SINGLE_TRACK}/presets` },
  "preset.style.create": { method: "POST", path: `${SINGLE_TRACK}/presets` },
  "preset.style.get": { method: "GET", path: `${SINGLE_TRACK}/presets/{presetId}` },
  "preset.style.update": { method: "PATCH", path: `${SINGLE_TRACK}/presets/{presetId}` },
  "preset.style.archive": { method: "DELETE", path: `${SINGLE_TRACK}/presets/{presetId}` },
  "preset.style.import.list": { method: "GET", path: `${PROJECT}/subtitle-style-imports` },
  "preset.style.import.submit": { method: "POST", path: `${PROJECT}/subtitle-style-imports` },
  "preset.style.import.get": { method: "GET", path: STYLE_IMPORT },
  "preset.style.import.delete": { method: "DELETE", path: STYLE_IMPORT },
  "preset.style.import.select-draft": { method: "POST", path: `${STYLE_IMPORT}/select-draft` },
  "preset.style.import.save-items": { method: "POST", path: `${STYLE_IMPORT}/items` },
  "preset.subtitle.list": { method: "GET", path: `${PROJECT}/subtitle-presets` },
  "preset.subtitle.update": { method: "PATCH", path: `${PROJECT}/subtitle-presets/{presetId}` },
  "preset.subtitle.archive": { method: "DELETE", path: `${PROJECT}/subtitle-presets/{presetId}` },
  "editing.context": { method: "GET", path: SINGLE_TRACK },
  "editing.estimate": { method: "POST", path: `${PROJECT}/talking-head-estimate` },
  "editing.submit": { method: "POST", path: `${PROJECT}/billing-submissions` },
  "material.import.submit": { method: "POST", path: `${PROJECT}/billing-submissions` },
  "material.index.submit": { method: "POST", path: `${PROJECT}/billing-submissions` },
  "request.get": { method: "GET", path: REQUEST },
  "request.watch": { method: "GET", path: REQUEST },
  "request.cancel": { method: "POST", path: `${REQUEST}/cancel` },
  "request.recreate": { method: "GET", path: `${REQUEST}/recreate` },
  "editing.quote.get": { method: "GET", path: `${SINGLE_TRACK}/quotes/{quoteId}` },
  "task.list": { method: "GET", path: `${SINGLE_TRACK}/tasks` },
  "task.get": { method: "GET", path: `${SINGLE_TRACK}/tasks/{taskId}` },
  "task.watch": { method: "GET", path: `${SINGLE_TRACK}/tasks/{taskId}` },
  "task.cancel": { method: "DELETE", path: `${SINGLE_TRACK}/tasks/{taskId}` },
  "task.delete": { method: "DELETE", path: `${SINGLE_TRACK}/tasks/{taskId}` },
  "task.recreate": { method: "GET", path: `${SINGLE_TRACK}/tasks/{taskId}/recreate` },
  "delivery.info": { method: "GET", path: "/api/draft-delivery" },
  "credits.status": { method: "GET", path: "/api/credits/status" },
  "credits.transactions": { method: "GET", path: "/api/credits/transactions" }
};
function routeMethod(routeId) {
  return CLI_ROUTES[routeId].method;
}
function buildRoutePath(routeId, params = {}) {
  let template = CLI_ROUTES[routeId].path, used = /* @__PURE__ */ new Set(), path = template.replace(/\{([A-Za-z]+)\}/g, (_match, name) => {
    let value = params[name];
    if (value === void 0)
      throw localInputError("missing_parameter", `\u547D\u4EE4 ${routeId} \u9700\u8981\u53C2\u6570 ${name}\u3002`);
    if (!SEGMENT_PATTERN.test(value))
      throw localInputError(
        "invalid_identifier",
        `\u6807\u8BC6\u7B26\u65E0\u6548\uFF1A${name} \u53EA\u5141\u8BB8\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26\uFF08\u6700\u591A 128 \u4E2A\u5B57\u7B26\uFF09\u3002`
      );
    return used.add(name), value;
  }), unused = Object.keys(params).filter((name) => !used.has(name));
  if (unused.length > 0)
    throw localInputError("unexpected_parameter", `\u547D\u4EE4 ${routeId} \u4E0D\u63A5\u53D7\u53C2\u6570\uFF1A${unused.join(", ")}`);
  return path;
}

// packages/mycutbuddy-cli/src/core/http.ts
var AUTHENTICATION_FAILURE_CODES = {
  authentication_required: !0,
  invalid_credential: !0,
  credential_expired: !0,
  credential_revoked: !0,
  agent_route_forbidden: !0,
  ambiguous_credentials: !0
};
function parseJsonBody(text) {
  if (text.length === 0)
    return { parsed: !0, value: null };
  try {
    return { parsed: !0, value: JSON.parse(text) };
  } catch {
    return { parsed: !1 };
  }
}
function readRetryAfterSeconds(response) {
  let raw = response.headers.get("retry-after");
  if (raw === null)
    return;
  let seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : void 0;
}
function serviceHint(route, status, message) {
  if (status === 404 && route.startsWith("project."))
    return "\u9879\u76EE\u4E0D\u5B58\u5728\uFF0C\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7\uFF1B\u8BF7\u5148\u7528 project.list \u6838\u5BF9\u9879\u76EE ID\u3002";
  if (message !== null && message.includes("library_type"))
    return "\u7D20\u6750\u5E93\u7C7B\u578B\u53EA\u652F\u6301 primary\u3001talking_head \u6216 voiceover\u3002";
  if (message !== null && message.includes("\u6BCF\u9875\u6761\u6570"))
    return "\u6BCF\u9875\u6761\u6570\u53EA\u652F\u6301 20\u300130 \u6216 50\u3002";
  if (message !== null && message.includes("\u8BA1\u8D39\u63D0\u793A\u5DF2\u66F4\u65B0"))
    return "\u91CD\u65B0\u8BFB\u53D6\u5F53\u524D\u8BA1\u8D39\u63D0\u793A\u7248\u672C\u540E\u518D\u63D0\u4EA4\uFF1BCLI \u7701\u7565 --notice-version \u65F6\u4F1A\u81EA\u52A8\u8BFB\u53D6\u3002";
}
var ServiceClient = class {
  constructor(options) {
    this.options = options;
  }
  async request(spec) {
    let path = buildRoutePath(spec.route, spec.params), method = routeMethod(spec.route), url = new URL(path, this.options.site);
    for (let [key, value] of Object.entries(spec.query ?? {}))
      value != null && url.searchParams.set(key, String(value));
    let response;
    try {
      response = await this.options.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          accept: "application/json",
          ...spec.body === void 0 ? {} : { "content-type": "application/json" }
        },
        ...spec.body === void 0 ? {} : { body: JSON.stringify(spec.body) },
        // A redirect is never followed: it would move the credential to another origin, and an
        // HTML sign-in page must never be reported as a business result.
        redirect: "manual",
        signal: AbortSignal.timeout(this.options.timeoutMs)
      });
    } catch (error) {
      let name = error instanceof Error ? error.name : "Error", timeoutSeconds = Math.round(this.options.timeoutMs / 1e3);
      throw name === "TimeoutError" ? transientError("timeout", `\u8BF7\u6C42\u8D85\u65F6\uFF08${timeoutSeconds} \u79D2\uFF09\uFF1A${method} ${path}`, {
        route: spec.route
      }) : transientError("network_error", `\u8FDE\u63A5\u7AD9\u70B9\u5931\u8D25\uFF0C\u4E1A\u52A1\u52A8\u4F5C\u672A\u88AB\u786E\u8BA4\u6210\u529F\uFF1A${method} ${path}`, {
        route: spec.route,
        reason: name
      });
    }
    let text = await response.text(), json = parseJsonBody(text), body = json.parsed ? json.value : null, serviceObject = body !== null && typeof body == "object" && !Array.isArray(body) ? body : null, serviceCode = typeof serviceObject?.code == "string" ? serviceObject.code : null, serviceMessage = typeof serviceObject?.error == "string" ? serviceObject.error : typeof serviceObject?.message == "string" ? serviceObject.message : null, retryAfterSeconds = readRetryAfterSeconds(response), hint = serviceHint(spec.route, response.status, serviceMessage), details = {
      status: response.status,
      route: spec.route,
      ...hint === void 0 ? {} : { hint },
      ...retryAfterSeconds === void 0 ? {} : { retry_after_seconds: retryAfterSeconds },
      ...serviceObject === null ? {} : { service: serviceObject },
      ...json.parsed ? {} : { service_body: "non_json", content_type: response.headers.get("content-type") ?? "" }
    };
    if (response.status >= 200 && response.status < 300) {
      if (!json.parsed)
        throw transientError("malformed_response", `${method} ${path} \u8FD4\u56DE\u4E86\u975E JSON \u54CD\u5E94\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u4E1A\u52A1\u7ED3\u679C\u3002`, details);
      return { status: response.status, body };
    }
    if (response.status >= 300 && response.status < 400) {
      let location = response.headers.get("location");
      throw transientError("unexpected_redirect", `${method} ${path} \u8FD4\u56DE\u91CD\u5B9A\u5411\uFF08HTTP ${response.status}\uFF09\uFF0CCLI \u4E0D\u8DDF\u968F\u91CD\u5B9A\u5411\u3002`, {
        ...details,
        ...location === null ? {} : { location: sanitizeUrl(location) }
      });
    }
    let businessMessage = serviceMessage ?? `\u7AD9\u70B9\u62D2\u7EDD\u4E86\u8BE5\u8BF7\u6C42\uFF08HTTP ${response.status}\uFF09\uFF1A${method} ${path}`;
    throw serviceCode !== null && AUTHENTICATION_FAILURE_CODES[serviceCode] === !0 ? authenticationError(serviceCode, serviceMessage ?? `\u51ED\u636E\u65E0\u6CD5\u8C03\u7528\u8BE5\u63A5\u53E3\uFF08HTTP ${response.status}\uFF09\uFF1A${method} ${path}`, details) : response.status === 401 ? authenticationError("authentication_required", serviceMessage ?? "\u7AD9\u70B9\u8981\u6C42\u6709\u6548\u7684 MyCutBuddy \u51ED\u636E\u3002", details) : response.status === 403 ? businessRejection(serviceCode ?? "forbidden", businessMessage, details) : response.status === 404 || response.status === 410 ? serviceCode !== null ? businessRejection(serviceCode, businessMessage, details) : serviceObject !== null ? businessRejection(response.status === 404 ? "not_found" : "not_available", businessMessage, details) : businessRejection(
      "capability_unavailable",
      `\u7AD9\u70B9\u672A\u63D0\u4F9B\u8BE5\u80FD\u529B\uFF08HTTP ${response.status}\uFF09\uFF1A${method} ${path}\u3002`,
      details
    ) : response.status === 429 ? transientError("rate_limited", businessMessage, details) : response.status >= 500 ? transientError(serviceCode ?? "server_error", businessMessage, details) : businessRejection(serviceCode ?? "request_rejected", businessMessage, details);
  }
};

// packages/mycutbuddy-cli/src/core/output.ts
function successEnvelope(command, data, warnings = []) {
  return { ok: !0, command, data: redactSecrets(data), warnings: [...warnings] };
}
function failureEnvelope(command, error, warnings = []) {
  return {
    ok: !1,
    command,
    error: {
      kind: error.kind,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...error.details === void 0 ? {} : { details: redactSecrets(error.details) }
    },
    warnings: [...warnings]
  };
}
function serializeEnvelope(envelope, options = {}) {
  return options.pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}
function humanSuccessText(command, data) {
  let line = `\u547D\u4EE4 ${command} \u5B8C\u6210`;
  return data == null ? `${line}
` : `${line}
${JSON.stringify(data, null, 2)}
`;
}
function humanFailureText(command, error) {
  let line = `\u547D\u4EE4 ${command ?? "(\u672A\u77E5)"} \u5931\u8D25 [${error.code}] ${error.message}`;
  return error.details === void 0 ? `${line}
` : `${line}
${JSON.stringify(error.details, null, 2)}
`;
}

// packages/mycutbuddy-cli/src/core/site.ts
var DEFAULT_SITE = "https://www.jiandazi.com", LOOPBACK_HOSTNAMES = { "127.0.0.1": !0, localhost: !0, "[::1]": !0 };
function normalizeSite(raw = DEFAULT_SITE) {
  let value = raw.trim();
  if (value.length === 0)
    throw localInputError("missing_site", "\u7F3A\u5C11\u7AD9\u70B9\u5730\u5740\uFF1A\u8BF7\u7528 --site \u6216\u73AF\u5883\u53D8\u91CF MYCUTBUDDY_SITE \u6307\u5B9A\u7AD9\u70B9\u3002");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw localInputError("invalid_site", `\u7AD9\u70B9\u5730\u5740\u65E0\u6548\uFF1A${value}`);
  }
  if (url.username.length > 0 || url.password.length > 0)
    throw localInputError("invalid_site", "\u7AD9\u70B9\u5730\u5740\u4E0D\u5F97\u5305\u542B\u7528\u6237\u540D\u6216\u5BC6\u7801\u3002");
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw localInputError("invalid_site", `\u7AD9\u70B9\u5730\u5740\u53EA\u652F\u6301 https\uFF08\u672C\u673A\u56DE\u73AF\u5730\u5740\u53EF\u7528 http\uFF09\uFF0C\u6536\u5230 ${url.protocol}`);
  if (url.protocol === "http:" && LOOPBACK_HOSTNAMES[url.hostname] !== !0)
    throw localInputError(
      "insecure_site",
      `\u975E\u672C\u673A\u7AD9\u70B9\u5FC5\u987B\u4F7F\u7528 HTTPS\uFF1A${url.hostname} \u4E0D\u80FD\u901A\u8FC7 http \u8BBF\u95EE\uFF0C\u51ED\u636E\u4E0D\u4F1A\u53D1\u9001\u5230\u660E\u6587\u5730\u5740\u3002`
    );
  if (url.pathname !== "/" || url.search.length > 0 || url.hash.length > 0)
    throw localInputError("invalid_site", `\u7AD9\u70B9\u5730\u5740\u53EA\u63A5\u53D7\u6765\u6E90\u5730\u5740\uFF08scheme://host[:port]\uFF09\uFF1A${value}`);
  return url.origin;
}

// packages/mycutbuddy-cli/src/core/version.ts
var CLI_VERSION = "0.4.3";

// packages/mycutbuddy-cli/src/core/device-auth.ts
function readString(body, key) {
  let value = body?.[key];
  return typeof value == "string" ? value : void 0;
}
function readNumber(body, key) {
  let value = body?.[key];
  return typeof value == "number" && Number.isFinite(value) ? value : void 0;
}
async function postJson(path, body, options) {
  let response;
  try {
    response = await options.fetchImpl(new URL(path, options.site), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs)
    });
  } catch (error) {
    let name = error instanceof Error ? error.name : "Error";
    throw name === "TimeoutError" ? transientError("timeout", `\u8BBE\u5907\u6388\u6743\u8BF7\u6C42\u8D85\u65F6\uFF08${Math.round(options.timeoutMs / 1e3)} \u79D2\uFF09\uFF1A${path}`, { path }) : transientError("network_error", `\u65E0\u6CD5\u8FDE\u63A5\u7AD9\u70B9\uFF1A${path}`, { path, reason: name });
  }
  let text = await response.text(), parsedBody = null, parsed = !0;
  if (text.length > 0)
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsed = !1;
    }
  let record = parsedBody !== null && typeof parsedBody == "object" && !Array.isArray(parsedBody) ? parsedBody : null, retryAfter = response.headers.get("retry-after"), retryAfterSeconds = retryAfter === null ? null : Number.parseInt(retryAfter, 10);
  return {
    status: response.status,
    body: record,
    code: readString(record, "error") ?? null,
    intervalSeconds: readNumber(record, "interval") ?? null,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    parsed
  };
}
async function requestDeviceAuthorization(options) {
  let response = await postJson(
    "/api/agent-auth/device/code",
    { client_id: AGENT_AUTHORIZATION_CLIENT_ID, agent_name: options.agentName, scope: AGENT_AUTHORIZATION_SCOPE },
    options
  );
  if (response.status === 200) {
    let deviceCode = readString(response.body, "device_code"), userCode = readString(response.body, "user_code"), verificationUri = readString(response.body, "verification_uri"), expiresIn = readNumber(response.body, "expires_in"), intervalSeconds = readNumber(response.body, "interval");
    if (deviceCode === void 0 || !isAgentDeviceCodeShape(deviceCode) || userCode === void 0 || verificationUri === void 0 || expiresIn === void 0 || intervalSeconds === void 0)
      throw transientError("malformed_response", "\u7AD9\u70B9\u8FD4\u56DE\u7684\u8BBE\u5907\u6388\u6743\u4FE1\u606F\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", {
        path: "/api/agent-auth/device/code"
      });
    return {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: readString(response.body, "verification_uri_complete") ?? verificationUri,
      expiresIn,
      intervalSeconds
    };
  }
  throw response.status === 429 ? transientError("rate_limited", "\u8BBE\u5907\u6388\u6743\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", {
    path: "/api/agent-auth/device/code",
    ...response.retryAfterSeconds === null ? {} : { retry_after_seconds: response.retryAfterSeconds }
  }) : response.status >= 500 ? transientError("server_error", `\u7AD9\u70B9\u6682\u65F6\u65E0\u6CD5\u5F00\u59CB\u8BBE\u5907\u6388\u6743\uFF08HTTP ${response.status}\uFF09\u3002`, {
    path: "/api/agent-auth/device/code"
  }) : businessRejection(
    response.code ?? "invalid_request",
    "\u7AD9\u70B9\u62D2\u7EDD\u4E86\u8BBE\u5907\u6388\u6743\u8BF7\u6C42\uFF1A\u8BF7\u68C0\u67E5 --name\uFF081 \u5230 80 \u4E2A\u5B57\u7B26\uFF0C\u4E0D\u80FD\u5305\u542B\u63A7\u5236\u5B57\u7B26\uFF09\u3002",
    { path: "/api/agent-auth/device/code", status: response.status }
  );
}
function delaySeconds(seconds) {
  let { promise, resolve: resolve4 } = Promise.withResolvers();
  return setTimeout(resolve4, seconds * 1e3), promise;
}
async function pollDeviceAuthorization(session, options) {
  let deadline = Date.now() + (options.waitBudgetMs ?? 0), intervalSeconds = session.intervalSeconds;
  for (; ; ) {
    let response = await postJson(
      "/api/agent-auth/device/token",
      {
        client_id: AGENT_AUTHORIZATION_CLIENT_ID,
        device_code: session.deviceCode,
        grant_type: AGENT_AUTHORIZATION_GRANT_TYPE
      },
      options
    );
    if (response.status === 200) {
      let accessToken = readString(response.body, "access_token"), credentialId = readString(response.body, "credential_id"), expiresInSeconds = readNumber(response.body, "expires_in");
      if (accessToken === void 0 || !isAgentAccessTokenShape(accessToken) || credentialId === void 0 || expiresInSeconds === void 0)
        throw transientError("malformed_response", "\u7AD9\u70B9\u8FD4\u56DE\u7684\u51ED\u636E\u4FE1\u606F\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743\u3002", {
          path: "/api/agent-auth/device/token"
        });
      return {
        status: "authorized",
        intervalSeconds,
        credential: {
          accessToken,
          credentialId,
          scope: readString(response.body, "scope") ?? AGENT_AUTHORIZATION_SCOPE,
          expiresInSeconds
        }
      };
    }
    if (response.intervalSeconds !== null && (intervalSeconds = response.intervalSeconds), response.code === "access_denied")
      return { status: "denied", intervalSeconds, errorCode: "access_denied" };
    if (response.code === "expired_token")
      return { status: "expired", intervalSeconds, errorCode: "expired_token" };
    if (response.code === "invalid_grant")
      return { status: "refused", intervalSeconds, errorCode: "invalid_grant" };
    if (!(response.status === 429 || response.status >= 500 || !response.parsed || response.code === "authorization_pending" || response.code === "slow_down"))
      return { status: "refused", intervalSeconds, errorCode: response.code ?? "invalid_request" };
    if (options.waitBudgetMs === void 0) {
      if (response.status === 429)
        throw transientError("rate_limited", "\u8BBE\u5907\u6388\u6743\u8F6E\u8BE2\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", {
          path: "/api/agent-auth/device/token",
          ...response.retryAfterSeconds === null ? {} : { retry_after_seconds: response.retryAfterSeconds }
        });
      if (response.status >= 500 || !response.parsed)
        throw transientError("server_error", `\u7AD9\u70B9\u6682\u65F6\u65E0\u6CD5\u5B8C\u6210\u8BBE\u5907\u6388\u6743\u8F6E\u8BE2\uFF08HTTP ${response.status}\uFF09\u3002`, {
          path: "/api/agent-auth/device/token"
        });
      return { status: "pending", intervalSeconds };
    }
    let waitSeconds = response.retryAfterSeconds ?? intervalSeconds;
    if (Date.now() + waitSeconds * 1e3 > deadline)
      return { status: "pending", intervalSeconds };
    await (options.sleep ?? delaySeconds)(waitSeconds);
  }
}

// packages/mycutbuddy-cli/src/commands/auth.ts
function resolveCommandSite(context) {
  return normalizeSite(optionString(context.values, "site") ?? context.env.MYCUTBUDDY_SITE);
}
function credentialFacts(credential) {
  let expiresAt = new Date(credential.expires_at);
  return {
    credential_id: credential.credential_id,
    scope: credential.scope,
    agent_name: credential.agent_name,
    authorized_at: credential.authorized_at,
    expires_at: credential.expires_at,
    expired_locally: Number.isFinite(expiresAt.getTime()) ? expiresAt.getTime() <= Date.now() : !0
  };
}
var authCommands = [
  {
    id: "auth.login",
    summary: "\u5F00\u59CB\u8BBE\u5907\u6388\u6743\uFF1B\u7528\u6237\u6279\u51C6\u540E\u51ED\u636E\u5199\u5165\u672C\u673A\u5B89\u5168\u5B58\u50A8",
    usage: "auth.login --name <Agent \u540D\u79F0> [--site <\u7AD9\u70B9\u5730\u5740>] [--wait]",
    options: { name: { type: "string" }, wait: { type: "boolean" } },
    needsCredential: !1,
    async run(context) {
      let site = resolveCommandSite(context), agentName = requiredStringOption(context.values, "name", "Agent \u540D\u79F0\uFF081 \u5230 80 \u4E2A\u5B57\u7B26\uFF09"), timeoutMs = optionTimeoutMs(context.values), session = await requestDeviceAuthorization({ site, agentName, timeoutMs, fetchImpl: context.fetchImpl }), wait = optionFlag(context.values, "wait");
      wait && context.progress({
        event: "awaiting_approval",
        user_code: session.userCode,
        verification_uri: session.verificationUri,
        verification_uri_complete: session.verificationUriComplete,
        expires_in: session.expiresIn,
        interval: session.intervalSeconds
      });
      let outcome = await pollDeviceAuthorization(session, {
        site,
        timeoutMs,
        fetchImpl: context.fetchImpl,
        ...wait ? { waitBudgetMs: session.expiresIn * 1e3 } : {}
      }), shown = {
        site,
        user_code: session.userCode,
        verification_uri: session.verificationUri,
        verification_uri_complete: session.verificationUriComplete,
        expires_in: session.expiresIn,
        interval: outcome.intervalSeconds
      };
      if (outcome.status === "authorized" && outcome.credential !== void 0) {
        let authorizedAt = /* @__PURE__ */ new Date(), expiresAt = new Date(authorizedAt.getTime() + outcome.credential.expiresInSeconds * 1e3), credential = {
          site,
          access_token: outcome.credential.accessToken,
          credential_id: outcome.credential.credentialId,
          scope: outcome.credential.scope,
          agent_name: agentName,
          authorized_at: authorizedAt.toISOString(),
          expires_at: expiresAt.toISOString()
        };
        return context.store.save(credential), { ...shown, status: "authorized", credential: credentialFacts(credential) };
      }
      if (outcome.status === "pending")
        return context.warnings.push({
          code: "authorization_pending",
          message: "\u7528\u6237\u5C1A\u672A\u5728\u6D4F\u89C8\u5668\u4E2D\u6279\u51C6\u6388\u6743\uFF1B\u6279\u51C6\u540E\u518D\u6B21\u8FD0\u884C auth.login --wait\uFF0C\u6216\u7528 auth.status --probe \u786E\u8BA4\u3002"
        }), { ...shown, status: "pending" };
      throw outcome.status === "denied" ? authenticationError("access_denied", "\u7528\u6237\u62D2\u7EDD\u4E86\u672C\u6B21\u8BBE\u5907\u6388\u6743\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u6388\u6743\u3002", shown) : outcome.status === "expired" ? authenticationError("expired_token", "\u8BBE\u5907\u6388\u6743\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u6388\u6743\u3002", shown) : authenticationError(
        outcome.errorCode ?? "invalid_grant",
        "\u8BBE\u5907\u6388\u6743\u5151\u6362\u5931\u8D25\uFF1A\u8BBE\u5907\u7801\u65E0\u6548\u6216\u5DF2\u88AB\u4F7F\u7528\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u6388\u6743\u3002",
        shown
      );
    }
  },
  {
    id: "auth.status",
    summary: "\u67E5\u770B\u672C\u673A\u4FDD\u5B58\u7684\u51ED\u636E\u72B6\u6001\uFF0C\u53EF\u9009\u5411\u7AD9\u70B9\u9A8C\u8BC1\u51ED\u636E\u662F\u5426\u4ECD\u88AB\u63A5\u53D7",
    usage: "auth.status [--site <\u7AD9\u70B9\u5730\u5740>] [--probe]",
    options: { probe: { type: "boolean" } },
    needsCredential: !1,
    async run(context) {
      let site = resolveCommandSite(context), credential = context.store.read(site);
      if (credential === null)
        return context.warnings.push({
          code: "credential_missing",
          message: `\u672C\u673A\u6CA1\u6709 ${site} \u7684\u51ED\u636E\uFF0C\u8BF7\u5148\u8FD0\u884C auth.login \u5B8C\u6210\u8BBE\u5907\u6388\u6743\u3002`
        }), { site, credential: null, probe: { performed: !1 } };
      let facts = credentialFacts(credential);
      if (!optionFlag(context.values, "probe"))
        return { site, credential: facts, probe: { performed: !1 } };
      let response = await new ServiceClient({
        site,
        accessToken: credential.access_token,
        timeoutMs: optionTimeoutMs(context.values),
        fetchImpl: context.fetchImpl
      }).request({ route: "credits.status" });
      return {
        site,
        credential: facts,
        probe: { performed: !0, accepted: !0, http_status: response.status }
      };
    }
  },
  {
    id: "auth.list",
    summary: "\u5217\u51FA\u672C\u673A\u4FDD\u5B58\u4E86\u51ED\u636E\u7684\u7AD9\u70B9\uFF08\u4E0D\u542B\u4EE4\u724C\uFF09",
    usage: "auth.list",
    options: {},
    needsCredential: !1,
    async run(context) {
      return { sites: context.store.list().map((credential) => ({ site: credential.site, ...credentialFacts(credential) })) };
    }
  },
  {
    id: "auth.logout",
    summary: "\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u67D0\u4E2A\u7AD9\u70B9\u51ED\u636E\uFF08\u4E0D\u5F71\u54CD\u5176\u4ED6\u7AD9\u70B9\uFF09",
    usage: "auth.logout [--site <\u7AD9\u70B9\u5730\u5740>]",
    options: {},
    needsCredential: !1,
    async run(context) {
      let site = resolveCommandSite(context), removed = context.store.remove(site);
      return removed || context.warnings.push({ code: "credential_missing", message: `\u672C\u673A\u6CA1\u6709 ${site} \u7684\u51ED\u636E\u3002` }), { site, removed };
    }
  }
];

// packages/mycutbuddy-cli/src/commands/credits.ts
var creditsCommands = [
  {
    id: "credits.status",
    summary: "\u67E5\u8BE2\u79EF\u5206\u603B\u989D\u3001\u8BA2\u9605\u4E0E\u5DE5\u4F5C\u53F0\u8BBF\u95EE\u72B6\u6001",
    usage: "credits.status",
    options: {},
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      return (await context.client.request({ route: "credits.status" })).body;
    }
  },
  {
    id: "credits.transactions",
    summary: "\u5206\u9875\u67E5\u8BE2\u79EF\u5206\u6D41\u6C34",
    usage: "credits.transactions [--page 1] [--limit 10] [--type purchase|consumption|refund|bonus|adjustment]",
    options: {
      page: { type: "string" },
      limit: { type: "string" },
      type: { type: "string" }
    },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let page = optionInteger(context.values, "page", { fallback: 1, minimum: 1, maximum: 1e5 }), limit = optionInteger(context.values, "limit", { fallback: 10, minimum: 1, maximum: 100 }), type = optionEnum(context.values, "type", CREDIT_TRANSACTION_TYPES);
      return (await context.client.request({
        route: "credits.transactions",
        query: { page, limit, type }
      })).body;
    }
  }
];

// packages/mycutbuddy-cli/src/core/draft-download.ts
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
var DOWNLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, TUNNEL_PREFIX = "/~!frp/drafts/";
async function downloadDraftPackage(input) {
  let downloadId = input.downloadId.trim().toLowerCase();
  if (!DOWNLOAD_ID_PATTERN.test(downloadId))
    throw localInputError(
      "invalid_identifier",
      "\u4E0B\u8F7D ID \u5FC5\u987B\u662F\u4EFB\u52A1\u53CD\u9988\u91CC\u7684 download_id\uFF08UUID\uFF09\uFF0C\u4E0D\u63A5\u53D7\u8DEF\u5F84\u6216\u94FE\u63A5\u3002"
    );
  let url = new URL(`${TUNNEL_PREFIX}${downloadId}`, input.site), partialPath = `${input.targetPath}.part`, response;
  try {
    response = await input.fetchImpl(url, {
      method: "GET",
      headers: { authorization: `Bearer ${input.accessToken}`, accept: "application/zip" },
      redirect: "manual",
      signal: AbortSignal.timeout(input.timeoutMs)
    });
  } catch (error) {
    let name = error instanceof Error ? error.name : "Error", timeoutMinutes = Math.round(input.timeoutMs / 6e4);
    throw transientError(
      name === "TimeoutError" ? "timeout" : "network_error",
      `\u4E0B\u8F7D\u672A\u5B8C\u6210\uFF08${timeoutMinutes} \u5206\u949F\u7A97\u53E3\uFF09\uFF1A\u8FDE\u63A5\u4E2D\u65AD\u6216\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002`,
      { reason: name }
    );
  }
  if (response.status !== 200) {
    let text = await response.text().catch(() => ""), serviceCode = null, serviceMessage = null;
    try {
      let parsed = JSON.parse(text);
      typeof parsed.code == "string" && (serviceCode = parsed.code), typeof parsed.error == "string" ? serviceMessage = parsed.error : typeof parsed.message == "string" && (serviceMessage = parsed.message);
    } catch {
      serviceCode = null;
    }
    let details = { status: response.status, ...serviceCode === null ? {} : { service: { code: serviceCode } } }, message = serviceMessage ?? `\u7AD9\u70B9\u62D2\u7EDD\u4E0B\u8F7D\uFF08HTTP ${response.status}\uFF09\u3002`;
    throw response.status === 401 ? authenticationError(serviceCode ?? "authentication_required", message, details) : response.status === 429 ? transientError("rate_limited", message, details) : response.status >= 500 ? transientError(serviceCode ?? "server_error", message, details) : businessRejection(serviceCode ?? "download_refused", message, details);
  }
  if (!response.body)
    throw transientError("malformed_response", "\u7AD9\u70B9\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\u4F53\uFF0C\u672A\u5199\u5165\u4EFB\u4F55\u6587\u4EF6\u3002");
  let declared = Number.parseInt(response.headers.get("content-length") ?? "", 10), hash = createHash("sha256"), bytes = 0, counter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length, hash.update(chunk), callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(partialPath));
  } catch (error) {
    throw await rm(partialPath, { force: !0 }), transientError(
      "download_interrupted",
      "\u4E0B\u8F7D\u4E2D\u9014\u65AD\u5F00\uFF0C\u672A\u5199\u5165\u4EFB\u4F55\u5B8C\u6574\u6587\u4EF6\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u82E5\u53CD\u590D\u65AD\u5728\u76F8\u8FD1\u4F4D\u7F6E\uFF0C\u53EF\u6539\u7528\u767E\u5EA6\u7F51\u76D8\u4EA4\u4ED8\u3002",
      { reason: error instanceof Error ? error.name : "Error", received_bytes: bytes }
    );
  }
  if (Number.isFinite(declared) && declared !== bytes)
    throw await rm(partialPath, { force: !0 }), transientError(
      "download_incomplete",
      `\u4E0B\u8F7D\u4E0D\u5B8C\u6574\uFF08\u6536\u5230 ${bytes} \u5B57\u8282\uFF0C\u5E94\u4E3A ${declared} \u5B57\u8282\uFF09\uFF0C\u672A\u4FDD\u7559\u6587\u4EF6\uFF0C\u8BF7\u91CD\u8BD5\u3002`,
      { received_bytes: bytes, declared_bytes: declared }
    );
  return await rename(partialPath, input.targetPath), { path: input.targetPath, bytes, sha256: hash.digest("hex") };
}

// packages/mycutbuddy-cli/src/core/service-facts.ts
var TERMINAL_TASK_STATUSES = {
  completed: !0,
  partial_completed: !0,
  failed: !0,
  cancelled: !0,
  test_succeeded: !0,
  test_failed: !0
};
function isTerminalTaskStatus(status) {
  return typeof status == "string" && TERMINAL_TASK_STATUSES[status] === !0;
}
function metadataOnlyStages(metadata) {
  return {
    metadata,
    downloaded: "unknown",
    extracted: "not_performed",
    installed: "not_performed",
    jianying_recognition: "unverified"
  };
}

// packages/mycutbuddy-cli/src/core/service-response.ts
function asRecord(value) {
  return value !== null && typeof value == "object" && !Array.isArray(value) ? value : null;
}
function readField(value, key) {
  return asRecord(value)?.[key];
}
function readStringField(value, key) {
  let field = readField(value, key);
  return typeof field == "string" ? field : void 0;
}

// packages/mycutbuddy-cli/src/local/draft.ts
import { randomBytes } from "node:crypto";
import { lstatSync as lstatSync2, readdirSync, renameSync as renameSync2, rmSync as rmSync3 } from "node:fs";
import { basename, join as join2, resolve as resolve2 } from "node:path";

// packages/mycutbuddy-cli/src/local/zip.ts
import { closeSync, createReadStream, createWriteStream as createWriteStream2, lstatSync, mkdirSync as mkdirSync2, openSync, readSync, rmSync as rmSync2, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, resolve, sep } from "node:path";
import { Transform as Transform2 } from "node:stream";
import { pipeline as pipeline2 } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
var LIMITS = {
  entries: 5e4,
  entryBytes: 4 * 1024 * 1024 * 1024,
  totalBytes: 16 * 1024 * 1024 * 1024
}, END_OF_CENTRAL_DIRECTORY_SIGNATURE = 101010256, CENTRAL_DIRECTORY_SIGNATURE = 33639248, LOCAL_HEADER_SIGNATURE = 67324752, MAXIMUM_COMMENT_LENGTH = 65535, EOCD_SEARCH_LENGTH = 22 + MAXIMUM_COMMENT_LENGTH, MAXIMUM_NAME_LENGTH = 4096, COMPRESSION_STORED = 0, COMPRESSION_DEFLATE = 8, UNIX_FILE_TYPE_MASK = 61440, UNIX_SYMBOLIC_LINK = 40960, UNIX_REGULAR_FILE = 32768, UNIX_DIRECTORY = 16384, DOS_DIRECTORY_ATTRIBUTE = 16;
function readRange(descriptor, start, length) {
  let buffer = Buffer.alloc(length);
  if (readSync(descriptor, buffer, 0, length, start) !== length)
    throw localInputError("archive_unreadable", "\u538B\u7F29\u5305\u5728\u8BFB\u53D6\u8FC7\u7A0B\u4E2D\u63D0\u524D\u7ED3\u675F\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u3002");
  return buffer;
}
function findEndOfCentralDirectory(descriptor, fileSize) {
  if (fileSize < 22)
    throw localInputError("archive_unreadable", "\u6587\u4EF6\u592A\u5C0F\uFF0C\u4E0D\u662F\u6709\u6548\u7684 ZIP \u538B\u7F29\u5305\u3002");
  let searchLength = Math.min(fileSize, EOCD_SEARCH_LENGTH), tail = readRange(descriptor, fileSize - searchLength, searchLength);
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE)
      continue;
    let commentLength = tail.readUInt16LE(index + 20);
    if (index + 22 + commentLength !== tail.length)
      continue;
    let entries = tail.readUInt16LE(index + 10), size = tail.readUInt32LE(index + 12), offset = tail.readUInt32LE(index + 16);
    if (entries === 65535 || size === 4294967295 || offset === 4294967295)
      throw localInputError(
        "unsupported_archive",
        "\u8BE5\u538B\u7F29\u5305\u4F7F\u7528 ZIP64 \u683C\u5F0F\uFF0CCLI \u6682\u4E0D\u652F\u6301\uFF1B\u8BF7\u91CD\u65B0\u6253\u5305\u4E3A\u666E\u901A ZIP\uFF08\u5355\u4E2A\u6587\u4EF6\u4E0D\u8D85\u8FC7 4GB\uFF09\u3002"
      );
    return { entries, offset, size };
  }
  throw localInputError("archive_unreadable", "\u672A\u627E\u5230 ZIP \u4E2D\u592E\u76EE\u5F55\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u6216\u88AB\u622A\u65AD\u3002");
}
function assertSafeEntryName(name, directoryEntry) {
  let reject = (reason) => {
    throw localInputError("unsafe_archive_entry", `\u538B\u7F29\u5305\u6761\u76EE\u4E0D\u5B89\u5168\uFF08${reason}\uFF09\uFF1A${JSON.stringify(name)}`, {
      entry: name,
      reason
    });
  };
  name.length === 0 && reject("\u7A7A\u540D\u79F0"), name.length > MAXIMUM_NAME_LENGTH && reject("\u540D\u79F0\u8FC7\u957F"), name.includes("\0") && reject("\u5305\u542B\u7A7A\u5B57\u7B26"), (name.startsWith("/") || name.startsWith("\\")) && reject("\u7EDD\u5BF9\u8DEF\u5F84"), name.includes("\\") && reject("\u5305\u542B\u53CD\u659C\u6760"), /^[A-Za-z]:/.test(name) && reject("\u5305\u542B\u76D8\u7B26"), /[\u0000-\u001f\u007f]/.test(name) && reject("\u5305\u542B\u63A7\u5236\u5B57\u7B26");
  let segments = name.split("/"), last = segments.length - 1;
  for (let [index, segment] of segments.entries())
    directoryEntry && index === last && segment === "" || (segment === "" && reject("\u8DEF\u5F84\u51FA\u73B0\u7A7A\u76EE\u5F55\u6BB5"), (segment === "." || segment === "..") && reject("\u8DEF\u5F84\u7A7F\u8D8A"), (segment.endsWith(" ") || segment.endsWith(".")) && reject("\u6BB5\u540D\u4EE5\u7A7A\u683C\u6216\u70B9\u7ED3\u5C3E"), /(?:^|\.)(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment) && reject("Windows \u8BBE\u5907\u540D"));
}
function readEntries(descriptor, fileSize) {
  let directory = findEndOfCentralDirectory(descriptor, fileSize);
  if (directory.size === 0 || directory.entries === 0)
    throw localInputError("empty_archive", "\u538B\u7F29\u5305\u5185\u6CA1\u6709\u4EFB\u4F55\u6587\u4EF6\u3002");
  if (directory.entries > LIMITS.entries)
    throw localInputError("unsupported_archive", `\u538B\u7F29\u5305\u6761\u76EE\u8FC7\u591A\uFF08${directory.entries}\uFF09\uFF0C\u8D85\u51FA CLI \u5141\u8BB8\u7684 ${LIMITS.entries} \u6761\u3002`);
  if (directory.offset + directory.size > fileSize)
    throw localInputError("archive_unreadable", "\u538B\u7F29\u5305\u4E2D\u592E\u76EE\u5F55\u8D85\u51FA\u6587\u4EF6\u8303\u56F4\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u3002");
  let records = readRange(descriptor, directory.offset, directory.size), entries = [], cursor = 0, totalBytes = 0;
  for (let index = 0; index < directory.entries; index += 1) {
    if (cursor + 46 > records.length || records.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE)
      throw localInputError("archive_unreadable", "\u538B\u7F29\u5305\u4E2D\u592E\u76EE\u5F55\u8BB0\u5F55\u4E0D\u5B8C\u6574\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u3002");
    let versionMadeBy = records.readUInt16LE(cursor + 4), flags = records.readUInt16LE(cursor + 8), compression = records.readUInt16LE(cursor + 10), compressedBytes = records.readUInt32LE(cursor + 20), uncompressedBytes = records.readUInt32LE(cursor + 24), nameLength = records.readUInt16LE(cursor + 28), extraLength = records.readUInt16LE(cursor + 30), commentLength = records.readUInt16LE(cursor + 32), externalAttributes = records.readUInt32LE(cursor + 38), localHeaderOffset = records.readUInt32LE(cursor + 42), recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > records.length)
      throw localInputError("archive_unreadable", "\u538B\u7F29\u5305\u4E2D\u592E\u76EE\u5F55\u8BB0\u5F55\u8D8A\u754C\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u3002");
    let name = records.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"), unixMode = versionMadeBy >> 8 === 3 ? externalAttributes >>> 16 & 65535 : null, directoryEntry = name.endsWith("/") || (unixMode !== null ? (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_DIRECTORY : (externalAttributes & DOS_DIRECTORY_ATTRIBUTE) !== 0);
    if (flags & 1)
      throw localInputError("unsupported_archive", `\u538B\u7F29\u5305\u6761\u76EE\u5DF2\u52A0\u5BC6\uFF0C\u65E0\u6CD5\u89E3\u538B\uFF1A${JSON.stringify(name)}`);
    if (compression !== COMPRESSION_STORED && compression !== COMPRESSION_DEFLATE)
      throw localInputError(
        "unsupported_archive",
        `\u538B\u7F29\u5305\u6761\u76EE\u4F7F\u7528\u4E86\u4E0D\u652F\u6301\u7684\u538B\u7F29\u65B9\u5F0F\uFF08${compression}\uFF09\uFF1A${JSON.stringify(name)}`
      );
    if (unixMode !== null && (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMBOLIC_LINK)
      throw localInputError("unsafe_archive_entry", `\u538B\u7F29\u5305\u5305\u542B\u7B26\u53F7\u94FE\u63A5\uFF0C\u5DF2\u62D2\u7EDD\u89E3\u538B\uFF1A${JSON.stringify(name)}`, {
        entry: name,
        reason: "\u7B26\u53F7\u94FE\u63A5"
      });
    if (unixMode !== null) {
      let type = unixMode & UNIX_FILE_TYPE_MASK;
      if (type !== 0 && type !== UNIX_REGULAR_FILE && type !== UNIX_DIRECTORY)
        throw localInputError("unsafe_archive_entry", `\u538B\u7F29\u5305\u5305\u542B\u7279\u6B8A\u6587\u4EF6\uFF0C\u5DF2\u62D2\u7EDD\u89E3\u538B\uFF1A${JSON.stringify(name)}`, {
          entry: name,
          reason: "\u7279\u6B8A\u6587\u4EF6\u7C7B\u578B"
        });
    }
    if (uncompressedBytes > LIMITS.entryBytes)
      throw localInputError("unsupported_archive", `\u538B\u7F29\u5305\u6761\u76EE\u8FC7\u5927\uFF0C\u8D85\u51FA CLI \u5141\u8BB8\u7684 4GB\uFF1A${JSON.stringify(name)}`);
    if (assertSafeEntryName(name, directoryEntry), totalBytes += uncompressedBytes, totalBytes > LIMITS.totalBytes)
      throw localInputError("unsupported_archive", "\u538B\u7F29\u5305\u89E3\u538B\u540E\u603B\u5927\u5C0F\u8D85\u51FA CLI \u5141\u8BB8\u7684 16GB\u3002");
    entries.push({
      name,
      directory: directoryEntry,
      compression,
      compressedBytes,
      uncompressedBytes,
      localHeaderOffset,
      unixPermissions: unixMode === null ? null : unixMode & 511
    }), cursor = recordEnd;
  }
  return entries;
}
function resolveEntryPath(root, entryName) {
  let normalized = entryName.endsWith("/") ? entryName.slice(0, -1) : entryName, target = resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${sep}`))
    throw localInputError("unsafe_archive_entry", `\u538B\u7F29\u5305\u6761\u76EE\u8D8A\u51FA\u76EE\u6807\u76EE\u5F55\uFF0C\u5DF2\u62D2\u7EDD\u89E3\u538B\uFF1A${JSON.stringify(entryName)}`, {
      entry: entryName,
      reason: "\u8D8A\u51FA\u76EE\u6807\u76EE\u5F55"
    });
  return target;
}
var DeclaredSizeGuard = class extends Transform2 {
  constructor(limit) {
    super();
    this.produced = 0;
    this.limit = limit;
  }
  _transform(chunk, _encoding, callback) {
    if (this.produced += chunk.length, this.produced > this.limit) {
      callback(new Error("archive entry produced more bytes than it declared"));
      return;
    }
    callback(null, chunk);
  }
};
async function extractEntry(archivePath, entry, targetPath) {
  if (entry.directory) {
    mkdirSync2(targetPath, { recursive: !0, mode: 493 });
    return;
  }
  mkdirSync2(dirname2(targetPath), { recursive: !0, mode: 493 });
  let descriptor = openSync(archivePath, "r");
  try {
    let header = readRange(descriptor, entry.localHeaderOffset, 30);
    if (header.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE)
      throw localInputError("archive_unreadable", `\u538B\u7F29\u5305\u6761\u76EE\u5934\u90E8\u65E0\u6548\uFF1A${JSON.stringify(entry.name)}`);
    let nameLength = header.readUInt16LE(26), extraLength = header.readUInt16LE(28), dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength, dataEnd = dataStart + entry.compressedBytes, fileSize = statSync2(archivePath).size;
    if (dataEnd > fileSize)
      throw localInputError("archive_unreadable", `\u538B\u7F29\u5305\u6761\u76EE\u6570\u636E\u8D85\u51FA\u6587\u4EF6\u8303\u56F4\uFF1A${JSON.stringify(entry.name)}`);
    let mode = entry.unixPermissions === null ? 420 : Math.min(entry.unixPermissions, 511);
    if (entry.compressedBytes === 0) {
      writeFileSync2(targetPath, Buffer.alloc(0), { mode });
      return;
    }
    let source = createReadStream(archivePath, { start: dataStart, end: dataEnd - 1 }), destination = createWriteStream2(targetPath, { mode }), guard = new DeclaredSizeGuard(entry.uncompressedBytes);
    entry.compression === COMPRESSION_STORED ? await pipeline2(source, guard, destination) : await pipeline2(source, createInflateRaw(), guard, destination);
  } finally {
    closeSync(descriptor);
  }
}
function inspectArchive(archivePath) {
  let descriptor = openSync(archivePath, "r");
  try {
    let entries = readEntries(descriptor, statSync2(archivePath).size), topLevelNames = [
      ...new Set(
        entries.map((entry) => (entry.name.endsWith("/") ? entry.name.slice(0, -1) : entry.name).split("/")[0])
      )
    ];
    return {
      entries: entries.map((entry) => ({ name: entry.name, directory: entry.directory, bytes: entry.uncompressedBytes })),
      files: entries.filter((entry) => !entry.directory).length,
      directories: entries.filter((entry) => entry.directory).length,
      totalUncompressedBytes: entries.reduce((total, entry) => total + entry.uncompressedBytes, 0),
      topLevelNames
    };
  } finally {
    closeSync(descriptor);
  }
}
async function extractArchive(options) {
  let target = resolve(options.targetDirectory);
  if (lstatSync(target, { throwIfNoEntry: !1 }) !== void 0)
    throw localInputError("target_exists", `\u89E3\u538B\u76EE\u6807\u5DF2\u5B58\u5728\uFF0C\u8BF7\u5148\u79FB\u9664\u6216\u6362\u4E00\u4E2A\u76EE\u5F55\uFF1A${target}`);
  let descriptor = openSync(options.archivePath, "r"), entries;
  try {
    entries = readEntries(descriptor, statSync2(options.archivePath).size);
  } finally {
    closeSync(descriptor);
  }
  mkdirSync2(target, { recursive: !0, mode: 448 });
  try {
    for (let entry of entries)
      await extractEntry(options.archivePath, entry, resolveEntryPath(target, entry.name));
  } catch (error) {
    throw rmSync2(target, { recursive: !0, force: !0 }), error;
  }
  return {
    files: entries.filter((entry) => !entry.directory).length,
    directories: entries.filter((entry) => entry.directory).length,
    bytes: entries.reduce((total, entry) => total + entry.uncompressedBytes, 0)
  };
}

// packages/mycutbuddy-cli/src/local/draft.ts
var MAXIMUM_DRAFT_NAME_LENGTH = 200;
function assertPackageFile(packagePath) {
  let resolved = resolve2(packagePath), stats = lstatSync2(resolved, { throwIfNoEntry: !1 });
  if (stats === void 0 || !stats.isFile())
    throw localInputError("package_missing", `\u627E\u4E0D\u5230\u672C\u5730\u538B\u7F29\u5305\u6587\u4EF6\uFF1A${resolved}`);
  return resolved;
}
function assertDraftsDirectory(draftsDirectory) {
  let resolved = resolve2(draftsDirectory), stats = lstatSync2(resolved, { throwIfNoEntry: !1 });
  if (stats === void 0 || !stats.isDirectory())
    throw localInputError(
      "drafts_directory_missing",
      `\u526A\u6620\u8349\u7A3F\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u4E0D\u662F\u76EE\u5F55\uFF1A${resolved}\u3002\u8BF7\u663E\u5F0F\u6307\u5B9A\u7528\u6237\u7535\u8111\u4E0A\u771F\u5B9E\u7684\u8349\u7A3F\u76EE\u5F55\u3002`
    );
  return resolved;
}
function assertDraftName(name) {
  let trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAXIMUM_DRAFT_NAME_LENGTH || trimmed === "." || trimmed === ".." || /[\\/]/.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed))
    throw localInputError("invalid_draft_name", `\u8349\u7A3F\u76EE\u5F55\u540D\u65E0\u6548\uFF1A${JSON.stringify(name)}`);
  return trimmed;
}
function inspectDraftPackage(packagePath) {
  let resolved = assertPackageFile(packagePath), inspection = inspectArchive(resolved);
  return {
    package_path: resolved,
    files: inspection.files,
    directories: inspection.directories,
    total_uncompressed_bytes: inspection.totalUncompressedBytes,
    top_level_names: inspection.topLevelNames,
    entries: inspection.entries
  };
}
async function extractDraftPackage(options) {
  let resolved = assertPackageFile(options.packagePath);
  inspectArchive(resolved);
  let target = resolve2(options.targetDirectory), result = await extractArchive({ archivePath: resolved, targetDirectory: target });
  return { package_path: resolved, target_directory: target, ...result };
}
function summarizeEntries(entries, prefix) {
  let related = prefix === null ? entries : entries.filter((entry) => entry.name.startsWith(prefix));
  return {
    files: related.filter((entry) => !entry.directory).length,
    directories: related.filter((entry) => entry.directory).length,
    bytes: related.reduce((total, entry) => total + entry.bytes, 0)
  };
}
async function installDraftPackage(options) {
  let packagePath = assertPackageFile(options.packagePath), draftsDirectory = assertDraftsDirectory(options.draftsDirectory), requestedName = options.draftName === void 0 ? void 0 : assertDraftName(options.draftName), inspection = inspectArchive(packagePath), stagingDirectory = join2(draftsDirectory, `.mycutbuddy-install-${randomBytes(6).toString("hex")}`);
  try {
    let extracted = await extractArchive({ archivePath: packagePath, targetDirectory: stagingDirectory }), staged = readdirSync(stagingDirectory, { withFileTypes: !0 }), draftDirectories = staged.filter((entry) => entry.isDirectory()).map((entry) => entry.name), looseEntries = staged.some((entry) => !entry.isDirectory()), plan = [];
    if (looseEntries) {
      if (draftDirectories.length > 1)
        throw localInputError(
          "invalid_package_layout",
          `\u538B\u7F29\u5305\u6839\u90E8\u65E2\u6709\u8349\u7A3F\u76EE\u5F55\u53C8\u6709\u6563\u843D\u6587\u4EF6\uFF0C\u65E0\u6CD5\u5224\u65AD\u8349\u7A3F\u8FB9\u754C\uFF1A${draftDirectories.join("\u3001")}\u3002\u8BF7\u91CD\u65B0\u751F\u6210\u4EA4\u4ED8\u5305\u3002`,
          { draft_directories: draftDirectories }
        );
      plan.push({
        draftName: requestedName ?? basename(packagePath).replace(/\.zip$/i, ""),
        sourceDirectory: stagingDirectory,
        prefix: null
      });
    } else {
      if (draftDirectories.length === 0)
        throw localInputError("invalid_package_layout", "\u538B\u7F29\u5305\u5185\u6CA1\u6709\u4EFB\u4F55\u8349\u7A3F\u76EE\u5F55\uFF0C\u65E0\u6CD5\u5B89\u88C5\u3002", {
          package_path: packagePath
        });
      if (draftDirectories.length === 1)
        plan.push({
          draftName: requestedName ?? assertDraftName(draftDirectories[0]),
          sourceDirectory: join2(stagingDirectory, draftDirectories[0]),
          prefix: `${draftDirectories[0]}/`
        });
      else {
        if (requestedName !== void 0)
          throw localInputError(
            "name_requires_single_draft",
            `\u538B\u7F29\u5305\u5185\u542B ${draftDirectories.length} \u6761\u8349\u7A3F\uFF0C--name \u53EA\u80FD\u7528\u4E8E\u5355\u8349\u7A3F\u5305\uFF1B\u8BF7\u76F4\u63A5\u5B89\u88C5\uFF0C\u8349\u7A3F\u4F1A\u5404\u81EA\u6CBF\u7528\u5305\u5185\u76EE\u5F55\u540D\u3002`,
            { draft_directories: draftDirectories }
          );
        for (let directory of draftDirectories)
          plan.push({
            draftName: assertDraftName(directory),
            sourceDirectory: join2(stagingDirectory, directory),
            prefix: `${directory}/`
          });
      }
    }
    let targets = plan.map((item) => ({ ...item, installedPath: join2(draftsDirectory, item.draftName) })), conflicts = targets.filter((target) => lstatSync2(target.installedPath, { throwIfNoEntry: !1 }) !== void 0);
    if (conflicts.length > 0) {
      let paths = conflicts.map((target) => target.installedPath);
      throw localInputError(
        "draft_conflict",
        conflicts.length === 1 ? `\u540C\u540D\u8349\u7A3F\u5DF2\u5B58\u5728\uFF0CCLI \u4E0D\u4F1A\u8986\u76D6\uFF1A${paths[0]}\u3002\u8BF7\u5148\u5904\u7406\u5DF2\u6709\u8349\u7A3F\uFF0C\u6216\u7528 --name \u6307\u5B9A\u53E6\u4E00\u4E2A\u76EE\u5F55\u540D\u3002` : `\u6709 ${conflicts.length} \u4E2A\u540C\u540D\u8349\u7A3F\u5DF2\u5B58\u5728\uFF0CCLI \u4E0D\u4F1A\u8986\u76D6\u5176\u4E2D\u4EFB\u4F55\u4E00\u4E2A\uFF1A${paths.join("\u3001")}\u3002\u8BF7\u5148\u5904\u7406\u5DF2\u6709\u8349\u7A3F\u3002`,
        { installed_paths: paths, draft_names: conflicts.map((target) => target.draftName) }
      );
    }
    let installed = [];
    try {
      for (let target of targets)
        renameSync2(target.sourceDirectory, target.installedPath), installed.push({
          draft_name: target.draftName,
          installed_path: target.installedPath,
          ...summarizeEntries(inspection.entries, target.prefix)
        });
    } catch (error) {
      for (let draft of installed)
        rmSync3(draft.installed_path, { recursive: !0, force: !0 });
      throw error;
    }
    return {
      package_path: packagePath,
      drafts_directory: draftsDirectory,
      drafts: installed,
      files: extracted.files,
      directories: extracted.directories,
      bytes: extracted.bytes,
      stages: {
        // Metadata belongs to the service call the caller already made; installing only observes
        // local facts.
        metadata: "unknown",
        downloaded: "confirmed",
        extracted: "completed",
        installed: "completed",
        jianying_recognition: "unverified"
      }
    };
  } finally {
    rmSync3(stagingDirectory, { recursive: !0, force: !0 });
  }
}

// packages/mycutbuddy-cli/src/commands/definition.ts
var OPTION_DESCRIPTIONS = {
  site: "\u76EE\u6807\u7AD9\u70B9\u5730\u5740\uFF1B\u5FC5\u987B\u4F7F\u7528 https\uFF0C\u672C\u673A\u8054\u8C03\u53EF\u7528 127.0.0.1\u3002\u7701\u7565\u65F6\u4F7F\u7528 MYCUTBUDDY_SITE \u6216\u9ED8\u8BA4\u7AD9\u70B9\u3002",
  format: "\u8F93\u51FA\u683C\u5F0F\uFF1Ajson\uFF08\u9ED8\u8BA4\uFF0C\u7A33\u5B9A\u4FE1\u5C01\uFF09\u6216 human\u3002",
  pretty: "JSON \u8F93\u51FA\u7F29\u8FDB\u3002",
  timeout: "\u5355\u6B21\u8BF7\u6C42\u8D85\u65F6\u79D2\u6570\uFF081\u2013600\uFF0C\u9ED8\u8BA4 20\uFF09\u3002",
  help: "\u663E\u793A\u8BE5\u547D\u4EE4\u7684\u7528\u6CD5\u3001\u8F93\u5165\u7ED3\u6784\u4E0E\u540E\u7EED\u547D\u4EE4\u3002",
  version: "\u663E\u793A\u672C\u5730 CLI \u7248\u672C\u5E76\u9000\u51FA\u3002",
  project: "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list\u3002",
  library: "\u7D20\u6750\u5E93\u7C7B\u578B\uFF1Aprimary\u3001talking_head \u6216 voiceover\uFF1B\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\u3002",
  input: "\u4E1A\u52A1\u8F93\u5165 JSON \u5B57\u7B26\u4E32\u3002",
  "input-file": "\u4E1A\u52A1\u8F93\u5165 JSON \u6587\u4EF6\uFF1B- \u8868\u793A\u4ECE\u6807\u51C6\u8F93\u5165\u8BFB\u53D6\u3002",
  "submission-key": "\u672C\u6B21\u903B\u8F91\u64CD\u4F5C\u7684\u5E42\u7B49\u952E\uFF1B\u7701\u7565\u65F6\u81EA\u52A8\u751F\u6210\u5E76\u5728\u672C\u673A\u4FDD\u7559\u5F85\u7528\u8BB0\u5F55\u3002",
  "notice-version": "\u670D\u52A1\u7AEF\u5F53\u524D\u8BA1\u8D39\u63D0\u793A\u7248\u672C\uFF1B\u7701\u7565\u65F6\u81EA\u52A8\u8BFB\u53D6\u3002",
  "confirm-charge": "\u786E\u8BA4\u672C\u6B21\u63D0\u4EA4\u53EF\u80FD\u4EA7\u751F\u8D39\u7528\uFF1B\u7F3A\u5C11\u65F6\u5728\u672C\u5730\u62D2\u7EDD\u3002",
  page: "\u9875\u7801\uFF0C\u4ECE 1 \u5F00\u59CB\u3002",
  "page-size": "\u6BCF\u9875\u6761\u6570\u3002",
  task: "\u4EFB\u52A1 ID\u3002",
  request: "\u8BA1\u8D39\u8BF7\u6C42 ID\u3002",
  style: "\u526A\u8F91\u98CE\u683C ID\u3002",
  quote: "\u526A\u8F91\u62A5\u4EF7 ID\u3002",
  type: "\u8D44\u6E90\u7C7B\u578B\u3002",
  form: "\u526A\u8F91\u5F62\u5F0F\u3002",
  operation: "\u7D20\u6750\u5BFC\u5165\u64CD\u4F5C ID\u3002",
  import: "\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165 ID\u3002",
  draft: "\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165\u4E2D\u7684\u8349\u7A3F ID\u3002",
  "request-key": "\u672C\u6B21\u6837\u5F0F\u5BFC\u5165\u7684\u552F\u4E00\u952E\u3002",
  "subtitle-preset": "\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE ID\u3002",
  "watch-timeout": "\u89C2\u5BDF\u7A97\u53E3\u79D2\u6570\uFF081\u20133600\uFF0C\u9ED8\u8BA4 60\uFF09\u3002",
  "watch-interval": "\u4E24\u6B21\u89C2\u5BDF\u4E4B\u95F4\u7684\u79D2\u6570\uFF081\u2013300\uFF0C\u9ED8\u8BA4 5\uFF09\u3002",
  "focus-request": "\u628A\u5217\u8868\u5B9A\u4F4D\u5230\u67D0\u4E2A\u8BA1\u8D39\u8BF7\u6C42\u3002",
  "focus-task": "\u628A\u5217\u8868\u5B9A\u4F4D\u5230\u67D0\u4E2A\u4EFB\u52A1\u3002",
  package: "\u672C\u673A\u5DF2\u4E0B\u8F7D\u7684\u4EA4\u4ED8\u538B\u7F29\u5305\u8DEF\u5F84\u3002",
  target: "\u89E3\u538B\u76EE\u6807\u76EE\u5F55\uFF0C\u5FC5\u987B\u5C1A\u4E0D\u5B58\u5728\u3002",
  "drafts-dir": "\u526A\u6620\u8349\u7A3F\u76EE\u5F55\u3002",
  name: "\u540D\u79F0\u3002",
  probe: "\u5411\u7AD9\u70B9\u9A8C\u8BC1\u5F53\u524D\u51ED\u636E\u662F\u5426\u4ECD\u88AB\u63A5\u53D7\u3002"
}, PROJECT_OPTION = { project: { type: "string" } }, LIBRARY_OPTION = { library: { type: "string" } }, PAYLOAD_OPTIONS = {
  input: { type: "string" },
  "input-file": { type: "string" }
}, CHARGE_OPTIONS = {
  "submission-key": { type: "string" },
  "notice-version": { type: "string" },
  "confirm-charge": { type: "boolean" }
}, PAGINATION_OPTIONS = {
  page: { type: "string" },
  "page-size": { type: "string" }
};

// packages/mycutbuddy-cli/src/commands/delivery.ts
var PROJECT_HINT = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", PACKAGE_HINT = "\u672C\u673A\u5DF2\u4E0B\u8F7D\u7684\u4EA4\u4ED8\u538B\u7F29\u5305\u8DEF\u5F84\uFF08\u6765\u81EA delivery.download \u7684\u8FD4\u56DE\u503C\uFF0C\u6216\u5B98\u65B9\u767E\u5EA6\u7F51\u76D8 Skill \u4E0B\u8F7D\u7684\u6587\u4EF6\uFF09", DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1e3, siteCommands = [
  {
    id: "delivery.info",
    summary: "\u8BFB\u53D6\u9879\u76EE\u8349\u7A3F\u4EA4\u4ED8\u76EE\u5F55\u7684\u670D\u52A1\u7AEF\u4E8B\u5B9E\uFF08\u5206\u4EAB\u94FE\u63A5\u4E0E\u63D0\u53D6\u7801\uFF09",
    usage: "delivery.info --project <\u9879\u76EE ID>",
    options: PROJECT_OPTION,
    needsCredential: !0,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT), delivery = (await context.client.request({
        route: "delivery.info",
        query: { project_id: projectId }
      })).body, hasLink = typeof readStringField(delivery, "share_url") == "string", hasCode = typeof readStringField(delivery, "extraction_code") == "string";
      return {
        project_id: projectId,
        delivery,
        stages: metadataOnlyStages(
          delivery === null ? "absent" : hasLink && hasCode ? "available" : "incomplete"
        )
      };
    }
  },
  {
    id: "delivery.download",
    summary: "\u76F4\u63A5\u4ECE\u7F51\u7AD9\u4E0B\u8F7D\u4EA4\u4ED8\u538B\u7F29\u5305\uFF08\u4E0D\u7ECF\u767E\u5EA6\u7F51\u76D8\uFF0C\u5199\u5B8C\u5373\u8BA1\u5165\u8BE5\u5305\u4EA4\u4ED8\u6210\u529F\uFF09",
    usage: "delivery.download --download-id <download_id> --out <\u4FDD\u5B58\u8DEF\u5F84>",
    options: {
      "download-id": { type: "string" },
      out: { type: "string" }
    },
    needsCredential: !0,
    help: {
      note: "\u53EA\u63A5\u53D7\u4EFB\u52A1\u53CD\u9988\u91CC downloads[].download_id\uFF1B\u7236\u76EE\u5F55\u5FC5\u987B\u5DF2\u5B58\u5728\uFF0C\u4E0B\u8F7D\u4E0D\u5B8C\u6574\u65F6\u4E0D\u4FDD\u7559\u6587\u4EF6\u3002",
      options: {
        "download-id": "\u4EFB\u52A1\u53CD\u9988 downloads[].download_id\uFF08\u72B6\u6001\u4E3A available \u6216 completed \u65F6\u624D\u6709\u8BE5\u5B57\u6BB5\uFF09",
        out: "\u538B\u7F29\u5305\u4FDD\u5B58\u8DEF\u5F84\uFF0C\u4F8B\u5982 ./\u4EA4\u4ED8\u5305.zip"
      },
      next: [
        "node scripts/mycutbuddy.mjs delivery.inspect --package <\u4FDD\u5B58\u8DEF\u5F84>",
        "node scripts/mycutbuddy.mjs delivery.extract --package <\u4FDD\u5B58\u8DEF\u5F84> --target <\u89E3\u538B\u76EE\u5F55>"
      ]
    },
    async run(context) {
      let downloadId = requiredStringOption(
        context.values,
        "download-id",
        "\u4EFB\u52A1\u53CD\u9988 downloads[].download_id"
      ), targetPath = requiredStringOption(context.values, "out", "\u538B\u7F29\u5305\u4FDD\u5B58\u8DEF\u5F84\uFF08\u7236\u76EE\u5F55\u5FC5\u987B\u5DF2\u5B58\u5728\uFF09");
      return { ...await downloadDraftPackage({
        site: context.site,
        accessToken: context.accessToken,
        downloadId,
        targetPath,
        fetchImpl: context.fetchImpl,
        timeoutMs: DOWNLOAD_TIMEOUT_MS
      }), stages: {
        metadata: "available",
        downloaded: "confirmed",
        extracted: "not_performed",
        installed: "not_performed",
        jianying_recognition: "unverified"
      } };
    }
  }
], localCommands = [
  {
    id: "delivery.inspect",
    summary: "\u5728\u89E3\u538B\u524D\u5B89\u5168\u9884\u68C0\u672C\u5730\u4EA4\u4ED8\u538B\u7F29\u5305\uFF08\u4E0D\u5199\u5165\u4EFB\u4F55\u6587\u4EF6\uFF09",
    usage: "delivery.inspect --package <\u538B\u7F29\u5305\u8DEF\u5F84>",
    options: { package: { type: "string" } },
    needsCredential: !1,
    async run(context) {
      let packagePath = requiredStringOption(context.values, "package", PACKAGE_HINT);
      return inspectDraftPackage(packagePath);
    }
  },
  {
    id: "delivery.extract",
    summary: "\u5B89\u5168\u89E3\u538B\u672C\u5730\u4EA4\u4ED8\u538B\u7F29\u5305\u5230\u6307\u5B9A\u76EE\u5F55\uFF08\u76EE\u6807\u76EE\u5F55\u5FC5\u987B\u5C1A\u4E0D\u5B58\u5728\uFF09",
    usage: "delivery.extract --package <\u538B\u7F29\u5305\u8DEF\u5F84> --target <\u76EE\u6807\u76EE\u5F55>",
    options: { package: { type: "string" }, target: { type: "string" } },
    needsCredential: !1,
    async run(context) {
      let packagePath = requiredStringOption(context.values, "package", PACKAGE_HINT), target = requiredStringOption(context.values, "target", "\u89E3\u538B\u76EE\u6807\u76EE\u5F55\uFF08\u5FC5\u987B\u5C1A\u4E0D\u5B58\u5728\uFF09");
      return extractDraftPackage({ packagePath, targetDirectory: target });
    }
  },
  {
    id: "delivery.install",
    summary: "\u628A\u672C\u5730\u4EA4\u4ED8\u538B\u7F29\u5305\u5185\u7684\u5168\u90E8\u8349\u7A3F\u5B89\u88C5\u4E3A\u526A\u6620\u8349\u7A3F\u76EE\u5F55\uFF08\u540C\u540D\u4E0D\u8986\u76D6\uFF0C\u4E0D\u6539\u5199\u8349\u7A3F JSON\uFF09",
    usage: "delivery.install --package <\u538B\u7F29\u5305\u8DEF\u5F84> --drafts-dir <\u526A\u6620\u8349\u7A3F\u76EE\u5F55> [--name <\u8349\u7A3F\u76EE\u5F55\u540D>]",
    options: {
      package: { type: "string" },
      "drafts-dir": { type: "string" },
      name: { type: "string" }
    },
    needsCredential: !1,
    async run(context) {
      let packagePath = requiredStringOption(context.values, "package", PACKAGE_HINT), draftsDirectory = requiredStringOption(
        context.values,
        "drafts-dir",
        "\u7528\u6237\u7535\u8111\u4E0A\u7684\u526A\u6620\u8349\u7A3F\u76EE\u5F55\uFF08\u5FC5\u987B\u7531\u8C03\u7528\u65B9\u663E\u5F0F\u6307\u5B9A\uFF09"
      ), draftName = optionString(context.values, "name");
      return installDraftPackage({
        packagePath,
        draftsDirectory,
        ...draftName === void 0 ? {} : { draftName }
      });
    }
  }
], deliveryCommands = [
  ...siteCommands,
  ...localCommands
];

// packages/mycutbuddy-cli/src/core/pending-submissions.ts
import { createHash as createHash2, randomUUID } from "node:crypto";
import { chmodSync as chmodSync2, linkSync, mkdirSync as mkdirSync3, readFileSync as readFileSync3, rmSync as rmSync4, statSync as statSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join3 } from "node:path";
var PENDING_DIRECTORY_MODE = 448, PENDING_FILE_MODE = 384, FORBIDDEN_PERMISSION_BITS2 = 63;
function canonicalJson(value) {
  if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value == "object") {
    let record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
var PendingSubmissionStore = class {
  constructor(home) {
    this.directory = join3(home, "pending-submissions");
  }
  /**
   * Returns the pending key for this exact operation, or writes a fresh one before returning.
   *
   * A key whose file was hand-edited into another scope is refused instead of reused silently.
   */
  takeOrCreate(scope) {
    this.ensureDirectory();
    let digest = createHash2("sha256").update(canonicalJson({
      site: scope.site,
      kind: scope.kind,
      projectId: scope.projectId,
      input: scope.input
    })).digest("hex"), path = join3(this.directory, `${digest}.json`), existing = this.read(path, digest, scope);
    if (existing !== null)
      return { submissionKey: existing.submission_key, source: "pending", path };
    let record = {
      version: 1,
      submission_key: randomUUID(),
      site: scope.site,
      kind: scope.kind,
      project_id: scope.projectId,
      input_digest: digest,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.writeExclusive(path, record))
      return { submissionKey: record.submission_key, source: "generated", path };
    let winner = this.read(path, digest, scope);
    if (winner === null)
      throw localInputError("pending_submission_store_unreadable", `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u5199\u5165\u540E\u65E0\u6CD5\u8BFB\u53D6\uFF1A${path}`);
    return { submissionKey: winner.submission_key, source: "pending", path };
  }
  /** The operation reached a definitive service answer; the pending key is no longer needed. */
  discard(path) {
    rmSync4(path, { force: !0 });
  }
  ensureDirectory() {
    if (mkdirSync3(this.directory, { recursive: !0, mode: PENDING_DIRECTORY_MODE }), process.platform !== "win32" && statSync3(this.directory).mode & FORBIDDEN_PERMISSION_BITS2)
      throw localInputError(
        "pending_submission_store_insecure",
        `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u76EE\u5F55\u6743\u9650\u4E0D\u5B89\u5168\uFF08\u9700\u8981\u4EC5\u672C\u4EBA\u53EF\u8BBF\u95EE\uFF09\uFF1A${this.directory}`
      );
  }
  read(path, digest, scope) {
    let raw;
    try {
      raw = readFileSync3(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT")
        return null;
      throw localInputError("pending_submission_store_unreadable", `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u65E0\u6CD5\u8BFB\u53D6\uFF1A${path}`);
    }
    if (process.platform !== "win32" && statSync3(path).mode & FORBIDDEN_PERMISSION_BITS2)
      throw localInputError(
        "pending_submission_store_insecure",
        `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u6743\u9650\u4E0D\u5B89\u5168\uFF08\u9700\u8981\u4EC5\u672C\u4EBA\u53EF\u8BFB\u5199\uFF09\uFF1A${path}`
      );
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw localInputError("pending_submission_store_invalid", `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${path}`);
    }
    if (parsed === null || typeof parsed != "object" || Array.isArray(parsed))
      throw localInputError("pending_submission_store_invalid", `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u5185\u5BB9\u65E0\u6548\uFF1A${path}`);
    let record = parsed;
    if (!(record.version === 1 && typeof record.submission_key == "string" && record.submission_key.length >= 1 && record.submission_key.length <= 128 && /^[A-Za-z0-9_-]+$/.test(record.submission_key) && record.site === scope.site && record.kind === scope.kind && record.project_id === scope.projectId && record.input_digest === digest))
      throw localInputError("pending_submission_store_invalid", `\u672C\u673A\u5F85\u7528\u63D0\u4EA4\u952E\u4E0E\u672C\u6B21\u63D0\u4EA4\u4E0D\u5339\u914D\uFF1A${path}`);
    return record;
  }
  writeExclusive(path, record) {
    let temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync3(temporaryPath, `${JSON.stringify(record, null, 2)}
`, { mode: PENDING_FILE_MODE }), chmodSync2(temporaryPath, PENDING_FILE_MODE);
      try {
        linkSync(temporaryPath, path);
      } catch (error) {
        if (error.code === "EEXIST")
          return !1;
        throw error;
      }
      return !0;
    } finally {
      rmSync4(temporaryPath, { force: !0 });
    }
  }
};

// packages/mycutbuddy-cli/src/commands/submissions.ts
var SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/, TALKING_HEAD_PATHS = {
  segment_composition: !0,
  full_video: !0
};
function asObject(value) {
  return value !== null && typeof value == "object" && !Array.isArray(value) ? value : null;
}
async function readChargeFacts(context, kind, projectId, input) {
  if (kind === "editing") {
    let response2 = await context.client.request({
      route: "editing.context",
      params: { projectId }
    });
    return asObject(response2.body);
  }
  let libraryType = input.library_type;
  if (!isMaterialLibraryType(libraryType))
    throw localInputError(
      "invalid_payload",
      `input.library_type \u53EA\u652F\u6301\uFF1A${MATERIAL_LIBRARY_TYPES.join("\u3001")}\u3002`
    );
  let response = await context.client.request({
    route: "material.directory",
    params: { projectId },
    query: { library_type: libraryType }
  });
  return asObject(response.body);
}
function noticeVersionFromFacts(kind, input, facts) {
  if (facts === null)
    return;
  if (kind === "material_import")
    return readStringField(facts, "material_import_notice_version");
  if (kind === "material_index")
    return readStringField(facts, input.shot_mode === void 0 ? "billing_notice_version" : "primary_shot_notice_version");
  let talkingHeadPath = readStringField(input, "talking_head_path");
  return readStringField(
    facts,
    talkingHeadPath !== void 0 && TALKING_HEAD_PATHS[talkingHeadPath] === !0 ? "talking_head_notice_version" : "billing_notice_version"
  );
}
function validateMaterialIndexInput(input) {
  if (input.library_type === "voiceover")
    throw localInputError(
      "invalid_payload",
      "\u8BED\u97F3\u914D\u97F3\u5E93\u6CA1\u6709\u7D20\u6750\u7D22\u5F15\uFF1A\u5B83\u53EA\u5B58\u653E\u914D\u97F3\u97F3\u9891\uFF0C\u5BFC\u5165\u5B8C\u6210\u5373\u5C31\u7EEA\uFF1B\u7D22\u5F15\u53EA\u80FD\u9009\u62E9 primary \u6216 talking_head\u3002"
    );
  let shotMode = input.shot_mode, hasPrompt = input.additional_prompt !== void 0;
  if (shotMode === void 0) {
    if (hasPrompt)
      throw localInputError(
        "invalid_payload",
        "input.additional_prompt \u53EA\u80FD\u4E0E input.shot_mode \u4E00\u8D77\u63D0\u4EA4\uFF1B\u4EC5\u7D22\u5F15\u8BF7\u53EA\u4F20 library_type\u3002"
      );
    return;
  }
  if (input.library_type !== "primary")
    throw localInputError(
      "invalid_payload",
      "\u53EA\u6709\u4E3B\u7D20\u6750\u5E93\uFF08primary\uFF09\u53EF\u4EE5\u63D0\u4EA4 shot_mode\uFF1B\u4EBA\u7269\u53E3\u64AD\u5E93\u53EA\u80FD\u7D22\u5F15\uFF0C\u8BED\u97F3\u914D\u97F3\u5E93\u6CA1\u6709\u7D22\u5F15\u3002"
    );
  if (typeof shotMode != "string" || !MATERIAL_SHOT_MODES.includes(shotMode))
    throw localInputError(
      "invalid_payload",
      `input.shot_mode \u53EA\u652F\u6301\uFF1A${MATERIAL_SHOT_MODES.join("\u3001")}\u3002`
    );
  if (hasPrompt && typeof input.additional_prompt != "string")
    throw localInputError("invalid_payload", "input.additional_prompt \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\uFF0C\u6CA1\u6709\u7279\u6B8A\u8981\u6C42\u8BF7\u7559\u7A7A\u3002");
}
function validateEditingInput(input) {
  let source = input.audio_source;
  if (source !== void 0 && !NARRATION_AUDIO_SOURCES.includes(source))
    throw localInputError(
      "invalid_payload",
      `input.audio_source \u53EA\u652F\u6301\uFF1A${NARRATION_AUDIO_SOURCES.join("\u3001")}\u3002`
    );
  let rows = input.rows;
  if (rows !== void 0 && (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_BATCH_ROWS))
    throw localInputError("invalid_payload", `input.rows \u5FC5\u987B\u662F 1..${MAX_BATCH_ROWS} \u884C\u7684\u6570\u7EC4\u3002`);
}
function inputSummary(kind, input) {
  let summary = {};
  return typeof input.library_type == "string" && (summary.library_type = input.library_type), kind === "editing" && (typeof input.audio_source == "string" && (summary.audio_source = input.audio_source), summary.row_count = Array.isArray(input.rows) ? input.rows.length : 1), kind === "material_index" && typeof input.shot_mode == "string" && (summary.shot_mode = input.shot_mode, summary.has_additional_prompt = typeof input.additional_prompt == "string" && input.additional_prompt.length > 0), summary;
}
async function submitChargeableWork(context, route, kind) {
  if (context.values["confirm-charge"] !== !0)
    throw localInputError(
      "charge_confirmation_required",
      `${kind} \u63D0\u4EA4\u53EF\u80FD\u4EA7\u751F\u8D39\u7528\uFF1A\u8BF7\u5148\u4E0E\u7528\u6237\u786E\u8BA4\uFF0C\u518D\u7528 --confirm-charge \u660E\u786E\u786E\u8BA4\u672C\u6B21\u63D0\u4EA4\u3002`
    );
  let input = readPayload(context.values, {
    required: !0,
    hint: "\u670D\u52A1\u7AEF\u63A5\u53D7\u7684 input \u5BF9\u8C61\uFF08\u4E0E\u7F51\u9875\u5DE5\u4F5C\u53F0\u76F8\u540C\u7684\u5B57\u6BB5\uFF09"
  });
  kind === "material_import" && (input.directory_contract_version = MATERIAL_IMPORT_DIRECTORY_CONTRACT_VERSION, (typeof input.target_directory != "string" || input.target_directory.trim() === "") && (input.target_directory = "."));
  let projectId = requiredStringOption(context.values, "project", "\u9879\u76EE ID");
  kind === "editing" && validateEditingInput(input), kind === "material_index" && validateMaterialIndexInput(input);
  let explicitKey = optionString(context.values, "submission-key");
  if (explicitKey !== void 0 && !SUBMISSION_KEY_PATTERN.test(explicitKey))
    throw localInputError(
      "invalid_arguments",
      "--submission-key \u53EA\u5141\u8BB8 1..128 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\u3002"
    );
  let explicitNoticeVersion = optionString(context.values, "notice-version"), facts = null;
  try {
    facts = await readChargeFacts(context, kind, projectId, input);
  } catch (error) {
    if (isCliError(error) && error.kind === "local_input" || explicitNoticeVersion === void 0)
      throw error;
    context.warnings.push({
      code: "charge_preview_unavailable",
      message: `\u5DF2\u4F7F\u7528\u663E\u5F0F --notice-version\uFF0C\u4F46\u8BFB\u53D6\u8BA1\u8D39\u9884\u89C8\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
    });
  }
  let noticeVersion = explicitNoticeVersion ?? noticeVersionFromFacts(kind, input, facts);
  if (noticeVersion === void 0)
    throw localInputError(
      "notice_version_missing",
      "\u65E0\u6CD5\u4ECE\u670D\u52A1\u7AEF\u8BFB\u5230\u8BA1\u8D39\u63D0\u793A\u7248\u672C\uFF1B\u8BF7\u91CD\u8BD5\uFF0C\u6216\u663E\u5F0F\u4F20\u5165 --notice-version\u3002"
    );
  let ledger = new PendingSubmissionStore(context.store.home), pending = explicitKey === void 0 ? ledger.takeOrCreate({ site: context.site, kind, projectId, input }) : { submissionKey: explicitKey, source: "explicit", path: "" };
  context.progress({
    event: "charge_preview",
    kind,
    project_id: projectId,
    notice_version: noticeVersion,
    notice_version_source: explicitNoticeVersion === void 0 ? "auto" : "explicit",
    submission_key: pending.submissionKey,
    submission_key_source: pending.source,
    credit_balance: facts === null ? null : readField(facts, "credit_balance") ?? null,
    quote: kind === "material_index" && facts !== null ? readField(facts, "material_index_quote") ?? null : null,
    // The primary directory reports the server's own count of not yet processed videos; the CLI
    // only forwards it so the caller can explain what this batch would process.
    ...kind === "material_index" && input.library_type === "primary" && facts !== null && readField(facts, "unprocessed_video_count") !== void 0 ? { unprocessed_video_count: readField(facts, "unprocessed_video_count") } : {},
    input_summary: inputSummary(kind, input)
  });
  let response;
  try {
    response = await context.client.request({
      route,
      params: { projectId },
      body: { submission_key: pending.submissionKey, notice_version: noticeVersion, kind, input }
    });
  } catch (error) {
    let failure = isCliError(error) ? error : null;
    throw failure !== null && (failure.kind === "transient" || failure.kind === "authentication") ? failure.kind === "transient" ? new CliError("transient", failure.code, failure.message, {
      retryable: !0,
      details: {
        ...failure.details,
        kind,
        submission_key: pending.submissionKey,
        submission_key_source: pending.source,
        replay_hint: "\u7528\u76F8\u540C\u8F93\u5165\u91CD\u653E\u5373\u53EF\u590D\u7528\u540C\u4E00\u6B21\u8BA1\u8D39\u8BF7\u6C42\uFF1B\u7701\u7565 --submission-key \u65F6\u4F1A\u81EA\u52A8\u590D\u7528\u672C\u673A\u5F85\u7528\u952E\u3002"
      }
    }) : new CliError("authentication", failure.code, failure.message, {
      retryable: !1,
      details: {
        ...failure.details,
        kind,
        submission_key: pending.submissionKey,
        submission_key_source: pending.source
      }
    }) : (pending.path.length > 0 && ledger.discard(pending.path), error);
  }
  pending.path.length > 0 && ledger.discard(pending.path);
  let submission = response.body;
  return readField(submission, "state") === "failed" && context.warnings.push({
    code: "submission_failed",
    message: "\u63D0\u4EA4\u5DF2\u88AB\u53D7\u7406\uFF0C\u4F46\u670D\u52A1\u7AEF\u5DF2\u5224\u5B9A\u672C\u6B21\u8BF7\u6C42\u5931\u8D25\uFF1B\u8BF7\u8BFB\u53D6 data.submission.failure \u7684\u4E8B\u5B9E\u3002"
  }), {
    submission_key: pending.submissionKey,
    submission_key_source: pending.source,
    kind,
    replayed: response.status === 200,
    http_status: response.status,
    request_id: readField(submission, "request_id"),
    execution_task_id: readField(submission, "execution_task_id"),
    submission
  };
}

// packages/mycutbuddy-cli/src/commands/editing.ts
var PROJECT_HINT2 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", editingCommands = [
  {
    id: "editing.context",
    summary: "\u8BFB\u53D6\u7F16\u8F91\u5668\u5143\u6570\u636E\u3001\u8D44\u6E90\u76EE\u5F55\u3001\u98CE\u683C\u76EE\u5F55\u3001\u4F59\u989D\u4E0E\u8BA1\u8D39\u63D0\u793A\u7248\u672C",
    usage: "editing.context --project <\u9879\u76EE ID>",
    options: PROJECT_OPTION,
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT2);
      return (await context.client.request({
        route: "editing.context",
        params: { projectId }
      })).body;
    }
  },
  {
    id: "editing.estimate",
    summary: "\u5BF9\u4EBA\u7269\u53E3\u64AD\u8F93\u5165\u53D6\u5F97\u514D\u8D39\u4F30\u7B97\u4E0E\u4F30\u7B97\u4EE4\u724C",
    usage: `editing.estimate --project <\u9879\u76EE ID> --input '{"talking_head_path":"...","preset_id":"...",...}'`,
    options: { ...PROJECT_OPTION, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT2), payload = readPayload(context.values, { required: !0, hint: "\u53E3\u64AD\u4F30\u7B97\u8F93\u5165" });
      return (await context.client.request({
        route: "editing.estimate",
        params: { projectId },
        body: payload
      })).body;
    },
    help: {
      note: "\u514D\u8D39\u4F30\u7B97\uFF1B\u53EA\u7528\u4E8E\u4EBA\u7269\u53E3\u64AD\u3002\u8FD4\u56DE\u7684 estimate_token \u5FC5\u987B\u539F\u6837\u5E26\u5165\u7F16\u8F91 submission\u3002",
      fields: [
        { key: "talking_head_path", required: !0, type: "enum", values: ["segment_composition", "full_video"], description: "\u5206\u6BB5\u53E3\u64AD\u6216\u5B8C\u6574\u53E3\u64AD\u3002" },
        { key: "preset_id", required: !0, type: "string", description: "\u4ECE\u98CE\u683C\u76EE\u5F55\u9009\u62E9\u7684\u771F\u5B9E\u9884\u8BBE ID\u3002" },
        { key: "use_primary_overlay", required: !0, type: "boolean", description: "\u662F\u5426\u5141\u8BB8\u4F7F\u7528\u4E3B\u7D20\u6750\u5E93\u753B\u9762\u8986\u76D6\u3002" },
        { key: "public_config", required: !0, type: "object", description: "\u6240\u9009\u53E3\u64AD\u98CE\u683C\u7684\u5B9E\u9645\u914D\u7F6E\u3002" },
        { key: "rows", required: !0, type: "array", description: "1..200 \u884C\uFF1B\u6BCF\u884C\u542B row_id\u3001script\u3001instruction\u3001public_overrides \u7B49\u3002" }
      ],
      next: ["editing.submit --project <\u9879\u76EE ID> --confirm-charge --input-file <\u5305\u542B estimate_token \u7684\u8F93\u5165>"]
    }
  },
  {
    id: "editing.submit",
    summary: "\u63D0\u4EA4\u526A\u8F91\u8BA1\u8D39\u8BF7\u6C42\uFF08\u6536\u8D39\uFF0C\u9700\u8981\u663E\u5F0F\u786E\u8BA4\uFF1B\u4E0D\u5728\u6B64\u7B49\u5F85\u7EC8\u6001\uFF09",
    usage: "editing.submit --project <\u9879\u76EE ID> [--submission-key <\u5E42\u7B49\u952E>] [--notice-version <\u63D0\u793A\u7248\u672C>] --confirm-charge --input '{...}'",
    options: { ...PROJECT_OPTION, ...CHARGE_OPTIONS, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !0,
    async run(context) {
      return submitChargeableWork(context, "editing.submit", "editing");
    },
    help: {
      note: "\u4E0E\u7F51\u9875\u5DE5\u4F5C\u53F0\u76F8\u540C\u7684\u526A\u8F91\u8F93\u5165\u3002\u65C1\u767D\u7528 audio_source\uFF1B\u4EBA\u7269\u53E3\u64AD\u6539\u7528 talking_head_path \u5E76\u5148\u7ECF editing.estimate \u53D6\u5F97 estimate_token\u3002\u7701\u7565 --notice-version \u65F6\u7531 CLI \u8BFB\u53D6\u5F53\u524D\u7248\u672C\uFF1B\u7701\u7565 --submission-key \u65F6\u81EA\u52A8\u751F\u6210\u5E76\u5728\u672C\u673A\u4FDD\u7559\u5F85\u7528\u8BB0\u5F55\u3002",
      fields: [
        { key: "audio_source", type: "enum", values: ["tts", "upload"], description: "\u65C1\u767D\u914D\u97F3\u6765\u6E90\uFF1B\u4E0A\u4F20\u65F6\u8FD8\u5FC5\u987B\u63D0\u4F9B audio_file_relative_path\u3002\u4EBA\u7269\u53E3\u64AD\u4E0D\u4F7F\u7528\u8BE5\u5B57\u6BB5\u3002" },
        { key: "talking_head_path", type: "enum", values: ["segment_composition", "full_video"], description: "\u4EBA\u7269\u53E3\u64AD\u8DEF\u5F84\uFF1B\u51FA\u73B0\u8BE5\u5B57\u6BB5\u65F6\u6309\u53E3\u64AD\u8F93\u5165\u6821\u9A8C\u3002" },
        { key: "use_primary_overlay", type: "boolean", description: "\u4EBA\u7269\u53E3\u64AD\u662F\u5426\u53E0\u52A0\u4E3B\u7D20\u6750\u5E93\u753B\u9762\uFF1B\u53E3\u64AD\u65F6\u5FC5\u586B\u3002" },
        { key: "estimate_token", type: "string", description: "\u4EBA\u7269\u53E3\u64AD\u5FC5\u586B\uFF0C\u5FC5\u987B\u6765\u81EA editing.estimate \u7684\u771F\u5B9E\u8FD4\u56DE\u503C\u3002" },
        { key: "public_config", required: !0, type: "object", description: "\u57FA\u4E8E\u6240\u9009\u9884\u8BBE\u7684\u5B8C\u6574\u914D\u7F6E\u5FEB\u7167\uFF1B\u4E0D\u8981\u53EA\u63D0\u4EA4\u8986\u76D6\u9879\u3002" },
        { key: "preset_source", required: !0, type: "object", description: '{kind:"system"|"personal", preset_id:"\u5B9E\u9645\u9884\u8BBE ID"}\u3002' },
        { key: "script_text", type: "string", description: "\u5355\u6761 TTS \u6587\u6848\uFF1B\u6279\u91CF\u65F6\u53EA\u80FD\u653E\u5728 rows \u4E2D\u3002" },
        { key: "draft_name", type: "string", description: "\u53EF\u9009\u8349\u7A3F\u540D\uFF0C\u6700\u591A 40 \u4E2A\u5B89\u5168\u5B57\u7B26\u3002" },
        { key: "audio_file_relative_path", type: "string", description: "audio_source=upload \u65F6\u5FC5\u586B\uFF1B\u6765\u81EA\u8BED\u97F3\u914D\u97F3\u5E93\u5DF2\u53D1\u5E03 MP3 \u7684\u663E\u793A\u8DEF\u5F84\uFF0C\u7701\u7565\u672B\u5C3E .mp3\u3002" },
        { key: "rows", type: "array", description: "\u6279\u91CF 1..200 \u884C\uFF1B\u65C1\u767D\u6BCF\u884C\u53EF\u5E26 script_text\u3001draft_name\u3001audio_source\u3001audio_file_relative_path\u3001public_overrides\uFF1B\u53E3\u64AD\u6BCF\u884C\u542B row_id\u3001script\u3001instruction \u7B49\u3002" },
        { key: "presentation", type: "object", description: "\u53EF\u9009\uFF0C\u7F51\u9875\u5448\u73B0\u5FEB\u7167\uFF0C\u4E0D\u662F\u526A\u8F91\u53C2\u6570\u3002" }
      ],
      example: {
        audio_source: "tts",
        preset_source: { kind: "system", preset_id: "system-single-track-default" },
        public_config: { "...": "\u5B8C\u6574\u914D\u7F6E\uFF0C\u6765\u81EA preset.style.get \u7684 public_config" },
        script_text: "\u8FD9\u662F\u4E00\u6761\u65C1\u767D\u6587\u6848\u3002"
      },
      next: [
        "request.watch --project <\u9879\u76EE ID> --request <request_id>",
        "task.watch --project <\u9879\u76EE ID> --task <execution_task_id>"
      ]
    }
  },
  {
    id: "editing.quote.get",
    summary: "\u67E5\u8BE2\u65C1\u767D\u62A5\u4EF7\u7684\u5F53\u524D\u72B6\u6001\u4E0E\u9010\u884C\u8D39\u7528",
    usage: "editing.quote.get --project <\u9879\u76EE ID> --quote <\u62A5\u4EF7 ID>",
    options: { ...PROJECT_OPTION, quote: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT2), quoteId = requiredStringOption(context.values, "quote", "\u526A\u8F91\u62A5\u4EF7 ID");
      return (await context.client.request({
        route: "editing.quote.get",
        params: { projectId, quoteId }
      })).body;
    }
  }
];

// packages/mycutbuddy-cli/src/commands/help.ts
function commandGroup(id) {
  return id === "help" || id === "version" ? "general" : id.split(".")[0];
}
function describeCommandOptions(definition) {
  let specific = definition.help?.options ?? {};
  return ["site", ...Object.keys(definition.options).sort(), "format", "pretty", "timeout", "version", "help"].map((name) => ({
    name: `--${name}`,
    description: specific[name] ?? OPTION_DESCRIPTIONS[name] ?? "\u8BE5\u547D\u4EE4\u7684\u9009\u9879\u3002"
  }));
}
function commandDescription(definition) {
  let payload = definition.help?.payload ?? (definition.help?.fields === void 0 ? void 0 : {
    ...definition.help.example === void 0 ? {} : { example: definition.help.example },
    fields: definition.help.fields
  });
  return {
    id: definition.id,
    group: commandGroup(definition.id),
    summary: definition.summary,
    usage: definition.usage,
    needs_credential: definition.needsCredential,
    chargeable: definition.chargeable === !0,
    ...definition.help?.note === void 0 ? {} : { note: definition.help.note },
    options: describeCommandOptions(definition),
    ...payload === void 0 ? {} : { input: payload },
    ...definition.help?.next === void 0 ? {} : { next: definition.help.next }
  };
}
function commandHelpText(definition) {
  let lines = [
    `${definition.id} \u2014 ${definition.summary}`,
    `\u7528\u6CD5\uFF1Amycutbuddy ${definition.usage}`,
    definition.needsCredential ? `\u9ED8\u8BA4\u8FDE\u63A5 ${DEFAULT_SITE}\uFF1B--site\uFF08\u6216 MYCUTBUDDY_SITE\uFF09\u53EF\u8986\u76D6\uFF0C\u4E14\u9700\u8981\u672C\u673A\u5DF2\u6388\u6743\u7684\u51ED\u636E\u3002` : "\u4E0D\u9700\u8981\u7AD9\u70B9\u51ED\u636E\u3002",
    "",
    "\u9009\u9879\uFF1A",
    ...describeCommandOptions(definition).map((option) => `  ${option.name}  ${option.description}`)
  ], payload = definition.help?.payload ?? (definition.help?.fields === void 0 ? void 0 : {
    ...definition.help.example === void 0 ? {} : { example: definition.help.example },
    fields: definition.help.fields
  });
  if (definition.help?.note !== void 0 && lines.push("", `\u8BF4\u660E\uFF1A${definition.help.note}`), payload !== void 0) {
    payload.note !== void 0 && lines.push("", `\u8F93\u5165\u8BF4\u660E\uFF1A${payload.note}`), lines.push("", "\u8F93\u5165\u5B57\u6BB5\uFF1A");
    for (let field of payload.fields) {
      let required = field.required === !0 ? "\u5FC5\u586B" : "\u53EF\u9009", values = field.values === void 0 ? "" : `\uFF08${field.values.join(" | ")}\uFF09`;
      lines.push(`  ${field.key} [${required}] ${field.type}${values}  ${field.description}`);
    }
    payload.example !== void 0 && lines.push("", `\u793A\u4F8B\uFF1A${JSON.stringify(payload.example)}`);
  }
  return definition.help?.next !== void 0 && lines.push("", "\u540E\u7EED\u547D\u4EE4\uFF1A", ...definition.help.next.map((next) => `  ${next}`)), `${lines.join(`
`)}
`;
}

// packages/mycutbuddy-cli/src/commands/material-upload.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// packages/mycutbuddy-cli/src/core/local-manifest.ts
import { lstatSync as lstatSync3, readdirSync as readdirSync2 } from "node:fs";
import { basename as basename2, resolve as resolve3 } from "node:path";
function unsupported(path, kind) {
  throw localInputError(
    "unsupported_local_entry",
    `\u672C\u673A\u8DEF\u5F84\u91CC\u6709\u4E0D\u652F\u6301\u5BFC\u5165\u7684\u6761\u76EE\uFF08${kind}\uFF09\uFF1A${path}\u3002\u8BF7\u53EA\u4E0A\u4F20\u666E\u901A\u6587\u4EF6\u4E0E\u76EE\u5F55\uFF0C\u7B26\u53F7\u94FE\u63A5\u8BF7\u5148\u66FF\u6362\u4E3A\u771F\u5B9E\u6587\u4EF6\u3002`,
    { path }
  );
}
function walk(directory, prefix, files) {
  let entries = readdirSync2(directory, { withFileTypes: !0 }).slice().sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (let entry of entries) {
    let absolute = resolve3(directory, entry.name), relative = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`, stats = lstatSync3(absolute);
    if (stats.isSymbolicLink() && unsupported(absolute, "\u7B26\u53F7\u94FE\u63A5"), stats.isDirectory()) {
      walk(absolute, relative, files);
      continue;
    }
    stats.isFile() || unsupported(absolute, "\u975E\u666E\u901A\u6587\u4EF6"), files.push({ relative_path: relative, size_bytes: stats.size, absolute_path: absolute });
  }
}
function collectLocalManifest(paths, cwd) {
  if (paths.length === 0)
    throw localInputError("missing_argument", "\u81F3\u5C11\u9700\u8981\u4E00\u4E2A --path\uFF1A\u7ED9\u51FA\u8981\u4E0A\u4F20\u7684\u672C\u5730\u6587\u4EF6\u6216\u76EE\u5F55\u3002");
  let files = [], rootEntries = [];
  for (let requested of paths) {
    let absolute = resolve3(cwd, requested), stats;
    try {
      stats = lstatSync3(absolute);
    } catch {
      throw localInputError("path_not_found", `\u672C\u673A\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u65E0\u6CD5\u8BFB\u53D6\uFF1A${requested}`, { path: requested });
    }
    if (stats.isSymbolicLink() && unsupported(absolute, "\u7B26\u53F7\u94FE\u63A5"), stats.isDirectory()) {
      rootEntries.push({ name: basename2(absolute), kind: "directory" });
      let collected = [];
      walk(absolute, basename2(absolute), collected), files.push(...collected);
      continue;
    }
    stats.isFile() || unsupported(absolute, "\u975E\u666E\u901A\u6587\u4EF6"), rootEntries.push({ name: basename2(absolute), kind: "file" }), files.push({ relative_path: basename2(absolute), size_bytes: stats.size, absolute_path: absolute });
  }
  let seen = /* @__PURE__ */ new Map();
  for (let file of files) {
    let key = file.relative_path, count = (seen.get(key) ?? 0) + 1;
    if (seen.set(key, count), count > 1)
      throw localInputError(
        "duplicate_relative_path",
        `\u540C\u4E00\u4E2A\u8DEF\u5F84\u4E0B\u51FA\u73B0\u4E86\u91CD\u590D\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF1A${key}\u3002\u8BF7\u5206\u5F00\u4E0A\u4F20\u6216\u53BB\u6389\u91CD\u590D\u7684 --path\u3002`,
        { relative_path: key }
      );
  }
  return { files, selection: { root_entries: rootEntries } };
}

// packages/mycutbuddy-cli/src/core/tus-upload.ts
import { openSync as openSync2, closeSync as closeSync2, readSync as readSync2, statSync as statSync4 } from "node:fs";
var TUS_CHUNK_BYTES = 8 * 1024 * 1024, TUS_RETRY_DELAYS_MS = [0, 2e3, 5e3, 1e4, 2e4, 3e4], TUS_VERSION = "1.0.0";
function headerOffset(response) {
  let raw = response.headers.get("upload-offset");
  if (raw === null)
    return null;
  let value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= 0 ? value : null;
}
function declaredLength(localPath, expectedBytes) {
  let size = statSync4(localPath).size;
  if (expectedBytes !== void 0 && size !== expectedBytes)
    throw businessRejection(
      "local_file_changed",
      `\u672C\u5730\u6587\u4EF6\u5728\u4E0A\u4F20\u8FC7\u7A0B\u4E2D\u53D1\u751F\u53D8\u5316\uFF08\u590D\u6838 ${expectedBytes} \u5B57\u8282\uFF0C\u5F53\u524D ${size} \u5B57\u8282\uFF09\uFF1A${localPath}`,
      { local_path: localPath }
    );
  return size;
}
function sleep(ms, signal) {
  if (ms <= 0)
    return Promise.resolve();
  if (signal?.aborted === !0)
    return Promise.reject(signal.reason ?? new Error("aborted"));
  let { promise, resolve: resolve4, reject } = Promise.withResolvers(), onAbort = () => {
    clearTimeout(timer), reject(signal?.reason ?? new Error("aborted"));
  }, timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort), resolve4();
  }, ms);
  return signal?.addEventListener("abort", onAbort, { once: !0 }), promise;
}
function isRetryable(status) {
  return status === 409 || status === 423 || status === 429 || status >= 500;
}
function retryableStatus(status, action) {
  return transientError(
    "upload_temporarily_unavailable",
    `\u8282\u70B9\u6682\u65F6\u65E0\u6CD5${action}\uFF08HTTP ${status}\uFF09\uFF1A\u8FD9\u6B21\u4E0A\u4F20\u6CA1\u6709\u5B8C\u6210\uFF0C\u91CD\u65B0\u8FD0\u884C\u4F1A\u521B\u5EFA\u65B0\u7684\u4E0A\u4F20\u4F1A\u8BDD\u3002`,
    { status, action }
  );
}
function refusal(status, action) {
  return status === 401 ? authenticationError(
    "upload_token_refused",
    "\u4E0A\u4F20\u4F1A\u8BDD\u4EE4\u724C\u5DF2\u5931\u6548\uFF08HTTP 401\uFF09\uFF1A\u672C\u6B21\u4E0A\u4F20\u7684\u4F1A\u8BDD\u5DF2\u88AB\u670D\u52A1\u7AEF\u62D2\u7EDD\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C\u3002",
    { status, action }
  ) : businessRejection(
    "upload_rejected",
    `\u8282\u70B9\u62D2\u7EDD\u4E86\u4E0A\u4F20\u8BF7\u6C42\uFF08HTTP ${status}\uFF09\uFF1A${action}`,
    { status, action }
  );
}
async function request(fetchImpl, url, init) {
  try {
    return await fetchImpl(url, { ...init, redirect: "manual" });
  } catch (error) {
    throw init.signal?.aborted === !0 ? init.signal.reason ?? error : error instanceof Error && error.name === "AbortError" ? error : transientError("upload_network_error", `\u4E0A\u4F20\u8FDE\u63A5\u4E2D\u65AD\uFF1A${error instanceof Error ? error.message : String(error)}`, {
      reason: error instanceof Error ? error.name : "Error"
    });
  }
}
async function tusUploadFile(options) {
  let chunkBytes = options.chunkBytes ?? TUS_CHUNK_BYTES, delays = options.retryDelaysMs ?? TUS_RETRY_DELAYS_MS, totalBytes = declaredLength(options.localPath), attempt = 0, backOff = async () => {
    options.signal?.throwIfAborted(), await sleep(delays[attempt + 1] ?? 0, options.signal), attempt += 1;
  }, attemptLoop = async (step) => {
    for (; ; )
      try {
        return await step();
      } catch (error) {
        if (!isCliError(error) || !error.retryable || attempt >= delays.length - 1)
          throw error;
        await backOff();
      }
  }, send = (url, init) => request(options.fetchImpl, url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${options.token()}` }
  }), created = await attemptLoop(async () => {
    let response = await send(options.endpoint, {
      method: "POST",
      headers: {
        "tus-resumable": TUS_VERSION,
        "upload-length": String(totalBytes),
        "upload-metadata": `upload_id ${Buffer.from(options.uploadId, "utf8").toString("base64")},relative_path ${Buffer.from(options.relativePath, "utf8").toString("base64")}`
      },
      signal: options.signal
    });
    if (response.status === 201) {
      let location = response.headers.get("location");
      if (location === null)
        throw businessRejection("upload_protocol_error", "\u8282\u70B9\u521B\u5EFA\u4E0A\u4F20\u8D44\u6E90\u540E\u6CA1\u6709\u8FD4\u56DE\u4F4D\u7F6E\uFF0C\u65E0\u6CD5\u7EE7\u7EED\u4E0A\u4F20\u3002");
      return new URL(location, options.endpoint).toString();
    }
    let status = response.status;
    throw isRetryable(status) ? retryableStatus(status, "\u521B\u5EFA\u4E0A\u4F20\u8D44\u6E90") : refusal(status, "\u521B\u5EFA\u4E0A\u4F20\u8D44\u6E90");
  }), readOffset = async () => {
    let response = await send(created, {
      method: "HEAD",
      headers: { "tus-resumable": TUS_VERSION },
      signal: options.signal
    });
    if (response.status === 200) {
      let offset2 = headerOffset(response);
      return offset2 === null && reject_protocol("\u67E5\u8BE2\u4E0A\u4F20\u504F\u79FB\u6CA1\u6709\u8FD4\u56DE Upload-Offset\u3002"), offset2;
    }
    let status = response.status;
    throw isRetryable(status) ? retryableStatus(status, "\u67E5\u8BE2\u4E0A\u4F20\u504F\u79FB") : refusal(status, "\u67E5\u8BE2\u4E0A\u4F20\u504F\u79FB");
  }, offset = await attemptLoop(readOffset), reported = -1, report = (received) => {
    received !== reported && (reported = received, options.onProgress?.(received));
  };
  report(offset);
  let descriptor = openSync2(options.localPath, "r");
  try {
    for (; offset < totalBytes; ) {
      let length = Math.min(chunkBytes, totalBytes - offset), buffer = Buffer.allocUnsafe(length);
      if (readSync2(descriptor, buffer, 0, length, offset) !== length)
        throw businessRejection("local_file_changed", `\u672C\u5730\u6587\u4EF6\u957F\u5EA6\u4E0E\u590D\u6838\u7ED3\u679C\u4E0D\u4E00\u81F4\uFF1A${options.localPath}`);
      let chunkOffset = offset, confirmed;
      try {
        let response = await send(created, {
          method: "PATCH",
          headers: {
            "tus-resumable": TUS_VERSION,
            "content-type": "application/offset+octet-stream",
            "upload-offset": String(chunkOffset)
          },
          body: buffer,
          signal: options.signal
        });
        if (response.status !== 204) {
          let status = response.status;
          throw isRetryable(status) ? retryableStatus(status, "\u5199\u5165\u4E0A\u4F20\u5206\u7247") : refusal(status, "\u5199\u5165\u4E0A\u4F20\u5206\u7247");
        }
        let reported2 = headerOffset(response);
        reported2 === null && reject_protocol("\u5206\u7247\u4E0A\u4F20\u6CA1\u6709\u8FD4\u56DE Upload-Offset\u3002"), confirmed = reported2;
      } catch (error) {
        if (!isCliError(error) || !error.retryable || attempt >= delays.length - 1)
          throw error;
        await backOff(), offset = await attemptLoop(readOffset), report(offset);
        continue;
      }
      offset = Math.min(Math.max(confirmed, chunkOffset), totalBytes), report(offset);
    }
  } finally {
    closeSync2(descriptor);
  }
  if (offset < totalBytes)
    throw transientError("upload_incomplete", `\u4E0A\u4F20\u672A\u5B8C\u6210\uFF1A\u5DF2\u786E\u8BA4 ${offset}/${totalBytes} \u5B57\u8282\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C\u3002`);
  return { resourceUrl: created, receivedBytes: offset };
}
function reject_protocol(message) {
  throw businessRejection("upload_protocol_error", message);
}

// packages/mycutbuddy-cli/src/commands/material-upload.ts
var PROJECT_HINT3 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", LIBRARY_HINT = "\u7D20\u6750\u5E93\u7C7B\u578B\uFF1Aprimary\u3001talking_head \u6216 voiceover\uFF08\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\uFF09", SUBMISSION_KEY_PATTERN2 = /^[A-Za-z0-9_-]{1,128}$/, PAGE_HEARTBEAT_INTERVAL_MS = 15e3, MAX_CONCURRENT_FILES = 2, COMPLETE_ATTEMPTS = 6, SESSION_POLL_INTERVAL_MS = 3e3, SESSION_POLL_MAX_INTERVAL_MS = 12e3, TERMINAL_SESSION_STATES = ["completed", "failed", "cancelled"];
function asRecord2(value) {
  return value !== null && typeof value == "object" && !Array.isArray(value) ? value : null;
}
function reviewedFiles(value, source) {
  if (!Array.isArray(value))
    throw businessRejection("unexpected_response", `\u670D\u52A1\u7AEF\u590D\u6838\u7ED3\u679C\u7F3A\u5C11${source}\u6E05\u5355\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u4E0A\u4F20\u3002`);
  return value.map((entry) => {
    let record = asRecord2(entry), relativePath = readStringField(record, "relative_path"), originalPath = readStringField(record, "original_relative_path"), sizeBytes = readField(record, "size_bytes");
    if (relativePath === void 0 || originalPath === void 0 || typeof sizeBytes != "number")
      throw businessRejection("unexpected_response", `\u670D\u52A1\u7AEF\u590D\u6838\u7ED3\u679C\u7684${source}\u6761\u76EE\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u4E0A\u4F20\u3002`);
    let reason = readStringField(record, "reason");
    return { relative_path: relativePath, original_relative_path: originalPath, size_bytes: sizeBytes, ...reason === void 0 ? {} : { reason } };
  });
}
function startLease(context, projectId, uploadId, pageId, lease, abort) {
  let renew = async () => {
    try {
      let response = await context.client.request({
        route: "material.upload.heartbeat",
        params: { projectId, uploadId },
        body: { page_id: pageId }
      }), rotated = readStringField(response.body, "token");
      rotated !== void 0 && (lease.token = rotated);
    } catch (error) {
      if (isCliError(error) && error.kind === "transient")
        return;
      lease.failure = error, abort.abort(error);
    }
  };
  lease.timer = setInterval(() => {
    renew();
  }, PAGE_HEARTBEAT_INTERVAL_MS), lease.timer.unref?.();
}
function sleep2(ms, signal) {
  if (signal?.aborted === !0)
    return Promise.resolve();
  let { promise, resolve: resolve4 } = Promise.withResolvers(), timer, finish = () => {
    clearTimeout(timer), signal?.removeEventListener("abort", finish), resolve4();
  };
  return timer = setTimeout(finish, ms), signal?.addEventListener("abort", finish, { once: !0 }), promise;
}
async function requestSeal(context, projectId, uploadId, pageId, signal) {
  for (let attempt = 0; attempt < COMPLETE_ATTEMPTS; attempt += 1) {
    signal.throwIfAborted();
    try {
      await context.client.request({
        route: "material.upload.complete",
        params: { projectId, uploadId },
        body: { page_id: pageId }
      });
      return;
    } catch (error) {
      if (!(isCliError(error) && error.kind === "transient" && attempt < COMPLETE_ATTEMPTS - 1))
        throw error;
      context.progress({ event: "seal_retrying", upload_id: uploadId, attempt: attempt + 1 }), await sleep2(TUS_RETRY_DELAYS_MS[Math.min(attempt + 1, TUS_RETRY_DELAYS_MS.length - 1)], signal);
    }
  }
}
async function awaitTerminalSession(context, projectId, uploadId, abort) {
  let interval = SESSION_POLL_INTERVAL_MS, reportedState = null;
  for (; ; ) {
    abort.signal.throwIfAborted();
    let summary = null, state;
    try {
      let response = await context.client.request({
        route: "material.upload.get",
        params: { projectId, uploadId }
      });
      summary = asRecord2(response.body) ?? {}, state = readStringField(summary, "state");
    } catch (error) {
      if (!(isCliError(error) && error.kind === "transient"))
        throw error;
    }
    if (summary !== null) {
      if (state !== void 0 && TERMINAL_SESSION_STATES.includes(state))
        return summary;
      state !== reportedState && (reportedState = state ?? null, context.progress({ event: "session_waiting", upload_id: uploadId, state: state ?? null })), interval = SESSION_POLL_INTERVAL_MS;
    } else
      context.progress({ event: "session_poll_retrying", upload_id: uploadId, retry_in_ms: interval }), interval = Math.min(interval * 2, SESSION_POLL_MAX_INTERVAL_MS);
    await sleep2(interval, abort.signal);
  }
}
async function terminateSession(context, projectId, uploadId, pageId, warnUnconfirmed) {
  try {
    let response = await context.client.request({
      route: "material.upload.terminate",
      params: { projectId, uploadId },
      body: { page_id: pageId, reason: "owner_cancel" }
    }), state = readStringField(response.body, "state");
    context.progress({ event: "session_closed", upload_id: uploadId, state: state ?? null });
  } catch (error) {
    if (!warnUnconfirmed)
      return;
    context.warnings.push({
      code: "upload_terminate_unconfirmed",
      message: `\u5DF2\u8BF7\u6C42\u7EC8\u6B62\u672C\u6B21\u4E0A\u4F20\u4F1A\u8BDD\uFF0C\u4F46\u7AD9\u70B9\u6CA1\u6709\u786E\u8BA4\uFF08${error instanceof Error ? error.message : String(error)}\uFF09\uFF1B\u4F1A\u8BDD\u4F1A\u5728 60 \u79D2\u79DF\u7EA6\u5230\u671F\u540E\u88AB\u81EA\u52A8\u6536\u5C3E\u3002`
    });
  }
}
async function runMaterialUpload(context) {
  let projectId = requiredStringOption(context.values, "project", PROJECT_HINT3), library = requiredEnumOption(context.values, "library", MATERIAL_LIBRARY_TYPES, LIBRARY_HINT), targetDirectory = optionString(context.values, "target-directory") ?? ".", manifest = collectLocalManifest(optionStrings(context.values, "path"), context.cwd), explicitKey = optionString(context.values, "submission-key");
  if (explicitKey !== void 0 && !SUBMISSION_KEY_PATTERN2.test(explicitKey))
    throw localInputError("invalid_arguments", "--submission-key \u53EA\u5141\u8BB8 1..128 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\u3002");
  let facts = await context.client.request({
    route: "material.directory",
    params: { projectId },
    query: { library_type: library }
  }), preview = await context.client.request({
    route: "material.upload.preview",
    params: { projectId },
    body: {
      library_type: library,
      target_directory: targetDirectory,
      directory_contract_version: MATERIAL_IMPORT_DIRECTORY_CONTRACT_VERSION,
      selection: manifest.selection,
      files: manifest.files.map((file) => ({ relative_path: file.relative_path, size_bytes: file.size_bytes }))
    }
  }), accepted = reviewedFiles(readField(preview.body, "accepted_files"), "\u63A5\u53D7"), excluded = reviewedFiles(readField(preview.body, "excluded_files"), "\u6392\u9664"), noticeVersion = readStringField(preview.body, "notice_version"), directoryContract = readStringField(preview.body, "directory_contract_version") ?? MATERIAL_IMPORT_DIRECTORY_CONTRACT_VERSION, acceptedBytes = readField(preview.body, "accepted_bytes"), resolvedTarget = readStringField(preview.body, "target_directory") ?? targetDirectory;
  if (context.progress({
    event: "upload_review",
    library_type: library,
    target_directory: resolvedTarget,
    upload_enabled: readField(preview.body, "upload_enabled") === !0,
    accepted_files: accepted.map((file) => ({ relative_path: file.relative_path, size_bytes: file.size_bytes })),
    excluded_files: excluded,
    accepted_bytes: acceptedBytes ?? null,
    excluded_bytes: readField(preview.body, "excluded_bytes") ?? null,
    session_limit_bytes: readField(preview.body, "session_limit_bytes") ?? null,
    single_file_limit_bytes: readField(preview.body, "single_file_limit_bytes") ?? null,
    notice_version: noticeVersion ?? null,
    credit_balance: readField(facts.body, "credit_balance") ?? null
  }), readField(preview.body, "upload_enabled") !== !0)
    throw businessRejection(
      "upload_unavailable",
      "\u5F53\u524D\u7AD9\u70B9\u6216\u8282\u70B9\u6682\u65F6\u65E0\u6CD5\u63A5\u6536\u76F4\u4F20\uFF0C\u8BF7\u6539\u7528\u7F51\u76D8\u5BFC\u5165\u3002",
      { disabled_reason: readField(preview.body, "disabled_reason") ?? null }
    );
  if (accepted.length === 0)
    throw localInputError(
      "nothing_to_upload",
      "\u670D\u52A1\u7AEF\u590D\u6838\u540E\u6CA1\u6709\u53EF\u4E0A\u4F20\u7684\u53D7\u652F\u6301\u7D20\u6750\uFF1A\u8BF7\u6309\u6392\u9664\u6E05\u5355\u8C03\u6574\u540E\u91CD\u65B0\u8FD0\u884C\u3002",
      { excluded_files: excluded }
    );
  if (!optionFlag(context.values, "confirm-charge"))
    throw localInputError(
      "charge_confirmation_required",
      "\u76F4\u4F20\u5728\u8282\u70B9\u5C01\u5B58\u771F\u5B9E\u6587\u4EF6\u540E\u4F1A\u6309\u5BFC\u5165\u516C\u5F0F\u81EA\u52A8\u8BA1\u8D39\uFF1A\u8BF7\u5148\u4E0E\u7528\u6237\u786E\u8BA4\uFF0C\u518D\u7528 --confirm-charge \u660E\u786E\u786E\u8BA4\u672C\u6B21\u4E0A\u4F20\u3002"
    );
  if (noticeVersion === void 0)
    throw businessRejection("notice_version_missing", "\u670D\u52A1\u7AEF\u590D\u6838\u6CA1\u6709\u8FD4\u56DE\u8BA1\u8D39\u63D0\u793A\u7248\u672C\uFF0C\u4E0D\u80FD\u63D0\u4EA4\u53D7\u7406\u8BF7\u6C42\u3002");
  let localByOriginal = new Map(manifest.files.map((file) => [file.relative_path, file]));
  for (let file of accepted) {
    let local = localByOriginal.get(file.original_relative_path);
    if (local === void 0 || local.size_bytes !== file.size_bytes)
      throw businessRejection(
        "local_file_changed",
        `\u672C\u5730\u6587\u4EF6\u4E0E\u590D\u6838\u6E05\u5355\u4E0D\u4E00\u81F4\uFF1A${file.original_relative_path}\u3002\u8BF7\u91CD\u65B0\u8FD0\u884C\u3002`,
        { relative_path: file.original_relative_path }
      );
  }
  let submissionKey = explicitKey ?? randomUUID2(), pageId = randomUUID2(), abort = new AbortController(), interrupted = !1, onSignal = () => {
    interrupted || (interrupted = !0, abort.abort(businessRejection("upload_interrupted", "\u672C\u6B21\u4E0A\u4F20\u5DF2\u88AB\u4E2D\u65AD\uFF0C\u6B63\u5728\u7EC8\u6B62\u4E0A\u4F20\u4F1A\u8BDD\u3002")));
  };
  process.on("SIGINT", onSignal), process.on("SIGTERM", onSignal);
  let uploadId, lease = null, sealed = !1, terminalState = null;
  try {
    let admission = await context.client.request({
      route: "material.upload.admit",
      params: { projectId },
      body: {
        submission_key: submissionKey,
        notice_version: noticeVersion,
        library_type: library,
        target_directory: resolvedTarget,
        directory_contract_version: directoryContract,
        selection: manifest.selection,
        // The admission revalidates the physical selection, exactly like the web panel: the reviewed
        // content paths below the root belong to the tus metadata, not to this list.
        files: accepted.map((file) => ({ relative_path: file.original_relative_path, size_bytes: file.size_bytes })),
        page_id: pageId
      }
    });
    uploadId = readStringField(admission.body, "upload_id");
    let sessionToken = readStringField(admission.body, "token"), tusUrl = readStringField(admission.body, "tus_url");
    if (uploadId === void 0 || sessionToken === void 0 || tusUrl === void 0)
      throw businessRejection(
        "upload_not_writable",
        "\u53D7\u7406\u8BF7\u6C42\u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u7684\u4E0A\u4F20\u4F1A\u8BDD\uFF1A\u8BE5\u4F1A\u8BDD\u53EF\u80FD\u5DF2\u7ECF\u5C01\u5B58\u6216\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C\u3002",
        { upload_id: uploadId ?? null }
      );
    let sessionId = uploadId;
    abort.signal.throwIfAborted(), context.progress({
      event: "session_admitted",
      upload_id: sessionId,
      request_id: readStringField(admission.body, "request_id") ?? null,
      replayed: readField(admission.body, "replayed") === !0,
      accepted_bytes: acceptedBytes ?? null
    });
    let tusEndpoint = new URL(tusUrl, context.site).toString(), sessionLease = { token: sessionToken, failure: null, timer: null };
    lease = sessionLease;
    let receivedByPath = /* @__PURE__ */ new Map(), pending = [...accepted], totalAcceptedBytes = accepted.reduce((total, file) => total + file.size_bytes, 0), reportProgress = () => {
      let received = [...receivedByPath.values()].reduce((total, bytes) => total + bytes, 0);
      context.progress({
        event: "upload_progress",
        upload_id: sessionId,
        received_bytes: received,
        total_bytes: totalAcceptedBytes,
        files: accepted.map((file) => ({
          relative_path: file.relative_path,
          size_bytes: file.size_bytes,
          received_bytes: receivedByPath.get(file.relative_path) ?? 0
        }))
      });
    };
    startLease(context, projectId, sessionId, pageId, sessionLease, abort);
    let worker = async () => {
      try {
        for (; ; ) {
          if (abort.signal.aborted)
            return;
          let file = pending.shift();
          if (file === void 0)
            return;
          let local = localByOriginal.get(file.original_relative_path), result = await tusUploadFile({
            endpoint: tusEndpoint,
            uploadId: sessionId,
            relativePath: file.relative_path,
            localPath: local.absolute_path,
            fetchImpl: context.fetchImpl,
            token: () => sessionLease.token,
            signal: abort.signal,
            onProgress: (receivedBytes) => {
              receivedByPath.set(file.relative_path, Math.min(receivedBytes, file.size_bytes)), reportProgress();
            }
          });
          receivedByPath.set(file.relative_path, Math.min(result.receivedBytes, file.size_bytes)), reportProgress();
        }
      } catch (error) {
        throw abort.abort(error), error;
      }
    }, outcomes = await Promise.allSettled(
      Array.from({ length: Math.min(MAX_CONCURRENT_FILES, pending.length) }, () => worker())
    );
    if (interrupted && abort.signal.throwIfAborted(), sessionLease.failure !== null)
      throw sessionLease.failure;
    let rejected = outcomes.find((outcome) => outcome.status === "rejected");
    if (rejected !== void 0)
      throw rejected.reason;
    await requestSeal(context, projectId, sessionId, pageId, abort.signal), sealed = !0;
    let body = await awaitTerminalSession(context, projectId, sessionId, abort);
    if (terminalState = readStringField(body, "state") ?? null, terminalState === "failed") {
      let failureSummary = readStringField(body, "failure_summary");
      throw businessRejection(
        "upload_failed",
        `\u670D\u52A1\u7AEF\u5224\u5B9A\u672C\u6B21\u4E0A\u4F20\u5931\u8D25\uFF1A${failureSummary ?? "\u672A\u63D0\u4F9B\u539F\u56E0"}\u3002\u672A\u5B8C\u6210\u7684\u6587\u4EF6\u4F1A\u88AB\u6E05\u7406\uFF0C\u672A\u63D0\u4EA4\u7684\u6D88\u8D39\u6309\u65E2\u6709\u89C4\u5219\u8FD4\u8FD8\u3002`,
        {
          upload_id: sessionId,
          request_id: body.request_id ?? null,
          state: terminalState,
          cleanup_status: body.cleanup_status ?? null,
          failure_summary: failureSummary ?? null
        }
      );
    }
    if (terminalState !== "completed")
      throw businessRejection(
        "upload_cancelled",
        "\u670D\u52A1\u7AEF\u5DF2\u53D6\u6D88\u672C\u6B21\u4E0A\u4F20\u4F1A\u8BDD\u5E76\u505C\u6B62\u5199\u5165\uFF0C\u7D20\u6750\u6CA1\u6709\u5165\u5E93\uFF1B\u91CD\u65B0\u8FD0\u884C\u4F1A\u521B\u5EFA\u65B0\u7684\u4E0A\u4F20\u4F1A\u8BDD\u3002",
        {
          upload_id: sessionId,
          request_id: body.request_id ?? null,
          state: terminalState,
          cleanup_status: body.cleanup_status ?? null
        }
      );
    if (interrupted)
      throw businessRejection("upload_interrupted", "\u672C\u6B21\u8FD0\u884C\u5728\u4E0A\u4F20\u5B8C\u6210\u540E\u88AB\u4E2D\u65AD\u3002");
    return {
      upload_id: sessionId,
      request_id: body.request_id ?? null,
      library_type: library,
      target_directory: body.target_directory ?? resolvedTarget,
      directory_contract_version: body.directory_contract_version ?? directoryContract,
      state: body.state ?? null,
      accepted_bytes: body.accepted_bytes ?? acceptedBytes ?? null,
      received_bytes: body.received_bytes ?? null,
      session_limit_bytes: body.session_limit_bytes ?? null,
      single_file_limit_bytes: body.single_file_limit_bytes ?? null,
      files: body.files ?? null,
      excluded_files: body.excluded_files ?? excluded,
      cleanup_status: body.cleanup_status ?? null,
      failure_summary: body.failure_summary ?? null,
      credit_cost: body.credit_cost ?? null,
      submission_key: submissionKey,
      submission_key_source: explicitKey === void 0 ? "run" : "explicit",
      replayed: readField(admission.body, "replayed") === !0
    };
  } catch (error) {
    throw interrupted ? businessRejection(
      "upload_interrupted",
      terminalState === "completed" ? "\u672C\u6B21\u8FD0\u884C\u5728\u670D\u52A1\u7AEF\u786E\u8BA4\u4E0A\u4F20\u5B8C\u6210\u4E4B\u540E\u88AB\u4E2D\u65AD\uFF1A\u7D20\u6750\u5DF2\u63D0\u4EA4\u5E76\u4FDD\u7559\uFF0C\u8BF7\u7528 request.watch \u4E0E\u7D20\u6750\u76EE\u5F55\u6838\u5BF9\u7ED3\u679C\u3002" : sealed ? "\u672C\u6B21\u4E0A\u4F20\u5DF2\u5C01\u5B58\u4F46\u8FD8\u6CA1\u6709\u786E\u8BA4\u7EC8\u6001\uFF0C\u5DF2\u8BF7\u6C42\u7EC8\u6B62\u4E0A\u4F20\u4F1A\u8BDD\uFF1B\u5DF2\u63D0\u4EA4\u7684\u7D20\u6750\u4E0D\u4F1A\u56E0\u6B64\u88AB\u5220\u9664\uFF0C\u8BF7\u7528 request.watch \u6838\u5BF9\u6700\u7EC8\u7ED3\u679C\u3002" : uploadId === void 0 ? "\u672C\u6B21\u4E0A\u4F20\u5DF2\u88AB\u4E2D\u65AD\uFF0C\u53D7\u7406\u8BF7\u6C42\u6CA1\u6709\u5F97\u5230\u786E\u8BA4\uFF1B\u82E5\u7AD9\u70B9\u5DF2\u53D7\u7406\uFF0C\u8BE5\u4F1A\u8BDD\u4F1A\u5728 60 \u79D2\u79DF\u7EA6\u5230\u671F\u540E\u81EA\u52A8\u6536\u5C3E\u3002" : "\u672C\u6B21\u4E0A\u4F20\u5DF2\u88AB\u4E2D\u65AD\uFF0C\u6B63\u5728\u7EC8\u6B62\u4E0A\u4F20\u4F1A\u8BDD\uFF1B\u5DF2\u786E\u8BA4\u7684\u5B57\u8282\u4E0D\u4F1A\u5165\u5E93\uFF0C\u91CD\u65B0\u8FD0\u884C\u4F1A\u521B\u5EFA\u65B0\u7684\u4E0A\u4F20\u4F1A\u8BDD\u3002",
      { upload_id: uploadId ?? null, state: terminalState, sealed }
    ) : !isCliError(error) && lease !== null && lease.failure !== null ? lease.failure : error;
  } finally {
    lease !== null && clearInterval(lease.timer ?? void 0), uploadId !== void 0 && await terminateSession(context, projectId, uploadId, pageId, terminalState === null), process.removeListener("SIGINT", onSignal), process.removeListener("SIGTERM", onSignal);
  }
}
var materialUploadCommands = [
  {
    id: "material.upload",
    summary: "\u628A\u672C\u5730\u6587\u4EF6\u6216\u76EE\u5F55\u76F4\u63A5\u4E0A\u4F20\u5230\u67D0\u4E2A\u7D20\u6750\u5E93\uFF08\u5C01\u5B58\u540E\u81EA\u52A8\u8BA1\u8D39\uFF0C\u9700\u8981\u663E\u5F0F\u786E\u8BA4\uFF09",
    usage: "material.upload --project <\u9879\u76EE ID> --library primary|talking_head|voiceover --path <\u672C\u5730\u6587\u4EF6\u6216\u76EE\u5F55> [--path ...] [--target-directory <\u5E93\u5185\u76EE\u5F55>] [--submission-key <\u5E42\u7B49\u952E>] --confirm-charge",
    options: {
      ...PROJECT_OPTION,
      ...LIBRARY_OPTION,
      path: { type: "string", multiple: !0 },
      "target-directory": { type: "string" },
      "submission-key": { type: "string" },
      "confirm-charge": { type: "boolean" }
    },
    needsCredential: !0,
    chargeable: !0,
    async run(context) {
      return runMaterialUpload(context);
    },
    help: {
      note: "\u4E00\u6B21\u8FD0\u884C\u5C31\u662F\u4E00\u4E2A\u4E0A\u4F20\u4F1A\u8BDD\uFF1A\u4E2D\u65AD\u3001\u6743\u5A01\u62D2\u7EDD\u6216\u8FDB\u7A0B\u7ED3\u675F\u65F6\u5C3D\u529B\u7EC8\u6B62\uFF0C\u4E0D\u8DE8\u8FD0\u884C\u7EED\u4F20\uFF1B\u91CD\u8DD1\u662F\u65B0\u4F1A\u8BDD\u3002\u76EE\u5F55\u4FDD\u7559\u5B50\u76EE\u5F55\u5C42\u7EA7\uFF0C\u767D\u540D\u5355\u5916\u6587\u4EF6\u7531\u670D\u52A1\u7AEF\u5217\u4E3A\u6392\u9664\u9879\u3002",
      options: {
        path: "\u672C\u5730\u6587\u4EF6\u6216\u76EE\u5F55\uFF1B\u53EF\u91CD\u590D\u51FA\u73B0\uFF0C\u76EE\u5F55\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\u4FDD\u7559\u5B50\u76EE\u5F55\u5C42\u7EA7\u3002",
        "target-directory": "\u7D20\u6750\u5E93\u5185\u7684\u76EE\u6807\u76EE\u5F55\uFF0C\u9ED8\u8BA4 .\uFF08\u5E93\u6839\uFF09\uFF1B\u5FC5\u987B\u662F\u670D\u52A1\u7AEF\u63A5\u53D7\u7684\u5E93\u91CC\u5DF2\u6709\u76EE\u5F55\u3002"
      },
      next: ["request.watch --project <\u9879\u76EE ID> --request <request_id>", "material.directory --project <\u9879\u76EE ID> --library <\u5E93\u7C7B\u578B>"]
    }
  }
];

// packages/mycutbuddy-cli/src/commands/material.ts
var PROJECT_HINT4 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", LIBRARY_HINT2 = "\u7D20\u6750\u5E93\u7C7B\u578B\uFF1Aprimary\u3001talking_head \u6216 voiceover\uFF08\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\uFF09", materialCommands = [
  {
    id: "material.directory",
    summary: "\u67E5\u8BE2\u67D0\u4E2A\u7D20\u6750\u5E93\u7684\u7BA1\u7406\u76EE\u5F55\uFF08\u542B\u9501\u5B9A\u72B6\u6001\u4E0E\u63D0\u793A\u7248\u672C\uFF09",
    usage: "material.directory --project <\u9879\u76EE ID> --library primary|talking_head|voiceover [--task <\u4EFB\u52A1 ID>]",
    options: { ...PROJECT_OPTION, ...LIBRARY_OPTION, task: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT4), library = requiredEnumOption(context.values, "library", MATERIAL_LIBRARY_TYPES, LIBRARY_HINT2), taskId = optionString(context.values, "task");
      return (await context.client.request({
        route: "material.directory",
        params: { projectId },
        query: { library_type: library, task_id: taskId }
      })).body;
    }
  },
  {
    id: "material.manage",
    summary: "\u4FDD\u5B58\u7D20\u6750\u5E93\u7BA1\u7406\u64CD\u4F5C\uFF08\u521B\u5EFA/\u6539\u540D/\u79FB\u52A8/\u5220\u9664\u76EE\u5F55\u4E0E\u7D20\u6750\u3001\u66F4\u65B0\u5C5E\u6027\uFF09",
    usage: `material.manage --project <\u9879\u76EE ID> --library primary|talking_head|voiceover --input '{"operations":[...]}'`,
    options: { ...PROJECT_OPTION, ...LIBRARY_OPTION, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT4), library = requiredEnumOption(context.values, "library", MATERIAL_LIBRARY_TYPES, LIBRARY_HINT2), payload = readOperationsPayload(context.values, library);
      return (await context.client.request({
        route: "material.manage",
        params: { projectId },
        body: { ...payload, library_type: library }
      })).body;
    },
    help: {
      note: "\u64CD\u4F5C\u6309\u6570\u7EC4\u987A\u5E8F\u89E3\u91CA\uFF1B201 \u53EA\u8868\u793A\u5DF2\u6392\u961F\uFF0C\u5FC5\u987B\u7528 material.directory --task <task_id> \u8BFB\u53D6\u4FDD\u5B58\u7ED3\u679C\u3002",
      fields: [
        { key: "operations", required: !0, type: "array", description: "\u975E\u7A7A\u64CD\u4F5C\u6570\u7EC4\uFF1Bkind \u53EF\u4E3A create_directory\u3001rename_directory\u3001move_directory\u3001delete_directory\u3001set_directory_description\u3001rename_material\u3001move_material\u3001delete_material\u3001update_material_attributes\u3002" }
      ],
      example: {
        operations: [
          { kind: "create_directory", path: "\u4EA7\u54C1" },
          { kind: "set_directory_description", path: "\u4EA7\u54C1", material_description: "\u4EA7\u54C1\u5916\u89C2\u4E0E\u4F7F\u7528\u573A\u666F" }
        ]
      },
      next: ["material.directory --project <\u9879\u76EE ID> --library <\u5E93\u7C7B\u578B> --task <task_id>"]
    }
  },
  {
    id: "material.import-failure.dismiss",
    summary: "\u5FFD\u7565\u67D0\u4E2A\u7D20\u6750\u5E93\u7684\u5BFC\u5165\u5931\u8D25\u63D0\u793A",
    usage: "material.import-failure.dismiss --project <\u9879\u76EE ID> --library primary|talking_head|voiceover --operation <\u5BFC\u5165\u64CD\u4F5C ID>",
    options: { ...PROJECT_OPTION, ...LIBRARY_OPTION, operation: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT4), library = requiredEnumOption(context.values, "library", MATERIAL_LIBRARY_TYPES, LIBRARY_HINT2), operationId = requiredStringOption(context.values, "operation", "\u5BFC\u5165\u64CD\u4F5C ID\uFF08import_operation.operation_id\uFF09");
      return (await context.client.request({
        route: "material.import-failure.dismiss",
        params: { projectId },
        query: { library_type: library },
        body: { operation_id: operationId }
      })).body;
    }
  },
  {
    id: "material.import.submit",
    summary: "\u63D0\u4EA4\u7D20\u6750\u5BFC\u5165\uFF08\u6536\u8D39\uFF0C\u9700\u8981\u663E\u5F0F\u786E\u8BA4\uFF09",
    usage: "material.import.submit --project <\u9879\u76EE ID> [--submission-key <\u5E42\u7B49\u952E>] [--notice-version <\u63D0\u793A\u7248\u672C>] --confirm-charge --input '{...}'",
    options: { ...PROJECT_OPTION, ...CHARGE_OPTIONS, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !0,
    async run(context) {
      return submitChargeableWork(context, "material.import.submit", "material_import");
    },
    help: {
      note: "\u5206\u4EAB\u94FE\u63A5\u5FC5\u987B\u662F pan.baidu.com \u7684 /s/ \u6216 /e/ \u94FE\u63A5\uFF1B\u5BFC\u5165\u662F\u5408\u5E76\u6DFB\u52A0\u3002\u7701\u7565 --notice-version / --submission-key \u65F6\u7531 CLI \u81EA\u52A8\u5904\u7406\u3002",
      fields: [
        { key: "library_type", required: !0, type: "enum", values: MATERIAL_LIBRARY_TYPES, description: "\u76EE\u6807\u7D20\u6750\u5E93\u3002" },
        { key: "share_url", required: !0, type: "string", description: "\u767E\u5EA6\u7F51\u76D8\u5206\u4EAB\u94FE\u63A5\u3002" },
        { key: "extraction_code", type: "string", description: "\u63D0\u53D6\u7801\uFF1B\u94FE\u63A5\u81EA\u5E26 pwd \u65F6\u53EF\u7701\u7565\u3002" },
        { key: "target_directory", type: "string", description: "\u5E93\u5185\u76EE\u6807\u76EE\u5F55\uFF1B\u7701\u7565\u6216\u4F20 . \u8868\u793A\u5E93\u6839\uFF0C\u5FC5\u987B\u662F\u5DF2\u63D0\u4EA4\u4E14\u5B58\u5728\u7684\u76EE\u5F55\u3002" }
      ],
      example: {
        library_type: "primary",
        share_url: "https://pan.baidu.com/s/...",
        extraction_code: "abcd"
      },
      next: ["request.watch --project <\u9879\u76EE ID> --request <request_id>"]
    }
  },
  {
    id: "material.index.submit",
    summary: "\u63D0\u4EA4\u7D20\u6750\u7D22\u5F15\u6216\u4E3B\u7D20\u6750\u5E93\u300C\u5904\u7406\u5E76\u7D22\u5F15\u300D\uFF08\u6536\u8D39\uFF0C\u9700\u8981\u663E\u5F0F\u786E\u8BA4\uFF09",
    usage: "material.index.submit --project <\u9879\u76EE ID> [--submission-key <\u5E42\u7B49\u952E>] [--notice-version <\u63D0\u793A\u7248\u672C>] --confirm-charge --input '{...}'",
    options: { ...PROJECT_OPTION, ...CHARGE_OPTIONS, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !0,
    async run(context) {
      return submitChargeableWork(context, "material.index.submit", "material_index");
    },
    help: {
      note: "\u53EA\u6709 primary \u548C talking_head \u53EF\u4EE5\u7D22\u5F15\uFF1Bvoiceover \u6CA1\u6709\u7D22\u5F15\u5165\u53E3\u3002\u4E3B\u7D20\u6750\u5E93\u5B58\u5728\u672A\u5904\u7406\u89C6\u9891\u65F6\u5FC5\u987B\u663E\u5F0F\u9009\u62E9 shot_mode\uFF0C\u4E00\u6B21\u786E\u8BA4\u540C\u65F6\u6388\u6743\u5206\u5272\u548C\u968F\u540E\u7684\u7D22\u5F15\uFF1B\u6CA1\u6709\u672A\u5904\u7406\u89C6\u9891\u65F6\u53EA\u4F20 library_type\uFF0C\u8FD9\u4E5F\u662F\u7D22\u5F15\u79EF\u5206\u4E0D\u8DB3\u6682\u505C\u540E\u7684\u300C\u7EE7\u7EED\u7D22\u5F15\u300D\u5165\u53E3\uFF08\u4E0D\u8981\u91CD\u4F20 shot_mode\uFF09\u3002\u4EBA\u7269\u53E3\u64AD\u5E93\u53EA\u80FD\u7D22\u5F15\uFF0C\u4E0D\u63A5\u53D7 shot_mode \u548C additional_prompt\u3002\u670D\u52A1\u7AEF\u6309\u771F\u5B9E\u65F6\u957F\u4E0E\u53EF\u7D22\u5F15\u7D20\u6750\u6838\u4EF7\uFF0CCLI \u4E0D\u8BA1\u7B97\u4EF7\u683C\u6216\u5DEE\u989D\u3002",
      fields: [
        { key: "library_type", required: !0, type: "enum", values: MATERIAL_LIBRARY_TYPES, description: "\u8981\u7D22\u5F15\u7684\u7D20\u6750\u5E93\u3002" },
        { key: "shot_mode", type: "enum", values: MATERIAL_SHOT_MODES, description: "\u4EC5 primary\uFF1Asingle \u4E3A\u8FDE\u7EED\u62CD\u6444\u4E0D\u5206\u6790\u4E0D\u88C1\u526A\uFF0Cmulti \u4E3A\u540C\u4E00\u6587\u4EF6\u5305\u542B\u591A\u4E2A\u955C\u5934\uFF0Cmixed \u7531\u8282\u70B9\u5148\u514D\u8D39\u5206\u7C7B\u518D\u53EA\u5206\u5272\u591A\u955C\u5934/\u957F\u955C\u5934\u3002" },
        { key: "additional_prompt", type: "string", description: "\u4EC5\u4E0E shot_mode \u4E00\u8D77\u4F7F\u7528\uFF0C\u8BF4\u660E\u672C\u6B21\u8981\u4FDD\u7559\u6216\u53BB\u9664\u7684\u753B\u9762\uFF1B\u6CA1\u6709\u7279\u6B8A\u8981\u6C42\u8BF7\u7701\u7565\u6216\u7559\u7A7A\u3002" }
      ],
      example: { library_type: "primary", shot_mode: "mixed", additional_prompt: "\u53BB\u9664\u6240\u6709\u4EBA\u7269\u53E3\u64AD\u753B\u9762\uFF0C\u53EA\u4FDD\u7559\u4EA7\u54C1\u753B\u9762" },
      next: ["request.watch --project <\u9879\u76EE ID> --request <request_id>"]
    }
  },
  ...materialUploadCommands
];
function readOperationsPayload(values, library) {
  let payload = readPayload(values, { required: !0, hint: '{ "operations": [...] }' }), operations = payload.operations;
  if (!Array.isArray(operations) || operations.length === 0)
    throw localInputError("invalid_payload", "input.operations \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002");
  let declared = payload.library_type;
  if (declared !== void 0 && declared !== library)
    throw localInputError("library_mismatch", "--input \u4E2D\u7684 library_type \u4E0E --library \u4E0D\u4E00\u81F4\uFF0C\u8BF7\u53EA\u4FDD\u7559\u4E00\u5904\u3002");
  return payload;
}

// packages/mycutbuddy-cli/src/core/identity.ts
function rethrowWithIdentity(error, identity) {
  throw isCliError(error) && error.kind === "transient" ? new CliError("transient", error.code, error.message, {
    retryable: !0,
    details: {
      ...error.details,
      ...identity,
      replay_hint: "\u7528\u76F8\u540C\u7684\u4E1A\u52A1\u8EAB\u4EFD\u4E0E\u76F8\u540C\u8F93\u5165\u91CD\u653E\uFF0C\u5373\u53EF\u590D\u7528\u540C\u4E00\u6B21\u670D\u52A1\u7AEF\u64CD\u4F5C\u3002"
    }
  }) : error;
}

// packages/mycutbuddy-cli/src/commands/preset.ts
var PROJECT_HINT5 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", STYLE_HINT = "\u526A\u8F91\u98CE\u683C ID\uFF0C\u6765\u81EA preset.style.list \u7684\u8FD4\u56DE\u503C", IMPORT_HINT = "\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165 ID\uFF0C\u6765\u81EA preset.style.import.submit \u7684\u8FD4\u56DE\u503C", presetCommands = [
  {
    id: "preset.style.list",
    summary: "\u5217\u51FA\u67D0\u4E2A\u526A\u8F91\u5F62\u5F0F\u76EE\u5F55\u4E0B\u7684\u526A\u8F91\u98CE\u683C\uFF08\u542B\u7CFB\u7EDF\u4E0E\u4E2A\u4EBA\uFF09",
    usage: "preset.style.list --project <\u9879\u76EE ID> [--form narration|talking_head_segment|talking_head_full]",
    options: { ...PROJECT_OPTION, form: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), form = optionEnum(context.values, "form", EDITING_FORMS);
      return (await context.client.request({
        route: "preset.style.list",
        params: { projectId },
        query: { style_category: form }
      })).body;
    }
  },
  {
    id: "preset.style.get",
    summary: "\u67E5\u8BE2\u5355\u4E2A\u526A\u8F91\u98CE\u683C\u7684\u5B8C\u6574\u914D\u7F6E",
    usage: "preset.style.get --project <\u9879\u76EE ID> --style <\u98CE\u683C ID> [--form <\u526A\u8F91\u5F62\u5F0F>]",
    options: { ...PROJECT_OPTION, style: { type: "string" }, form: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetId = requiredStringOption(context.values, "style", STYLE_HINT), form = optionEnum(context.values, "form", EDITING_FORMS);
      return (await context.client.request({
        route: "preset.style.get",
        params: { projectId, presetId },
        query: { style_category: form }
      })).body;
    }
  },
  {
    id: "preset.style.create",
    summary: "\u4FDD\u5B58\u4E2A\u4EBA\u526A\u8F91\u98CE\u683C\uFF08\u540C\u540D\u8986\u76D6\u9700\u8981 --input \u4E2D overwrite \u4E3A true\uFF09",
    usage: `preset.style.create --project <\u9879\u76EE ID> --input '{"name":"...","style_category":"narration",...}'`,
    options: { ...PROJECT_OPTION, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), payload = readPayload(context.values, { required: !0, hint: "\u526A\u8F91\u98CE\u683C\u5B57\u6BB5" });
      return (await context.client.request({
        route: "preset.style.create",
        params: { projectId },
        body: payload
      })).body;
    },
    help: {
      note: "\u4FDD\u5B58\u4E2A\u4EBA\u98CE\u683C\uFF1B\u5148\u8BFB\u53D6\u73B0\u6709\u9884\u8BBE\u5E76\u4FDD\u7559\u5B8C\u6574 public_config\uFF0C\u4E0D\u8981\u53EA\u63D0\u4EA4\u6539\u52A8\u5B57\u6BB5\u3002",
      fields: [
        { key: "name", required: !0, type: "string", description: "\u98CE\u683C\u540D\u79F0\u3002" },
        { key: "style_category", required: !0, type: "enum", values: EDITING_FORMS, description: "\u65C1\u767D\u6216\u53E3\u64AD\u5F62\u5F0F\u3002" },
        { key: "description", type: "string", description: "\u98CE\u683C\u7528\u9014\u8BF4\u660E\u3002" },
        { key: "tags", type: "array", description: "\u6807\u7B7E\u6570\u7EC4\u3002" },
        { key: "public_config", required: !0, type: "object", description: "\u5B8C\u6574\u526A\u8F91\u914D\u7F6E\u3002" },
        { key: "narration_audio_source", type: "enum", values: ["tts", "upload"], description: "\u4EC5\u65C1\u767D\u53EF\u5E26\u3002" },
        { key: "use_primary_overlay", type: "boolean", description: "\u4EC5\u53E3\u64AD\u53EF\u5E26\u3002" },
        { key: "source_preset_id", type: "string", description: "\u4ECE\u54EA\u4E2A\u9884\u8BBE\u590D\u5236\u800C\u6765\u3002" },
        { key: "overwrite", type: "boolean", description: "\u540C\u540D\u8986\u76D6\u5FC5\u987B\u663E\u5F0F\u8BBE\u4E3A true\u3002" }
      ]
    }
  },
  {
    id: "preset.style.update",
    summary: "\u66F4\u65B0\u4E2A\u4EBA\u526A\u8F91\u98CE\u683C",
    usage: "preset.style.update --project <\u9879\u76EE ID> --style <\u98CE\u683C ID> --input '{...}'",
    options: { ...PROJECT_OPTION, style: { type: "string" }, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetId = requiredStringOption(context.values, "style", STYLE_HINT), payload = readPayload(context.values, { required: !0, hint: "\u8981\u4FEE\u6539\u7684\u526A\u8F91\u98CE\u683C\u5B57\u6BB5" });
      return (await context.client.request({
        route: "preset.style.update",
        params: { projectId, presetId },
        body: payload
      })).body;
    },
    help: {
      note: "PATCH \u524D\u5148\u8BFB\u53D6\u5E76\u4FDD\u7559\u539F\u914D\u7F6E\uFF0C\u63D0\u4EA4\u7528\u6237\u8981\u4FDD\u5B58\u7684\u5B8C\u6574\u98CE\u683C\uFF1B\u4E0D\u80FD\u66F4\u6539\u5206\u7C7B\u3002",
      fields: [
        { key: "name", type: "string", description: "\u65B0\u540D\u79F0\u3002" },
        { key: "description", type: "string", description: "\u65B0\u63CF\u8FF0\u3002" },
        { key: "tags", type: "array", description: "\u6807\u7B7E\u6570\u7EC4\u3002" },
        { key: "public_config", type: "object", description: "\u5B8C\u6574\u914D\u7F6E\uFF1B\u672A\u63D0\u4EA4\u7684\u5B57\u6BB5\u4E0D\u4F1A\u88AB\u63A8\u65AD\u3002" }
      ]
    }
  },
  {
    id: "preset.style.archive",
    summary: "\u5F52\u6863\u4E2A\u4EBA\u526A\u8F91\u98CE\u683C\uFF08\u670D\u52A1\u7AEF\u8F6F\u5F52\u6863\uFF0C\u4E0D\u505A\u4E8C\u6B21\u786E\u8BA4\uFF09",
    usage: "preset.style.archive --project <\u9879\u76EE ID> --style <\u98CE\u683C ID>",
    options: { ...PROJECT_OPTION, style: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetId = requiredStringOption(context.values, "style", STYLE_HINT);
      return (await context.client.request({
        route: "preset.style.archive",
        params: { projectId, presetId }
      })).body;
    }
  },
  {
    id: "preset.style.import.list",
    summary: "\u5206\u9875\u5217\u51FA\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165\u8BB0\u5F55",
    usage: "preset.style.import.list --project <\u9879\u76EE ID> [--type dialogue_subtitle_style|global_subtitle_style] [--page 1] [--page-size 20]",
    options: { ...PROJECT_OPTION, type: { type: "string" }, ...PAGINATION_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetType = optionEnum(context.values, "type", PRESET_TYPES), page = optionInteger(context.values, "page", { fallback: 1, minimum: 1, maximum: 1e5 }), pageSize = optionPageSize(context.values);
      return (await context.client.request({
        route: "preset.style.import.list",
        params: { projectId },
        query: { preset_type: presetType, page, pageSize }
      })).body;
    }
  },
  {
    id: "preset.style.import.submit",
    summary: "\u63D0\u4EA4\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165\uFF08\u5206\u4EAB\u94FE\u63A5\u9700\u8981\u8054\u7F51\u89E3\u6790\uFF0C\u5F02\u6B65\u6267\u884C\uFF09",
    usage: `preset.style.import.submit --project <\u9879\u76EE ID> --request-key <\u552F\u4E00\u952E> --input '{"preset_type":"...","share_url":"..."}'`,
    options: { ...PROJECT_OPTION, "request-key": { type: "string" }, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), requestKey = requiredStringOption(
        context.values,
        "request-key",
        "\u672C\u6B21\u5BFC\u5165\u7684\u552F\u4E00\u952E\uFF08\u540C\u952E\u540C\u8F93\u5165\u4F1A\u88AB\u670D\u52A1\u7AEF\u91CD\u653E\uFF09"
      ), payload = readPayload(context.values, { required: !0, hint: "preset_type \u4E0E share_url \u7B49\u5B57\u6BB5" }), payloadType = payload.preset_type;
      if (typeof payloadType != "string" || !PRESET_TYPES.includes(payloadType))
        throw localInputError(
          "invalid_payload",
          `input.preset_type \u53EA\u652F\u6301\uFF1A${PRESET_TYPES.join("\u3001")}\u3002`
        );
      if (payload.request_key !== void 0 && payload.request_key !== requestKey)
        throw localInputError("request_key_mismatch", "--input \u4E2D\u7684 request_key \u4E0E --request-key \u4E0D\u4E00\u81F4\uFF0C\u8BF7\u53EA\u4FDD\u7559\u4E00\u5904\u3002");
      try {
        return (await context.client.request({
          route: "preset.style.import.submit",
          params: { projectId },
          body: { ...payload, project_id: projectId, request_key: requestKey }
        })).body;
      } catch (error) {
        rethrowWithIdentity(error, { request_key: requestKey, project_id: projectId });
      }
    },
    help: {
      note: "\u5206\u4EAB\u94FE\u63A5\u5FC5\u987B\u662F pan.baidu.com \u7684\u771F\u5B9E\u94FE\u63A5\uFF1B\u540C request-key \u540C\u8F93\u5165\u53EF\u91CD\u653E\u3002",
      fields: [
        { key: "preset_type", required: !0, type: "enum", values: PRESET_TYPES, description: "\u5BF9\u8BDD\u5B57\u5E55\u6837\u5F0F\u6216\u5168\u5C40\u5B57\u5E55\u6837\u5F0F\u3002" },
        { key: "share_url", required: !0, type: "string", description: "\u767E\u5EA6\u7F51\u76D8\u5206\u4EAB\u94FE\u63A5\u3002" },
        { key: "extraction_code", type: "string", description: "\u63D0\u53D6\u7801\uFF1B\u94FE\u63A5\u81EA\u5E26 pwd \u65F6\u53EF\u7701\u7565\u3002" }
      ],
      next: ["preset.style.import.get --project <\u9879\u76EE ID> --import <import_id>"]
    }
  },
  {
    id: "preset.style.import.get",
    summary: "\u67E5\u8BE2\u5355\u6761\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165\u8BB0\u5F55",
    usage: "preset.style.import.get --project <\u9879\u76EE ID> --import <\u5BFC\u5165 ID>",
    options: { ...PROJECT_OPTION, import: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), importId = requiredStringOption(context.values, "import", IMPORT_HINT);
      return (await context.client.request({
        route: "preset.style.import.get",
        params: { projectId, importId }
      })).body;
    }
  },
  {
    id: "preset.style.import.delete",
    summary: "\u5220\u9664\u5355\u6761\u5B57\u5E55\u6837\u5F0F\u5BFC\u5165\u8BB0\u5F55\uFF08\u4EC5\u7EC8\u6001\uFF0C\u670D\u52A1\u7AEF\u8F6F\u5220\u9664\uFF09",
    usage: "preset.style.import.delete --project <\u9879\u76EE ID> --import <\u5BFC\u5165 ID>",
    options: { ...PROJECT_OPTION, import: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), importId = requiredStringOption(context.values, "import", IMPORT_HINT);
      return (await context.client.request({
        route: "preset.style.import.delete",
        params: { projectId, importId }
      })).body;
    }
  },
  {
    id: "preset.style.import.select-draft",
    summary: "\u4ECE\u5BFC\u5165\u7ED3\u679C\u4E2D\u9009\u62E9\u8981\u63D0\u53D6\u7684\u526A\u6620\u8349\u7A3F",
    usage: "preset.style.import.select-draft --project <\u9879\u76EE ID> --import <\u5BFC\u5165 ID> --draft <\u8349\u7A3F ID>",
    options: { ...PROJECT_OPTION, import: { type: "string" }, draft: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), importId = requiredStringOption(context.values, "import", IMPORT_HINT), draftId = requiredStringOption(context.values, "draft", "\u8349\u7A3F ID\uFF0C\u6765\u81EA\u5BFC\u5165\u8BB0\u5F55 drafts \u4E2D\u7684\u771F\u5B9E\u503C");
      return (await context.client.request({
        route: "preset.style.import.select-draft",
        params: { projectId, importId },
        body: { draft_id: draftId }
      })).body;
    }
  },
  {
    id: "preset.style.import.save-items",
    summary: "\u628A\u5BFC\u5165\u7ED3\u679C\u9010\u9879\u4FDD\u5B58\u4E3A\u4E2A\u4EBA\u5B57\u5E55\u6837\u5F0F",
    usage: `preset.style.import.save-items --project <\u9879\u76EE ID> --import <\u5BFC\u5165 ID> --input '{"items":[...]}'`,
    options: { ...PROJECT_OPTION, import: { type: "string" }, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), importId = requiredStringOption(context.values, "import", IMPORT_HINT), payload = readPayload(context.values, { required: !0, hint: '{ "items": [...] }' });
      return (await context.client.request({
        route: "preset.style.import.save-items",
        params: { projectId, importId },
        body: payload
      })).body;
    },
    help: {
      note: "\u5148\u8BFB\u53D6\u5BFC\u5165\u8BE6\u60C5\u7684 items\uFF0C\u6309\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684 ordinal \u547D\u540D\uFF1B\u4E0D\u8981\u6309\u9875\u9762\u5C55\u793A\u987A\u5E8F\u91CD\u65B0\u7F16\u53F7\u3002",
      fields: [
        { key: "items", required: !0, type: "array", description: "\u6BCF\u9879\u542B ordinal\u3001name\uFF0C\u53EF\u9009 description\u3002" }
      ]
    }
  },
  {
    id: "preset.subtitle.list",
    summary: "\u5217\u51FA\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE",
    usage: "preset.subtitle.list --project <\u9879\u76EE ID> --type dialogue_subtitle_style|global_subtitle_style",
    options: { ...PROJECT_OPTION, type: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetType = requiredEnumOption(context.values, "type", PRESET_TYPES, "\u5B57\u5E55\u9884\u8BBE\u7C7B\u578B");
      return (await context.client.request({
        route: "preset.subtitle.list",
        params: { projectId },
        query: { preset_type: presetType }
      })).body;
    }
  },
  {
    id: "preset.subtitle.update",
    summary: "\u91CD\u547D\u540D\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE\u6216\u6539\u63CF\u8FF0",
    usage: `preset.subtitle.update --project <\u9879\u76EE ID> --subtitle-preset <\u9884\u8BBE ID> --input '{"name":"..."}'`,
    options: { ...PROJECT_OPTION, "subtitle-preset": { type: "string" }, ...PAYLOAD_OPTIONS },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetId = requiredStringOption(context.values, "subtitle-preset", "\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE ID"), payload = readPayload(context.values, { required: !0, hint: "name \u6216 description" });
      return (await context.client.request({
        route: "preset.subtitle.update",
        params: { projectId, presetId },
        body: payload
      })).body;
    }
  },
  {
    id: "preset.subtitle.archive",
    summary: "\u5F52\u6863\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE\uFF08\u670D\u52A1\u7AEF\u8F6F\u5F52\u6863\uFF0C\u4E0D\u505A\u4E8C\u6B21\u786E\u8BA4\uFF09",
    usage: "preset.subtitle.archive --project <\u9879\u76EE ID> --subtitle-preset <\u9884\u8BBE ID>",
    options: { ...PROJECT_OPTION, "subtitle-preset": { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT5), presetId = requiredStringOption(context.values, "subtitle-preset", "\u4E2A\u4EBA\u5B57\u5E55\u9884\u8BBE ID");
      return (await context.client.request({
        route: "preset.subtitle.archive",
        params: { projectId, presetId }
      })).body;
    }
  }
];

// packages/mycutbuddy-cli/src/commands/project.ts
var PROJECT_HINT6 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", projectCommands = [
  {
    id: "project.list",
    summary: "\u5217\u51FA\u5F53\u524D\u8D26\u53F7\u7684\u9879\u76EE",
    usage: "project.list",
    options: {},
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      return (await context.client.request({ route: "project.list" })).body;
    }
  },
  {
    id: "project.create",
    summary: "\u521B\u5EFA\u9879\u76EE",
    usage: "project.create --name <\u9879\u76EE\u540D>",
    options: { name: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let name = requiredStringOption(context.values, "name", "\u9879\u76EE\u540D\u79F0");
      return (await context.client.request({ route: "project.create", body: { name } })).body;
    }
  },
  {
    id: "project.get",
    summary: "\u67E5\u8BE2\u5355\u4E2A\u9879\u76EE\u6458\u8981",
    usage: "project.get --project <\u9879\u76EE ID>",
    options: PROJECT_OPTION,
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT6);
      return (await context.client.request({ route: "project.get", params: { projectId } })).body;
    }
  },
  {
    id: "project.rename",
    summary: "\u91CD\u547D\u540D\u9879\u76EE",
    usage: "project.rename --project <\u9879\u76EE ID> --name <\u65B0\u540D\u79F0>",
    options: { ...PROJECT_OPTION, name: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT6), name = requiredStringOption(context.values, "name", "\u65B0\u7684\u9879\u76EE\u540D\u79F0");
      return (await context.client.request({ route: "project.rename", params: { projectId }, body: { name } })).body;
    }
  },
  {
    id: "project.delete",
    summary: "\u5220\u9664\u9879\u76EE\uFF08\u5F02\u6B65\u53D7\u7406\uFF0C\u8FD4\u56DE delivery_id \u4E0E deleting \u72B6\u6001\uFF09",
    usage: "project.delete --project <\u9879\u76EE ID>",
    options: PROJECT_OPTION,
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT6);
      return (await context.client.request({ route: "project.delete", params: { projectId } })).body;
    }
  }
];

// packages/mycutbuddy-cli/src/commands/shot-stage.ts
var MATERIAL_SHOT_STAGES = [
  "preparing",
  "prepared",
  "processing",
  "processed",
  "indexing",
  "awaiting_index_credits",
  "completed",
  "failed",
  "cancelled"
], STAGE_LABELS = {
  preparing: "\u6B63\u5728\u51C6\u5907\u5904\u7406",
  prepared: "\u6B63\u5728\u5F00\u59CB\u5904\u7406",
  processing: "\u6B63\u5728\u5206\u5272\u7D20\u6750",
  processed: "\u5206\u5272\u5DF2\u5B8C\u6210\uFF0C\u6B63\u5728\u51C6\u5907\u7D22\u5F15",
  indexing: "\u5206\u5272\u5DF2\u5B8C\u6210\uFF0C\u6B63\u5728\u7D22\u5F15",
  awaiting_index_credits: "\u5206\u5272\u5DF2\u5B8C\u6210\uFF0C\u5F85\u7D22\u5F15\uFF08\u79EF\u5206\u4E0D\u8DB3\uFF09",
  completed: "\u955C\u5934\u5904\u7406\u5DF2\u5B8C\u6210",
  failed: "\u955C\u5934\u5904\u7406\u672A\u5B8C\u6210",
  cancelled: "\u955C\u5934\u5904\u7406\u5DF2\u53D6\u6D88"
};
function readShotStageView(payload) {
  let projection = readField(payload, "shot_processing"), stageValue = readField(projection, "stage") ?? readField(payload, "shot_processing_stage");
  if (typeof stageValue != "string" || !MATERIAL_SHOT_STAGES.includes(stageValue))
    return null;
  let stage = stageValue;
  return {
    stage,
    label: stage === "failed" && readField(projection, "failure_stage") === "index" ? "\u5206\u5272\u5DF2\u5B8C\u6210\uFF0C\u7D22\u5F15\u5931\u8D25" : STAGE_LABELS[stage],
    summary: projection !== null && typeof projection == "object" && !Array.isArray(projection) ? projection : { stage },
    // Only a real outcome or the durable index-credit pause ends the observation: the pause waits
    // for the user's explicit resume, and nothing else stops advancing by itself.
    stopsObservation: stage === "completed" || stage === "failed" || stage === "cancelled" || stage === "awaiting_index_credits",
    nextStep: nextStepFor(stage, projection)
  };
}
function pushShotStageWarning(warnings, view) {
  if (view.stage === "awaiting_index_credits") {
    warnings.push({ code: "index_credits_insufficient", message: view.nextStep ?? "" });
    return;
  }
  if (view.stage === "failed") {
    warnings.push({
      code: "shot_processing_failed",
      message: view.nextStep ?? "\u8BF7\u8BFB\u53D6\u670D\u52A1\u7AEF\u5B89\u5168\u5931\u8D25\u4E8B\u5B9E\uFF0C\u6D88\u8D39\u4E0E\u8FD4\u8FD8\u4EE5\u670D\u52A1\u7AEF\u8D26\u672C\u4E3A\u51C6\u3002"
    });
    return;
  }
  view.stage === "cancelled" && warnings.push({
    code: "shot_processing_cancelled",
    message: "\u670D\u52A1\u7AEF\u955C\u5934\u9636\u6BB5\u4E3A cancelled\uFF1A\u672C\u6B21\u672A\u63D0\u4EA4\u7684\u5904\u7406\u4EA7\u7269\u5DF2\u6E05\u7406\uFF0C\u5DF2\u6263\u79EF\u5206\u662F\u5426\u8FD4\u8FD8\u5728\u670D\u52A1\u7AEF\u8D26\u672C\u4E3A\u51C6\u3002"
  });
}
function nextStepFor(stage, projection) {
  if (stage === "completed")
    return "\u672C\u6B21\u955C\u5934\u6D41\u7A0B\u5DF2\u7ED3\u675F\uFF1B\u7528 material.directory --library primary \u8BFB\u53D6\u5F53\u524D\u7D20\u6750\u4E0E\u771F\u5B9E\u7D22\u5F15\u72B6\u6001\uFF0C\u65E0\u5F85\u7D22\u5F15\u7D20\u6750\u65F6\u4E0D\u4F1A\u521B\u5EFA\u7D22\u5F15\u4EFB\u52A1\u3002";
  if (stage === "failed")
    return readField(projection, "failure_stage") === "index" ? "\u5206\u5272\u5DF2\u5B8C\u6210\uFF0C\u4EC5\u7D22\u5F15\u5931\u8D25\uFF1B\u6210\u529F\u5206\u5272\u548C\u5904\u7406\u8D39\u4FDD\u7559\uFF0C\u7D22\u5F15\u8FD4\u8FD8\u4EE5\u670D\u52A1\u7AEF\u8D26\u672C\u4E3A\u51C6\u3002\u786E\u8BA4\u5F53\u524D\u5E93\u6CA1\u6709\u65B0\u589E\u672A\u5904\u7406\u89C6\u9891\u540E\uFF0C\u91CD\u65B0\u6388\u6743 material.index.submit\uFF0C\u53EA\u4F20 library_type=primary \u66F4\u65B0\u7D22\u5F15\uFF0C\u4E0D\u91CD\u4F20\u955C\u5934\u6A21\u5F0F\u3002" : "\u8BFB\u53D6\u5931\u8D25\u4E8B\u5B9E\u540E\u6309\u771F\u5B9E\u539F\u56E0\u5904\u7406\uFF1B\u5DF2\u63D0\u4EA4\u7684\u5206\u5272\u4E0E\u5904\u7406\u6807\u8BB0\u4E0D\u4F1A\u56E0\u4E3A\u8FD9\u6B21\u5931\u8D25\u88AB\u56DE\u6EDA\u3002";
  if (stage === "cancelled")
    return "\u672C\u6B21\u8BF7\u6C42\u5DF2\u53D6\u6D88\uFF1B\u9700\u8981\u91CD\u505A\u65F6\u91CD\u65B0\u4E0E\u7528\u6237\u786E\u8BA4\u540E\u7528\u65B0\u7684\u63D0\u4EA4\u952E\u53D1\u8D77\uFF0C\u4E0D\u8981\u590D\u7528\u65E7\u63D0\u4EA4\u952E\u3002";
  if (stage !== "awaiting_index_credits")
    return null;
  let required = readField(projection, "index_required_credits"), balance = readField(projection, "index_balance"), shortfall = readField(projection, "index_shortfall");
  return `\u5206\u5272\u5DF2\u5B8C\u6210\u3001\u5F85\u7D22\u5F15\uFF1A${typeof required == "number" && typeof balance == "number" && typeof shortfall == "number" ? `\u672C\u6B21\u7D22\u5F15\u9700\u8981 ${required} \u79EF\u5206\u3001\u5F53\u524D\u4F59\u989D ${balance}\u3001\u5DEE\u989D ${shortfall}\u3002` : "\u6240\u9700\u79EF\u5206\u3001\u5F53\u524D\u4F59\u989D\u4E0E\u5DEE\u989D\u89C1 data.shot_processing\u3002"}\u8865\u8DB3\u79EF\u5206\u540E\u91CD\u65B0\u6267\u884C material.index.submit\uFF0C\u53EA\u4F20 library_type=primary \u663E\u5F0F\u7EE7\u7EED\u7D22\u5F15\uFF1B\u5DF2\u6210\u529F\u7684\u5206\u5272\u8D39\u4E0D\u9000\uFF0C\u65E7\u7247\u6BB5\u4E0D\u4F1A\u91CD\u65B0\u5206\u5272\uFF0C\u89C2\u5BDF\u547D\u4EE4\u4E0D\u4F1A\u81EA\u52A8\u91CD\u63D0\u6216\u91CD\u6263\u3002`;
}

// packages/mycutbuddy-cli/src/commands/request.ts
var PROJECT_HINT7 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", REQUEST_HINT = "\u8BA1\u8D39\u8BF7\u6C42 ID\uFF0C\u6765\u81EA\u4EFB\u610F\u6536\u8D39\u63D0\u4EA4\u547D\u4EE4\u8FD4\u56DE\u7684 request_id", REQUEST_TERMINAL_STATES = {
  failed: !0,
  cancelled: !0,
  submitted: !0
}, requestCommands = [
  {
    id: "request.get",
    summary: "\u67E5\u8BE2\u5355\u6761\u8BA1\u8D39\u8BF7\u6C42\u7684\u5F53\u524D\u72B6\u6001\uFF08\u5BFC\u5165\u3001\u7D22\u5F15\u3001\u526A\u8F91\u5171\u7528\uFF09",
    usage: "request.get --project <\u9879\u76EE ID> --request <\u8BF7\u6C42 ID>",
    options: { ...PROJECT_OPTION, request: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      return readRequest(context);
    }
  },
  {
    id: "request.watch",
    summary: "\u89C2\u5BDF\u8BA1\u8D39\u8BF7\u6C42\u76F4\u5230\u7EC8\u6001\u6216\u89C2\u5BDF\u7A97\u53E3\u7ED3\u675F\uFF1B\u4E0D\u4F1A\u628A\u7A97\u53E3\u7ED3\u675F\u5F53\u4F5C\u5B8C\u6210",
    usage: "request.watch --project <\u9879\u76EE ID> --request <\u8BF7\u6C42 ID> [--watch-timeout 60] [--watch-interval 5]",
    options: {
      ...PROJECT_OPTION,
      request: { type: "string" },
      "watch-timeout": { type: "string" },
      "watch-interval": { type: "string" }
    },
    needsCredential: !0,
    chargeable: !1,
    help: {
      note: "\u666E\u901A\u8BF7\u6C42\u5728 submitted/failed/cancelled \u505C\u6B62\u3002\u4E3B\u5E93\u955C\u5934\u8BF7\u6C42\uFF08\u8FD4\u56DE shot_processing\uFF09\u4F1A\u7EE7\u7EED\u89C2\u5BDF\u5904\u7406\u4E0E\u968F\u540E\u7684\u7D22\u5F15\u9636\u6BB5\uFF0C\u76F4\u5230 completed/failed/cancelled \u6216\u7D22\u5F15\u79EF\u5206\u4E0D\u8DB3\u7684\u6301\u4E45\u6682\u505C awaiting_index_credits\uFF1B\u6682\u505C\u65F6\u6309 shot_next_step \u63D0\u793A\u8865\u8DB3\u540E\u4EC5\u7EE7\u7EED\u7D22\u5F15\uFF0C\u89C2\u5BDF\u672C\u8EAB\u4E0D\u4F1A\u81EA\u52A8\u63D0\u4EA4\u6216\u91CD\u6263\u3002\u7A97\u53E3\u7ED3\u675F\u53EA\u62A5 watch_incomplete\u3002",
      next: [
        "material.directory --project <\u9879\u76EE ID> --library <\u5E93\u7C7B\u578B>  # \u5BFC\u5165/\u7D22\u5F15\u7EE7\u7EED\u6267\u884C\u65F6",
        "task.watch --project <\u9879\u76EE ID> --task <execution_task_id>  # \u526A\u8F91\u6267\u884C\u4EFB\u52A1",
        `material.index.submit --project <\u9879\u76EE ID> --confirm-charge --input '{"library_type":"primary"}'  # \u7D22\u5F15\u79EF\u5206\u4E0D\u8DB3\u8865\u8DB3\u540E\u7EE7\u7EED\u7D22\u5F15\uFF08\u4E0D\u8981\u91CD\u4F20 shot_mode\uFF09`
      ]
    },
    async run(context) {
      let timeoutSeconds = optionInteger(context.values, "watch-timeout", {
        fallback: 60,
        minimum: 1,
        maximum: 3600
      }), intervalSeconds = optionInteger(context.values, "watch-interval", {
        fallback: 5,
        minimum: 1,
        maximum: 300
      }), deadline = Date.now() + timeoutSeconds * 1e3, observations = 0, request2 = null, state, shot = null;
      for (; ; ) {
        request2 = await readRequest(context), state = readStringField(request2, "state"), shot = readShotStageView(request2), observations += 1;
        let executionTaskId = readStringField(request2, "execution_task_id");
        if (context.progress({
          event: "request_observation",
          state: state ?? null,
          execution_task_id: executionTaskId ?? null,
          shot_stage: shot?.stage ?? null,
          shot_stage_label: shot?.label ?? null,
          observation: observations
        }), shot !== null && (shot.stopsObservation || state === "failed" || state === "cancelled"))
          return pushShotStageWarning(context.warnings, shot), {
            request: request2,
            terminal: !0,
            execution_task_id: executionTaskId ?? null,
            execution_continues: !1,
            shot_processing: shot.summary,
            shot_stage_label: shot.label,
            shot_next_step: shot.nextStep,
            observations,
            watch: {
              timeout_seconds: timeoutSeconds,
              interval_seconds: intervalSeconds,
              stopped_because: shot.stopsObservation ? shot.stage : state === "failed" ? "failed" : "cancelled"
            }
          };
        if (shot === null && state !== void 0 && REQUEST_TERMINAL_STATES[state] === !0) {
          let executionContinues = state === "submitted" && executionTaskId !== void 0;
          return executionContinues && context.warnings.push({
            code: "execution_continues",
            message: `\u8BA1\u8D39\u8BF7\u6C42\u5DF2\u521B\u5EFA\u6267\u884C\u4EFB\u52A1 ${executionTaskId}\uFF1B\u8BF7\u6C42\u672C\u8EAB\u5DF2\u7ED3\u675F\uFF0C\u4F46\u6267\u884C\u4ECD\u5728\u7EE7\u7EED\uFF0C\u8BF7\u7528 task.watch \u6216 material.directory \u8BFB\u53D6\u540E\u7EED\u4E8B\u5B9E\u3002`
          }), {
            request: request2,
            terminal: !0,
            execution_task_id: executionTaskId ?? null,
            execution_continues: executionContinues,
            observations,
            watch: {
              timeout_seconds: timeoutSeconds,
              interval_seconds: intervalSeconds,
              stopped_because: state
            }
          };
        }
        if (Date.now() + intervalSeconds * 1e3 > deadline)
          break;
        await delaySeconds2(intervalSeconds);
      }
      return context.warnings.push({
        code: "watch_incomplete",
        message: shot === null ? `\u89C2\u5BDF\u7A97\u53E3\u5DF2\u7ED3\u675F\uFF0C\u670D\u52A1\u7AEF\u8BF7\u6C42\u72B6\u6001\u4ECD\u662F ${state ?? "\u672A\u77E5"}\uFF1B\u8FD9\u4E0D\u8868\u793A\u8BF7\u6C42\u5DF2\u7ECF\u5B8C\u6210\u3002` : `\u89C2\u5BDF\u7A97\u53E3\u5DF2\u7ED3\u675F\uFF0C\u670D\u52A1\u7AEF\u955C\u5934\u9636\u6BB5\u4ECD\u662F ${shot.stage}\uFF08\u8BF7\u6C42\u72B6\u6001 ${state ?? "\u672A\u77E5"}\uFF09\uFF1B\u8FD9\u4E0D\u8868\u793A\u6574\u6761\u955C\u5934\u5904\u7406\u94FE\u5DF2\u7ECF\u5B8C\u6210\u3002`
      }), {
        request: request2,
        terminal: !1,
        execution_task_id: readStringField(request2, "execution_task_id") ?? null,
        // Active shot stages keep working in the background; an ordinary request keeps the
        // existing `false` because its remaining work is read from another command.
        execution_continues: shot !== null,
        ...shot === null ? {} : {
          shot_processing: shot.summary,
          shot_stage_label: shot.label,
          shot_next_step: shot.nextStep
        },
        observations,
        watch: {
          timeout_seconds: timeoutSeconds,
          interval_seconds: intervalSeconds,
          stopped_because: "observation_window_exhausted"
        }
      };
    }
  },
  {
    id: "request.cancel",
    summary: "\u53D6\u6D88\u5C1A\u672A\u8FDB\u5165\u6267\u884C\u7684\u8BA1\u8D39\u8BF7\u6C42",
    usage: "request.cancel --project <\u9879\u76EE ID> --request <\u8BF7\u6C42 ID>",
    options: { ...PROJECT_OPTION, request: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT7), requestId = requiredStringOption(context.values, "request", REQUEST_HINT), response = await context.client.request({
        route: "request.cancel",
        params: { projectId, requestId }
      }), state = readStringField(response.body, "state");
      return state !== void 0 && state !== "cancelled" && context.warnings.push({
        code: "cancel_not_effective",
        message: `\u8BF7\u6C42\u5F53\u524D\u72B6\u6001\u4E3A ${state}\uFF0C\u672C\u6B21\u53D6\u6D88\u672A\u751F\u6548\uFF1B\u5DF2\u8FDB\u5165\u6267\u884C\u7684\u4EFB\u52A1\u8BF7\u7528 task.cancel \u67E5\u8BE2\u662F\u5426\u4ECD\u5141\u8BB8\u53D6\u6D88\u3002`
      }), response.body;
    }
  },
  {
    id: "request.recreate",
    summary: "\u53D6\u5F97\u5931\u8D25\u6216\u5DF2\u53D6\u6D88\u8BF7\u6C42\u7684\u91CD\u65B0\u7F16\u8F91\u8F93\u5165\uFF08\u4E0D\u542B\u4F30\u7B97\u4EE4\u724C\uFF0C\u9700\u91CD\u65B0\u4F30\u7B97\uFF09",
    usage: "request.recreate --project <\u9879\u76EE ID> --request <\u8BF7\u6C42 ID>",
    options: { ...PROJECT_OPTION, request: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT7), requestId = requiredStringOption(context.values, "request", REQUEST_HINT);
      return (await context.client.request({
        route: "request.recreate",
        params: { projectId, requestId }
      })).body;
    }
  }
];
async function readRequest(context) {
  let projectId = requiredStringOption(context.values, "project", PROJECT_HINT7), requestId = requiredStringOption(context.values, "request", REQUEST_HINT);
  return (await context.client.request({
    route: "request.get",
    params: { projectId, requestId }
  })).body;
}
function delaySeconds2(seconds) {
  let { promise, resolve: resolve4 } = Promise.withResolvers();
  return setTimeout(resolve4, seconds * 1e3), promise;
}

// packages/mycutbuddy-cli/src/commands/task.ts
var PROJECT_HINT8 = "\u9879\u76EE ID\uFF0C\u6765\u81EA project.list \u7684\u8FD4\u56DE\u503C", TASK_HINT = "\u4EFB\u52A1 ID\uFF0C\u6765\u81EA task.list \u6216 editing.submit \u8FD4\u56DE\u7684 execution_task_id", taskCommands = [
  {
    id: "task.list",
    summary: "\u5206\u9875\u5217\u51FA\u5355\u8F68\u526A\u8F91\u4EFB\u52A1\u4E0E\u8BA1\u8D39\u8BF7\u6C42",
    usage: "task.list --project <\u9879\u76EE ID> [--page 1] [--page-size 20] [--focus-request <\u8BF7\u6C42 ID> | --focus-task <\u4EFB\u52A1 ID>]",
    options: {
      ...PROJECT_OPTION,
      ...PAGINATION_OPTIONS,
      "focus-request": { type: "string" },
      "focus-task": { type: "string" }
    },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT8), page = optionInteger(context.values, "page", { fallback: 1, minimum: 1, maximum: 1e5 }), pageSize = optionPageSize(context.values);
      return (await context.client.request({
        route: "task.list",
        params: { projectId },
        query: {
          page,
          pageSize,
          focusRequestId: optionString(context.values, "focus-request"),
          focusTaskId: optionString(context.values, "focus-task")
        }
      })).body;
    }
  },
  {
    id: "task.get",
    summary: "\u67E5\u8BE2\u5355\u4E2A\u4EFB\u52A1\u7684\u5F53\u524D\u4E8B\u5B9E\uFF08\u72B6\u6001\u3001\u53EF\u53D6\u6D88\u3001\u8D39\u7528\u3001\u5931\u8D25\u6210\u5458\u3001\u4EA4\u4ED8\u7269\uFF09",
    usage: "task.get --project <\u9879\u76EE ID> --task <\u4EFB\u52A1 ID>",
    options: { ...PROJECT_OPTION, task: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      return (await readTask(context)).body;
    }
  },
  {
    id: "task.watch",
    summary: "\u89C2\u5BDF\u5355\u4E2A\u4EFB\u52A1\u76F4\u5230\u7EC8\u6001\u6216\u89C2\u5BDF\u7A97\u53E3\u7ED3\u675F\uFF08\u4E0D\u4F1A\u628A\u7A97\u53E3\u7ED3\u675F\u5F53\u4F5C\u5B8C\u6210\uFF09",
    usage: "task.watch --project <\u9879\u76EE ID> --task <\u4EFB\u52A1 ID> [--watch-timeout 60] [--watch-interval 5]",
    options: {
      ...PROJECT_OPTION,
      task: { type: "string" },
      "watch-timeout": { type: "string" },
      "watch-interval": { type: "string" }
    },
    needsCredential: !0,
    chargeable: !1,
    help: {
      note: "\u4EFB\u52A1\u53EA\u9648\u8FF0\u5355\u4E2A\u6267\u884C\u9636\u6BB5\uFF1A\u4EFB\u52A1 completed \u4E0D\u7B49\u4E8E\u6574\u6761\u4E3B\u5E93\u955C\u5934\u5904\u7406\u94FE\u5B8C\u6210\u3002\u540C\u4E00\u94FE\u7684\u9636\u6BB5\u7528 shot_processing \u4E0E shot_next_step \u8BFB\u53D6\uFF0C\u6574\u94FE\u89C2\u5BDF\u7528 request.watch\uFF1B\u7D20\u6750\u5BFC\u5165\u4E0E\u72EC\u7ACB\u7D22\u5F15\u7684\u6267\u884C\u4EFB\u52A1\u540C\u6837\u6309\u81EA\u8EAB status \u5224\u65AD\u7EC8\u6001\uFF08\u8FD4\u56DE task_type\u3001request_id\u3001import_stage\uFF09\uFF0C\u5E93\u7EA7\u4E8B\u5B9E\u4ECD\u8BFB material.directory\uFF1B\u7A97\u53E3\u7ED3\u675F\u53EA\u62A5 watch_incomplete\u3002"
    },
    async run(context) {
      let timeoutSeconds = optionInteger(context.values, "watch-timeout", {
        fallback: 60,
        minimum: 1,
        maximum: 3600
      }), intervalSeconds = optionInteger(context.values, "watch-interval", {
        fallback: 5,
        minimum: 1,
        maximum: 300
      }), deadline = Date.now() + timeoutSeconds * 1e3, observations = 0, task = null, status, shot = null;
      for (; ; ) {
        if (task = (await readTask(context)).body, status = readStringField(task, "status"), shot = readShotStageView(task), observations += 1, context.progress({
          event: "task_observation",
          status: status ?? null,
          shot_stage: shot?.stage ?? null,
          shot_stage_label: shot?.label ?? null,
          observation: observations,
          terminal: isTerminalTaskStatus(status)
        }), isTerminalTaskStatus(status))
          return shot !== null && pushShotStageWarning(context.warnings, shot), {
            task,
            terminal: !0,
            ...shot === null ? {} : {
              shot_processing: shot.summary,
              shot_stage_label: shot.label,
              shot_next_step: shot.nextStep
            },
            observations,
            watch: {
              timeout_seconds: timeoutSeconds,
              interval_seconds: intervalSeconds,
              stopped_because: "terminal_state"
            }
          };
        if (Date.now() + intervalSeconds * 1e3 > deadline)
          break;
        await delaySeconds3(intervalSeconds);
      }
      return context.warnings.push({
        code: "watch_incomplete",
        message: shot === null ? `\u89C2\u5BDF\u7A97\u53E3\u5DF2\u7ED3\u675F\uFF0C\u670D\u52A1\u7AEF\u72B6\u6001\u4ECD\u662F ${status ?? "\u672A\u77E5"}\uFF1B\u8FD9\u4E0D\u8868\u793A\u4EFB\u52A1\u5DF2\u7ECF\u5B8C\u6210\u3002` : `\u89C2\u5BDF\u7A97\u53E3\u5DF2\u7ED3\u675F\uFF0C\u670D\u52A1\u7AEF\u4EFB\u52A1\u72B6\u6001\u4ECD\u662F ${status ?? "\u672A\u77E5"}\uFF0C\u955C\u5934\u9636\u6BB5\u4E3A ${shot.stage}\uFF1B\u8FD9\u4E0D\u8868\u793A\u6574\u6761\u955C\u5934\u5904\u7406\u94FE\u5DF2\u7ECF\u5B8C\u6210\u3002`
      }), {
        task,
        terminal: !1,
        ...shot === null ? {} : {
          shot_processing: shot.summary,
          shot_stage_label: shot.label,
          shot_next_step: shot.nextStep
        },
        observations,
        watch: { timeout_seconds: timeoutSeconds, interval_seconds: intervalSeconds, stopped_because: "observation_window_exhausted" }
      };
    }
  },
  {
    id: "task.cancel",
    summary: "\u53D6\u6D88\u5C1A\u672A\u7ED3\u675F\u7684\u4EFB\u52A1\uFF1B\u5DF2\u7EC8\u6001\u7684\u4EFB\u52A1\u53EA\u80FD\u5220\u9664\uFF0C\u4E0D\u80FD\u53D6\u6D88",
    usage: "task.cancel --project <\u9879\u76EE ID> --task <\u4EFB\u52A1 ID>",
    options: { ...PROJECT_OPTION, task: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT8), taskId = requiredStringOption(context.values, "task", TASK_HINT);
      return (await context.client.request({
        route: "task.cancel",
        params: { projectId, taskId },
        query: { operation: "cancel" }
      })).body;
    }
  },
  {
    id: "task.delete",
    summary: "\u5220\u9664\u5DF2\u7EC8\u6001\u7684\u4EFB\u52A1\u8BB0\u5F55\uFF08\u8F6F\u5220\u9664\uFF0C\u4E0D\u6539\u52A8\u8D26\u672C\u4E0E\u8FDC\u7AEF\u4EA4\u4ED8\uFF09",
    usage: "task.delete --project <\u9879\u76EE ID> --task <\u4EFB\u52A1 ID>",
    options: { ...PROJECT_OPTION, task: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT8), taskId = requiredStringOption(context.values, "task", TASK_HINT);
      return (await context.client.request({
        route: "task.delete",
        params: { projectId, taskId },
        query: { operation: "delete" }
      })).body;
    }
  },
  {
    id: "task.recreate",
    summary: "\u53D6\u5F97\u7EC8\u6001\u4EFB\u52A1\u7684\u91CD\u65B0\u7F16\u8F91\u8F93\u5165\uFF08\u9700\u8981\u91CD\u65B0\u4F30\u7B97\u4E0E\u65B0\u7684\u63D0\u4EA4\u952E\uFF09",
    usage: "task.recreate --project <\u9879\u76EE ID> --task <\u4EFB\u52A1 ID>",
    options: { ...PROJECT_OPTION, task: { type: "string" } },
    needsCredential: !0,
    chargeable: !1,
    async run(context) {
      let projectId = requiredStringOption(context.values, "project", PROJECT_HINT8), taskId = requiredStringOption(context.values, "task", TASK_HINT);
      return (await context.client.request({
        route: "task.recreate",
        params: { projectId, taskId }
      })).body;
    }
  }
];
async function readTask(context) {
  let projectId = requiredStringOption(context.values, "project", PROJECT_HINT8), taskId = requiredStringOption(context.values, "task", TASK_HINT);
  return context.client.request({ route: "task.get", params: { projectId, taskId } });
}
function delaySeconds3(seconds) {
  let { promise, resolve: resolve4 } = Promise.withResolvers();
  return setTimeout(resolve4, seconds * 1e3), promise;
}

// packages/mycutbuddy-cli/src/commands/version.ts
var versionCommand = {
  id: "version",
  summary: "\u663E\u793A\u672C\u5730 CLI \u7248\u672C\u4E0E\u9ED8\u8BA4\u7AD9\u70B9",
  usage: "version",
  options: {},
  needsCredential: !1,
  async run() {
    return {
      cli_version: CLI_VERSION,
      node_version: process.version,
      default_site: DEFAULT_SITE
    };
  }
};

// packages/mycutbuddy-cli/src/commands/index.ts
var COMMAND_GROUPS = ["general", "auth", "project", "material", "preset", "editing", "request", "task", "delivery", "credits"], helpCommand = {
  id: "help",
  summary: "\u5217\u51FA\u5168\u90E8\u547D\u4EE4\uFF0C\u6216\u67E5\u770B\u5355\u4E2A\u547D\u4EE4\u7684\u7528\u6CD5\u4E0E\u8F93\u5165\u7ED3\u6784",
  usage: "help [\u547D\u4EE4 ID]",
  options: {},
  needsCredential: !1,
  async run(context) {
    let requested = context.positionals[0];
    if (requested === void 0) {
      let commands = CLI_COMMANDS.map((command) => command.id), groups = Object.fromEntries(COMMAND_GROUPS.map((group) => [group, []]));
      for (let command of CLI_COMMANDS) {
        let group = commandGroup(command.id);
        (groups[group] ??= []).push(commandDescription(command));
      }
      return {
        groups,
        commands,
        exit_codes: { 0: "\u6210\u529F", 1: "CLI \u5185\u90E8\u9519\u8BEF", 2: "\u672C\u5730\u8F93\u5165\u9519\u8BEF", 3: "\u4E1A\u52A1\u62D2\u7EDD", 4: "\u8BA4\u8BC1\u5931\u8D25", 5: "\u4E34\u65F6\u5931\u8D25\uFF08\u53EF\u91CD\u8BD5\uFF09" }
      };
    }
    let definition = CLI_COMMANDS.find((command) => command.id === requested);
    if (definition === void 0)
      throw localInputError("unknown_command", `\u672A\u77E5\u547D\u4EE4\uFF1A${requested}`, {
        command: requested,
        available: CLI_COMMANDS.map((command) => command.id)
      });
    return commandDescription(definition);
  }
}, CLI_COMMANDS = [
  helpCommand,
  versionCommand,
  ...authCommands,
  ...projectCommands,
  ...materialCommands,
  ...presetCommands,
  ...editingCommands,
  ...requestCommands,
  ...taskCommands,
  ...deliveryCommands,
  ...creditsCommands
];
function resolveCommand(argv) {
  let first = argv[0];
  if (first === void 0)
    throw localInputError("missing_command", "\u7F3A\u5C11\u547D\u4EE4\uFF1A\u8BF7\u8FD0\u884C help \u67E5\u770B\u5168\u90E8\u547D\u4EE4\u3002");
  if (first === "help" || first === "--help" || first === "-h")
    return { definition: helpCommand, rest: argv.slice(1) };
  if (first === "version")
    return { definition: versionCommand, rest: argv.slice(1) };
  if (first.startsWith("-"))
    throw localInputError("missing_command", `\u7F3A\u5C11\u547D\u4EE4\uFF1A\u6536\u5230\u9009\u9879 ${first}\u3002\u8BF7\u5148\u7ED9\u51FA\u547D\u4EE4\uFF0C\u518D\u7ED9\u51FA\u9009\u9879\u3002`);
  let token = first, rest = argv.slice(1);
  if (!first.includes(".")) {
    let verb = rest[0];
    if (verb === void 0 || verb.startsWith("-"))
      throw localInputError("missing_command", `\u547D\u4EE4 ${first} \u7F3A\u5C11\u5B50\u547D\u4EE4\uFF0C\u4F8B\u5982 ${first}.list\u3002`);
    token = `${first}.${verb}`, rest = rest.slice(1);
  }
  let definition = CLI_COMMANDS.find((command) => command.id === token);
  if (definition === void 0)
    throw localInputError("unknown_command", `\u672A\u77E5\u547D\u4EE4\uFF1A${token}`, {
      command: token,
      available: CLI_COMMANDS.map((command) => command.id)
    });
  return { definition, rest };
}

// packages/mycutbuddy-cli/src/cli.ts
function defaultRuntime() {
  let env = process.env;
  return {
    env,
    cwd: process.cwd(),
    fetchImpl: fetch,
    store: new CredentialStore(CredentialStore.defaultHome(env)),
    write: (text) => process.stdout.write(text),
    writeError: (text) => process.stderr.write(text)
  };
}
var GLOBAL_VALUE_OPTIONS = {
  "--site": !0,
  "--format": !0,
  "--timeout": !0
}, GLOBAL_FLAG_OPTIONS = {
  "--pretty": !0,
  "--help": !0,
  "--version": !0
};
function hoistLeadingGlobalOptions(argv) {
  let leading = [], index = 0;
  for (; index < argv.length; ) {
    let token = argv[index];
    if (GLOBAL_VALUE_OPTIONS[token] === !0) {
      let value = argv[index + 1];
      if (value === void 0 || value.startsWith("-"))
        break;
      leading.push(token, value), index += 2;
      continue;
    }
    if (Object.keys(GLOBAL_VALUE_OPTIONS).some((name) => token.startsWith(`${name}=`))) {
      leading.push(token), index += 1;
      continue;
    }
    if (GLOBAL_FLAG_OPTIONS[token] === !0) {
      leading.push(token), index += 1;
      continue;
    }
    break;
  }
  if (leading.length === 0)
    return argv;
  let command = argv[index];
  return command === void 0 ? leading.includes("--help") ? ["help", ...leading] : leading.includes("--version") ? ["version", ...leading] : argv : [command, ...leading, ...argv.slice(index + 1)];
}
async function runCli(argv, runtime) {
  let warnings = [], commandId = null, format = "json", pretty = !1;
  try {
    let { definition, rest } = resolveCommand(hoistLeadingGlobalOptions(argv));
    commandId = definition.id;
    let parsed = parseCommandLine(rest, definition.options), values = parsed.values;
    if (format = optionFormat(values), pretty = values.pretty === !0, values.version === !0)
      return runtime.write(`mycutbuddy ${CLI_VERSION}
`), EXIT_STATUS.success;
    if (values.help === !0)
      return runtime.write(commandHelpText(definition)), EXIT_STATUS.success;
    if (parsed.positionals.length > 0 && definition.id !== "help")
      throw localInputError(
        "unexpected_arguments",
        `\u547D\u4EE4 ${definition.id} \u4E0D\u63A5\u53D7\u4F4D\u7F6E\u53C2\u6570\uFF1A${parsed.positionals.join(" ")}`
      );
    let base = {
      values,
      positionals: parsed.positionals,
      cwd: runtime.cwd,
      env: runtime.env,
      store: runtime.store,
      fetchImpl: runtime.fetchImpl,
      warnings,
      // Progress goes to standard error: standard output stays one envelope per command.
      progress: (event) => runtime.writeError(`${JSON.stringify({ command: definition.id, ...event })}
`)
    };
    if (!definition.needsCredential) {
      let data2 = await definition.run(base);
      return writeSuccess(runtime, format, pretty, definition.id, data2, warnings), EXIT_STATUS.success;
    }
    let data = await definition.run(siteContext(base, runtime, values));
    return writeSuccess(runtime, format, pretty, definition.id, data, warnings), EXIT_STATUS.success;
  } catch (error) {
    let failure = toCliError(error);
    return format === "human" ? runtime.writeError(humanFailureText(commandId, failure)) : runtime.write(`${serializeEnvelope(failureEnvelope(commandId, failure, warnings), { pretty })}
`), EXIT_STATUS[failure.kind];
  }
}
function writeSuccess(runtime, format, pretty, commandId, data, warnings) {
  if (format === "human") {
    runtime.write(humanSuccessText(commandId, data));
    return;
  }
  runtime.write(`${serializeEnvelope(successEnvelope(commandId, data, warnings), { pretty })}
`);
}
function siteContext(base, runtime, values) {
  let resolvedSite, resolvedCredential, client, site = () => resolvedSite ??= normalizeSite(optionString(values, "site") ?? runtime.env.MYCUTBUDDY_SITE), credential = () => {
    let target = site(), found = resolvedCredential === void 0 ? runtime.store.read(target) : resolvedCredential;
    if (resolvedCredential = found, found === null)
      throw authenticationError(
        "credential_missing",
        `\u672C\u673A\u6CA1\u6709 ${target} \u7684\u6388\u6743\u51ED\u636E\uFF1A\u8BF7\u5148\u8FD0\u884C auth.login --site ${target} --name <Agent \u540D\u79F0>\u3002`,
        { site: target }
      );
    return found;
  };
  return {
    ...base,
    get site() {
      return site();
    },
    get accessToken() {
      return credential().access_token;
    },
    get client() {
      return client === void 0 && (client = new ServiceClient({
        site: site(),
        accessToken: credential().access_token,
        timeoutMs: optionTimeoutMs(values),
        fetchImpl: runtime.fetchImpl
      })), client;
    }
  };
}

// packages/mycutbuddy-cli/src/main.ts
runCli(process.argv.slice(2), defaultRuntime()).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    console.error(error), process.exitCode = 1;
  }
);
