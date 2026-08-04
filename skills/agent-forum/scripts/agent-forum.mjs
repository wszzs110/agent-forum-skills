#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2,
  mod
));

// node_modules/uuid/dist-node/regex.js
var regex_default;
var init_regex = __esm({
  "node_modules/uuid/dist-node/regex.js"() {
    regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
  }
});

// node_modules/uuid/dist-node/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default;
var init_validate = __esm({
  "node_modules/uuid/dist-node/validate.js"() {
    init_regex();
    validate_default = validate;
  }
});

// node_modules/uuid/dist-node/stringify.js
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
var byteToHex;
var init_stringify = __esm({
  "node_modules/uuid/dist-node/stringify.js"() {
    byteToHex = [];
    for (let i = 0; i < 256; ++i) {
      byteToHex.push((i + 256).toString(16).slice(1));
    }
  }
});

// node_modules/uuid/dist-node/rng.js
function rng() {
  return crypto.getRandomValues(rnds8);
}
var rnds8;
var init_rng = __esm({
  "node_modules/uuid/dist-node/rng.js"() {
    rnds8 = new Uint8Array(16);
  }
});

// node_modules/uuid/dist-node/v7.js
function v7(options, buf, offset) {
  let bytes;
  if (options) {
    bytes = v7Bytes(options.random ?? options.rng?.() ?? rng(), options.msecs, options.seq, buf, offset);
  } else {
    const now = Date.now();
    const rnds = rng();
    updateV7State(_state, now, rnds);
    bytes = v7Bytes(rnds, _state.msecs, _state.seq, buf, offset);
  }
  return buf ?? unsafeStringify(bytes);
}
function updateV7State(state2, now, rnds) {
  state2.msecs ??= -Infinity;
  state2.seq ??= 0;
  if (now > state2.msecs) {
    state2.seq = rnds[6] << 23 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
    state2.msecs = now;
  } else {
    state2.seq = state2.seq + 1 | 0;
    if (state2.seq === 0) {
      state2.msecs++;
    }
  }
  return state2;
}
function v7Bytes(rnds, msecs, seq, buf, offset = 0) {
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  if (!buf) {
    buf = new Uint8Array(16);
    offset = 0;
  } else {
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
  }
  msecs ??= Date.now();
  seq ??= rnds[6] * 127 << 24 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
  buf[offset++] = msecs / 1099511627776 & 255;
  buf[offset++] = msecs / 4294967296 & 255;
  buf[offset++] = msecs / 16777216 & 255;
  buf[offset++] = msecs / 65536 & 255;
  buf[offset++] = msecs / 256 & 255;
  buf[offset++] = msecs & 255;
  buf[offset++] = 112 | seq >>> 28 & 15;
  buf[offset++] = seq >>> 20 & 255;
  buf[offset++] = 128 | seq >>> 14 & 63;
  buf[offset++] = seq >>> 6 & 255;
  buf[offset++] = seq << 2 & 255 | rnds[10] & 3;
  buf[offset++] = rnds[11];
  buf[offset++] = rnds[12];
  buf[offset++] = rnds[13];
  buf[offset++] = rnds[14];
  buf[offset++] = rnds[15];
  return buf;
}
var _state, v7_default;
var init_v7 = __esm({
  "node_modules/uuid/dist-node/v7.js"() {
    init_rng();
    init_stringify();
    _state = {};
    v7_default = v7;
  }
});

// node_modules/uuid/dist-node/version.js
function version(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  return parseInt(uuid.slice(14, 15), 16);
}
var version_default;
var init_version = __esm({
  "node_modules/uuid/dist-node/version.js"() {
    init_validate();
    version_default = version;
  }
});

// node_modules/uuid/dist-node/index.js
var init_dist_node = __esm({
  "node_modules/uuid/dist-node/index.js"() {
    init_v7();
    init_validate();
    init_version();
  }
});

// src/domain/ids.ts
function createEntityId(kind) {
  return `${entityPrefixes[kind]}_${v7_default()}`;
}
function isEntityId(value, kind) {
  const prefix = `${entityPrefixes[kind]}_`;
  if (!value.startsWith(prefix) || value !== value.toLowerCase()) return false;
  const uuid = value.slice(prefix.length);
  return validate_default(uuid) && version_default(uuid) === 7;
}
var entityPrefixes;
var init_ids = __esm({
  "src/domain/ids.ts"() {
    "use strict";
    init_dist_node();
    entityPrefixes = {
      forum: "forum",
      room: "room",
      thread: "thread",
      message: "msg",
      event: "evt",
      member: "member",
      binding: "binding"
    };
  }
});

// src/domain/timestamps.ts
function isCanonicalUtcTimestamp(value) {
  if (!utcTimestampWithMilliseconds.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}
function currentUtcTimestamp(now = /* @__PURE__ */ new Date()) {
  return now.toISOString();
}
var utcTimestampWithMilliseconds;
var init_timestamps = __esm({
  "src/domain/timestamps.ts"() {
    "use strict";
    utcTimestampWithMilliseconds = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u;
  }
});

// src/storage/errors.ts
var StorageError;
var init_errors = __esm({
  "src/storage/errors.ts"() {
    "use strict";
    StorageError = class extends Error {
      constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "StorageError";
      }
    };
  }
});

// src/storage/lock.ts
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
function defaultProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(
      error && typeof error === "object" && "code" in error && error.code === "EPERM"
    );
  }
}
async function readOwner(lockPath) {
  try {
    const value = JSON.parse(
      await readFile(resolve(lockPath, ownerFileName), "utf8")
    );
    if (typeof value.token !== "string" || typeof value.pid !== "number" || typeof value.hostname !== "string" || typeof value.command !== "string" || typeof value.startedAt !== "string" || !isCanonicalUtcTimestamp(value.startedAt)) {
      return void 0;
    }
    return value;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error instanceof SyntaxError)) {
      return void 0;
    }
    if (error instanceof SyntaxError) return void 0;
    throw error;
  }
}
async function lockAgeMs(lockPath, owner, now) {
  if (owner) return now.valueOf() - new Date(owner.startedAt).valueOf();
  try {
    return now.valueOf() - (await stat(lockPath)).mtimeMs;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}
async function removeStaleLock(lockPath) {
  const quarantine = `${lockPath}.stale-${randomUUID()}`;
  await rename(lockPath, quarantine);
  await rm(quarantine, { recursive: true, force: true });
}
async function acquireForumLock(options) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const staleAfterMs = options.staleAfterMs ?? 10 * 60 * 1e3;
  const currentHostname = options.hostname ?? hostname();
  const currentPid = options.pid ?? process.pid;
  const isProcessAlive3 = options.isProcessAlive ?? defaultProcessAlive;
  const owner = {
    token: randomUUID(),
    pid: currentPid,
    hostname: currentHostname,
    command: options.command,
    startedAt: currentUtcTimestamp(now)
  };
  await mkdir(dirname(options.lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(options.lockPath, { mode: 448 });
      try {
        await writeFile(
          resolve(options.lockPath, ownerFileName),
          `${JSON.stringify(owner, null, 2)}
`,
          { encoding: "utf8", flag: "wx", mode: 384 }
        );
      } catch (error) {
        await rm(options.lockPath, { recursive: true, force: true });
        throw error;
      }
      return {
        path: options.lockPath,
        owner,
        release: async () => {
          const current = await readOwner(options.lockPath);
          if (!current || current.token !== owner.token) {
            throw new StorageError(
              "LOCK_OWNERSHIP_LOST",
              `lock ownership changed before release: ${options.lockPath}`
            );
          }
          await rm(options.lockPath, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const existing = await readOwner(options.lockPath);
      if (existing === void 0) {
        try {
          await stat(options.lockPath);
        } catch (statError) {
          if (statError && typeof statError === "object" && "code" in statError && statError.code === "ENOENT") {
            continue;
          }
          throw statError;
        }
      }
      const age = await lockAgeMs(options.lockPath, existing, now);
      const sameHost = !existing || existing.hostname === currentHostname;
      const alive = existing && sameHost ? isProcessAlive3(existing.pid) : false;
      const removable = sameHost && !alive && (existing !== void 0 || age >= staleAfterMs);
      if (attempt === 0 && removable) {
        try {
          await removeStaleLock(options.lockPath);
          continue;
        } catch (staleError) {
          if (staleError && typeof staleError === "object" && "code" in staleError && staleError.code === "ENOENT") {
            continue;
          }
          throw staleError;
        }
      }
      throw new StorageError(
        "LOCAL_LOCKED",
        `forum write lock is already held: ${options.lockPath}`,
        existing ? { ...existing, token: void 0 } : { ageMs: age }
      );
    }
  }
  throw new StorageError(
    "LOCAL_LOCKED",
    `forum write lock could not be acquired: ${options.lockPath}`
  );
}
async function clearStaleForumLock(options) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const staleAfterMs = options.staleAfterMs ?? 10 * 60 * 1e3;
  const currentHostname = options.hostname ?? hostname();
  const isProcessAlive3 = options.isProcessAlive ?? defaultProcessAlive;
  let owner;
  try {
    owner = await readOwner(options.lockPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  let age;
  try {
    age = await lockAgeMs(options.lockPath, owner, now);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  const sameHost = !owner || owner.hostname === currentHostname;
  const alive = owner && sameHost ? isProcessAlive3(owner.pid) : false;
  const removable = sameHost && !alive && (owner !== void 0 || age >= staleAfterMs);
  if (!removable) {
    throw new StorageError(
      "LOCK_NOT_STALE",
      `lock is not safe to clear: ${options.lockPath}`
    );
  }
  await removeStaleLock(options.lockPath);
  return true;
}
var ownerFileName;
var init_lock = __esm({
  "src/storage/lock.ts"() {
    "use strict";
    init_timestamps();
    init_errors();
    ownerFileName = "owner.json";
  }
});

// src/storage/paths.ts
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve as resolve2, sep } from "node:path";
function createAgentForumPaths(homeDirectory = homedir()) {
  const root = resolve2(homeDirectory, ".AgentForum");
  const stateDirectory = resolve2(root, "state");
  return {
    root,
    configFile: resolve2(root, "config.json"),
    forumsDirectory: resolve2(root, "forums"),
    stateDirectory,
    locksDirectory: resolve2(stateDirectory, "locks"),
    cacheDirectory: resolve2(stateDirectory, "cache"),
    viewerDirectory: resolve2(stateDirectory, "viewer"),
    dashboardDirectory: resolve2(stateDirectory, "dashboard"),
    dashboardRuntimeFile: resolve2(stateDirectory, "dashboard", "runtime.json"),
    dashboardDesktopFile: resolve2(stateDirectory, "dashboard", "desktop.json"),
    dashboardPolicyFile: resolve2(stateDirectory, "dashboard", "acquisition-policy.json"),
    uiPreferencesFile: resolve2(stateDirectory, "ui-preferences.json"),
    dashboardDownloadsDirectory: resolve2(stateDirectory, "dashboard", "downloads"),
    dashboardInstallDirectory: resolve2(root, "dashboard"),
    dashboardInstallationFile: resolve2(root, "dashboard", "installation.json"),
    installationsFile: resolve2(stateDirectory, "installations.json"),
    bindingsFile: resolve2(stateDirectory, "context-bindings.json"),
    publishPolicyFile: resolve2(stateDirectory, "publish-policy.json")
  };
}
function assertLocalAlias(alias) {
  if (!localAliasPattern.test(alias)) {
    throw new StorageError(
      "INVALID_LOCAL_ALIAS",
      `local alias must match ${localAliasPattern.source}: ${alias}`
    );
  }
}
function forumClonePath(paths, alias) {
  assertLocalAlias(alias);
  return resolve2(paths.forumsDirectory, alias);
}
function forumStatePath(paths, forumId) {
  if (!isEntityId(forumId, "forum")) {
    throw new StorageError("INVALID_FORUM_ID", `invalid forum ID: ${forumId}`);
  }
  return resolve2(paths.stateDirectory, forumId);
}
function forumLockPath(paths, forumId) {
  if (!isEntityId(forumId, "forum")) {
    throw new StorageError("INVALID_FORUM_ID", `invalid forum ID: ${forumId}`);
  }
  return resolve2(paths.locksDirectory, `${forumId}.lock`);
}
async function sameExistingPath(left, right) {
  const [canonicalLeft, canonicalRight] = await Promise.all([
    realpath(resolve2(left)),
    realpath(resolve2(right))
  ]);
  if (process.platform === "win32") {
    return canonicalLeft.toLowerCase() === canonicalRight.toLowerCase();
  }
  return canonicalLeft === canonicalRight;
}
var localAliasPattern;
var init_paths = __esm({
  "src/storage/paths.ts"() {
    "use strict";
    init_ids();
    init_errors();
    localAliasPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args2) {
      const code = [strs[0]];
      let i = 0;
      while (i < args2.length) {
        addCodeArg(code, args2[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args2) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args2.length) {
        expr.push(plus);
        addCodeArg(expr, args2[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants2) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants2);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants2) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants2);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants2) {
        this.code = optimizeExpr(this.code, names, constants2);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants2) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants2))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants2) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants2);
        if (!(super.optimizeNames(names, constants2) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants2);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants2) {
        if (!super.optimizeNames(names, constants2))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants2);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants2) {
        if (!super.optimizeNames(names, constants2))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants2);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args2, async) {
        super();
        this.name = name;
        this.args = args2;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants2) {
        var _a, _b;
        super.optimizeNames(names, constants2);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants2);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants2);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args2 = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args2, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants2) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants2[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants2[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args2) {
      return args2.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args2) {
      return args2.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args2 = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args2})` : (0, codegen_1._)`${func}(${args2})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate2 = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate2);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines: lines2 } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines: lines2, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate2 = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate2 });
        validate2.errors = null;
        validate2.schema = sch.schema;
        validate2.schemaEnv = sch;
        if (sch.$async)
          validate2.$async = true;
        if (this.opts.code.source === true) {
          validate2.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate2.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate2.source)
            validate2.source.evaluated = (0, codegen_1.stringify)(validate2.evaluated);
        }
        sch.validate = validate2;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve24.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve24(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output2) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output2.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output2 = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output2)) {
            break;
          }
          if (++tokenCount > 7) {
            output2.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output2)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output2.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output2.address = address.join("");
      return output2;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path2) {
      let input = path2;
      const output2 = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output2.push("/");
            break;
          } else {
            output2.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output2.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output2.length !== 0) {
              output2.pop();
            }
            output2.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output2.length !== 0) {
                  output2.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output2.push(input);
          break;
        } else {
          output2.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output2.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output2 = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output2 += decoded;
            } else {
              output2 += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output2 += input[i];
      }
      return output2;
    }
    function normalizePathEncoding(input) {
      let output2 = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output2 += decoded;
            } else {
              output2 += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output2 += input[i];
        } else {
          output2 += escape(input[i]);
        }
      }
      return output2;
    }
    function escapePreservingEscapes(input) {
      let output2 = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output2 += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output2 += escape(input[i]);
      }
      return output2;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path2, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path2 && path2 !== "/" ? path2 : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve24(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative4, options, skipNormalization) {
      const target2 = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative4 = parse(serialize(relative4, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative4.scheme) {
        target2.scheme = relative4.scheme;
        target2.userinfo = relative4.userinfo;
        target2.host = relative4.host;
        target2.port = relative4.port;
        target2.path = removeDotSegments(relative4.path || "");
        target2.query = relative4.query;
      } else {
        if (relative4.userinfo !== void 0 || relative4.host !== void 0 || relative4.port !== void 0) {
          target2.userinfo = relative4.userinfo;
          target2.host = relative4.host;
          target2.port = relative4.port;
          target2.path = removeDotSegments(relative4.path || "");
          target2.query = relative4.query;
        } else {
          if (!relative4.path) {
            target2.path = base.path;
            if (relative4.query !== void 0) {
              target2.query = relative4.query;
            } else {
              target2.query = base.query;
            }
          } else {
            if (relative4.path[0] === "/") {
              target2.path = removeDotSegments(relative4.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target2.path = "/" + relative4.path;
              } else if (!base.path) {
                target2.path = relative4.path;
              } else {
                target2.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative4.path;
              }
              target2.path = removeDotSegments(target2.path);
            }
            target2.query = relative4.query;
          }
          target2.userinfo = base.userinfo;
          target2.host = base.host;
          target2.port = base.port;
        }
        target2.scheme = base.scheme;
      }
      target2.fragment = relative4.fragment;
      return target2;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve24,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines: lines2 } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines: lines2 });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate2 = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate2));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate2, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate2);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate2);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required: required2 }) {
            return Array.isArray(required2) && required2.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv2, sch) {
        return $data ? ajv2.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// schemas/v1/common.schema.json
var common_schema_default;
var init_common_schema = __esm({
  "schemas/v1/common.schema.json"() {
    common_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/common.schema.json",
      title: "Agent Forum 1.0 Common Definitions",
      $defs: {
        schemaVersion: {
          const: "1.0"
        },
        timestamp: {
          type: "string",
          format: "utc-date-time-ms"
        },
        forumId: {
          type: "string",
          pattern: "^forum_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        roomId: {
          type: "string",
          pattern: "^room_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        threadId: {
          type: "string",
          pattern: "^thread_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        messageId: {
          type: "string",
          pattern: "^msg_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        eventId: {
          type: "string",
          pattern: "^evt_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        memberId: {
          type: "string",
          pattern: "^member_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        slug: {
          type: "string",
          minLength: 1,
          maxLength: 64,
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
        },
        shortText: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          pattern: "^[^\\r\\n\\u0000-\\u001f\\u007f]+$"
        },
        description: {
          type: "string",
          maxLength: 2e3
        },
        role: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          pattern: "^[^\\r\\n\\u0000-\\u001f\\u007f]+$"
        },
        responsibility: {
          type: "string",
          maxLength: 1e3
        },
        reference: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "value"],
          properties: {
            kind: {
              enum: ["repository", "branch", "commit", "path", "symbol", "endpoint", "ticket", "url"]
            },
            value: {
              type: "string",
              minLength: 1,
              maxLength: 2048
            }
          }
        }
      }
    };
  }
});

// schemas/v1/context-bindings.schema.json
var context_bindings_schema_default;
var init_context_bindings_schema = __esm({
  "schemas/v1/context-bindings.schema.json"() {
    context_bindings_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/context-bindings.schema.json",
      title: "Agent Forum Local Context Bindings 1.0",
      type: "object",
      additionalProperties: false,
      required: ["formatVersion", "bindings"],
      properties: {
        formatVersion: {
          const: 1
        },
        bindings: {
          type: "array",
          items: {
            oneOf: [
              { $ref: "#/$defs/branchBinding" },
              { $ref: "#/$defs/workspaceBinding" }
            ]
          }
        }
      },
      $defs: {
        commonProperties: {
          type: "object",
          properties: {
            bindingId: {
              type: "string",
              pattern: "^binding_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
            },
            workspaceType: {
              const: "git"
            },
            workspaceRoot: {
              type: "string",
              minLength: 1,
              maxLength: 32768
            },
            workspaceKey: {
              type: "string",
              minLength: 1,
              maxLength: 32768,
              pattern: "^(?:win32|linux|darwin):"
            },
            forumId: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
            },
            roomId: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
            },
            repositoryFingerprint: {
              type: "string",
              minLength: 1,
              maxLength: 2048
            },
            createdAt: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
            },
            updatedAt: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
            }
          }
        },
        branchBinding: {
          type: "object",
          additionalProperties: false,
          required: [
            "bindingId",
            "workspaceType",
            "workspaceRoot",
            "workspaceKey",
            "scope",
            "branch",
            "forumId",
            "roomId",
            "createdAt",
            "updatedAt"
          ],
          properties: {
            bindingId: { $ref: "#/$defs/commonProperties/properties/bindingId" },
            workspaceType: { $ref: "#/$defs/commonProperties/properties/workspaceType" },
            workspaceRoot: { $ref: "#/$defs/commonProperties/properties/workspaceRoot" },
            workspaceKey: { $ref: "#/$defs/commonProperties/properties/workspaceKey" },
            scope: { const: "branch" },
            branch: {
              type: "string",
              minLength: 1,
              maxLength: 255
            },
            forumId: { $ref: "#/$defs/commonProperties/properties/forumId" },
            roomId: { $ref: "#/$defs/commonProperties/properties/roomId" },
            repositoryFingerprint: { $ref: "#/$defs/commonProperties/properties/repositoryFingerprint" },
            createdAt: { $ref: "#/$defs/commonProperties/properties/createdAt" },
            updatedAt: { $ref: "#/$defs/commonProperties/properties/updatedAt" }
          }
        },
        workspaceBinding: {
          type: "object",
          additionalProperties: false,
          required: [
            "bindingId",
            "workspaceType",
            "workspaceRoot",
            "workspaceKey",
            "scope",
            "forumId",
            "roomId",
            "createdAt",
            "updatedAt"
          ],
          properties: {
            bindingId: { $ref: "#/$defs/commonProperties/properties/bindingId" },
            workspaceType: { $ref: "#/$defs/commonProperties/properties/workspaceType" },
            workspaceRoot: { $ref: "#/$defs/commonProperties/properties/workspaceRoot" },
            workspaceKey: { $ref: "#/$defs/commonProperties/properties/workspaceKey" },
            scope: { const: "workspace" },
            forumId: { $ref: "#/$defs/commonProperties/properties/forumId" },
            roomId: { $ref: "#/$defs/commonProperties/properties/roomId" },
            repositoryFingerprint: { $ref: "#/$defs/commonProperties/properties/repositoryFingerprint" },
            createdAt: { $ref: "#/$defs/commonProperties/properties/createdAt" },
            updatedAt: { $ref: "#/$defs/commonProperties/properties/updatedAt" }
          }
        }
      }
    };
  }
});

// schemas/v1/event.schema.json
var event_schema_default;
var init_event_schema = __esm({
  "schemas/v1/event.schema.json"() {
    event_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/event.schema.json",
      title: "Agent Forum Lifecycle Event 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "id", "scope", "targetId", "type", "actorId", "createdAt", "reason", "data"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        id: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/eventId"
        },
        scope: {
          enum: ["forum", "room", "thread"]
        },
        targetId: {
          type: "string",
          pattern: "^(?:forum|room|thread)_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        type: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        actorId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        },
        reason: {
          type: "string",
          minLength: 1,
          maxLength: 1e3
        },
        data: {
          type: "object"
        }
      },
      allOf: [
        {
          if: { properties: { scope: { const: "forum" } } },
          then: {
            properties: {
              targetId: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
              },
              type: { type: "string", pattern: "^forum-" }
            }
          }
        },
        {
          if: { properties: { scope: { const: "room" } } },
          then: {
            properties: {
              targetId: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
              },
              type: { type: "string", pattern: "^room-" }
            }
          }
        },
        {
          if: { properties: { scope: { const: "thread" } } },
          then: {
            properties: {
              targetId: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/threadId"
              },
              type: { type: "string", pattern: "^thread-" }
            }
          }
        }
      ]
    };
  }
});

// schemas/v1/forum.schema.json
var forum_schema_default;
var init_forum_schema = __esm({
  "schemas/v1/forum.schema.json"() {
    forum_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/forum.schema.json",
      title: "Agent Forum Metadata 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "forumId", "initialName", "initialDescription", "createdBy", "createdAt"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        forumId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
        },
        initialName: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText"
        },
        initialDescription: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/description"
        },
        createdBy: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        }
      }
    };
  }
});

// schemas/v1/inbox-cursor.schema.json
var inbox_cursor_schema_default;
var init_inbox_cursor_schema = __esm({
  "schemas/v1/inbox-cursor.schema.json"() {
    inbox_cursor_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/inbox-cursor.schema.json",
      title: "Agent Forum Local Inbox Cursor 1.0",
      type: "object",
      additionalProperties: false,
      required: ["formatVersion", "forumId", "memberId", "seenIds", "updatedAt"],
      properties: {
        formatVersion: { const: 1 },
        forumId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId" },
        memberId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId" },
        seenIds: {
          type: "array",
          uniqueItems: true,
          items: {
            type: "string",
            pattern: "^(?:msg|evt)_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
          }
        },
        updatedAt: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp" }
      }
    };
  }
});

// schemas/v1/identity-attention.schema.json
var identity_attention_schema_default;
var init_identity_attention_schema = __esm({
  "schemas/v1/identity-attention.schema.json"() {
    identity_attention_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/identity-attention.schema.json",
      title: "Agent Forum Local Identity Attention 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "forumId", "ownerMemberId", "links", "updatedAt"],
      properties: {
        schemaVersion: { const: "1.0" },
        forumId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId" },
        ownerMemberId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId" },
        links: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["subjectMemberId", "mode", "reason", "createdAt"],
            properties: {
              subjectMemberId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId" },
              mode: { enum: ["recovery", "delegation"] },
              reason: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText" },
              createdAt: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp" },
              expiresAt: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp" }
            }
          }
        },
        updatedAt: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp" }
      }
    };
  }
});

// schemas/v1/local-config.schema.json
var local_config_schema_default;
var init_local_config_schema = __esm({
  "schemas/v1/local-config.schema.json"() {
    local_config_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/local-config.schema.json",
      title: "Agent Forum Local Configuration 1.0",
      type: "object",
      additionalProperties: false,
      required: ["formatVersion", "defaultIdentityId", "identities", "forums"],
      properties: {
        formatVersion: {
          const: 1
        },
        defaultIdentityId: {
          oneOf: [
            { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId" },
            { type: "null" }
          ]
        },
        identities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["memberId", "displayName", "role", "responsibility", "createdAt", "updatedAt"],
            properties: {
              memberId: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
              },
              displayName: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText"
              },
              role: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/role"
              },
              responsibility: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/responsibility"
              },
              client: {
                type: "string",
                maxLength: 100
              },
              createdAt: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
              },
              updatedAt: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
              }
            }
          }
        },
        forums: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["alias", "forumId", "path", "dataBranch", "createdAt"],
            properties: {
              alias: {
                type: "string",
                pattern: "^[a-z0-9][a-z0-9._-]{0,63}$"
              },
              forumId: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
              },
              path: {
                type: "string",
                minLength: 1
              },
              dataBranch: {
                type: "string",
                minLength: 1,
                maxLength: 255
              },
              createdAt: {
                $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
              }
            }
          }
        }
      }
    };
  }
});

// schemas/v1/member-profile.schema.json
var member_profile_schema_default;
var init_member_profile_schema = __esm({
  "schemas/v1/member-profile.schema.json"() {
    member_profile_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/member-profile.schema.json",
      title: "Agent Forum Public Member Profile 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "memberId", "displayName", "role", "responsibility", "status", "createdAt", "updatedAt"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        memberId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        displayName: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText"
        },
        role: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/role"
        },
        responsibility: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/responsibility"
        },
        status: {
          enum: ["active", "left"]
        },
        client: {
          type: "string",
          maxLength: 100
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        },
        updatedAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        }
      }
    };
  }
});

// schemas/v1/message.schema.json
var message_schema_default;
var init_message_schema = __esm({
  "schemas/v1/message.schema.json"() {
    message_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/message.schema.json",
      title: "Agent Forum Message Metadata 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "id", "threadId", "authorId", "type", "createdAt", "replyTo", "mentions", "references"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        id: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/messageId"
        },
        threadId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/threadId"
        },
        authorId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        type: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        },
        replyTo: {
          oneOf: [
            { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/messageId" },
            { type: "null" }
          ]
        },
        mentions: {
          type: "array",
          uniqueItems: true,
          items: {
            $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
          }
        },
        references: {
          type: "array",
          items: {
            $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/reference"
          }
        },
        audience: {
          type: "string",
          enum: ["broadcast"]
        }
      }
    };
  }
});

// schemas/v1/protocol.schema.json
var protocol_schema_default;
var init_protocol_schema = __esm({
  "schemas/v1/protocol.schema.json"() {
    protocol_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/protocol.schema.json",
      title: "Agent Forum Protocol 1.0",
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "stability", "forumId", "dataBranch", "createdAt"],
      properties: {
        protocolVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        stability: {
          const: "draft"
        },
        forumId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
        },
        dataBranch: {
          type: "string",
          minLength: 1,
          maxLength: 255,
          pattern: "^(?!-)(?!.*(?:\\.\\.|//|@\\{|[ ~^:?*\\[]))(?!.*\\.$).+$"
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        }
      }
    };
  }
});

// schemas/v1/publish-policy.schema.json
var publish_policy_schema_default;
var init_publish_policy_schema = __esm({
  "schemas/v1/publish-policy.schema.json"() {
    publish_policy_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/publish-policy.schema.json",
      title: "Agent Forum Local Publish Policy 1.0",
      type: "object",
      additionalProperties: false,
      required: ["formatVersion", "entries"],
      properties: {
        formatVersion: {
          const: 1
        },
        entries: {
          type: "array",
          items: {
            $ref: "#/$defs/publishPolicyEntry"
          }
        }
      },
      $defs: {
        publishPolicyEntry: {
          type: "object",
          additionalProperties: false,
          required: ["forumId", "roomId", "mode", "updatedAt"],
          properties: {
            forumId: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId"
            },
            roomId: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
            },
            mode: {
              enum: ["auto", "ask"]
            },
            updatedAt: {
              $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
            }
          }
        }
      }
    };
  }
});

// schemas/v1/room-member.schema.json
var room_member_schema_default;
var init_room_member_schema = __esm({
  "schemas/v1/room-member.schema.json"() {
    room_member_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/room-member.schema.json",
      title: "Agent Forum Room Member 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "roomId", "memberId", "role", "responsibility", "status", "joinedAt", "updatedAt"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        roomId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
        },
        memberId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        role: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/role"
        },
        responsibility: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/responsibility"
        },
        status: {
          enum: ["active", "left"]
        },
        joinedAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        },
        updatedAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        }
      }
    };
  }
});

// schemas/v1/room.schema.json
var room_schema_default;
var init_room_schema = __esm({
  "schemas/v1/room.schema.json"() {
    room_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/room.schema.json",
      title: "Agent Forum Room 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "id", "slug", "initialTitle", "initialDescription", "createdBy", "createdAt"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        id: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
        },
        slug: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/slug"
        },
        initialTitle: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText"
        },
        initialDescription: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/description"
        },
        createdBy: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        }
      }
    };
  }
});

// schemas/v1/thread.schema.json
var thread_schema_default;
var init_thread_schema = __esm({
  "schemas/v1/thread.schema.json"() {
    thread_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://agent-forum.dev/schemas/v1/thread.schema.json",
      title: "Agent Forum Thread 1.0",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "id", "roomId", "initialTitle", "kind", "createdBy", "createdAt", "firstMessageId"],
      properties: {
        schemaVersion: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/schemaVersion"
        },
        id: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/threadId"
        },
        roomId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/roomId"
        },
        initialTitle: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/shortText"
        },
        kind: {
          enum: [
            "discussion",
            "question",
            "proposal",
            "change",
            "blocker",
            "review",
            "status",
            "test-result"
          ]
        },
        createdBy: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId"
        },
        createdAt: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp"
        },
        firstMessageId: {
          $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/messageId"
        }
      }
    };
  }
});

// schemas/v1/thread-watch.schema.json
var thread_watch_schema_default;
var init_thread_watch_schema = __esm({
  "schemas/v1/thread-watch.schema.json"() {
    thread_watch_schema_default = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://agent-forum.dev/schemas/v1/thread-watch.schema.json", type: "object", additionalProperties: false, required: ["schemaVersion", "forumId", "memberId", "threadIds", "updatedAt"], properties: { schemaVersion: { const: "1.0" }, forumId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/forumId" }, memberId: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/memberId" }, threadIds: { type: "array", uniqueItems: true, items: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/threadId" } }, updatedAt: { $ref: "https://agent-forum.dev/schemas/v1/common.schema.json#/$defs/timestamp" } } };
  }
});

// src/protocol/validator.ts
function toIssues(errors) {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "schema validation failed"
  }));
}
function normalizeProtocolReadDocument(schemaName, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value;
  const versionField = schemaName === "protocol" ? "protocolVersion" : "schemaVersion";
  let normalized;
  const version2 = record[versionField];
  if (version2 === 1 || version2 === "1" || typeof version2 === "string" && /^1\.\d+$/u.test(version2)) {
    normalized = { ...record, [versionField]: "1.0" };
  }
  const createdAt = record.createdAt;
  if (typeof createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(createdAt) && !isCanonicalUtcTimestamp(createdAt)) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.valueOf())) normalized = { ...normalized ?? record, createdAt: date.toISOString() };
  }
  return normalized ?? value;
}
function validateProtocolDocument(schemaName, value, options = {}) {
  const validator = validators.get(schemaName);
  if (!validator) {
    return {
      ok: false,
      issues: [
        {
          path: "/",
          keyword: "schema",
          message: `unknown protocol schema: ${schemaName}`
        }
      ]
    };
  }
  const mode = options.mode ?? "write";
  const candidate = mode === "read" ? normalizeProtocolReadDocument(schemaName, value) : value;
  if (validator(candidate)) return { ok: true };
  const issues = toIssues(validator.errors).filter(
    (issue) => mode !== "read" || issue.keyword !== "additionalProperties"
  );
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
var import__, schemaDocuments, ajv, validators;
var init_validator = __esm({
  "src/protocol/validator.ts"() {
    "use strict";
    import__ = __toESM(require__(), 1);
    init_common_schema();
    init_context_bindings_schema();
    init_event_schema();
    init_forum_schema();
    init_inbox_cursor_schema();
    init_identity_attention_schema();
    init_local_config_schema();
    init_member_profile_schema();
    init_message_schema();
    init_protocol_schema();
    init_publish_policy_schema();
    init_room_member_schema();
    init_room_schema();
    init_thread_schema();
    init_thread_watch_schema();
    init_timestamps();
    schemaDocuments = {
      protocol: protocol_schema_default,
      "context-bindings": context_bindings_schema_default,
      "publish-policy": publish_policy_schema_default,
      forum: forum_schema_default,
      "inbox-cursor": inbox_cursor_schema_default,
      "identity-attention": identity_attention_schema_default,
      "local-config": local_config_schema_default,
      "member-profile": member_profile_schema_default,
      "room-member": room_member_schema_default,
      room: room_schema_default,
      thread: thread_schema_default,
      "thread-watch": thread_watch_schema_default,
      message: message_schema_default,
      event: event_schema_default
    };
    ajv = new import__.Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: true
    });
    ajv.addFormat("utc-date-time-ms", {
      type: "string",
      validate: isCanonicalUtcTimestamp
    });
    ajv.addSchema(common_schema_default);
    validators = /* @__PURE__ */ new Map();
    for (const [name, schema] of Object.entries(schemaDocuments)) {
      validators.set(name, ajv.compile(schema));
    }
  }
});

// src/storage/atomic.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import {
  link,
  lstat,
  mkdir as mkdir2,
  open,
  readdir,
  rename as rename2,
  rm as rm2,
  stat as stat2
} from "node:fs/promises";
import { dirname as dirname2, resolve as resolve3 } from "node:path";
async function pathExists(path2) {
  try {
    await stat2(path2);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
async function writeFileAtomic(destination, content, options = {}) {
  await mkdir2(dirname2(destination), { recursive: true });
  const temporary = resolve3(
    dirname2(destination),
    `${temporaryPrefix}${randomUUID2()}`
  );
  let handle;
  try {
    handle = await open(temporary, "wx", options.mode ?? 384);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = void 0;
    if (options.overwrite) {
      await rename2(temporary, destination);
    } else {
      await link(temporary, destination);
      await rm2(temporary, { force: true });
    }
  } catch (error) {
    await handle?.close().catch(() => void 0);
    await rm2(temporary, { force: true });
    if (!options.overwrite && !(error instanceof StorageError) && await pathExists(destination)) {
      throw new StorageError(
        "IMMUTABLE_PATH_EXISTS",
        `immutable path already exists: ${destination}`
      );
    }
    throw error;
  }
}
async function writeJsonAtomic(destination, value, options = {}) {
  await writeFileAtomic(
    destination,
    `${JSON.stringify(value, null, 2)}
`,
    options
  );
}
async function writeValidatedJsonAtomic(destination, schema, value, options = {}) {
  const validation = validateProtocolDocument(schema, value, { mode: "write" });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `document does not satisfy the ${schema} schema`,
      validation.issues
    );
  }
  await writeJsonAtomic(destination, value, options);
}
async function createImmutableDirectory(destination, writer) {
  await mkdir2(dirname2(destination), { recursive: true });
  if (await pathExists(destination)) {
    throw new StorageError(
      "IMMUTABLE_PATH_EXISTS",
      `immutable directory already exists: ${destination}`
    );
  }
  const temporary = resolve3(
    dirname2(destination),
    `${temporaryPrefix}${randomUUID2()}`
  );
  try {
    await mkdir2(temporary, { mode: 448 });
    await writer(temporary);
    await rename2(temporary, destination);
  } catch (error) {
    await rm2(temporary, { recursive: true, force: true });
    if (!(error instanceof StorageError) && await pathExists(destination)) {
      throw new StorageError(
        "IMMUTABLE_PATH_EXISTS",
        `immutable directory already exists: ${destination}`
      );
    }
    throw error;
  }
}
var temporaryPrefix;
var init_atomic = __esm({
  "src/storage/atomic.ts"() {
    "use strict";
    init_validator();
    init_errors();
    temporaryPrefix = ".agent-forum-tmp-";
  }
});

// src/services/errors.ts
var ServiceError;
var init_errors2 = __esm({
  "src/services/errors.ts"() {
    "use strict";
    ServiceError = class extends Error {
      constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "ServiceError";
      }
    };
  }
});

// src/config/local-config.ts
var local_config_exports = {};
__export(local_config_exports, {
  createLocalIdentity: () => createLocalIdentity,
  emptyLocalConfig: () => emptyLocalConfig,
  findForum: () => findForum,
  findIdentity: () => findIdentity,
  loadLocalConfig: () => loadLocalConfig,
  registerLocalForum: () => registerLocalForum,
  saveLocalConfig: () => saveLocalConfig,
  unregisterLocalForum: () => unregisterLocalForum,
  updateLocalIdentity: () => updateLocalIdentity
});
import { readFile as readFile2 } from "node:fs/promises";
import { resolve as resolve4 } from "node:path";
function emptyLocalConfig() {
  return {
    formatVersion: 1,
    defaultIdentityId: null,
    identities: [],
    forums: []
  };
}
function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `local config contains duplicate ${label}`
    );
  }
}
function validateLocalConfigSemantics(config, paths) {
  assertUnique(config.identities.map((identity) => identity.memberId), "member IDs");
  assertUnique(config.forums.map((forum) => forum.alias), "forum aliases");
  assertUnique(config.forums.map((forum) => forum.forumId), "forum IDs");
  assertUnique(config.forums.map((forum) => resolve4(forum.path)), "forum paths");
  if (config.defaultIdentityId !== null && !config.identities.some(
    (identity) => identity.memberId === config.defaultIdentityId
  )) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      "defaultIdentityId does not refer to a configured identity"
    );
  }
  for (const forum of config.forums) {
    if (resolve4(forum.path) !== forumClonePath(paths, forum.alias)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `forum path is outside the managed alias location: ${forum.alias}`
      );
    }
  }
}
async function loadLocalConfig(paths = createAgentForumPaths()) {
  try {
    const value = JSON.parse(await readFile2(paths.configFile, "utf8"));
    const validation = validateProtocolDocument("local-config", value, {
      mode: "write"
    });
    if (!validation.ok) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `local config is invalid: ${paths.configFile}`,
        validation.issues
      );
    }
    const config = value;
    validateLocalConfigSemantics(config, paths);
    return config;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyLocalConfig();
    }
    throw error;
  }
}
async function saveLocalConfig(paths, config) {
  validateLocalConfigSemantics(config, paths);
  await writeValidatedJsonAtomic(paths.configFile, "local-config", config, {
    overwrite: true,
    mode: 384
  });
}
function findIdentity(config, memberId) {
  const selected = memberId ?? config.defaultIdentityId;
  if (!selected) {
    throw new ServiceError(
      "DEFAULT_IDENTITY_REQUIRED",
      "no default identity is configured"
    );
  }
  const identity = config.identities.find(
    (candidate) => candidate.memberId === selected
  );
  if (!identity) {
    throw new ServiceError(
      "IDENTITY_NOT_FOUND",
      `identity is not configured: ${selected}`
    );
  }
  return identity;
}
function findForum(config, alias) {
  const forum = config.forums.find((candidate) => candidate.alias === alias);
  if (!forum) {
    throw new ServiceError("FORUM_NOT_FOUND", `forum alias is not configured: ${alias}`);
  }
  return forum;
}
async function acquireConfigLock(paths, command) {
  return acquireForumLock({
    lockPath: resolve4(paths.locksDirectory, "config.lock"),
    command
  });
}
async function createLocalIdentity(input, paths = createAgentForumPaths()) {
  const lock = await acquireConfigLock(paths, "identity create");
  try {
    const config = await loadLocalConfig(paths);
    const timestamp = currentUtcTimestamp(input.now);
    const memberId = input.memberId ?? createEntityId("member");
    if (config.identities.some((identity2) => identity2.memberId === memberId)) {
      throw new ServiceError(
        "IDENTITY_EXISTS",
        `identity is already configured: ${memberId}`
      );
    }
    const identity = {
      memberId,
      displayName: input.displayName,
      role: input.role,
      responsibility: input.responsibility,
      ...input.client ? { client: input.client } : {},
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const defaultIdentityId = input.setDefault === false && config.defaultIdentityId ? config.defaultIdentityId : identity.memberId;
    const next = {
      ...config,
      defaultIdentityId,
      identities: [...config.identities, identity]
    };
    await saveLocalConfig(paths, next);
    return { identity, defaultIdentityId };
  } finally {
    await lock.release();
  }
}
async function updateLocalIdentity(input, paths = createAgentForumPaths()) {
  const lock = await acquireConfigLock(paths, "identity update");
  try {
    const config = await loadLocalConfig(paths);
    const existing = findIdentity(config, input.memberId);
    const { client: existingClient, ...identityBase } = existing;
    const identity = {
      ...identityBase,
      ...input.displayName !== void 0 ? { displayName: input.displayName } : {},
      ...input.role !== void 0 ? { role: input.role } : {},
      ...input.responsibility !== void 0 ? { responsibility: input.responsibility } : {},
      ...input.client === null ? {} : input.client !== void 0 ? { client: input.client } : existingClient ? { client: existingClient } : {},
      updatedAt: currentUtcTimestamp(input.now)
    };
    const identities = config.identities.map(
      (candidate) => candidate.memberId === existing.memberId ? identity : candidate
    );
    const defaultIdentityId = input.setDefault ? existing.memberId : config.defaultIdentityId ?? existing.memberId;
    await saveLocalConfig(paths, { ...config, identities, defaultIdentityId });
    return { identity, defaultIdentityId };
  } finally {
    await lock.release();
  }
}
async function registerLocalForum(registration, paths = createAgentForumPaths()) {
  const lock = await acquireConfigLock(paths, "forum register");
  try {
    const config = await loadLocalConfig(paths);
    if (config.forums.some((forum) => forum.alias === registration.alias)) {
      throw new ServiceError(
        "FORUM_ALIAS_EXISTS",
        `forum alias is already configured: ${registration.alias}`
      );
    }
    await saveLocalConfig(paths, {
      ...config,
      forums: [...config.forums, registration]
    });
  } finally {
    await lock.release();
  }
}
async function unregisterLocalForum(alias, paths = createAgentForumPaths()) {
  const lock = await acquireConfigLock(paths, "forum unregister");
  try {
    const config = await loadLocalConfig(paths);
    const registration = findForum(config, alias);
    await saveLocalConfig(paths, {
      ...config,
      forums: config.forums.filter((forum) => forum.alias !== alias)
    });
    return registration;
  } finally {
    await lock.release();
  }
}
var init_local_config = __esm({
  "src/config/local-config.ts"() {
    "use strict";
    init_ids();
    init_timestamps();
    init_lock();
    init_paths();
    init_atomic();
    init_errors();
    init_validator();
    init_errors2();
  }
});

// src/git/runner.ts
import { spawnSync } from "node:child_process";
function redactGitOutput(value) {
  return value.replace(/(https?:\/\/)[^/@\s]+@/giu, "$1***@").replace(/(https?:\/\/[^/:\s]+:)[^@\s]+@/giu, "$1***@").replace(/([?&][^=&#\s]+)=([^&#\s]+)/gu, "$1=***").replace(/(https?:\/\/[^#\s]+)#[^\s]+/giu, "$1#***");
}
function runGit(cwd, args2) {
  const result = spawnSync("git", [...args2], {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C"
    },
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    throw new GitCommandError(
      "GIT_UNAVAILABLE",
      `failed to execute Git: ${result.error.message}`
    );
  }
  return {
    status: result.status ?? 1,
    stdout: redactGitOutput(result.stdout ?? ""),
    stderr: redactGitOutput(result.stderr ?? "")
  };
}
function requireGit(cwd, args2) {
  const result = runGit(cwd, args2);
  if (result.status !== 0) {
    throw new GitCommandError(
      "GIT_COMMAND_FAILED",
      `git ${redactGitOutput(args2.join(" "))} failed: ${result.stderr || result.stdout}`,
      result
    );
  }
  return result;
}
function assertGitBranchName(cwd, branch) {
  const result = runGit(cwd, ["check-ref-format", "--branch", branch]);
  if (result.status !== 0) {
    throw new GitCommandError(
      "INVALID_GIT_BRANCH",
      `invalid Git branch name: ${branch}`,
      result
    );
  }
}
function assertCleanWorktree(repository2) {
  const status = requireGit(repository2, ["status", "--porcelain"]).stdout;
  if (status.trim().length > 0) {
    throw new GitCommandError(
      "GIT_DIRTY_WORKTREE",
      `managed forum worktree is not clean: ${repository2}`
    );
  }
}
function configureForumCommitIdentity(repository2, displayName, memberId) {
  requireGit(repository2, [
    "-c",
    "core.longpaths=true",
    "config",
    "core.longpaths",
    "true"
  ]);
  requireGit(repository2, ["config", "user.name", displayName]);
  requireGit(repository2, [
    "config",
    "user.email",
    `${memberId}@agent-forum.invalid`
  ]);
  requireGit(repository2, ["config", "core.autocrlf", "false"]);
}
function commitPaths(repository2, paths, message) {
  requireGit(repository2, ["add", "--", ...paths]);
  requireGit(repository2, ["commit", "-m", message]);
  return requireGit(repository2, ["rev-parse", "HEAD"]).stdout.trim();
}
var GitCommandError;
var init_runner = __esm({
  "src/git/runner.ts"() {
    "use strict";
    GitCommandError = class extends Error {
      constructor(code, message, result) {
        super(message);
        this.code = code;
        this.result = result;
        this.name = "GitCommandError";
      }
    };
  }
});

// src/domain/state-transitions.ts
function isKnownLifecycleEventType(value) {
  return knownLifecycleEventTypeSet.has(value);
}
function requiredText(data, field, maxLength) {
  const value = data[field];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new StateTransitionError(
      "INVALID_EVENT_DATA",
      `${field} must be a non-empty string with at most ${maxLength} characters`
    );
  }
  return value;
}
function assertTarget(state2, event) {
  if (state2.scope !== event.scope || state2.id !== event.targetId) {
    throw new StateTransitionError(
      "EVENT_TARGET_MISMATCH",
      `event target ${event.scope}:${event.targetId} does not match ${state2.scope}:${state2.id}`
    );
  }
}
function archive(state2) {
  if (state2.status === "archived") {
    throw new StateTransitionError(
      "INVALID_STATE_TRANSITION",
      `${state2.scope} is already archived`
    );
  }
  return { ...state2, status: "archived" };
}
function restore(state2) {
  if (state2.status === "active") {
    throw new StateTransitionError(
      "INVALID_STATE_TRANSITION",
      `${state2.scope} is already active`
    );
  }
  return { ...state2, status: "active" };
}
function optionalRoomId(data) {
  const value = data.replacementRoomId;
  if (value === void 0) return void 0;
  if (typeof value !== "string" || !/^room_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
    throw new StateTransitionError(
      "INVALID_EVENT_DATA",
      "replacementRoomId must be a valid room ID when provided"
    );
  }
  return value;
}
function applyLifecycleEvent(state2, event) {
  assertTarget(state2, event);
  if (state2.scope === "forum") {
    const forum = state2;
    switch (event.type) {
      case "forum-renamed":
        return { ...forum, name: requiredText(event.data, "name", 200) };
      case "forum-description-changed":
        return {
          ...forum,
          description: requiredText(event.data, "description", 2e3)
        };
      case "forum-archived":
        return archive(forum);
      case "forum-restored":
        return restore(forum);
      default:
        break;
    }
  }
  if (state2.scope === "room") {
    const room = state2;
    switch (event.type) {
      case "room-renamed":
        return { ...room, title: requiredText(event.data, "title", 200) };
      case "room-description-changed":
        return {
          ...room,
          description: requiredText(event.data, "description", 2e3)
        };
      case "room-archived":
        return archive(room);
      case "room-restored":
        return restore(room);
      case "room-deprecated": {
        if (room.status !== "active") {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "cannot deprecate an archived room"
          );
        }
        if (room.deprecation) {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "room is already deprecated"
          );
        }
        const replacementRoomId = optionalRoomId(event.data);
        if (replacementRoomId === room.id) {
          throw new StateTransitionError(
            "INVALID_EVENT_DATA",
            "replacementRoomId cannot be the deprecated room itself"
          );
        }
        return {
          ...room,
          deprecation: replacementRoomId ? { replacementRoomId } : {}
        };
      }
      case "room-reenabled":
        if (!room.deprecation) {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "room is not deprecated"
          );
        }
        const { deprecation: _deprecation, ...reenabled } = room;
        return reenabled;
      default:
        break;
    }
  }
  if (state2.scope === "thread") {
    const thread = state2;
    switch (event.type) {
      case "thread-renamed":
        return { ...thread, title: requiredText(event.data, "title", 200) };
      case "thread-closed":
        if (thread.status === "closed") {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "thread is already closed"
          );
        }
        return { ...thread, status: "closed" };
      case "thread-reopened":
        if (thread.status === "open") {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "thread is already open"
          );
        }
        return { ...thread, status: "open" };
      default:
        break;
    }
  }
  throw new StateTransitionError(
    "UNKNOWN_EVENT_TYPE",
    `unsupported ${event.scope} event type: ${event.type}`
  );
}
var knownLifecycleEventTypes, knownLifecycleEventTypeSet, StateTransitionError;
var init_state_transitions = __esm({
  "src/domain/state-transitions.ts"() {
    "use strict";
    knownLifecycleEventTypes = [
      "forum-renamed",
      "forum-description-changed",
      "forum-archived",
      "forum-restored",
      "room-renamed",
      "room-description-changed",
      "room-archived",
      "room-restored",
      "room-deprecated",
      "room-reenabled",
      "thread-renamed",
      "thread-closed",
      "thread-reopened"
    ];
    knownLifecycleEventTypeSet = new Set(knownLifecycleEventTypes);
    StateTransitionError = class extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "StateTransitionError";
      }
    };
  }
});

// src/domain/message-types.ts
function isKnownMessageType(value) {
  return knownMessageTypeSet.has(value);
}
var knownMessageTypes, knownMessageTypeSet;
var init_message_types = __esm({
  "src/domain/message-types.ts"() {
    "use strict";
    knownMessageTypes = [
      "discussion",
      "question",
      "answer",
      "proposal",
      "decision",
      "change",
      "blocker",
      "review",
      "status",
      "test-result",
      "acknowledgement",
      "objection",
      "correction"
    ];
    knownMessageTypeSet = new Set(knownMessageTypes);
  }
});

// src/storage/protocol-store.ts
import { basename, resolve as resolve5 } from "node:path";
async function createImmutableMessage(destination, metadata, body) {
  if (body.trim().length === 0 || body.includes("\0")) {
    throw new StorageError(
      "INVALID_MESSAGE_BODY",
      "message body must be non-empty and must not contain NUL"
    );
  }
  if (metadata && typeof metadata === "object" && "id" in metadata && typeof metadata.id === "string" && basename(destination) !== metadata.id) {
    throw new StorageError(
      "PATH_ID_MISMATCH",
      `message path does not match metadata ID: ${destination}`
    );
  }
  if (metadata && typeof metadata === "object" && "type" in metadata && typeof metadata.type === "string" && !isKnownMessageType(metadata.type)) {
    throw new StorageError(
      "UNKNOWN_MESSAGE_TYPE",
      `current writer cannot publish message type: ${metadata.type}`
    );
  }
  await createImmutableDirectory(destination, async (temporaryDirectory) => {
    await writeValidatedJsonAtomic(
      resolve5(temporaryDirectory, "message.json"),
      "message",
      metadata
    );
    await writeFileAtomic(resolve5(temporaryDirectory, "body.md"), body);
  });
}
async function createImmutableEvent(destination, event) {
  if (event && typeof event === "object" && "id" in event && typeof event.id === "string" && basename(destination) !== event.id) {
    throw new StorageError(
      "PATH_ID_MISMATCH",
      `event path does not match event ID: ${destination}`
    );
  }
  if (event && typeof event === "object" && "type" in event && typeof event.type === "string" && !isKnownLifecycleEventType(event.type)) {
    throw new StorageError(
      "UNKNOWN_EVENT_TYPE",
      `current writer cannot publish lifecycle event type: ${event.type}`
    );
  }
  await createImmutableDirectory(destination, async (temporaryDirectory) => {
    await writeValidatedJsonAtomic(
      resolve5(temporaryDirectory, "event.json"),
      "event",
      event
    );
  });
}
var init_protocol_store = __esm({
  "src/storage/protocol-store.ts"() {
    "use strict";
    init_message_types();
    init_state_transitions();
    init_atomic();
    init_errors();
  }
});

// src/services/conflicts.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { readdir as readdir2, readFile as readFile4, rm as rm3 } from "node:fs/promises";
import { resolve as resolve6 } from "node:path";
function operationsDirectory(paths, forumId) {
  return resolve6(forumStatePath(paths, forumId), "operations");
}
function journalPath(paths, forumId, operationId) {
  if (!/^op_[0-9a-f-]{36}$/u.test(operationId)) {
    throw new ServiceError("CONFLICT_NOT_FOUND", `invalid conflict ID: ${operationId}`);
  }
  return resolve6(operationsDirectory(paths, forumId), `${operationId}.json`);
}
function validateJournal(value) {
  if (!value || typeof value !== "object") throw new Error("journal is not an object");
  const item = value;
  if (item.formatVersion !== 1 || typeof item.operationId !== "string" || typeof item.forumId !== "string" || typeof item.forumAlias !== "string" || typeof item.branch !== "string" || !["conflict", "reissue-prepared"].includes(String(item.status)) || typeof item.originalHead !== "string" || typeof item.localHead !== "string" || typeof item.remoteHead !== "string" || typeof item.recoveryRef !== "string" || !Array.isArray(item.conflicts) || !item.conflicts.every((path2) => typeof path2 === "string") || typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") {
    throw new Error("journal fields are invalid");
  }
  return item;
}
async function recordSyncConflict(input) {
  const operationId = `op_${randomUUID3()}`;
  const recoveryRef = `refs/agent-forum/recovery/${operationId.slice(3)}`;
  requireGit(input.repository, ["update-ref", recoveryRef, input.originalHead]);
  const timestamp = currentUtcTimestamp();
  const journal = {
    formatVersion: 1,
    operationId,
    forumId: input.forumId,
    forumAlias: input.forumAlias,
    branch: input.branch,
    status: "conflict",
    originalHead: input.originalHead,
    localHead: input.localHead,
    remoteHead: input.remoteHead,
    recoveryRef,
    conflicts: input.conflicts,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  try {
    await writeJsonAtomic(journalPath(input.paths, input.forumId, operationId), journal);
  } catch (error) {
    runGit(input.repository, ["update-ref", "-d", recoveryRef]);
    throw error;
  }
  return journal;
}
async function registrationFor(alias, paths) {
  return findForum(await loadLocalConfig(paths), alias);
}
async function getConflict(forumAlias, operationId, paths = createAgentForumPaths()) {
  const registration = await registrationFor(forumAlias, paths);
  try {
    return validateJournal(
      JSON.parse(await readFile4(journalPath(paths, registration.forumId, operationId), "utf8"))
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new ServiceError("CONFLICT_NOT_FOUND", `conflict was not found: ${operationId}`);
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("CONFLICT_JOURNAL_DAMAGED", `conflict journal is damaged: ${operationId}`);
  }
}
async function listConflicts(forumAlias, paths = createAgentForumPaths()) {
  const registration = await registrationFor(forumAlias, paths);
  let entries;
  try {
    entries = await readdir2(operationsDirectory(paths, registration.forumId));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { conflicts: [] };
    }
    throw error;
  }
  const conflicts = [];
  for (const entry of entries.filter((name) => name.endsWith(".json"))) {
    conflicts.push(await getConflict(forumAlias, entry.slice(0, -5), paths));
  }
  conflicts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return { conflicts };
}
async function prepareConflictReissue(forumAlias, operationId, paths = createAgentForumPaths()) {
  const registration = await registrationFor(forumAlias, paths);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum conflict prepare-reissue"
  });
  try {
    const journal = await getConflict(forumAlias, operationId, paths);
    assertCleanWorktree(registration.path);
    requireGit(registration.path, ["rev-parse", journal.recoveryRef]);
    const remoteHead = requireGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`
    ]).stdout.trim();
    if (remoteHead !== journal.remoteHead) {
      throw new ServiceError(
        "CONFLICT_REMOTE_CHANGED",
        "remote-tracking HEAD changed after the conflict; retry sync before preparing a reissue"
      );
    }
    requireGit(registration.path, ["reset", "--hard", journal.remoteHead]);
    const updated = {
      ...journal,
      status: "reissue-prepared",
      updatedAt: currentUtcTimestamp()
    };
    await writeJsonAtomic(journalPath(paths, registration.forumId, operationId), updated, {
      overwrite: true
    });
    return updated;
  } finally {
    await lock.release();
  }
}
async function closeConflict(forumAlias, operationId, paths = createAgentForumPaths()) {
  const registration = await registrationFor(forumAlias, paths);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum conflict close"
  });
  try {
    const journal = await getConflict(forumAlias, operationId, paths);
    requireGit(registration.path, ["update-ref", "-d", journal.recoveryRef]);
    await rm3(journalPath(paths, registration.forumId, operationId), { force: true });
    return { operationId, closed: true };
  } finally {
    await lock.release();
  }
}
var init_conflicts = __esm({
  "src/services/conflicts.ts"() {
    "use strict";
    init_local_config();
    init_timestamps();
    init_runner();
    init_atomic();
    init_lock();
    init_paths();
    init_errors2();
  }
});

// src/services/forum-lifecycle.ts
import { readFile as readFile5, readdir as readdir3, rm as rm4 } from "node:fs/promises";
import { resolve as resolve7 } from "node:path";
async function readForumView(forumAlias, paths) {
  const { registration } = await openForum(forumAlias, paths);
  const basePath = resolve7(registration.path, ".forum", "forum.json");
  const base = await readJsonDocument(basePath, "forum");
  if (base.forumId !== registration.forumId) {
    throw new ServiceError("FORUM_PROTOCOL_MISMATCH", "forum metadata ID does not match registration");
  }
  let state2 = {
    scope: "forum",
    id: String(base.forumId),
    name: String(base.initialName),
    description: String(base.initialDescription),
    status: "active"
  };
  let lastActivityAt = String(base.createdAt);
  const warnings = [];
  const eventsDirectory = resolve7(registration.path, ".forum", "events");
  let entries = [];
  try {
    entries = await readdir3(eventsDirectory, { withFileTypes: true });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const events = [];
  for (const entry of entries) {
    const eventPath = resolve7(eventsDirectory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push({ code: "INVALID_EVENT_PATH", path: resolve7(eventsDirectory, entry.name), message: "forum event path is invalid" });
      continue;
    }
    try {
      const event = await readJsonDocument(eventPath, "event");
      if (event.id !== entry.name) {
        throw new StorageError("PATH_ID_MISMATCH", "event ID does not match path");
      }
      events.push(event);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  events.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id)));
  for (const event of events) {
    const eventPath = resolve7(eventsDirectory, String(event.id), "event.json");
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push({ code: "UNKNOWN_EVENT_TYPE", path: eventPath, message: `unknown forum event type: ${String(event.type)}` });
      continue;
    }
    try {
      state2 = applyLifecycleEvent(state2, {
        scope: "forum",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data
      });
      lastActivityAt = String(event.createdAt);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  return {
    forum: {
      forumId: state2.id,
      name: state2.name,
      description: state2.description,
      status: state2.status,
      createdBy: String(base.createdBy),
      createdAt: String(base.createdAt),
      lastActivityAt
    },
    warnings
  };
}
async function showForum(forumAlias, paths = createAgentForumPaths()) {
  return readForumView(forumAlias, paths);
}
async function createForumEvent(input, paths = createAgentForumPaths()) {
  return withForumWrite(input.forumAlias, input.identityId, paths, input.type, async (registration, identity) => {
    const current = await readForumView(input.forumAlias, paths);
    const eventId = input.eventId ?? createEntityId("event");
    const timestamp = currentUtcTimestamp(input.now);
    const event = {
      schemaVersion: "1.0",
      id: eventId,
      scope: "forum",
      targetId: registration.forumId,
      type: input.type,
      actorId: identity.memberId,
      createdAt: timestamp,
      reason: input.reason,
      data: input.data
    };
    const next = applyLifecycleEvent(
      {
        scope: "forum",
        id: current.forum.forumId,
        name: current.forum.name,
        description: current.forum.description,
        status: current.forum.status
      },
      event
    );
    const directory = resolve7(registration.path, ".forum", "events", eventId);
    let created = false;
    try {
      await createImmutableEvent(directory, event);
      created = true;
      const commit = commitPaths(registration.path, [directory], `${input.type} ${registration.forumId}`);
      return {
        eventId,
        forum: { ...current.forum, name: next.name, description: next.description, status: next.status, lastActivityAt: timestamp },
        commit
      };
    } catch (error) {
      runGit(registration.path, ["reset", "--", directory]);
      if (created) await rm4(directory, { recursive: true, force: true });
      throw error;
    }
  });
}
async function leaveForum(forumAlias, identityId, paths = createAgentForumPaths(), now = /* @__PURE__ */ new Date()) {
  return withForumWrite(forumAlias, identityId, paths, "identity leave", async (registration, identity) => {
    const profilePath = resolve7(registration.path, "members", identity.memberId, "profile.json");
    const previous = await readFile5(profilePath, "utf8");
    const profile = await readJsonDocument(profilePath, "member-profile");
    const next = { ...profile, status: "left", updatedAt: currentUtcTimestamp(now) };
    try {
      await writeValidatedJsonAtomic(profilePath, "member-profile", next, { overwrite: true });
      const commit = commitPaths(registration.path, [profilePath], `Leave forum ${identity.memberId}`);
      return { memberId: identity.memberId, commit };
    } catch (error) {
      runGit(registration.path, ["reset", "--", profilePath]);
      await writeFileAtomic(profilePath, previous, { overwrite: true });
      throw error;
    }
  });
}
var init_forum_lifecycle = __esm({
  "src/services/forum-lifecycle.ts"() {
    "use strict";
    init_ids();
    init_state_transitions();
    init_timestamps();
    init_runner();
    init_atomic();
    init_errors();
    init_paths();
    init_protocol_store();
    init_errors2();
    init_room();
  }
});

// src/domain/thread-kinds.ts
function isKnownThreadKind(value) {
  return knownThreadKindSet.has(value);
}
var knownThreadKinds, knownThreadKindSet;
var init_thread_kinds = __esm({
  "src/domain/thread-kinds.ts"() {
    "use strict";
    knownThreadKinds = [
      "discussion",
      "question",
      "proposal",
      "change",
      "blocker",
      "review",
      "status",
      "test-result"
    ];
    knownThreadKindSet = new Set(knownThreadKinds);
  }
});

// src/services/publish-policy.ts
import { readFile as readFile6 } from "node:fs/promises";
function emptyPublishPolicy() {
  return { formatVersion: 1, entries: [] };
}
function entryKey(entry) {
  return `${entry.forumId}\0${entry.roomId}`;
}
function validatePolicySemantics(state2) {
  const keys = /* @__PURE__ */ new Set();
  for (const entry of state2.entries) {
    const key = entryKey(entry);
    if (keys.has(key)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `publish policy contains duplicate room entry: ${key}`
      );
    }
    keys.add(key);
  }
}
async function loadPublishPolicy(paths) {
  let text;
  try {
    text = await readFile6(paths.publishPolicyFile, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyPublishPolicy();
    }
    throw error;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `publish policy contains invalid JSON: ${paths.publishPolicyFile}`,
      error instanceof Error ? error.message : String(error)
    );
  }
  const validation = validateProtocolDocument("publish-policy", value, {
    mode: "write"
  });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `publish policy is invalid: ${paths.publishPolicyFile}`,
      validation.issues
    );
  }
  const state2 = value;
  validatePolicySemantics(state2);
  return state2;
}
async function getRoomPublishMode(paths, forumId, roomId) {
  const state2 = await loadPublishPolicy(paths);
  const entry = state2.entries.find(
    (candidate) => candidate.forumId === forumId && candidate.roomId === roomId
  );
  return entry?.mode ?? "auto";
}
async function setRoomPublishMode(paths, input) {
  const state2 = await loadPublishPolicy(paths);
  const entry = {
    forumId: input.forumId,
    roomId: input.roomId,
    mode: input.mode,
    updatedAt: currentUtcTimestamp(input.now)
  };
  const next = {
    formatVersion: 1,
    entries: [
      ...state2.entries.filter((candidate) => entryKey(candidate) !== entryKey(entry)),
      entry
    ]
  };
  validatePolicySemantics(next);
  await writeValidatedJsonAtomic(
    paths.publishPolicyFile,
    "publish-policy",
    next,
    { overwrite: true, mode: 384 }
  );
  return { entry, state: next };
}
async function assertRoomPublishAllowed(forumAlias, room, paths) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const roomView = await showRoom(forumAlias, room, paths);
  const mode = await getRoomPublishMode(
    paths,
    registration.forumId,
    roomView.room.id
  );
  if (mode === "ask") {
    throw new ServiceError(
      "SEND_AUTHORIZATION_REQUIRED",
      `room ${roomView.room.slug} requires user authorization before publishing`,
      {
        forumId: registration.forumId,
        roomId: roomView.room.id,
        roomSlug: roomView.room.slug
      }
    );
  }
}
var init_publish_policy = __esm({
  "src/services/publish-policy.ts"() {
    "use strict";
    init_local_config();
    init_timestamps();
    init_validator();
    init_atomic();
    init_errors();
    init_errors2();
    init_room();
  }
});

// src/services/thread.ts
import { readFile as readFile7, readdir as readdir4, rm as rm5 } from "node:fs/promises";
import { basename as basename2, resolve as resolve8 } from "node:path";
function structuralWarning(code, path2, message) {
  return { code, path: path2, message };
}
async function readThreadEvents(registration, roomId, threadId) {
  const directory = resolve8(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadId,
    "events"
  );
  let entries;
  try {
    entries = await readdir4(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { events: [], warnings: [] };
    }
    throw error;
  }
  const events = [];
  const warnings = [];
  for (const entry of entries) {
    const eventPath = resolve8(directory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push(
        structuralWarning(
          "INVALID_EVENT_PATH",
          resolve8(directory, entry.name),
          "thread event path is not a valid event ID directory"
        )
      );
      continue;
    }
    try {
      const event = await readJsonDocument(eventPath, "event");
      if (event.id !== entry.name) {
        throw new StorageError(
          "PATH_ID_MISMATCH",
          `event ID does not match its directory: ${eventPath}`
        );
      }
      events.push(event);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  events.sort((left, right) => {
    const byTime = String(left.createdAt).localeCompare(String(right.createdAt));
    return byTime || String(left.id).localeCompare(String(right.id));
  });
  return { events, warnings };
}
async function readMessageDirectory(directory, threadId) {
  const metadataPath = resolve8(directory, "message.json");
  if (!isEntityId(basename2(directory), "message")) {
    return {
      warnings: [
        structuralWarning(
          "INVALID_MESSAGE_PATH",
          directory,
          "message path is not a valid message ID directory"
        )
      ]
    };
  }
  const directoryId = basename2(directory);
  try {
    const metadata = await readJsonDocument(metadataPath, "message");
    if (metadata.id !== directoryId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `message ID does not match its directory: ${metadataPath}`
      );
    }
    if (metadata.threadId !== threadId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `message threadId does not match its parent thread: ${metadataPath}`
      );
    }
    const body = await readFile7(resolve8(directory, "body.md"), "utf8");
    if (body.trim().length === 0 || body.includes("\0")) {
      throw new StorageError(
        "INVALID_MESSAGE_BODY",
        `message body is empty or contains NUL: ${resolve8(directory, "body.md")}`
      );
    }
    const message = {
      id: String(metadata.id),
      threadId: String(metadata.threadId),
      authorId: String(metadata.authorId),
      type: String(metadata.type),
      createdAt: String(metadata.createdAt),
      replyTo: metadata.replyTo === null ? null : String(metadata.replyTo),
      mentions: metadata.mentions.map(String),
      references: metadata.references.map(
        (reference) => ({
          kind: String(reference.kind),
          value: String(reference.value)
        })
      ),
      ...metadata.audience === "broadcast" ? { audience: "broadcast" } : {},
      body
    };
    return {
      message,
      warnings: isKnownMessageType(message.type) ? [] : [
        structuralWarning(
          "UNKNOWN_MESSAGE_TYPE",
          metadataPath,
          `unknown message type: ${message.type}`
        )
      ]
    };
  } catch (error) {
    return { warnings: [protocolWarning(metadataPath, error)] };
  }
}
async function readThreadMessages(registration, roomId, threadId) {
  const directory = resolve8(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadId,
    "messages"
  );
  let entries;
  try {
    entries = await readdir4(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { messages: [], warnings: [] };
    }
    throw error;
  }
  const messages = [];
  const warnings = [];
  for (const entry of entries) {
    const path2 = resolve8(directory, entry.name);
    if (!entry.isDirectory()) {
      warnings.push(
        structuralWarning(
          "INVALID_MESSAGE_PATH",
          path2,
          "messages directory contains a non-directory entry"
        )
      );
      continue;
    }
    const result = await readMessageDirectory(path2, threadId);
    if (result.message) messages.push(result.message);
    warnings.push(...result.warnings);
  }
  messages.sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt);
    return byTime || left.id.localeCompare(right.id);
  });
  return { messages, warnings };
}
async function readThreadDirectory(registration, roomId, threadDirectoryName) {
  const directory = resolve8(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadDirectoryName
  );
  const threadPath = resolve8(directory, "thread.json");
  if (!isEntityId(threadDirectoryName, "thread")) {
    return {
      messages: [],
      warnings: [
        structuralWarning(
          "INVALID_THREAD_PATH",
          directory,
          "thread path is not a valid thread ID directory"
        )
      ]
    };
  }
  let base;
  try {
    base = await readJsonDocument(threadPath, "thread");
    if (base.id !== threadDirectoryName || base.roomId !== roomId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `thread ID or roomId does not match its path: ${threadPath}`
      );
    }
    if (!isKnownThreadKind(String(base.kind))) {
      throw new ServiceError(
        "THREAD_KIND_INVALID",
        `unsupported thread kind: ${String(base.kind)}`
      );
    }
  } catch (error) {
    return {
      messages: [],
      warnings: [protocolWarning(threadPath, error)]
    };
  }
  const messageResult = await readThreadMessages(
    registration,
    roomId,
    threadDirectoryName
  );
  const warnings = [...messageResult.warnings];
  const messageIds = new Set(
    messageResult.messages.map((message) => message.id)
  );
  for (const message of messageResult.messages) {
    if (message.replyTo === message.id) {
      warnings.push(
        structuralWarning(
          "MESSAGE_SELF_REPLY",
          resolve8(directory, "messages", message.id, "message.json"),
          "message replyTo cannot reference itself"
        )
      );
    } else if (message.replyTo !== null && !messageIds.has(message.replyTo)) {
      warnings.push(
        structuralWarning(
          "REPLY_TARGET_MISSING",
          resolve8(directory, "messages", message.id, "message.json"),
          `reply target is missing or damaged: ${message.replyTo}`
        )
      );
    }
  }
  const firstMessage = messageResult.messages.find(
    (message) => message.id === base.firstMessageId
  );
  if (!firstMessage) {
    warnings.push(
      structuralWarning(
        "FIRST_MESSAGE_MISSING",
        threadPath,
        `first message is missing or damaged: ${String(base.firstMessageId)}`
      )
    );
  } else {
    if (firstMessage.type !== base.kind) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_TYPE_MISMATCH",
          resolve8(directory, "messages", firstMessage.id, "message.json"),
          "first message type does not match thread kind"
        )
      );
    }
    if (firstMessage.authorId !== base.createdBy) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_AUTHOR_MISMATCH",
          resolve8(directory, "messages", firstMessage.id, "message.json"),
          "first message author does not match thread creator"
        )
      );
    }
    if (firstMessage.replyTo !== null) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_REPLY_INVALID",
          resolve8(directory, "messages", firstMessage.id, "message.json"),
          "first message replyTo must be null"
        )
      );
    }
  }
  let state2 = {
    scope: "thread",
    id: String(base.id),
    title: String(base.initialTitle),
    status: "open"
  };
  let lastActivityAt = String(base.createdAt);
  for (const message of messageResult.messages) {
    if (message.createdAt > lastActivityAt) lastActivityAt = message.createdAt;
  }
  const eventResult = await readThreadEvents(
    registration,
    roomId,
    threadDirectoryName
  );
  warnings.push(...eventResult.warnings);
  for (const event of eventResult.events) {
    const eventPath = resolve8(
      directory,
      "events",
      String(event.id),
      "event.json"
    );
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push(
        structuralWarning(
          "UNKNOWN_EVENT_TYPE",
          eventPath,
          `unknown thread event type: ${String(event.type)}`
        )
      );
      continue;
    }
    try {
      state2 = applyLifecycleEvent(state2, {
        scope: "thread",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data
      });
      if (String(event.createdAt) > lastActivityAt) {
        lastActivityAt = String(event.createdAt);
      }
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  return {
    thread: {
      id: String(base.id),
      roomId: String(base.roomId),
      title: state2.title,
      kind: base.kind,
      status: state2.status,
      createdBy: String(base.createdBy),
      createdAt: String(base.createdAt),
      firstMessageId: String(base.firstMessageId),
      lastActivityAt,
      messageCount: messageResult.messages.length
    },
    messages: messageResult.messages,
    warnings
  };
}
async function listThreads(forumAlias, room, paths = createAgentForumPaths()) {
  const roomResult = await showRoom(forumAlias, room, paths);
  const { registration } = await openForum(forumAlias, paths);
  const directory = resolve8(
    registration.path,
    "rooms",
    roomResult.room.id,
    "threads"
  );
  let entries;
  try {
    entries = await readdir4(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        room: roomResult.room,
        threads: [],
        warnings: roomResult.warnings
      };
    }
    throw error;
  }
  const threads = [];
  const warnings = [...roomResult.warnings];
  for (const entry of entries) {
    const path2 = resolve8(directory, entry.name);
    if (!entry.isDirectory()) {
      warnings.push(
        structuralWarning(
          "INVALID_THREAD_PATH",
          path2,
          "threads directory contains a non-directory entry"
        )
      );
      continue;
    }
    const result = await readThreadDirectory(
      registration,
      roomResult.room.id,
      entry.name
    );
    if (result.thread) threads.push(result.thread);
    warnings.push(...result.warnings);
  }
  threads.sort((left, right) => {
    const byActivity = right.lastActivityAt.localeCompare(left.lastActivityAt);
    return byActivity || left.id.localeCompare(right.id);
  });
  return { room: roomResult.room, threads, warnings: dedupeWarnings(warnings) };
}
async function showThread(forumAlias, room, threadId, paths = createAgentForumPaths()) {
  const roomResult = await showRoom(forumAlias, room, paths);
  const { registration } = await openForum(forumAlias, paths);
  const result = await readThreadDirectory(
    registration,
    roomResult.room.id,
    threadId
  );
  if (!result.thread) {
    throw new ServiceError(
      "THREAD_NOT_FOUND",
      `thread was not found: ${threadId}`,
      result.warnings
    );
  }
  return {
    room: roomResult.room,
    thread: result.thread,
    messages: result.messages,
    warnings: dedupeWarnings([...roomResult.warnings, ...result.warnings])
  };
}
function assertRoomWritable(room) {
  if (room.status !== "active") {
    throw new ServiceError(
      "ROOM_ARCHIVED",
      `cannot write to archived room: ${room.id}`
    );
  }
}
async function createThread(input, paths = createAgentForumPaths()) {
  if (!isKnownThreadKind(input.kind)) {
    throw new ServiceError(
      "THREAD_KIND_INVALID",
      `unsupported thread kind: ${input.kind}`
    );
  }
  const kind = input.kind;
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "thread create",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      assertRoomWritable(roomResult.room);
      await requireActiveRoomMember(
        registration,
        roomResult.room.id,
        identity
      );
      const threadId = input.threadId ?? createEntityId("thread");
      const messageId = input.messageId ?? createEntityId("message");
      const timestamp = currentUtcTimestamp(input.now);
      const thread = {
        schemaVersion: "1.0",
        id: threadId,
        roomId: roomResult.room.id,
        initialTitle: input.title,
        kind,
        createdBy: identity.memberId,
        createdAt: timestamp,
        firstMessageId: messageId
      };
      const metadata = {
        schemaVersion: "1.0",
        id: messageId,
        threadId,
        authorId: identity.memberId,
        type: kind,
        createdAt: timestamp,
        replyTo: null,
        mentions: [],
        references: [],
        ...input.broadcast ? { audience: "broadcast" } : {}
      };
      const threadDirectory = resolve8(
        registration.path,
        "rooms",
        roomResult.room.id,
        "threads",
        threadId
      );
      let directoryCreated = false;
      try {
        await createImmutableDirectory(threadDirectory, async (temporary) => {
          await writeValidatedJsonAtomic(
            resolve8(temporary, "thread.json"),
            "thread",
            thread
          );
          await createImmutableMessage(
            resolve8(temporary, "messages", messageId),
            metadata,
            input.body
          );
        });
        directoryCreated = true;
        const commit = commitPaths(
          registration.path,
          [threadDirectory],
          `Create thread ${input.title}`
        );
        return {
          thread: {
            id: threadId,
            roomId: roomResult.room.id,
            title: input.title,
            kind,
            status: "open",
            createdBy: identity.memberId,
            createdAt: timestamp,
            firstMessageId: messageId,
            lastActivityAt: timestamp,
            messageCount: 1
          },
          firstMessage: {
            id: messageId,
            threadId,
            authorId: identity.memberId,
            type: kind,
            createdAt: timestamp,
            replyTo: null,
            mentions: [],
            references: [],
            ...input.broadcast ? { audience: "broadcast" } : {},
            body: input.body
          },
          commit
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", threadDirectory]);
        if (directoryCreated) {
          await rm5(threadDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    }
  );
}
function hasStructuralThreadDamage(thread, warnings) {
  return warnings.some((item) => {
    if (!item.path.includes(thread.id)) return false;
    if (item.code.startsWith("FIRST_MESSAGE_")) return true;
    if (!["SCHEMA_VALIDATION_FAILED", "PATH_ID_MISMATCH"].includes(item.code)) {
      return false;
    }
    return item.path.endsWith("thread.json") || item.path.includes(thread.firstMessageId);
  });
}
async function createPost(input, paths = createAgentForumPaths()) {
  if (!isKnownMessageType(input.type)) {
    throw new ServiceError(
      "MESSAGE_TYPE_INVALID",
      `unsupported message type: ${input.type}`
    );
  }
  const type = input.type;
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.replyTo ? "post reply" : "post create",
    async (registration, identity) => {
      const detail = await showThread(
        input.forumAlias,
        input.room,
        input.thread,
        paths
      );
      assertRoomWritable(detail.room);
      if (hasStructuralThreadDamage(detail.thread, detail.warnings)) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          `cannot post to damaged thread: ${detail.thread.id}`,
          detail.warnings
        );
      }
      if (detail.thread.status !== "open") {
        throw new ServiceError(
          "THREAD_CLOSED",
          `cannot post to closed thread: ${detail.thread.id}`
        );
      }
      await requireActiveRoomMember(
        registration,
        detail.room.id,
        identity
      );
      const replyTo = input.replyTo ?? null;
      if (replyTo !== null && !detail.messages.some((message) => message.id === replyTo)) {
        throw new ServiceError(
          "MESSAGE_NOT_FOUND",
          `reply target was not found in thread ${detail.thread.id}: ${replyTo}`
        );
      }
      const messageId = input.messageId ?? createEntityId("message");
      const timestamp = currentUtcTimestamp(input.now);
      const metadata = {
        schemaVersion: "1.0",
        id: messageId,
        threadId: detail.thread.id,
        authorId: identity.memberId,
        type,
        createdAt: timestamp,
        replyTo,
        mentions: input.mentions ?? [],
        references: input.references ?? [],
        ...input.broadcast ? { audience: "broadcast" } : {}
      };
      const messageDirectory = resolve8(
        registration.path,
        "rooms",
        detail.room.id,
        "threads",
        detail.thread.id,
        "messages",
        messageId
      );
      let messageCreated = false;
      try {
        await createImmutableMessage(
          messageDirectory,
          metadata,
          input.body
        );
        messageCreated = true;
        const commit = commitPaths(
          registration.path,
          [messageDirectory],
          `${replyTo ? "Reply in" : "Post to"} thread ${detail.thread.id}`
        );
        const message = {
          id: messageId,
          threadId: detail.thread.id,
          authorId: identity.memberId,
          type,
          createdAt: timestamp,
          replyTo,
          mentions: [...input.mentions ?? []],
          references: [...input.references ?? []],
          ...input.broadcast ? { audience: "broadcast" } : {},
          body: input.body
        };
        return {
          message,
          thread: {
            ...detail.thread,
            lastActivityAt: timestamp > detail.thread.lastActivityAt ? timestamp : detail.thread.lastActivityAt,
            messageCount: detail.thread.messageCount + 1
          },
          commit
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", messageDirectory]);
        if (messageCreated) {
          await rm5(messageDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    }
  );
}
async function createThreadEvent(input, paths = createAgentForumPaths()) {
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.type,
    async (registration, identity) => {
      const detail = await showThread(
        input.forumAlias,
        input.room,
        input.thread,
        paths
      );
      assertRoomWritable(detail.room);
      if (hasStructuralThreadDamage(detail.thread, detail.warnings)) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          `cannot update damaged thread: ${detail.thread.id}`,
          detail.warnings
        );
      }
      await requireActiveRoomMember(
        registration,
        detail.room.id,
        identity
      );
      const eventId = input.eventId ?? createEntityId("event");
      const timestamp = currentUtcTimestamp(input.now);
      const event = {
        schemaVersion: "1.0",
        id: eventId,
        scope: "thread",
        targetId: detail.thread.id,
        type: input.type,
        actorId: identity.memberId,
        createdAt: timestamp,
        reason: input.reason,
        data: input.data
      };
      const nextState = applyLifecycleEvent(
        {
          scope: "thread",
          id: detail.thread.id,
          title: detail.thread.title,
          status: detail.thread.status
        },
        event
      );
      const eventDirectory = resolve8(
        registration.path,
        "rooms",
        detail.room.id,
        "threads",
        detail.thread.id,
        "events",
        eventId
      );
      let eventCreated = false;
      try {
        await createImmutableEvent(eventDirectory, event);
        eventCreated = true;
        const commit = commitPaths(
          registration.path,
          [eventDirectory],
          `${input.type} ${detail.thread.id}`
        );
        return {
          eventId,
          thread: {
            ...detail.thread,
            title: nextState.title,
            status: nextState.status,
            lastActivityAt: timestamp
          },
          commit
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", eventDirectory]);
        if (eventCreated) {
          await rm5(eventDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    }
  );
}
var init_thread = __esm({
  "src/services/thread.ts"() {
    "use strict";
    init_ids();
    init_message_types();
    init_state_transitions();
    init_thread_kinds();
    init_timestamps();
    init_runner();
    init_atomic();
    init_errors();
    init_paths();
    init_protocol_store();
    init_errors2();
    init_publish_policy();
    init_room();
  }
});

// src/services/semantic-validation.ts
function lines(value) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}
function isImmutableProtocolPath(path2) {
  const normalized = path2.replaceAll("\\", "/");
  if (normalized === ".gitattributes" || normalized === ".forum/protocol.json" || normalized === ".forum/forum.json") {
    return true;
  }
  if (/^\.forum\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/room\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/thread\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/messages\/[^/]+\/(?:message\.json|body\.md)$/u.test(normalized)) return true;
  return false;
}
function modifiedImmutablePaths(repository2, from, to) {
  if (from === to) return [];
  const result = runGit(repository2, [
    "log",
    "--format=",
    "--name-only",
    "--diff-filter=MDR",
    from ? `${from}..${to}` : to
  ]);
  if (result.status !== 0) {
    return [{ code: "HISTORY_INSPECTION_FAILED", message: "could not inspect changed history" }];
  }
  return [...new Set(lines(result.stdout).filter(isImmutableProtocolPath))].map(
    (path2) => ({
      code: "IMMUTABLE_PATH_MODIFIED",
      path: path2,
      message: `immutable protocol history modified or deleted: ${path2}`
    })
  );
}
function warningIssue(warning) {
  const blocking = /* @__PURE__ */ new Set([
    "SCHEMA_VALIDATION_FAILED",
    "PATH_ID_MISMATCH",
    "INVALID_STATE_TRANSITION",
    "EVENT_TARGET_MISMATCH",
    "INVALID_EVENT_DATA",
    "FIRST_MESSAGE_MISSING",
    "FIRST_MESSAGE_TYPE_MISMATCH",
    "FIRST_MESSAGE_AUTHOR_MISMATCH",
    "FIRST_MESSAGE_REPLY_INVALID",
    "REPLY_TARGET_MISSING",
    "MESSAGE_SELF_REPLY"
  ]);
  return blocking.has(warning.code) ? { code: warning.code, path: warning.path, message: warning.message } : void 0;
}
async function validateCurrentTree(forumAlias, paths) {
  const forum = await showForum(forumAlias, paths);
  const result = await listRooms(forumAlias, paths);
  const issues = [
    ...forum.warnings,
    ...result.warnings
  ].map(warningIssue).filter(Boolean);
  const slugs = /* @__PURE__ */ new Map();
  for (const room of result.rooms) {
    const ids = slugs.get(room.slug) ?? [];
    ids.push(room.id);
    slugs.set(room.slug, ids);
    const threads = await listThreads(forumAlias, room.id, paths);
    issues.push(
      ...threads.warnings.map(warningIssue).filter(Boolean)
    );
  }
  for (const [slug, roomIds] of slugs) {
    if (roomIds.length > 1) {
      issues.push({
        code: "ROOM_SLUG_CONFLICT",
        message: `room slug is not unique: ${slug}`,
        targetId: roomIds.join(","),
        category: "room-slug"
      });
    }
  }
  const unique = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    unique.set(`${issue.code}\0${issue.path ?? ""}\0${issue.message}`, issue);
  }
  return [...unique.values()];
}
function eventCategory(type) {
  if (type.endsWith("-renamed")) return "name-or-title";
  if (type.endsWith("-description-changed")) return "description";
  if (type.endsWith("-archived") || type.endsWith("-restored") || type.endsWith("-closed") || type.endsWith("-reopened")) return "status";
  return void 0;
}
function addedEvents(repository2, from, to) {
  if (from === to) return [];
  const diff = runGit(repository2, ["diff", "--name-only", "--diff-filter=A", `${from}..${to}`]);
  if (diff.status !== 0) return [];
  const events = [];
  for (const path2 of lines(diff.stdout).filter((item) => item.endsWith("/event.json"))) {
    const shown = runGit(repository2, ["show", `${to}:${path2}`]);
    if (shown.status !== 0) continue;
    try {
      const event = JSON.parse(shown.stdout);
      const category = eventCategory(String(event.type));
      if (category) {
        events.push({ path: path2, targetId: String(event.targetId), category });
      }
    } catch {
    }
  }
  return events;
}
function concurrentEventIssues(repository2, originalRemoteHead, remoteHead, localHead) {
  if (!originalRemoteHead) return [];
  const remoteEvents = addedEvents(repository2, originalRemoteHead, remoteHead);
  const localEvents = addedEvents(repository2, remoteHead, localHead);
  const issues = [];
  for (const local of localEvents) {
    const remote = remoteEvents.find(
      (candidate) => candidate.targetId === local.targetId && candidate.category === local.category
    );
    if (remote) {
      issues.push({
        code: "CONCURRENT_FIELD_UPDATE",
        path: local.path,
        message: `remote and local events concurrently update ${local.category} on ${local.targetId}`,
        targetId: local.targetId,
        category: local.category
      });
    }
  }
  return issues;
}
function schemaForProtocolPath(path2) {
  if (path2 === ".forum/protocol.json") return "protocol";
  if (path2 === ".forum/forum.json") return "forum";
  if (/^members\/[^/]+\/profile\.json$/u.test(path2)) return "member-profile";
  if (/^\.forum\/events\/[^/]+\/event\.json$/u.test(path2) || /^rooms\/[^/]+\/events\/[^/]+\/event\.json$/u.test(path2) || /^rooms\/[^/]+\/threads\/[^/]+\/events\/[^/]+\/event\.json$/u.test(path2)) return "event";
  if (/^rooms\/[^/]+\/room\.json$/u.test(path2)) return "room";
  if (/^rooms\/[^/]+\/members\/[^/]+\/membership\.json$/u.test(path2)) return "room-member";
  if (/^rooms\/[^/]+\/threads\/[^/]+\/thread\.json$/u.test(path2)) return "thread";
  if (/^rooms\/[^/]+\/threads\/[^/]+\/messages\/[^/]+\/message\.json$/u.test(path2)) return "message";
  return void 0;
}
function validateRemoteProtocolTree(input) {
  const tree = runGit(input.repository, ["ls-tree", "-r", "--name-only", input.remoteHead]);
  if (tree.status !== 0) {
    return [{ code: "REMOTE_PROTOCOL_INSPECTION_FAILED", message: "could not inspect fetched remote protocol tree" }];
  }
  const paths = lines(tree.stdout);
  const pathSet = new Set(paths);
  const issues = [];
  for (const path2 of paths) {
    const schema = schemaForProtocolPath(path2);
    if (!schema) continue;
    const shown = runGit(input.repository, ["show", `${input.remoteHead}:${path2}`]);
    if (shown.status !== 0) {
      issues.push({ code: "REMOTE_PROTOCOL_INSPECTION_FAILED", path: path2, message: "could not read protocol document from fetched remote" });
      continue;
    }
    let value;
    try {
      value = JSON.parse(shown.stdout);
    } catch {
      issues.push({ code: schema === "message" ? "REMOTE_MESSAGE_SCHEMA_INVALID" : "REMOTE_PROTOCOL_SCHEMA_INVALID", path: path2, message: "remote protocol JSON is invalid" });
      continue;
    }
    const validation = validateProtocolDocument(schema, value, { mode: "read" });
    if (!validation.ok) {
      for (const issue of validation.issues) {
        issues.push({
          code: schema === "message" ? "REMOTE_MESSAGE_SCHEMA_INVALID" : "REMOTE_PROTOCOL_SCHEMA_INVALID",
          path: path2,
          message: `${issue.path}: ${issue.message}`
        });
      }
      continue;
    }
    const document = value;
    if (path2 === ".forum/protocol.json" && (document.forumId !== input.forumId || document.dataBranch !== input.branch)) {
      issues.push({ code: "REMOTE_PROTOCOL_MISMATCH", path: path2, message: "remote protocol does not match the local forum registration" });
    }
    if (schema === "message") {
      const bodyPath = `${path2.slice(0, -"message.json".length)}body.md`;
      if (!pathSet.has(bodyPath)) {
        issues.push({ code: "REMOTE_MESSAGE_BODY_MISSING", path: bodyPath, message: "remote message body is missing" });
      } else {
        const body = runGit(input.repository, ["show", `${input.remoteHead}:${bodyPath}`]);
        if (body.status !== 0 || body.stdout.trim().length === 0 || body.stdout.includes("\0")) {
          issues.push({ code: "REMOTE_MESSAGE_BODY_INVALID", path: bodyPath, message: "remote message body is empty, unreadable, or contains NUL" });
        }
      }
    }
  }
  return issues;
}
function isRootProtocolIssue(issue) {
  return issue.path === ".forum/protocol.json" || issue.path === ".forum/forum.json";
}
function isQuarantinableLeafIssue(issue) {
  if (!issue.path || isRootProtocolIssue(issue)) return false;
  return (/* @__PURE__ */ new Set([
    "SCHEMA_VALIDATION_FAILED",
    "PATH_ID_MISMATCH",
    "INVALID_STATE_TRANSITION",
    "EVENT_TARGET_MISMATCH",
    "INVALID_EVENT_DATA",
    "FIRST_MESSAGE_MISSING",
    "FIRST_MESSAGE_TYPE_MISMATCH",
    "FIRST_MESSAGE_AUTHOR_MISMATCH",
    "FIRST_MESSAGE_REPLY_INVALID",
    "REPLY_TARGET_MISSING",
    "MESSAGE_SELF_REPLY"
  ])).has(issue.code);
}
async function validateSynchronizedForum(input) {
  const remoteImmutableIssues = modifiedImmutablePaths(input.repository, null, input.remoteHead).map((issue) => ({ ...issue, code: "REMOTE_IMMUTABLE_HISTORY_MODIFIED", message: `remote ${issue.message}` }));
  const immutableIssues = modifiedImmutablePaths(input.repository, input.remoteHead, input.localHead);
  const treeIssues = await validateCurrentTree(input.forumAlias, input.paths);
  const quarantinedIssues = [
    ...remoteImmutableIssues,
    ...treeIssues.filter(isQuarantinableLeafIssue)
  ];
  const semanticIssues = [
    ...treeIssues.filter((issue) => !isQuarantinableLeafIssue(issue)),
    ...concurrentEventIssues(
      input.repository,
      input.originalRemoteHead,
      input.remoteHead,
      input.localHead
    )
  ];
  return { immutableIssues, semanticIssues, quarantinedIssues };
}
var init_semantic_validation = __esm({
  "src/services/semantic-validation.ts"() {
    "use strict";
    init_runner();
    init_validator();
    init_forum_lifecycle();
    init_room();
    init_thread();
  }
});

// src/services/forum-sync.ts
import { isAbsolute, relative } from "node:path";
function output(result) {
  return `${result.stdout}
${result.stderr}`.trim();
}
function isNonFastForward(result) {
  const text = output(result).toLowerCase();
  return text.includes("non-fast-forward") || text.includes("fetch first") || text.includes("[rejected]") && text.includes("failed to push");
}
function classifyTransportFailure(operation, result) {
  const text = output(result);
  const lower = text.toLowerCase();
  if (lower.includes("authentication failed") || lower.includes("permission denied") || lower.includes("access denied") || lower.includes("could not read username") || lower.includes("publickey") || lower.includes("repository not found")) {
    return new ServiceError(
      "SYNC_AUTHENTICATION_FAILED",
      `${operation} failed because remote authentication or authorization was rejected`
    );
  }
  if (lower.includes("could not resolve host") || lower.includes("connection timed out") || lower.includes("failed to connect") || lower.includes("connection refused") || lower.includes("network is unreachable") || lower.includes("unable to access")) {
    return new ServiceError(
      "SYNC_NETWORK_FAILED",
      `${operation} failed because the remote network was unavailable`
    );
  }
  return new ServiceError(
    operation === "fetch" ? "SYNC_NETWORK_FAILED" : "SYNC_PUSH_FAILED",
    `${operation} failed: ${text || "Git returned a non-zero status"}`
  );
}
function conflictPaths(repository2) {
  return runGit(repository2, ["diff", "--name-only", "--diff-filter=U"]).stdout.split(/\r?\n/u).filter(Boolean);
}
async function validateRebasedForum(forumAlias, repository2, originalHead, paths) {
  try {
    await openForum(forumAlias, paths, { requireClean: true });
  } catch (error) {
    runGit(repository2, ["reset", "--hard", originalHead]);
    throw new ServiceError(
      "SYNC_PROTOCOL_FAILED",
      "rebased forum failed protocol validation; the original local HEAD was restored",
      error instanceof Error ? error.message : String(error)
    );
  }
}
function fetchRemoteHead(repository2, branch) {
  const fetch2 = runGit(repository2, ["fetch", "--no-tags", "origin", `refs/heads/${branch}`]);
  if (fetch2.status !== 0) throw classifyTransportFailure("fetch", fetch2);
  return requireGit(repository2, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
}
async function fetchAndRebase(forumAlias, forumId, repository2, branch, originalHead, originalRemoteHead, paths, fetchedRemoteHead) {
  const remoteHead = fetchedRemoteHead ?? fetchRemoteHead(repository2, branch);
  const remoteIssues = validateRemoteProtocolTree({ repository: repository2, remoteHead, forumId, branch });
  const blockingRemoteIssues = remoteIssues.filter(
    (issue) => issue.code === "REMOTE_PROTOCOL_INSPECTION_FAILED" || issue.path === ".forum/protocol.json" || issue.path === ".forum/forum.json"
  );
  if (blockingRemoteIssues.length > 0) {
    throw new ServiceError(
      "REMOTE_PROTOCOL_INVALID",
      "fetched remote has an invalid Forum root; no local commits were rebased",
      { remoteHead, issues: blockingRemoteIssues }
    );
  }
  const remoteWarnings = remoteIssues;
  const localHead = requireGit(repository2, ["rev-parse", "HEAD"]).stdout.trim();
  const rebase = runGit(repository2, ["rebase", remoteHead]);
  if (rebase.status !== 0) {
    const conflicts = conflictPaths(repository2);
    runGit(repository2, ["rebase", "--abort"]);
    if (conflicts.length > 0) {
      const journal = await recordSyncConflict({
        repository: repository2,
        forumId,
        forumAlias,
        branch,
        originalHead,
        localHead,
        remoteHead,
        conflicts,
        paths
      });
      throw new ServiceError(
        "SYNC_REBASE_CONFLICT",
        "sync encountered Git content conflicts; the rebase was aborted and local commits were preserved",
        {
          operationId: journal.operationId,
          conflicts,
          originalHead,
          remoteHead,
          recoveryRef: journal.recoveryRef
        }
      );
    }
    throw new ServiceError(
      "SYNC_REBASE_FAILED",
      `rebase failed and was aborted: ${output(rebase) || "Git returned a non-zero status"}`,
      { originalHead, remoteHead }
    );
  }
  await validateRebasedForum(
    forumAlias,
    repository2,
    originalHead,
    paths
  );
  const rebasedHead = requireGit(repository2, ["rev-parse", "HEAD"]).stdout.trim();
  const validation = await validateSynchronizedForum({
    forumAlias,
    repository: repository2,
    originalRemoteHead,
    remoteHead,
    localHead: rebasedHead,
    paths
  });
  const issues = validation.immutableIssues.length > 0 ? validation.immutableIssues : validation.semanticIssues;
  if (issues.length > 0) {
    const journal = await recordSyncConflict({
      repository: repository2,
      forumId,
      forumAlias,
      branch,
      originalHead,
      localHead: rebasedHead,
      remoteHead,
      conflicts: issues.map((issue) => issue.path ?? issue.targetId ?? issue.code),
      paths
    });
    runGit(repository2, ["reset", "--hard", originalHead]);
    throw new ServiceError(
      validation.immutableIssues.length > 0 ? "IMMUTABLE_HISTORY_MODIFIED" : "SEMANTIC_CONFLICT",
      validation.immutableIssues.length > 0 ? "sync detected modified or deleted immutable protocol history" : "sync detected a protocol semantic conflict",
      { operationId: journal.operationId, recoveryRef: journal.recoveryRef, issues }
    );
  }
  return {
    remoteHead,
    warnings: [...remoteWarnings, ...validation.quarantinedIssues].map((warning) => sanitizeSyncWarning(repository2, warning))
  };
}
function countAhead(repository2, base) {
  const result = requireGit(repository2, [
    "rev-list",
    "--count",
    `${base}..HEAD`
  ]).stdout.trim();
  return Number(result);
}
function defaultDelay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
function sanitizeSyncWarning(repository2, warning) {
  if (!warning.path || !isAbsolute(warning.path)) return warning;
  const path2 = relative(repository2, warning.path).replaceAll("\\", "/");
  return {
    ...warning,
    path: path2 && !path2.startsWith("../") && path2 !== ".." ? path2 : "<outside-forum>"
  };
}
async function refreshForumFromRemote(forumAlias, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "viewer background refresh"
  });
  try {
    await openForum(forumAlias, paths, { requireClean: true });
    const originalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    if (runGit(registration.path, ["remote", "get-url", "origin"]).status !== 0) {
      return { forumAlias, outcome: "remote-not-configured", originalHead, finalHead: originalHead, warnings: [] };
    }
    const tracked = runGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`
    ]);
    const originalRemoteHead = tracked.status === 0 ? tracked.stdout.trim() : null;
    const fetchedRemoteHead = fetchRemoteHead(registration.path, registration.dataBranch);
    if (countAhead(registration.path, fetchedRemoteHead) > 0) {
      return { forumAlias, outcome: "skipped-local-commits", originalHead, finalHead: originalHead, warnings: [] };
    }
    const refreshed = await fetchAndRebase(
      forumAlias,
      registration.forumId,
      registration.path,
      registration.dataBranch,
      originalHead,
      originalRemoteHead,
      paths,
      fetchedRemoteHead
    );
    const finalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    return {
      forumAlias,
      outcome: finalHead === originalHead ? "up-to-date" : "updated",
      originalHead,
      finalHead,
      warnings: refreshed.warnings
    };
  } finally {
    await lock.release();
  }
}
async function syncForum(forumAlias, paths = createAgentForumPaths(), options = {}) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const maxRetries = options.maxRetries ?? 3;
  const delay = options.delay ?? defaultDelay;
  const random = options.random ?? Math.random;
  const lock = options.lockAlreadyHeld ? void 0 : await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum sync"
  });
  try {
    await openForum(forumAlias, paths, { requireClean: true });
    const remote = runGit(registration.path, ["remote", "get-url", "origin"]);
    if (remote.status !== 0) {
      throw new ServiceError(
        "REMOTE_NOT_CONFIGURED",
        "origin is not configured for this forum"
      );
    }
    const originalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    const originalRemote = runGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`
    ]);
    const originalRemoteHead = originalRemote.status === 0 ? originalRemote.stdout.trim() : null;
    let fetches = 0;
    let pushAttempts = 0;
    let retries = 0;
    let successfulPush = false;
    const initialFetch = await fetchAndRebase(
      forumAlias,
      registration.forumId,
      registration.path,
      registration.dataBranch,
      originalHead,
      originalRemoteHead,
      paths
    );
    let remoteHead = initialFetch.remoteHead;
    const warnings = [...initialFetch.warnings];
    fetches += 1;
    let integratedRemote = originalRemoteHead !== remoteHead;
    while (countAhead(registration.path, remoteHead) > 0) {
      pushAttempts += 1;
      await options.beforePush?.(pushAttempts);
      const push = runGit(registration.path, [
        "push",
        "origin",
        registration.dataBranch
      ]);
      if (push.status === 0) {
        successfulPush = true;
        break;
      }
      if (!isNonFastForward(push)) {
        throw classifyTransportFailure("push", push);
      }
      if (retries >= maxRetries) {
        throw new ServiceError(
          "SYNC_RETRY_EXHAUSTED",
          `push did not converge after ${maxRetries} non-fast-forward retries`,
          { originalHead, remoteHead, pushAttempts }
        );
      }
      retries += 1;
      const milliseconds = Math.round(
        100 * 2 ** (retries - 1) * (0.5 + random())
      );
      await delay(milliseconds);
      const nextFetch = await fetchAndRebase(
        forumAlias,
        registration.forumId,
        registration.path,
        registration.dataBranch,
        originalHead,
        originalRemoteHead,
        paths
      );
      fetches += 1;
      warnings.push(...nextFetch.warnings);
      if (nextFetch.remoteHead !== remoteHead) integratedRemote = true;
      remoteHead = nextFetch.remoteHead;
    }
    const finalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    if (successfulPush) remoteHead = finalHead;
    const outcome = successfulPush ? integratedRemote ? "updated-and-pushed" : "pushed" : integratedRemote || finalHead !== originalHead ? "updated" : "up-to-date";
    return {
      forumAlias,
      branch: registration.dataBranch,
      outcome,
      originalHead,
      finalHead,
      remoteHead,
      fetches,
      pushAttempts,
      retries,
      warnings: [...new Map(warnings.map((warning) => [`${warning.code}\0${warning.path ?? ""}\0${warning.message}`, warning])).values()]
    };
  } finally {
    await lock?.release();
  }
}
var init_forum_sync = __esm({
  "src/services/forum-sync.ts"() {
    "use strict";
    init_local_config();
    init_runner();
    init_lock();
    init_paths();
    init_conflicts();
    init_errors2();
    init_room();
    init_semantic_validation();
  }
});

// src/services/room.ts
var room_exports = {};
__export(room_exports, {
  createRoom: () => createRoom,
  createRoomEvent: () => createRoomEvent,
  dedupeWarnings: () => dedupeWarnings,
  joinRoom: () => joinRoom,
  leaveRoom: () => leaveRoom,
  listRooms: () => listRooms,
  openForum: () => openForum,
  protocolWarning: () => protocolWarning,
  readJsonDocument: () => readJsonDocument,
  requireActiveRoomMember: () => requireActiveRoomMember,
  showRoom: () => showRoom,
  withForumWrite: () => withForumWrite
});
import {
  readFile as readFile8,
  readdir as readdir5,
  rm as rm6
} from "node:fs/promises";
import { resolve as resolve9 } from "node:path";
function withWriteSynchronization(value, synchronization) {
  if (!synchronization || !value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.assign(value, { synchronization });
}
async function readJsonDocument(path2, schema) {
  let value;
  try {
    value = JSON.parse(await readFile8(path2, "utf8"));
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `failed to read JSON document: ${path2}`,
      error instanceof Error ? error.message : String(error)
    );
  }
  const normalized = normalizeProtocolReadDocument(schema, value);
  const validation = validateProtocolDocument(schema, normalized, { mode: "read" });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `document does not satisfy the ${schema} schema: ${path2}`,
      validation.issues
    );
  }
  return normalized;
}
function protocolWarning(path2, error) {
  if (error instanceof StorageError || error instanceof ServiceError || error instanceof StateTransitionError) {
    return { code: error.code, path: path2, message: error.message };
  }
  return {
    code: "PROTOCOL_DATA_DAMAGED",
    path: path2,
    message: error instanceof Error ? error.message : String(error)
  };
}
function dedupeWarnings(warnings) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const warning of warnings) {
    const key = `${warning.code}\0${warning.path ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(warning);
  }
  return result;
}
async function openForum(alias, paths, options = {}) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, alias);
  const topLevel = requireGit(registration.path, [
    "rev-parse",
    "--show-toplevel"
  ]).stdout.trim();
  if (!await sameExistingPath(topLevel, registration.path)) {
    throw new ServiceError(
      "FORUM_PROTOCOL_MISMATCH",
      `configured forum path is not the Git root: ${registration.path}`
    );
  }
  const branch = requireGit(registration.path, [
    "branch",
    "--show-current"
  ]).stdout.trim();
  if (branch !== registration.dataBranch) {
    throw new ServiceError(
      "FORUM_PROTOCOL_MISMATCH",
      `managed forum is on '${branch}', expected '${registration.dataBranch}'`
    );
  }
  if (options.requireClean) assertCleanWorktree(registration.path);
  const protocolPath = resolve9(
    registration.path,
    ".forum",
    "protocol.json"
  );
  const protocol = await readJsonDocument(protocolPath, "protocol");
  if (protocol.forumId !== registration.forumId || protocol.dataBranch !== registration.dataBranch) {
    throw new ServiceError(
      "FORUM_PROTOCOL_MISMATCH",
      `forum protocol does not match local registration: ${alias}`
    );
  }
  return { registration };
}
async function readForumMember(registration, identity) {
  const path2 = resolve9(
    registration.path,
    "members",
    identity.memberId,
    "profile.json"
  );
  let profile;
  try {
    profile = await readJsonDocument(path2, "member-profile");
  } catch (error) {
    if (error instanceof StorageError && error.details && typeof error.details === "string" && error.details.includes("ENOENT")) {
      throw new ServiceError(
        "FORUM_MEMBERSHIP_REQUIRED",
        `identity is not published in forum: ${identity.memberId}`
      );
    }
    throw error;
  }
  if (profile.memberId !== identity.memberId || profile.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active forum member: ${identity.memberId}`
    );
  }
  return profile;
}
async function readMemberSummary(registration, memberId) {
  try {
    const profile = await readJsonDocument(
      resolve9(registration.path, "members", memberId, "profile.json"),
      "member-profile"
    );
    return {
      memberId,
      displayName: typeof profile.displayName === "string" ? profile.displayName : memberId,
      role: typeof profile.role === "string" ? profile.role : ""
    };
  } catch {
    return { memberId, displayName: memberId, role: "" };
  }
}
async function readRoomEvents(registration, roomId) {
  const eventsDirectory = resolve9(
    registration.path,
    "rooms",
    roomId,
    "events"
  );
  let entries;
  try {
    entries = await readdir5(eventsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { events: [], warnings: [] };
    }
    throw error;
  }
  const events = [];
  const warnings = [];
  for (const entry of entries) {
    const eventPath = resolve9(eventsDirectory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push({
        code: "INVALID_EVENT_PATH",
        path: resolve9(eventsDirectory, entry.name),
        message: "room event path is not a valid event ID directory"
      });
      continue;
    }
    try {
      const event = await readJsonDocument(eventPath, "event");
      if (event.id !== entry.name) {
        throw new StorageError(
          "PATH_ID_MISMATCH",
          `event ID does not match its directory: ${eventPath}`
        );
      }
      events.push(event);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  events.sort((left, right) => {
    const byTime = String(left.createdAt).localeCompare(String(right.createdAt));
    return byTime || String(left.id).localeCompare(String(right.id));
  });
  return { events, warnings };
}
async function readRoomDirectory(registration, roomDirectoryName) {
  const roomPath = resolve9(
    registration.path,
    "rooms",
    roomDirectoryName,
    "room.json"
  );
  if (!isEntityId(roomDirectoryName, "room")) {
    return {
      warnings: [
        {
          code: "INVALID_ROOM_PATH",
          path: resolve9(registration.path, "rooms", roomDirectoryName),
          message: "room path is not a valid room ID directory"
        }
      ]
    };
  }
  let base;
  try {
    base = await readJsonDocument(roomPath, "room");
    if (base.id !== roomDirectoryName) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `room ID does not match its directory: ${roomPath}`
      );
    }
  } catch (error) {
    return { warnings: [protocolWarning(roomPath, error)] };
  }
  let state2 = {
    scope: "room",
    id: String(base.id),
    title: String(base.initialTitle),
    description: String(base.initialDescription),
    status: "active"
  };
  let lastActivityAt = String(base.createdAt);
  let deprecation;
  const eventResult = await readRoomEvents(registration, roomDirectoryName);
  const warnings = [...eventResult.warnings];
  for (const event of eventResult.events) {
    const eventPath = resolve9(
      registration.path,
      "rooms",
      roomDirectoryName,
      "events",
      String(event.id),
      "event.json"
    );
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push({
        code: "UNKNOWN_EVENT_TYPE",
        path: eventPath,
        message: `unknown room event type: ${String(event.type)}`
      });
      continue;
    }
    try {
      state2 = applyLifecycleEvent(state2, {
        scope: "room",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data
      });
      if (event.type === "room-deprecated") {
        const replacementRoomId = event.data.replacementRoomId;
        deprecation = {
          state: "deprecated",
          eventId: String(event.id),
          changedAt: String(event.createdAt),
          changedBy: await readMemberSummary(registration, String(event.actorId)),
          reason: String(event.reason),
          ...typeof replacementRoomId === "string" ? { replacementRoomId } : {}
        };
      } else if (event.type === "room-reenabled") {
        deprecation = void 0;
      }
      lastActivityAt = String(event.createdAt);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  const createdBy = String(base.createdBy);
  if (deprecation) {
    warnings.push({
      code: "ROOM_DEPRECATED",
      path: roomPath,
      message: `room was deprecated by ${deprecation.changedBy.displayName} at ${deprecation.changedAt}`
    });
  }
  return {
    room: {
      id: String(base.id),
      slug: String(base.slug),
      title: state2.title,
      description: state2.description,
      status: state2.status,
      createdBy,
      creator: await readMemberSummary(registration, createdBy),
      createdAt: String(base.createdAt),
      lastActivityAt,
      ...deprecation ? { deprecation } : {}
    },
    warnings
  };
}
async function listRooms(forumAlias, paths = createAgentForumPaths()) {
  const { registration } = await openForum(forumAlias, paths);
  const roomsDirectory = resolve9(registration.path, "rooms");
  let entries;
  try {
    entries = await readdir5(roomsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { rooms: [], warnings: [] };
    }
    throw error;
  }
  const rooms = [];
  const warnings = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      warnings.push({
        code: "INVALID_ROOM_PATH",
        path: resolve9(roomsDirectory, entry.name),
        message: "rooms directory contains a non-directory entry"
      });
      continue;
    }
    const result = await readRoomDirectory(registration, entry.name);
    if (result.room) rooms.push(result.room);
    warnings.push(...result.warnings);
  }
  rooms.sort((left, right) => left.slug.localeCompare(right.slug));
  return { rooms, warnings };
}
async function showRoom(forumAlias, room, paths = createAgentForumPaths()) {
  const result = await listRooms(forumAlias, paths);
  const found = result.rooms.find(
    (candidate) => candidate.id === room || candidate.slug === room
  );
  if (!found) {
    throw new ServiceError(
      "ROOM_NOT_FOUND",
      `room was not found: ${room}`,
      result.warnings
    );
  }
  const { registration } = await openForum(forumAlias, paths);
  const events = await readRoomEvents(registration, found.id);
  return {
    room: found,
    warnings: result.warnings,
    history: events.events.map((event) => ({
      id: String(event.id),
      type: String(event.type),
      actorId: String(event.actorId),
      createdAt: String(event.createdAt),
      reason: String(event.reason),
      data: event.data
    }))
  };
}
async function withForumWrite(forumAlias, identityId, paths, command, operation) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const identity = findIdentity(config, identityId);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command
  });
  try {
    const remoteConfigured = runGit(registration.path, ["remote", "get-url", "origin"]).status === 0;
    const before = remoteConfigured ? await syncForum(forumAlias, paths, { lockAlreadyHeld: true }) : void 0;
    await openForum(forumAlias, paths, { requireClean: true });
    await readForumMember(registration, identity);
    configureForumCommitIdentity(
      registration.path,
      identity.displayName,
      identity.memberId
    );
    const value = await operation(registration, identity);
    const after = remoteConfigured ? await syncForum(forumAlias, paths, { lockAlreadyHeld: true }) : void 0;
    return withWriteSynchronization(
      value,
      before && after ? { before, after } : void 0
    );
  } finally {
    await lock.release();
  }
}
function roomMemberDocument(roomId, identity, role, responsibility, status, joinedAt, updatedAt) {
  return {
    schemaVersion: "1.0",
    roomId,
    memberId: identity.memberId,
    role,
    responsibility,
    status,
    joinedAt,
    updatedAt
  };
}
async function readRoomMember(path2) {
  try {
    return await readJsonDocument(path2, "room-member");
  } catch (error) {
    if (error instanceof StorageError && typeof error.details === "string" && error.details.includes("ENOENT")) {
      return void 0;
    }
    throw error;
  }
}
async function commitMutableDocument(repository2, path2, schema, value, commitMessage) {
  let previous;
  try {
    previous = await readFile8(path2, "utf8");
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  try {
    await writeValidatedJsonAtomic(path2, schema, value, { overwrite: true });
    return commitPaths(repository2, [path2], commitMessage);
  } catch (error) {
    runGit(repository2, ["reset", "--", path2]);
    if (previous === void 0) await rm6(path2, { force: true });
    else await writeFileAtomic(path2, previous, { overwrite: true });
    throw error;
  }
}
function normalizedRoomName(value) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}_-]+/gu, "");
}
function similarRooms(input, rooms) {
  const slug = normalizedRoomName(input.slug);
  const title = normalizedRoomName(input.title);
  return rooms.filter((room) => {
    const roomSlug = normalizedRoomName(room.slug);
    const roomTitle = normalizedRoomName(room.title);
    return title.length > 0 && title === roomTitle || slug.length > 0 && slug === roomSlug || title.length > 0 && title === roomSlug || slug.length > 0 && slug === roomTitle;
  });
}
async function createRoom(input, paths = createAgentForumPaths()) {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room create",
    async (registration, identity) => {
      const existing = await listRooms(input.forumAlias, paths);
      if (existing.warnings.some((item) => item.code === "SCHEMA_VALIDATION_FAILED")) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          "cannot safely check room slug uniqueness while room data is damaged",
          existing.warnings
        );
      }
      if (existing.rooms.some((room2) => room2.slug === input.slug)) {
        throw new ServiceError(
          "ROOM_SLUG_EXISTS",
          `room slug already exists: ${input.slug}`
        );
      }
      const matches = similarRooms(input, existing.rooms);
      if (matches.length > 0 && !input.allowSimilar) {
        throw new ServiceError(
          "ROOM_SIMILAR_EXISTS",
          "a Room with the same normalized name already exists; reuse it or confirm a distinct scope with --allow-similar",
          matches.map((room2) => ({
            id: room2.id,
            slug: room2.slug,
            title: room2.title,
            status: room2.status,
            deprecated: Boolean(room2.deprecation)
          }))
        );
      }
      const id = input.roomId ?? createEntityId("room");
      const timestamp = currentUtcTimestamp(input.now);
      const roomDirectory = resolve9(registration.path, "rooms", id);
      const room = {
        schemaVersion: "1.0",
        id,
        slug: input.slug,
        initialTitle: input.title,
        initialDescription: input.description,
        createdBy: identity.memberId,
        createdAt: timestamp
      };
      const member = roomMemberDocument(
        id,
        identity,
        identity.role,
        identity.responsibility,
        "active",
        timestamp,
        timestamp
      );
      let directoryCreated = false;
      try {
        await createImmutableDirectory(roomDirectory, async (temporary) => {
          await writeValidatedJsonAtomic(
            resolve9(temporary, "room.json"),
            "room",
            room
          );
          await writeValidatedJsonAtomic(
            resolve9(temporary, "members", `${identity.memberId}.json`),
            "room-member",
            member
          );
        });
        directoryCreated = true;
        const commit = commitPaths(
          registration.path,
          [roomDirectory],
          `Create room ${input.slug}`
        );
        return {
          room: {
            id,
            slug: input.slug,
            title: input.title,
            description: input.description,
            status: "active",
            createdBy: identity.memberId,
            creator: {
              memberId: identity.memberId,
              displayName: identity.displayName,
              role: identity.role
            },
            createdAt: timestamp,
            lastActivityAt: timestamp
          },
          identityId: identity.memberId,
          commit
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", roomDirectory]);
        if (directoryCreated) {
          await rm6(roomDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    }
  );
}
async function joinRoom(input, paths = createAgentForumPaths()) {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room join",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      if (roomResult.room.status !== "active") {
        throw new ServiceError(
          "ROOM_ARCHIVED",
          `cannot join archived room: ${roomResult.room.id}`
        );
      }
      const memberPath = resolve9(
        registration.path,
        "rooms",
        roomResult.room.id,
        "members",
        `${identity.memberId}.json`
      );
      const existing = await readRoomMember(memberPath);
      const role = input.role ?? identity.role;
      const responsibility = input.responsibility ?? identity.responsibility;
      if (existing?.status === "active" && existing.role === role && existing.responsibility === responsibility) {
        return { action: "unchanged", member: existing };
      }
      const timestamp = currentUtcTimestamp(input.now);
      const member = roomMemberDocument(
        roomResult.room.id,
        identity,
        role,
        responsibility,
        "active",
        existing?.joinedAt ?? timestamp,
        timestamp
      );
      const commit = await commitMutableDocument(
        registration.path,
        memberPath,
        "room-member",
        member,
        `Join room ${roomResult.room.slug}`
      );
      return {
        action: existing ? "updated" : "joined",
        member,
        commit
      };
    }
  );
}
async function leaveRoom(input, paths = createAgentForumPaths()) {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room leave",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      const memberPath = resolve9(
        registration.path,
        "rooms",
        roomResult.room.id,
        "members",
        `${identity.memberId}.json`
      );
      const existing = await readRoomMember(memberPath);
      if (!existing) {
        throw new ServiceError(
          "ROOM_MEMBERSHIP_REQUIRED",
          `identity is not a room member: ${identity.memberId}`
        );
      }
      if (existing.status === "left") {
        return { action: "unchanged", member: existing };
      }
      const member = {
        ...existing,
        status: "left",
        updatedAt: currentUtcTimestamp(input.now)
      };
      const commit = await commitMutableDocument(
        registration.path,
        memberPath,
        "room-member",
        member,
        `Leave room ${roomResult.room.slug}`
      );
      return { action: "left", member, commit };
    }
  );
}
async function requireActiveRoomMember(registration, roomId, identity) {
  const memberPath = resolve9(
    registration.path,
    "rooms",
    roomId,
    "members",
    `${identity.memberId}.json`
  );
  const member = await readRoomMember(memberPath);
  if (!member || member.status !== "active") {
    throw new ServiceError(
      "ROOM_MEMBERSHIP_REQUIRED",
      `identity is not an active room member: ${identity.memberId}`
    );
  }
  return member;
}
async function createRoomEvent(input, paths = createAgentForumPaths()) {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.type,
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      if (input.type === "room-deprecated" && typeof input.data.replacementRoomId === "string") {
        const replacement = await showRoom(input.forumAlias, input.data.replacementRoomId, paths);
        if (replacement.room.id === roomResult.room.id) {
          throw new ServiceError(
            "ROOM_REPLACEMENT_INVALID",
            "replacementRoomId cannot be the deprecated room itself"
          );
        }
      }
      await requireActiveRoomMember(registration, roomResult.room.id, identity);
      const eventId = input.eventId ?? createEntityId("event");
      const timestamp = currentUtcTimestamp(input.now);
      const event = {
        schemaVersion: "1.0",
        id: eventId,
        scope: "room",
        targetId: roomResult.room.id,
        type: input.type,
        actorId: identity.memberId,
        createdAt: timestamp,
        reason: input.reason,
        data: input.data
      };
      const currentState = {
        scope: "room",
        id: roomResult.room.id,
        title: roomResult.room.title,
        description: roomResult.room.description,
        status: roomResult.room.status,
        ...roomResult.room.deprecation ? { deprecation: { ...roomResult.room.deprecation.replacementRoomId ? { replacementRoomId: roomResult.room.deprecation.replacementRoomId } : {} } } : {}
      };
      const nextState = applyLifecycleEvent(
        currentState,
        event
      );
      const eventDirectory = resolve9(
        registration.path,
        "rooms",
        roomResult.room.id,
        "events",
        eventId
      );
      let eventCreated = false;
      try {
        await createImmutableEvent(eventDirectory, event);
        eventCreated = true;
        const commit = commitPaths(
          registration.path,
          [eventDirectory],
          `${input.type} ${roomResult.room.slug}`
        );
        return {
          eventId,
          room: {
            ...roomResult.room,
            title: nextState.title,
            description: nextState.description,
            status: nextState.status,
            lastActivityAt: timestamp
          },
          commit
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", eventDirectory]);
        if (eventCreated) {
          await rm6(eventDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    }
  );
}
var init_room = __esm({
  "src/services/room.ts"() {
    "use strict";
    init_local_config();
    init_ids();
    init_state_transitions();
    init_timestamps();
    init_runner();
    init_validator();
    init_atomic();
    init_errors();
    init_lock();
    init_paths();
    init_protocol_store();
    init_errors2();
    init_forum_sync();
  }
});

// src/errors.ts
var ExitCode = {
  Success: 0,
  Unexpected: 1,
  Usage: 2
};

// src/services/context.ts
init_local_config();
import { resolve as resolve10 } from "node:path";

// src/context/bindings.ts
init_ids();
init_timestamps();
init_runner();
init_validator();
init_atomic();
init_errors();
import { readFile as readFile3, realpath as realpath2 } from "node:fs/promises";
import { posix, win32 } from "node:path";
var ContextError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "ContextError";
  }
};
function pathApi(platform) {
  return platform === "win32" ? win32 : posix;
}
function supportedPlatform(value) {
  if (value === "win32" || value === "linux" || value === "darwin") {
    return value;
  }
  throw new ContextError(
    "UNSUPPORTED_PLATFORM",
    `context binding is not supported on platform: ${value}`
  );
}
function normalizeWorkspaceKey(workspaceRoot, platform) {
  const api = pathApi(platform);
  let normalized = api.normalize(workspaceRoot);
  const parsed = api.parse(normalized);
  while (normalized.length > parsed.root.length && normalized.endsWith(api.sep)) {
    normalized = normalized.slice(0, -1);
  }
  if (platform === "win32") {
    normalized = normalized.replaceAll("\\", "/").toLowerCase();
  }
  return `${platform}:${normalized}`;
}
function normalizeRepositoryFingerprint(remote) {
  const trimmed = remote.trim();
  const scp = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/u.exec(trimmed);
  if (scp && !trimmed.includes("://") && !/^[a-zA-Z]:[\\/]/u.test(trimmed)) {
    const host = scp[1]?.toLowerCase();
    const repositoryPath = scp[2]?.replace(/^\/+|\/+$/gu, "").replace(/\.git$/u, "");
    return host && repositoryPath ? `${host}/${repositoryPath}` : void 0;
  }
  try {
    const url = new URL(trimmed);
    if (!url.hostname || !["http:", "https:", "ssh:", "git:"].includes(url.protocol)) {
      return void 0;
    }
    const repositoryPath = url.pathname.replace(/^\/+|\/+$/gu, "").replace(/\.git$/u, "");
    return repositoryPath ? `${url.hostname.toLowerCase()}/${repositoryPath}` : void 0;
  } catch {
    return void 0;
  }
}
async function discoverGitWorkspace(cwd, platform = supportedPlatform(process.platform)) {
  const rootResult = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0) {
    throw new ContextError(
      "GIT_WORKSPACE_REQUIRED",
      "the selected directory is not inside a Git workspace"
    );
  }
  const workspaceRoot = await realpath2(rootResult.stdout.trim());
  const branchResult = runGit(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD"
  ]);
  const remoteResult = runGit(cwd, [
    "config",
    "--get",
    "remote.origin.url"
  ]);
  const repositoryFingerprint = remoteResult.status === 0 ? normalizeRepositoryFingerprint(remoteResult.stdout) : void 0;
  return {
    workspaceRoot,
    workspaceKey: normalizeWorkspaceKey(workspaceRoot, platform),
    branch: branchResult.status === 0 ? branchResult.stdout.trim() : null,
    ...repositoryFingerprint ? { repositoryFingerprint } : {}
  };
}
function emptyContextBindingState() {
  return { formatVersion: 1, bindings: [] };
}
function bindingIdentity(binding) {
  return binding.scope === "branch" ? `${binding.workspaceKey}\0branch\0${binding.branch ?? ""}` : `${binding.workspaceKey}\0workspace`;
}
function platformFromWorkspaceKey(workspaceKey) {
  const prefix = workspaceKey.slice(0, workspaceKey.indexOf(":"));
  if (prefix === "win32" || prefix === "linux" || prefix === "darwin") {
    return prefix;
  }
  throw new StorageError(
    "SCHEMA_VALIDATION_FAILED",
    `binding has unsupported workspace key: ${workspaceKey}`
  );
}
function validateBindingSemantics(state2) {
  const bindingIds = /* @__PURE__ */ new Set();
  const identities = /* @__PURE__ */ new Set();
  for (const binding of state2.bindings) {
    if (bindingIds.has(binding.bindingId)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `context bindings contain duplicate binding ID: ${binding.bindingId}`
      );
    }
    bindingIds.add(binding.bindingId);
    const identity = bindingIdentity(binding);
    if (identities.has(identity)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        "context bindings contain duplicate workspace scope"
      );
    }
    identities.add(identity);
    const platform = platformFromWorkspaceKey(binding.workspaceKey);
    if (normalizeWorkspaceKey(binding.workspaceRoot, platform) !== binding.workspaceKey) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding workspaceKey does not match workspaceRoot: ${binding.bindingId}`
      );
    }
    if (binding.repositoryFingerprint && (binding.repositoryFingerprint.includes("@") || binding.repositoryFingerprint.includes("://") || binding.repositoryFingerprint.includes("\\"))) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding repository fingerprint is not credential-safe: ${binding.bindingId}`
      );
    }
    if (binding.updatedAt < binding.createdAt) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding updatedAt precedes createdAt: ${binding.bindingId}`
      );
    }
  }
}
async function loadContextBindingState(paths) {
  let text;
  try {
    text = await readFile3(paths.bindingsFile, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyContextBindingState();
    }
    throw error;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `context bindings contain invalid JSON: ${paths.bindingsFile}`,
      error instanceof Error ? error.message : String(error)
    );
  }
  const validation = validateProtocolDocument("context-bindings", value, {
    mode: "write"
  });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `context bindings are invalid: ${paths.bindingsFile}`,
      validation.issues
    );
  }
  const state2 = value;
  validateBindingSemantics(state2);
  return state2;
}
async function saveContextBindingState(paths, state2) {
  validateBindingSemantics(state2);
  await writeValidatedJsonAtomic(
    paths.bindingsFile,
    "context-bindings",
    state2,
    { overwrite: true, mode: 384 }
  );
}
function requireBindingBranch(branch) {
  if (!branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "a branch binding requires a branch name"
    );
  }
  return branch;
}
function setContextBinding(state2, input, options = {}) {
  if (input.scope === "branch") requireBindingBranch(input.branch);
  const identity = bindingIdentity({
    scope: input.scope,
    workspaceKey: input.context.workspaceKey,
    ...input.branch ? { branch: input.branch } : {}
  });
  const existing = state2.bindings.find(
    (binding2) => bindingIdentity(binding2) === identity
  );
  if (existing && !options.force) {
    throw new ContextError(
      "BINDING_EXISTS",
      `a ${input.scope} binding already exists for this workspace and targets ${existing.forumId}/${existing.roomId}; use --force to replace it`,
      existing
    );
  }
  const timestamp = currentUtcTimestamp(options.now);
  const common = {
    bindingId: options.bindingId ?? existing?.bindingId ?? createEntityId("binding"),
    workspaceType: "git",
    workspaceRoot: input.context.workspaceRoot,
    workspaceKey: input.context.workspaceKey,
    forumId: input.forumId,
    roomId: input.roomId,
    ...input.context.repositoryFingerprint ? { repositoryFingerprint: input.context.repositoryFingerprint } : {},
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  const binding = input.scope === "branch" ? {
    ...common,
    scope: "branch",
    branch: requireBindingBranch(input.branch)
  } : { ...common, scope: "workspace" };
  const bindings = existing ? state2.bindings.map(
    (candidate) => bindingIdentity(candidate) === identity ? binding : candidate
  ) : [...state2.bindings, binding];
  const next = { formatVersion: 1, bindings };
  validateBindingSemantics(next);
  return { state: next, binding, replaced: Boolean(existing) };
}
function removeContextBinding(state2, workspaceKey, scope, branch) {
  const identity = bindingIdentity({
    scope,
    workspaceKey,
    ...branch ? { branch } : {}
  });
  const removed = state2.bindings.filter(
    (binding) => bindingIdentity(binding) === identity
  );
  return {
    state: {
      formatVersion: 1,
      bindings: state2.bindings.filter(
        (binding) => bindingIdentity(binding) !== identity
      )
    },
    removed
  };
}
function resolveContextBinding(state2, context) {
  if (context.branch !== null) {
    const exact = state2.bindings.find(
      (binding) => binding.scope === "branch" && binding.workspaceKey === context.workspaceKey && binding.branch === context.branch
    );
    if (exact) return { kind: "bound", source: "branch", binding: exact };
  }
  const fallback = state2.bindings.find(
    (binding) => binding.scope === "workspace" && binding.workspaceKey === context.workspaceKey
  );
  return fallback ? { kind: "bound", source: "workspace", binding: fallback } : { kind: "unbound", code: "CONTEXT_NOT_BOUND" };
}

// src/services/context.ts
init_runner();
init_lock();
init_paths();
init_errors2();
init_room();

// src/services/read-freshness.ts
init_local_config();
init_errors2();
init_forum_sync();
init_paths();
async function refreshForRead(forumAlias, options = {}, paths = createAgentForumPaths()) {
  if (options.noSync) {
    return { forumAlias, state: "stale", source: "local-cache" };
  }
  try {
    const refresh = await refreshForumFromRemote(forumAlias, paths);
    if (refresh.outcome === "remote-not-configured") {
      return { forumAlias, state: "stale", source: "local-only", refresh };
    }
    if (refresh.outcome === "skipped-local-commits") {
      return { forumAlias, state: "stale", source: "local-cache", refresh };
    }
    return { forumAlias, state: "fresh", source: "remote", refresh };
  } catch (error) {
    return {
      forumAlias,
      state: "stale",
      source: "local-cache",
      error: {
        code: error instanceof ServiceError ? error.code : "SYNC_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
async function refreshAllForRead(options = {}, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const results = [];
  for (const forum of [...config.forums].sort((left, right) => left.alias.localeCompare(right.alias))) {
    results.push(await refreshForRead(forum.alias, options, paths));
  }
  return results;
}

// src/services/context.ts
function selectedCwd(cwd) {
  return resolve10(cwd ?? process.cwd());
}
function findForumById(config, forumId) {
  return config.forums.find((forum) => forum.forumId === forumId);
}
async function targetFromRegistration(registration, roomIdOrSlug, paths) {
  try {
    const result = await showRoom(registration.alias, roomIdOrSlug, paths);
    return {
      forumId: registration.forumId,
      forumAlias: registration.alias,
      roomId: result.room.id,
      roomSlug: result.room.slug,
      roomTitle: result.room.title,
      targetStatus: result.room.status,
      ...result.room.deprecation ? { deprecation: result.room.deprecation } : {}
    };
  } catch (error) {
    if (error instanceof ServiceError && error.code === "ROOM_NOT_FOUND") {
      return {
        forumId: registration.forumId,
        forumAlias: registration.alias,
        roomId: roomIdOrSlug,
        roomSlug: null,
        roomTitle: null,
        targetStatus: "missing",
        problem: error.message
      };
    }
    return {
      forumId: registration.forumId,
      forumAlias: registration.alias,
      roomId: roomIdOrSlug,
      roomSlug: null,
      roomTitle: null,
      targetStatus: "unavailable",
      problem: error instanceof Error ? error.message : String(error)
    };
  }
}
async function targetForBinding(config, binding, paths) {
  const registration = findForumById(config, binding.forumId);
  if (!registration) {
    return {
      binding,
      forumId: binding.forumId,
      forumAlias: null,
      roomId: binding.roomId,
      roomSlug: null,
      roomTitle: null,
      targetStatus: "missing",
      problem: "forum is no longer registered locally"
    };
  }
  const target2 = await targetFromRegistration(registration, binding.roomId, paths);
  return { binding, ...target2 };
}
async function requireTarget(forumAlias, room, paths, options = {}) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const target2 = await targetFromRegistration(registration, room, paths);
  if (target2.targetStatus === "missing" || target2.targetStatus === "unavailable") {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      `context target is unavailable: ${forumAlias}/${room}`,
      target2
    );
  }
  if (options.active && target2.targetStatus === "archived") {
    throw new ServiceError(
      "ROOM_ARCHIVED",
      `cannot bind an archived room: ${target2.roomId}`
    );
  }
  return target2;
}
function requireBranch(context, requestedBranch, cwd) {
  const branch = requestedBranch ?? context.branch;
  if (!branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "a branch binding requires an attached HEAD or explicit --branch"
    );
  }
  assertGitBranchName(cwd, branch);
  return branch;
}
async function bindContext(input, paths = createAgentForumPaths()) {
  if (input.workspace && input.branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "--branch cannot be combined with a workspace-default binding"
    );
  }
  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const freshness = await refreshForRead(input.forumAlias, {}, paths);
  const target2 = await requireTarget(input.forumAlias, input.room, paths, {
    active: true
  });
  target2.freshness = freshness;
  const scope = input.workspace ? "workspace" : "branch";
  const branch = scope === "branch" ? requireBranch(context, input.branch, cwd) : void 0;
  const lock = await acquireForumLock({
    lockPath: resolve10(paths.locksDirectory, "context.lock"),
    command: "context bind"
  });
  try {
    const state2 = await loadContextBindingState(paths);
    const result = setContextBinding(
      state2,
      {
        context,
        scope,
        ...branch ? { branch } : {},
        forumId: target2.forumId,
        roomId: target2.roomId
      },
      {
        ...input.force !== void 0 ? { force: input.force } : {},
        ...input.now ? { now: input.now } : {},
        ...input.bindingId ? { bindingId: input.bindingId } : {}
      }
    );
    await saveContextBindingState(paths, result.state);
    return {
      action: result.replaced ? "replaced" : "created",
      binding: result.binding,
      target: target2
    };
  } finally {
    await lock.release();
  }
}
async function unbindContext(input, paths = createAgentForumPaths()) {
  if (input.workspace && input.branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "--branch cannot be combined with a workspace-default binding"
    );
  }
  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const scope = input.workspace ? "workspace" : "branch";
  const branch = scope === "branch" ? requireBranch(context, input.branch, cwd) : void 0;
  const lock = await acquireForumLock({
    lockPath: resolve10(paths.locksDirectory, "context.lock"),
    command: "context unbind"
  });
  try {
    const state2 = await loadContextBindingState(paths);
    const result = removeContextBinding(
      state2,
      context.workspaceKey,
      scope,
      branch
    );
    if (result.removed.length > 0) {
      await saveContextBindingState(paths, result.state);
    }
    return { removed: result.removed, context };
  } finally {
    await lock.release();
  }
}
async function listContextBindings(paths = createAgentForumPaths()) {
  const [state2, config] = await Promise.all([
    loadContextBindingState(paths),
    loadLocalConfig(paths)
  ]);
  const bindings = await Promise.all(
    state2.bindings.map((binding) => targetForBinding(config, binding, paths))
  );
  bindings.sort((left, right) => {
    const byWorkspace = left.binding.workspaceKey.localeCompare(
      right.binding.workspaceKey
    );
    if (byWorkspace) return byWorkspace;
    if (left.binding.scope !== right.binding.scope) {
      return left.binding.scope === "branch" ? -1 : 1;
    }
    const leftBranch = left.binding.scope === "branch" ? left.binding.branch : "";
    const rightBranch = right.binding.scope === "branch" ? right.binding.branch : "";
    return leftBranch.localeCompare(rightBranch);
  });
  return { bindings };
}
async function resolveContext(input = {}, paths = createAgentForumPaths()) {
  if (Boolean(input.forumAlias) !== Boolean(input.room)) {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      "explicit context requires both forum alias and room"
    );
  }
  if (input.forumAlias && input.room) {
    const target3 = await requireTarget(input.forumAlias, input.room, paths);
    return {
      ...target3,
      source: "explicit",
      context: null,
      binding: null
    };
  }
  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const state2 = await loadContextBindingState(paths);
  const resolution = resolveContextBinding(state2, context);
  if (resolution.kind === "unbound") {
    throw new ContextError(
      "CONTEXT_NOT_BOUND",
      "no branch or workspace-default binding matches the current context",
      context
    );
  }
  const config = await loadLocalConfig(paths);
  const target2 = await targetForBinding(config, resolution.binding, paths);
  if (target2.targetStatus === "missing" || target2.targetStatus === "unavailable") {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      `bound context target is ${target2.targetStatus}`,
      target2
    );
  }
  return {
    forumId: target2.forumId,
    forumAlias: target2.forumAlias,
    roomId: target2.roomId,
    roomSlug: target2.roomSlug,
    roomTitle: target2.roomTitle,
    targetStatus: target2.targetStatus,
    source: resolution.source,
    context,
    binding: resolution.binding
  };
}
async function showContext(cwd, paths = createAgentForumPaths()) {
  return resolveContext({ ...cwd ? { cwd } : {} }, paths);
}

// src/commands/error-result.ts
init_state_transitions();
init_runner();
init_errors2();
init_errors();
function commandError(command, error) {
  if (error instanceof ContextError || error instanceof ServiceError || error instanceof StorageError || error instanceof GitCommandError || error instanceof StateTransitionError) {
    return {
      exitCode: ExitCode.Unexpected,
      command,
      error: {
        code: error.code,
        message: error.message,
        ..."details" in error && error.details !== void 0 ? { details: error.details } : {}
      },
      human: `Error [${error.code}]: ${error.message}
`
    };
  }
  return void 0;
}
function invalidArgument(message) {
  return {
    exitCode: ExitCode.Usage,
    command: "usage",
    error: { code: "INVALID_ARGUMENT", message },
    human: `Error [INVALID_ARGUMENT]: ${message}
`
  };
}

// src/commands/options.ts
function parseCommandOptions(args2, definitions) {
  const valueOptions = new Set(definitions.values);
  const repeatableValueOptions = new Set(definitions.repeatableValues ?? []);
  const flagOptions = new Set(definitions.flags ?? []);
  const values = /* @__PURE__ */ new Map();
  const multiValues = /* @__PURE__ */ new Map();
  const flags = /* @__PURE__ */ new Set();
  for (let index = 0; index < args2.length; index += 1) {
    const argument = args2[index];
    if (!argument?.startsWith("--")) {
      return { error: `unexpected positional argument: ${argument ?? ""}` };
    }
    if (flagOptions.has(argument)) {
      if (flags.has(argument)) return { error: `duplicate option: ${argument}` };
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument) && !repeatableValueOptions.has(argument)) {
      return { error: `unknown option: ${argument}` };
    }
    if (valueOptions.has(argument) && values.has(argument)) {
      return { error: `duplicate option: ${argument}` };
    }
    const value = args2[index + 1];
    if (!value || value.startsWith("--")) {
      return { error: `${argument} requires a value` };
    }
    if (repeatableValueOptions.has(argument)) {
      const existing = multiValues.get(argument) ?? [];
      existing.push(value);
      multiValues.set(argument, existing);
    } else {
      values.set(argument, value);
    }
    index += 1;
  }
  return { values, multiValues, flags };
}
function requireOption(parsed, name) {
  const value = parsed.values.get(name);
  return value === void 0 ? { error: `${name} is required` } : value;
}

// src/commands/context.ts
function contextHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "context.help",
    data: {
      commands: ["bind", "unbind", "show", "list", "resolve"]
    },
    human: `Context binding

Usage:
  agent-forum context bind --forum <alias> --room <id-or-slug> [--cwd <path>] [--branch <name> | --workspace] [--force]
  agent-forum context unbind [--cwd <path>] [--branch <name> | --workspace]
  agent-forum context show [--cwd <path>]
  agent-forum context list
  agent-forum context resolve [--cwd <path>] [--forum <alias> --room <id-or-slug>]
`
  };
}
async function executeContextCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return contextHelp();
  }
  try {
    if (subcommand === "bind") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--room", "--cwd", "--branch"],
        flags: ["--workspace", "--force"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.flags.has("--workspace") && parsed.values.has("--branch")) {
        return invalidArgument("--workspace and --branch cannot be combined");
      }
      const forumAlias = requireOption(parsed, "--forum");
      if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
      const room = requireOption(parsed, "--room");
      if (typeof room !== "string") return invalidArgument(room.error);
      const cwd = parsed.values.get("--cwd");
      const branch = parsed.values.get("--branch");
      const result = await bindContext({
        forumAlias,
        room,
        workspace: parsed.flags.has("--workspace"),
        force: parsed.flags.has("--force"),
        ...cwd ? { cwd } : {},
        ...branch ? { branch } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.bind",
        data: result,
        human: `${result.action}: ${result.binding.scope} context
forum: ${result.target.forumAlias}
room: ${result.target.roomSlug}
${result.target.deprecation ? `warning: Room deprecated by ${result.target.deprecation.changedBy.displayName}; consider ${result.target.deprecation.replacementRoomId ?? "confirming a replacement with the Forum"}
` : ""}`
      };
    }
    if (subcommand === "unbind") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--cwd", "--branch"],
        flags: ["--workspace"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.flags.has("--workspace") && parsed.values.has("--branch")) {
        return invalidArgument("--workspace and --branch cannot be combined");
      }
      const cwd = parsed.values.get("--cwd");
      const branch = parsed.values.get("--branch");
      const result = await unbindContext({
        workspace: parsed.flags.has("--workspace"),
        ...cwd ? { cwd } : {},
        ...branch ? { branch } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.unbind",
        data: result,
        human: result.removed.length === 0 ? "No matching binding.\n" : `removed: ${result.removed.length}
`
      };
    }
    if (subcommand === "show") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--cwd"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await showContext(parsed.values.get("--cwd"));
      return {
        exitCode: ExitCode.Success,
        command: "context.show",
        data: result,
        human: `source: ${result.source}
forum: ${result.forumAlias}
room: ${result.roomSlug}
status: ${result.targetStatus}
`
      };
    }
    if (subcommand === "list") {
      const parsed = parseCommandOptions(args2.slice(1), { values: [] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await listContextBindings();
      return {
        exitCode: ExitCode.Success,
        command: "context.list",
        data: result,
        human: result.bindings.length === 0 ? "No context bindings.\n" : `${result.bindings.map(
          (item) => `${item.binding.scope}	${item.binding.workspaceRoot}	${item.forumAlias ?? item.forumId}/${item.roomSlug ?? item.roomId}	${item.targetStatus}`
        ).join("\n")}
`
      };
    }
    if (subcommand === "resolve") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--cwd", "--forum", "--room"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = parsed.values.get("--forum");
      const room = parsed.values.get("--room");
      if (Boolean(forumAlias) !== Boolean(room)) {
        return invalidArgument("--forum and --room must be provided together");
      }
      const cwd = parsed.values.get("--cwd");
      const result = await resolveContext({
        ...cwd ? { cwd } : {},
        ...forumAlias ? { forumAlias } : {},
        ...room ? { room } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.resolve",
        data: result,
        human: `source: ${result.source}
forum: ${result.forumAlias}
room: ${result.roomSlug}
status: ${result.targetStatus}
${result.deprecation ? `warning: Room deprecated by ${result.deprecation.changedBy.displayName}; consider ${result.deprecation.replacementRoomId ?? "confirming a replacement with the Forum"}
` : ""}`
      };
    }
    return invalidArgument(`unknown context subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`context.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/dashboard.ts
import { spawn as spawn2 } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir as mkdir4 } from "node:fs/promises";
import { dirname as dirname4, resolve as resolve18 } from "node:path";
import { fileURLToPath } from "node:url";
init_paths();

// src/version.ts
var PACKAGE_NAME = "@zzs-fun/agent-forum-skills";
var CLI_NAME = "agent-forum";
var VERSION = true ? "0.0.26" : "0.0.0-dev";
var DASHBOARD_VERSION = true ? "0.0.26" : "0.0.0-dev";

// src/services/dashboard.ts
init_local_config();
init_timestamps();
init_atomic();
init_lock();
init_paths();
import { readFile as readFile13 } from "node:fs/promises";
import { resolve as resolve15 } from "node:path";
init_errors2();

// src/services/inbox.ts
init_local_config();
init_timestamps();
init_validator();
init_atomic();
init_errors();
init_lock();
init_paths();
init_errors2();
import { readFile as readFile12, readdir as readdir7 } from "node:fs/promises";
import { resolve as resolve14 } from "node:path";
init_forum_sync();

// src/services/identity-attention.ts
init_local_config();
init_timestamps();
init_validator();
init_atomic();
init_errors();
init_lock();
init_paths();
init_room();
init_errors2();
import { readFile as readFile9 } from "node:fs/promises";
import { resolve as resolve11 } from "node:path";
function attentionPath(paths, forumId, ownerMemberId) {
  return resolve11(forumStatePath(paths, forumId), "attention", `${ownerMemberId}.json`);
}
function isActiveLink(link2, now) {
  return link2.expiresAt === void 0 || new Date(link2.expiresAt).valueOf() > now.valueOf();
}
async function loadState(forumId, ownerMemberId, paths) {
  const path2 = attentionPath(paths, forumId, ownerMemberId);
  try {
    const value = JSON.parse(await readFile9(path2, "utf8"));
    const validation = validateProtocolDocument("identity-attention", value);
    if (!validation.ok || value.forumId !== forumId || value.ownerMemberId !== ownerMemberId) {
      throw new StorageError("SCHEMA_VALIDATION_FAILED", `identity attention state is invalid: ${path2}`);
    }
    const state2 = value;
    if (new Set(state2.links.map((link2) => link2.subjectMemberId)).size !== state2.links.length) {
      throw new StorageError("SCHEMA_VALIDATION_FAILED", `identity attention state has duplicate subjects: ${path2}`);
    }
    return state2;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        schemaVersion: "1.0",
        forumId,
        ownerMemberId,
        links: [],
        updatedAt: currentUtcTimestamp()
      };
    }
    throw error;
  }
}
async function resolveOwner(forumAlias, ownerMemberId, paths) {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, forumAlias);
  return {
    forumId: forum.forumId,
    forumPath: forum.path,
    owner: findIdentity(config, ownerMemberId)
  };
}
async function recoverIdentity(input, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, input.forumAlias);
  const profile = await readJsonDocument(
    resolve11(forum.path, "members", input.memberId, "profile.json"),
    "member-profile"
  );
  if (profile.memberId !== input.memberId) {
    throw new ServiceError("IDENTITY_RECOVERY_FAILED", "remote profile memberId does not match requested memberId");
  }
  const existing = config.identities.find((identity) => identity.memberId === input.memberId);
  if (existing) {
    if (input.setDefault && config.defaultIdentityId !== existing.memberId) {
      const { updateLocalIdentity: updateLocalIdentity2 } = await Promise.resolve().then(() => (init_local_config(), local_config_exports));
      const result2 = await updateLocalIdentity2({ memberId: existing.memberId, setDefault: true }, paths);
      return { action: "unchanged", identity: result2.identity, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
    }
    return { action: "unchanged", identity: existing, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
  }
  const result = await createLocalIdentity({
    memberId: input.memberId,
    displayName: String(profile.displayName),
    role: String(profile.role),
    responsibility: String(profile.responsibility),
    ...typeof profile.client === "string" ? { client: profile.client } : {},
    setDefault: input.setDefault ?? true
  }, paths);
  return { action: "recovered", identity: result.identity, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
}
async function listIdentityAttention(input, paths = createAgentForumPaths()) {
  const { forumId, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  const state2 = await loadState(forumId, owner.memberId, paths);
  const now = /* @__PURE__ */ new Date();
  const links = state2.links.map((link2) => ({ ...link2, active: isActiveLink(link2, now) })).filter((link2) => input.includeExpired || link2.active);
  return { ownerMemberId: owner.memberId, links };
}
async function addIdentityAttention(input, paths = createAgentForumPaths()) {
  if (input.mode === "delegation" && !input.expiresAt) {
    throw new ServiceError("ATTENTION_EXPIRY_REQUIRED", "delegation attention requires --until UTC timestamp");
  }
  if (input.expiresAt && !isCanonicalUtcTimestamp(input.expiresAt)) {
    throw new ServiceError("ATTENTION_EXPIRY_INVALID", "attention expiry must use canonical UTC milliseconds timestamp");
  }
  if (input.expiresAt && new Date(input.expiresAt).valueOf() <= Date.now()) {
    throw new ServiceError("ATTENTION_EXPIRY_INVALID", "attention expiry must be in the future");
  }
  const { forumId, forumPath, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  if (owner.memberId === input.subjectMemberId) {
    throw new ServiceError("ATTENTION_SELF_REFERENCE", "identity attention subject must differ from owner");
  }
  const profile = await readJsonDocument(
    resolve11(forumPath, "members", input.subjectMemberId, "profile.json"),
    "member-profile"
  );
  if (profile.memberId !== input.subjectMemberId) {
    throw new ServiceError("ATTENTION_SUBJECT_NOT_FOUND", "attention subject profile does not match requested memberId");
  }
  const lock = await acquireForumLock({
    lockPath: resolve11(paths.locksDirectory, `attention-${forumId}-${owner.memberId}.lock`),
    command: "identity attention add"
  });
  try {
    const state2 = await loadState(forumId, owner.memberId, paths);
    const timestamp = currentUtcTimestamp();
    const link2 = {
      subjectMemberId: input.subjectMemberId,
      mode: input.mode,
      reason: input.reason,
      createdAt: state2.links.find((item) => item.subjectMemberId === input.subjectMemberId)?.createdAt ?? timestamp,
      ...input.expiresAt ? { expiresAt: input.expiresAt } : {}
    };
    const existing = state2.links.find((item) => item.subjectMemberId === input.subjectMemberId);
    const links = existing ? state2.links.map((item) => item.subjectMemberId === input.subjectMemberId ? link2 : item) : [...state2.links, link2];
    await writeValidatedJsonAtomic(attentionPath(paths, forumId, owner.memberId), "identity-attention", {
      ...state2,
      links,
      updatedAt: timestamp
    }, { overwrite: true, mode: 384 });
    return { action: existing ? "updated" : "added", ownerMemberId: owner.memberId, link: link2 };
  } finally {
    await lock.release();
  }
}
async function removeIdentityAttention(input, paths = createAgentForumPaths()) {
  const { forumId, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  const lock = await acquireForumLock({
    lockPath: resolve11(paths.locksDirectory, `attention-${forumId}-${owner.memberId}.lock`),
    command: "identity attention remove"
  });
  try {
    const state2 = await loadState(forumId, owner.memberId, paths);
    const links = state2.links.filter((link2) => link2.subjectMemberId !== input.subjectMemberId);
    const removed = links.length !== state2.links.length;
    if (removed) {
      await writeValidatedJsonAtomic(attentionPath(paths, forumId, owner.memberId), "identity-attention", {
        ...state2,
        links,
        updatedAt: currentUtcTimestamp()
      }, { overwrite: true, mode: 384 });
    }
    return { removed, ownerMemberId: owner.memberId };
  } finally {
    await lock.release();
  }
}

// src/services/thread-watch.ts
init_local_config();
init_timestamps();
init_validator();
init_atomic();
init_errors();
init_lock();
init_paths();
import { readFile as readFile10 } from "node:fs/promises";
import { resolve as resolve12 } from "node:path";
function path(paths, forumId, memberId) {
  return resolve12(forumStatePath(paths, forumId), "watches", `${memberId}.json`);
}
async function state(paths, forumId, memberId) {
  try {
    const value = JSON.parse(await readFile10(path(paths, forumId, memberId), "utf8"));
    const valid = validateProtocolDocument("thread-watch", value);
    if (!valid.ok || value.forumId !== forumId || value.memberId !== memberId) throw new StorageError("SCHEMA_VALIDATION_FAILED", "thread watch state is invalid");
    return value;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { schemaVersion: "1.0", forumId, memberId, threadIds: [], updatedAt: currentUtcTimestamp() };
    throw error;
  }
}
async function target(forumAlias, identityId, paths) {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, forumAlias);
  const identity = findIdentity(config, identityId);
  return { forumId: forum.forumId, memberId: identity.memberId };
}
async function listWatchedThreadIds(input, paths = createAgentForumPaths()) {
  const item = await target(input.forumAlias, input.identityId, paths);
  return { ...item, threadIds: (await state(paths, item.forumId, item.memberId)).threadIds };
}
async function setThreadWatch(input, paths = createAgentForumPaths()) {
  const item = await target(input.forumAlias, input.identityId, paths);
  const lock = await acquireForumLock({ lockPath: resolve12(paths.locksDirectory, `watch-${item.forumId}-${item.memberId}.lock`), command: input.watch ? "thread watch" : "thread unwatch" });
  try {
    const existing = await state(paths, item.forumId, item.memberId);
    const contains = existing.threadIds.includes(input.threadId);
    const threadIds = input.watch ? contains ? existing.threadIds : [...existing.threadIds, input.threadId] : existing.threadIds.filter((id) => id !== input.threadId);
    if (contains === input.watch) return { changed: false, ...item, threadIds };
    await writeValidatedJsonAtomic(path(paths, item.forumId, item.memberId), "thread-watch", { ...existing, threadIds, updatedAt: currentUtcTimestamp() }, { overwrite: true, mode: 384 });
    return { changed: true, ...item, threadIds };
  } finally {
    await lock.release();
  }
}

// src/services/timeline-cache.ts
init_local_config();
init_runner();
init_atomic();
init_lock();
init_errors();
init_paths();
init_forum_lifecycle();
init_room();
init_thread();
import { readFile as readFile11, readdir as readdir6 } from "node:fs/promises";
import { relative as relative2, resolve as resolve13 } from "node:path";
var cacheRebuildWaitMs = 1e4;
var cacheRebuildRetryMs = 50;
function cachePath(paths, forumId) {
  return resolve13(forumStatePath(paths, forumId), "cache", "snapshot.json");
}
function sanitizeWarnings(repository2, warnings) {
  return warnings.map((warning) => {
    const local = relative2(repository2, warning.path).replaceAll("\\", "/");
    return {
      ...warning,
      path: local && !local.startsWith("..") ? local : "<outside-forum>"
    };
  });
}
function deduplicateWarnings(warnings) {
  const unique = /* @__PURE__ */ new Map();
  for (const warning of warnings) {
    const key = `${warning.code}\0${warning.path}\0${warning.message}`;
    if (!unique.has(key)) unique.set(key, warning);
  }
  return [...unique.values()];
}
async function readEventDirectory(directory) {
  let names;
  try {
    names = await readdir6(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const events = [];
  for (const name of names) {
    try {
      const event = await readJsonDocument(resolve13(directory, name, "event.json"), "event");
      events.push({
        id: String(event.id),
        kind: "event",
        type: String(event.type),
        actorId: String(event.actorId),
        createdAt: String(event.createdAt),
        reason: String(event.reason),
        data: event.data
      });
    } catch {
    }
  }
  return events.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
async function readRoomMembers(repository2, roomId) {
  const members = {};
  const directory = resolve13(repository2, "rooms", roomId, "members");
  let names = [];
  try {
    names = await readdir6(directory);
  } catch {
    return members;
  }
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    try {
      const membership = await readJsonDocument(resolve13(directory, name), "room-member");
      members[String(membership.memberId)] = {
        role: String(membership.role),
        responsibility: String(membership.responsibility),
        status: String(membership.status),
        updatedAt: String(membership.updatedAt)
      };
    } catch {
    }
  }
  return members;
}
async function buildRoom(forumAlias, repository2, room, head, paths) {
  const threads = await listThreads(forumAlias, room.id, paths);
  const cachedThreads = [];
  const warnings = [...threads.warnings];
  for (const thread of threads.threads) {
    const detail = await showThread(forumAlias, room.id, thread.id, paths);
    warnings.push(...detail.warnings);
    const events = await readEventDirectory(
      resolve13(repository2, "rooms", room.id, "threads", thread.id, "events")
    );
    const timeline = [
      ...detail.messages.map((message) => ({ ...message, kind: "message" })),
      ...events
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    cachedThreads.push({ thread: detail.thread, timeline });
  }
  cachedThreads.sort(
    (a, b) => b.thread.lastActivityAt.localeCompare(a.thread.lastActivityAt) || a.thread.id.localeCompare(b.thread.id)
  );
  return {
    cached: {
      room,
      sourceHead: head,
      members: await readRoomMembers(repository2, room.id),
      events: await readEventDirectory(resolve13(repository2, "rooms", room.id, "events")),
      threads: cachedThreads
    },
    warnings
  };
}
async function readMembers(repository2) {
  const members = {};
  const directory = resolve13(repository2, "members");
  let names = [];
  try {
    names = await readdir6(directory);
  } catch {
    return members;
  }
  for (const name of names) {
    try {
      const profile = await readJsonDocument(resolve13(directory, name, "profile.json"), "member-profile");
      members[name] = {
        displayName: String(profile.displayName),
        role: String(profile.role),
        responsibility: String(profile.responsibility),
        status: String(profile.status)
      };
    } catch {
    }
  }
  return members;
}
async function loadCache(path2) {
  try {
    const value = JSON.parse(await readFile11(path2, "utf8"));
    const compatible = value.formatVersion === 1 && typeof value.sourceHead === "string" && Array.isArray(value.rooms) && value.rooms.every((room) => room && typeof room === "object" && "members" in room && Object.values(room.members).every((member) => member && typeof member.updatedAt === "string")) && value.members && Object.values(value.members).every((member) => member && typeof member.responsibility === "string");
    return compatible ? value : void 0;
  } catch {
    return void 0;
  }
}
function isCacheRebuildLocked(error) {
  return error instanceof StorageError && error.code === "LOCAL_LOCKED";
}
async function acquireCacheRebuildLock(lockPath, snapshotPath, head) {
  const deadline = Date.now() + cacheRebuildWaitMs;
  let lastLockError;
  while (true) {
    const existing = await loadCache(snapshotPath);
    if (existing?.sourceHead === head) return { kind: "cached", snapshot: existing };
    try {
      return {
        kind: "locked",
        lock: await acquireForumLock({ lockPath, command: "cache rebuild" })
      };
    } catch (error) {
      if (!isCacheRebuildLocked(error)) throw error;
      lastLockError = error;
      const refreshed = await loadCache(snapshotPath);
      if (refreshed?.sourceHead === head) return { kind: "cached", snapshot: refreshed };
      if (Date.now() >= deadline) throw lastLockError;
      await new Promise((resolveWait) => setTimeout(resolveWait, cacheRebuildRetryMs));
    }
  }
}
function affectedRooms(repository2, oldHead, newHead) {
  const diff = runGit(repository2, ["diff", "--name-only", `${oldHead}..${newHead}`]);
  if (diff.status !== 0) return void 0;
  const ids = /* @__PURE__ */ new Set();
  for (const path2 of diff.stdout.split(/\r?\n/u)) {
    const match = /^rooms\/([^/]+)\//u.exec(path2.replaceAll("\\", "/"));
    if (match?.[1]) ids.add(match[1]);
  }
  return ids;
}
async function getForumSnapshot(forumAlias, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const head = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
  const path2 = cachePath(paths, registration.forumId);
  const existing = await loadCache(path2);
  if (existing?.sourceHead === head) return { snapshot: existing, cache: "hit" };
  const acquisition = await acquireCacheRebuildLock(
    resolve13(paths.locksDirectory, `${registration.forumId}-cache.lock`),
    path2,
    head
  );
  if (acquisition.kind === "cached") return { snapshot: acquisition.snapshot, cache: "hit" };
  try {
    const latest = await loadCache(path2);
    if (latest?.sourceHead === head) return { snapshot: latest, cache: "hit" };
    const affected = latest ? affectedRooms(registration.path, latest.sourceHead, head) : void 0;
    const [forum, rooms] = await Promise.all([
      showForum(forumAlias, paths),
      listRooms(forumAlias, paths)
    ]);
    const oldRooms = new Map((latest?.rooms ?? []).map((room) => [room.room.id, room]));
    const cachedRooms = [];
    const warnings = [...forum.warnings, ...rooms.warnings];
    for (const room of rooms.rooms) {
      const preserved = affected && !affected.has(room.id) ? oldRooms.get(room.id) : void 0;
      if (preserved) cachedRooms.push(preserved);
      else {
        const built = await buildRoom(forumAlias, registration.path, room, head, paths);
        cachedRooms.push(built.cached);
        warnings.push(...built.warnings);
      }
    }
    cachedRooms.sort((a, b) => a.room.slug.localeCompare(b.room.slug));
    const snapshot = {
      formatVersion: 1,
      forumAlias,
      forumId: registration.forumId,
      sourceHead: head,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      forum: forum.forum,
      members: await readMembers(registration.path),
      rooms: cachedRooms,
      warnings: deduplicateWarnings(sanitizeWarnings(registration.path, warnings))
    };
    await writeJsonAtomic(path2, snapshot, { overwrite: true, mode: 384 });
    return { snapshot, cache: latest && affected ? "incremental" : "rebuilt" };
  } finally {
    await acquisition.lock.release();
  }
}

// src/services/inbox.ts
init_room();
init_thread();
function cursorPath(paths, forumId, memberId) {
  return resolve14(forumStatePath(paths, forumId), "cursors", `${memberId}.json`);
}
async function loadCursor(paths, forumId, memberId) {
  const path2 = cursorPath(paths, forumId, memberId);
  try {
    const value = JSON.parse(await readFile12(path2, "utf8"));
    const validation = validateProtocolDocument("inbox-cursor", value);
    if (!validation.ok || value.forumId !== forumId || value.memberId !== memberId) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `inbox cursor is invalid: ${path2}`,
        validation.ok ? void 0 : validation.issues
      );
    }
    return value;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        formatVersion: 1,
        forumId,
        memberId,
        seenIds: [],
        updatedAt: currentUtcTimestamp()
      };
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `inbox cursor contains invalid JSON: ${path2}`
    );
  }
}
async function getInboxReadCursor(input, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const cursor = await loadCursor(paths, registration.forumId, identity.memberId);
  return { memberId: identity.memberId, seenIds: cursor.seenIds, updatedAt: cursor.updatedAt };
}
async function appendSeenIds(forumId, memberId, ids, paths) {
  if (ids.length === 0) return { markedRead: 0, alreadyRead: 0 };
  const lock = await acquireForumLock({
    lockPath: resolve14(paths.locksDirectory, `${forumId}-${memberId}-cursor.lock`),
    command: "inbox mark read"
  });
  try {
    const latest = await loadCursor(paths, forumId, memberId);
    const seen = new Set(latest.seenIds);
    const additions = [...new Set(ids)].filter((id) => !seen.has(id));
    if (additions.length > 0) {
      await writeValidatedJsonAtomic(
        cursorPath(paths, forumId, memberId),
        "inbox-cursor",
        {
          formatVersion: 1,
          forumId,
          memberId,
          seenIds: [...latest.seenIds, ...additions],
          updatedAt: currentUtcTimestamp()
        },
        { overwrite: true, mode: 384 }
      );
    }
    return { markedRead: additions.length, alreadyRead: ids.length - additions.length };
  } finally {
    await lock.release();
  }
}
async function readEvents(directory, roomId, roomSlug, threadId, actorId, activeSince) {
  let names;
  try {
    names = await readdir7(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { entries: [], warnings: [] };
    }
    throw error;
  }
  const entries = [];
  const warnings = [];
  for (const name of names) {
    const path2 = resolve14(directory, name, "event.json");
    try {
      const event = await readJsonDocument(path2, "event");
      if (String(event.createdAt) >= activeSince) {
        entries.push({
          id: String(event.id),
          kind: "event",
          roomId,
          roomSlug,
          threadId,
          type: String(event.type),
          actorId: String(event.actorId),
          createdAt: String(event.createdAt),
          summary: String(event.reason),
          replyTo: null,
          mentions: [],
          relevance: "discovery",
          reasons: [],
          summaryTruncated: false
        });
      }
    } catch (error) {
      warnings.push(protocolWarning(path2, error));
    }
  }
  return { entries, warnings };
}
async function collectRelevantEntries(forumAlias, memberId, paths, roomIds) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const rooms = await listRooms(forumAlias, paths);
  const entries = [];
  const warnings = [...rooms.warnings];
  for (const room of rooms.rooms) {
    if (roomIds && !roomIds.has(room.id)) continue;
    const membershipPath = resolve14(
      registration.path,
      "rooms",
      room.id,
      "members",
      `${memberId}.json`
    );
    let membership;
    try {
      membership = await readJsonDocument(membershipPath, "room-member");
    } catch (error) {
      if (error instanceof StorageError && typeof error.details === "string" && error.details.includes("ENOENT")) continue;
      warnings.push(protocolWarning(membershipPath, error));
      continue;
    }
    if (membership.status !== "active") continue;
    const activeSince = String(membership.updatedAt);
    const roomEvents = await readEvents(
      resolve14(registration.path, "rooms", room.id, "events"),
      room.id,
      room.slug,
      null,
      memberId,
      activeSince
    );
    entries.push(...roomEvents.entries);
    warnings.push(...roomEvents.warnings);
    const threads = await listThreads(forumAlias, room.id, paths);
    warnings.push(...threads.warnings);
    for (const thread of threads.threads) {
      const detail = await showThread(forumAlias, room.id, thread.id, paths);
      warnings.push(...detail.warnings);
      for (const message of detail.messages) {
        if (message.createdAt < activeSince) continue;
        const compact = message.body.replace(/\s+/gu, " ").trim();
        entries.push({
          id: message.id,
          kind: "message",
          roomId: room.id,
          roomSlug: room.slug,
          threadId: thread.id,
          type: message.type,
          actorId: message.authorId,
          createdAt: message.createdAt,
          summary: compact.length > 500 ? `${compact.slice(0, 497)}...` : compact,
          replyTo: message.replyTo,
          mentions: message.mentions,
          ...message.audience === "broadcast" ? { audience: "broadcast" } : {},
          relevance: "discovery",
          reasons: [],
          summaryTruncated: compact.length > 500
        });
      }
      const threadEvents = await readEvents(
        resolve14(
          registration.path,
          "rooms",
          room.id,
          "threads",
          thread.id,
          "events"
        ),
        room.id,
        room.slug,
        thread.id,
        memberId,
        activeSince
      );
      entries.push(...threadEvents.entries);
      warnings.push(...threadEvents.warnings);
    }
  }
  const unique = new Map(entries.map((entry) => [entry.id, entry]));
  return { entries: [...unique.values()], warnings: dedupeWarnings(warnings) };
}
function classifyEntries(entries, attentionIds, watchedIds) {
  const authorByMessageId = new Map(entries.filter((entry) => entry.kind === "message").map((entry) => [entry.id, entry.actorId]));
  const priorityTypes = /* @__PURE__ */ new Set(["blocker", "question", "proposal", "decision", "objection", "thread-closed", "thread-reopened"]);
  return entries.map((entry) => {
    const reasons = [];
    if (entry.kind === "message" && entry.mentions.some((id) => attentionIds.has(id))) reasons.push("mention");
    if (entry.replyTo && attentionIds.has(authorByMessageId.get(entry.replyTo) ?? "")) reasons.push("reply-to-attention");
    if (reasons.length > 0) return { ...entry, relevance: "direct", reasons };
    if (entry.threadId && watchedIds.has(entry.threadId)) return { ...entry, relevance: "watched", reasons: ["watched-thread"] };
    if (priorityTypes.has(entry.type)) return { ...entry, relevance: "priority", reasons: ["priority-type"] };
    return { ...entry, relevance: "discovery", reasons };
  });
}
async function getAllUnreadInboxEntries(input, paths = createAgentForumPaths()) {
  const sync = input.sync ? await refreshForumFromRemote(input.forumAlias, paths) : null;
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const publicProfile2 = await readJsonDocument(
    resolve14(registration.path, "members", identity.memberId, "profile.json"),
    "member-profile"
  );
  if (publicProfile2.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active Forum member: ${identity.memberId}`
    );
  }
  const [collected, cursor, attention, watches] = await Promise.all([
    collectRelevantEntries(input.forumAlias, identity.memberId, paths),
    loadCursor(paths, registration.forumId, identity.memberId),
    listIdentityAttention({ forumAlias: input.forumAlias, ownerMemberId: identity.memberId }, paths),
    listWatchedThreadIds({ forumAlias: input.forumAlias, identityId: identity.memberId }, paths)
  ]);
  const attentionIds = /* @__PURE__ */ new Set([identity.memberId, ...attention.links.filter((link2) => link2.active).map((link2) => link2.subjectMemberId)]);
  const seen = new Set(cursor.seenIds);
  return {
    entries: classifyEntries(collected.entries, attentionIds, new Set(watches.threadIds)).filter((entry) => entry.actorId !== identity.memberId && !seen.has(entry.id)).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)),
    warnings: collected.warnings,
    sync
  };
}
async function markInboxEntriesRead(input, paths = createAgentForumPaths()) {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "at least one Inbox entry ID is required");
  let sync = null;
  let refreshWarning = null;
  if (input.sync) {
    try {
      sync = await refreshForumFromRemote(input.forumAlias, paths);
    } catch (error) {
      refreshWarning = error instanceof Error ? error.message : String(error);
    }
  }
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const publicProfile2 = await readJsonDocument(resolve14(registration.path, "members", identity.memberId, "profile.json"), "member-profile");
  if (publicProfile2.status !== "active") throw new ServiceError("FORUM_MEMBERSHIP_REQUIRED", `identity is not an active Forum member: ${identity.memberId}`);
  const collected = await collectRelevantEntries(input.forumAlias, identity.memberId, paths);
  const eligible = new Set(collected.entries.filter((entry) => entry.actorId !== identity.memberId).map((entry) => entry.id));
  const cursor = await loadCursor(paths, registration.forumId, identity.memberId);
  const seen = new Set(cursor.seenIds);
  const markedIds = ids.filter((id) => eligible.has(id));
  const results = ids.map((id) => {
    if (!eligible.has(id)) return { id, status: "skipped" };
    return { id, status: seen.has(id) ? "already-read" : "read" };
  });
  const result = markedIds.length > 0 ? await appendSeenIds(registration.forumId, identity.memberId, markedIds, paths) : { markedRead: 0, alreadyRead: 0 };
  return { ids, ...result, results, warnings: collected.warnings, sync, refreshWarning };
}
async function markThreadRead(input, paths = createAgentForumPaths()) {
  const detail = await showThread(input.forumAlias, input.room, input.thread, paths);
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const ids = detail.messages.map((message) => message.id);
  const result = ids.length > 0 ? await appendSeenIds(registration.forumId, identity.memberId, ids, paths) : { markedRead: 0, alreadyRead: 0 };
  return { threadId: detail.thread.id, ...result, warnings: detail.warnings };
}
function balancedPage(entries, limit) {
  const ordered = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  if (limit < 3) return ordered.slice(0, limit);
  const discoveryQuota = Math.min(Math.max(2, Math.ceil(limit * 0.2)), limit - 1);
  const discovery = ordered.filter((entry) => entry.relevance === "discovery").slice(0, discoveryQuota);
  const selected = new Set(discovery.map((entry) => entry.id));
  return [...ordered.filter((entry) => !selected.has(entry.id)).slice(0, limit - discovery.length), ...discovery].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}
async function showInboxEntry(input, paths = createAgentForumPaths()) {
  let sync = null;
  let refreshWarning = null;
  if (input.sync) {
    try {
      sync = await refreshForumFromRemote(input.forumAlias, paths);
    } catch (error) {
      refreshWarning = error instanceof Error ? error.message : String(error);
    }
  }
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const profile = await readJsonDocument(resolve14(registration.path, "members", identity.memberId, "profile.json"), "member-profile");
  if (profile.status !== "active") throw new ServiceError("FORUM_MEMBERSHIP_REQUIRED", `identity is not an active Forum member: ${identity.memberId}`);
  const collected = await collectRelevantEntries(input.forumAlias, identity.memberId, paths);
  const entry = collected.entries.find((item) => item.id === input.id);
  if (!entry) throw new ServiceError("MESSAGE_NOT_FOUND", `inbox entry was not found or is outside active Room membership: ${input.id}`);
  try {
    const cached = await getForumSnapshot(input.forumAlias, paths);
    const item = cached.snapshot.rooms.flatMap((room) => [...room.events, ...room.threads.flatMap((thread) => thread.timeline)]).find((candidate) => candidate.id === entry.id);
    if (item?.kind === "message") return { entry, content: { body: item.body }, cache: cached.cache, sync, refreshWarning };
    if (item?.kind === "event") return { entry, content: { reason: item.reason, data: item.data }, cache: cached.cache, sync, refreshWarning };
  } catch {
  }
  if (entry.kind === "message" && entry.threadId) {
    const detail = await showThread(input.forumAlias, entry.roomId, entry.threadId, paths);
    const message = detail.messages.find((item) => item.id === entry.id);
    if (!message) throw new ServiceError("MESSAGE_NOT_FOUND", `message was not found: ${entry.id}`);
    return { entry, content: { body: message.body }, cache: "fallback", sync, refreshWarning };
  }
  const eventPath = entry.threadId ? resolve14(registration.path, "rooms", entry.roomId, "threads", entry.threadId, "events", entry.id, "event.json") : resolve14(registration.path, "rooms", entry.roomId, "events", entry.id, "event.json");
  const event = await readJsonDocument(eventPath, "event");
  return { entry, content: { reason: String(event.reason), data: event.data }, cache: "fallback", sync, refreshWarning };
}
async function resolveInboxRoomScope(input, registration, paths) {
  if (input.all) return { scope: "all", roomIds: void 0 };
  if (input.roomId) {
    const room = await findRoomByScope(registration, input.roomId, paths);
    return { scope: "room", roomIds: /* @__PURE__ */ new Set([room.id]) };
  }
  try {
    const context = await resolveContext({}, paths);
    if (context.forumId !== registration.forumId) {
      throw new ServiceError(
        "INBOX_SCOPE_BOUND_MISMATCH",
        `the bound context Forum (${context.forumAlias}) differs from the requested --forum (${registration.alias}); use --room <slug> or --all`
      );
    }
    return { scope: "bound", roomIds: /* @__PURE__ */ new Set([context.roomId]) };
  } catch (error) {
    if (error instanceof ContextError && error.code === "CONTEXT_NOT_BOUND") {
      throw new ServiceError(
        "INBOX_SCOPE_REQUIRED",
        "no bound context; use --room <slug> or --all to select a scope"
      );
    }
    throw error;
  }
}
async function findRoomByScope(registration, roomIdOrSlug, paths) {
  const rooms = await listRooms(registration.alias, paths);
  const room = rooms.rooms.find(
    (item) => item.id === roomIdOrSlug || item.slug === roomIdOrSlug
  );
  if (!room) {
    throw new ServiceError(
      "ROOM_NOT_FOUND",
      `Room not found: ${roomIdOrSlug}`
    );
  }
  return { id: room.id };
}
async function fullContentPage(page, forumAlias, paths) {
  try {
    const cached = await getForumSnapshot(forumAlias, paths);
    const items = new Map(
      cached.snapshot.rooms.flatMap((room) => [
        ...room.events.map((event) => [event.id, event]),
        ...room.threads.flatMap((thread) => thread.timeline.map((item) => [item.id, item]))
      ])
    );
    return page.map((entry) => {
      const item = items.get(entry.id);
      const content = item?.kind === "message" ? item.body : item?.kind === "event" ? item.reason : void 0;
      return {
        ...entry,
        ...content !== void 0 ? { summary: content } : {},
        summaryTruncated: false
      };
    });
  } catch {
    return page.map((entry) => ({ ...entry, summaryTruncated: entry.summaryTruncated }));
  }
}
async function getInbox(input, paths = createAgentForumPaths()) {
  const limit = input.limit ?? 20;
  const summaryChars = input.summaryChars ?? 180;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StorageError("SCHEMA_VALIDATION_FAILED", "inbox limit must be between 1 and 100");
  }
  if (!Number.isInteger(summaryChars) || summaryChars < 0 || summaryChars > 500) {
    throw new StorageError("SCHEMA_VALIDATION_FAILED", "inbox summaryChars must be between 0 and 500");
  }
  const syncResult = input.sync ? await refreshForumFromRemote(input.forumAlias, paths) : null;
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const publicProfile2 = await readJsonDocument(
    resolve14(registration.path, "members", identity.memberId, "profile.json"),
    "member-profile"
  );
  if (publicProfile2.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active Forum member: ${identity.memberId}`
    );
  }
  const roomScope = await resolveInboxRoomScope(
    { forumAlias: input.forumAlias, ...input.roomId !== void 0 ? { roomId: input.roomId } : {}, ...input.all !== void 0 ? { all: input.all } : {} },
    registration,
    paths
  );
  const [collected, cursor, attention, watches] = await Promise.all([
    collectRelevantEntries(input.forumAlias, identity.memberId, paths, roomScope.roomIds),
    loadCursor(paths, registration.forumId, identity.memberId),
    listIdentityAttention({ forumAlias: input.forumAlias, ownerMemberId: identity.memberId }, paths),
    listWatchedThreadIds({ forumAlias: input.forumAlias, identityId: identity.memberId }, paths)
  ]);
  const seen = new Set(cursor.seenIds);
  const attentionIds = /* @__PURE__ */ new Set([identity.memberId, ...attention.links.filter((link2) => link2.active).map((link2) => link2.subjectMemberId)]);
  const unread = classifyEntries(collected.entries, attentionIds, new Set(watches.threadIds)).filter((entry) => entry.actorId !== identity.memberId && !seen.has(entry.id)).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const page = balancedPage(unread, limit);
  const idsToMark = input.markAllRead ? unread.map((entry) => entry.id) : input.markRead ? page.map((entry) => entry.id) : [];
  if (idsToMark.length > 0) await appendSeenIds(registration.forumId, identity.memberId, idsToMark, paths);
  const relevanceCounts = { direct: 0, watched: 0, priority: 0, discovery: 0 };
  for (const entry of unread) relevanceCounts[entry.relevance] += 1;
  const displayed = input.full ? await fullContentPage(page, input.forumAlias, paths) : page.map((entry) => {
    const truncated = entry.summary.length > summaryChars;
    return {
      ...entry,
      summary: summaryChars === 0 ? "" : truncated ? `${entry.summary.slice(0, Math.max(0, summaryChars - 3))}...` : entry.summary,
      summaryTruncated: entry.summaryTruncated || truncated
    };
  });
  return {
    entries: input.markAllRead ? [] : displayed,
    totalUnread: unread.length,
    relevanceCounts,
    hasMore: unread.length > page.length,
    markedRead: idsToMark.length,
    scope: roomScope.scope,
    warnings: collected.warnings,
    sync: syncResult
  };
}

// src/services/dashboard.ts
init_publish_policy();
var clientIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
var clientTypes = /* @__PURE__ */ new Set(["pi", "opencode", "codex", "claude-code"]);
function emptyRuntime() {
  return { formatVersion: 1, clients: [], viewTargets: [], pollingForumIds: [], pinnedRoomIds: [], revision: 0, updatedAt: currentUtcTimestamp() };
}
function validViewTarget(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  return typeof item.forumAlias === "string" && typeof item.forumId === "string" && typeof item.roomId === "string" && typeof item.identityId === "string";
}
function validClient(value) {
  if (!validViewTarget(value)) return false;
  const item = value;
  return typeof item.clientId === "string" && clientIdPattern.test(item.clientId) && typeof item.clientType === "string" && clientTypes.has(item.clientType) && (item.attachedAt === void 0 || typeof item.attachedAt === "string" && !Number.isNaN(Date.parse(item.attachedAt))) && typeof item.expiresAt === "string" && !Number.isNaN(Date.parse(item.expiresAt));
}
async function loadRuntime(paths) {
  try {
    const value = JSON.parse(await readFile13(paths.dashboardRuntimeFile, "utf8"));
    if (value.formatVersion !== 1 || !Array.isArray(value.clients) || !value.clients.every(validClient) || value.viewTargets !== void 0 && (!Array.isArray(value.viewTargets) || !value.viewTargets.every(validViewTarget)) || !Array.isArray(value.pollingForumIds) || !value.pollingForumIds.every((id) => typeof id === "string") || !Array.isArray(value.pinnedRoomIds) || !value.pinnedRoomIds.every((id) => typeof id === "string")) {
      throw new ServiceError("PROTOCOL_DATA_DAMAGED", "Dashboard runtime state is invalid");
    }
    const viewTargets = value.viewTargets ?? value.clients.map(({ forumAlias, forumId, roomId, identityId }) => ({ forumAlias, forumId, roomId, identityId }));
    return { formatVersion: 1, clients: value.clients, viewTargets, pollingForumIds: value.pollingForumIds, pinnedRoomIds: value.pinnedRoomIds, revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : currentUtcTimestamp() };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return emptyRuntime();
    throw error;
  }
}
function active(runtime, now = Date.now()) {
  return runtime.clients.filter((client) => Date.parse(client.expiresAt) > now);
}
async function mutateRuntime(command, paths, mutate) {
  const lock = await acquireForumLock({ lockPath: resolve15(paths.locksDirectory, "dashboard.lock"), command });
  try {
    const runtime = await loadRuntime(paths);
    const activeClients = active(runtime);
    if (activeClients.length !== runtime.clients.length) runtime.revision += 1;
    runtime.clients = activeClients;
    const result = mutate(runtime);
    runtime.updatedAt = currentUtcTimestamp();
    await writeJsonAtomic(paths.dashboardRuntimeFile, runtime, { overwrite: true, mode: 384 });
    return result;
  } finally {
    await lock.release();
  }
}
async function attachDashboardClient(input, paths = createAgentForumPaths()) {
  if (!clientIdPattern.test(input.clientId) || !clientTypes.has(input.clientType)) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "invalid Dashboard client identity");
  const leaseMs = input.leaseMs ?? 45e3;
  if (!Number.isInteger(leaseMs) || leaseMs < 5e3 || leaseMs > 5 * 6e4) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "Dashboard lease must be between 5 seconds and 5 minutes");
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const attachedAt = (/* @__PURE__ */ new Date()).toISOString();
  const client = { clientId: input.clientId, clientType: input.clientType, forumAlias: forum.alias, forumId: forum.forumId, roomId: input.roomId, identityId: identity.memberId, attachedAt, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
  return mutateRuntime("dashboard attach", paths, (runtime) => {
    const previous = runtime.clients.find((item) => item.clientId === client.clientId);
    if (previous?.attachedAt) client.attachedAt = previous.attachedAt;
    runtime.clients = [...runtime.clients.filter((item) => item.clientId !== client.clientId), client];
    const target2 = { forumAlias: client.forumAlias, forumId: client.forumId, roomId: client.roomId, identityId: client.identityId };
    if (input.resetView) runtime.viewTargets = runtime.clients.map(({ forumAlias, forumId, roomId, identityId }) => ({ forumAlias, forumId, roomId, identityId }));
    const targetKey = (item) => `${item.forumId}\0${item.roomId}\0${item.identityId}`;
    runtime.viewTargets = [...runtime.viewTargets.filter((item) => targetKey(item) !== targetKey(target2)), target2];
    if (input.resetView || !previous || previous.clientType !== client.clientType || previous.forumId !== client.forumId || previous.roomId !== client.roomId || previous.identityId !== client.identityId) runtime.revision += 1;
    return { client, activeClients: runtime.clients.length };
  });
}
async function detachDashboardClient(clientId, paths = createAgentForumPaths()) {
  return mutateRuntime("dashboard detach", paths, (runtime) => {
    const before = runtime.clients.length;
    runtime.clients = runtime.clients.filter((item) => item.clientId !== clientId);
    if (before !== runtime.clients.length) runtime.revision += 1;
    return { detached: before !== runtime.clients.length, activeClients: runtime.clients.length };
  });
}
async function dashboardStatus(paths = createAgentForumPaths()) {
  const runtime = await loadRuntime(paths);
  const activeClients = active(runtime);
  if (activeClients.length !== runtime.clients.length) {
    return mutateRuntime("dashboard status", paths, (current) => ({ clients: current.clients, viewTargets: current.viewTargets, pollingForumIds: current.pollingForumIds, pinnedRoomIds: current.pinnedRoomIds, revision: current.revision }));
  }
  return { clients: activeClients, viewTargets: runtime.viewTargets, pollingForumIds: runtime.pollingForumIds, pinnedRoomIds: runtime.pinnedRoomIds, revision: runtime.revision };
}
async function invalidateDashboard(paths = createAgentForumPaths()) {
  await mutateRuntime("dashboard invalidate", paths, (runtime) => {
    if (runtime.viewTargets.length > 0) runtime.revision += 1;
  });
}
async function setDashboardForumPolling(forumId, enabled, paths = createAgentForumPaths()) {
  return mutateRuntime("dashboard polling", paths, (runtime) => {
    runtime.pollingForumIds = enabled ? [.../* @__PURE__ */ new Set([...runtime.pollingForumIds, forumId])] : runtime.pollingForumIds.filter((id) => id !== forumId);
    runtime.revision += 1;
    return { forumId, enabled };
  });
}
async function setDashboardRoomPinned(roomId, pinned, paths = createAgentForumPaths()) {
  return mutateRuntime("dashboard pin", paths, (runtime) => {
    runtime.pinnedRoomIds = pinned ? [.../* @__PURE__ */ new Set([...runtime.pinnedRoomIds, roomId])] : runtime.pinnedRoomIds.filter((id) => id !== roomId);
    runtime.revision += 1;
    return { roomId, pinned };
  });
}
async function getDashboardSnapshot(paths = createAgentForumPaths()) {
  const runtime = await dashboardStatus(paths);
  const bindingState = await loadContextBindingState(paths);
  const publishPolicy = await loadPublishPolicy(paths);
  const sendModeByRoom = /* @__PURE__ */ new Map();
  for (const entry of publishPolicy.entries) {
    sendModeByRoom.set(`${entry.forumId}\0${entry.roomId}`, entry.mode);
  }
  const bindingsByRoom = /* @__PURE__ */ new Map();
  for (const binding of bindingState.bindings) {
    const key = `${binding.forumId}\0${binding.roomId}`;
    const current = bindingsByRoom.get(key) ?? [];
    current.push({ workspaceRoot: binding.workspaceRoot, branch: binding.scope === "branch" ? binding.branch : null });
    bindingsByRoom.set(key, current);
  }
  for (const bindings of bindingsByRoom.values()) {
    bindings.sort((left, right) => left.workspaceRoot.localeCompare(right.workspaceRoot) || (left.branch ?? "").localeCompare(right.branch ?? ""));
  }
  const teams = /* @__PURE__ */ new Map();
  for (const target2 of runtime.viewTargets) teams.set(target2.forumId, [...teams.get(target2.forumId) ?? [], target2]);
  const result = [];
  for (const [forumId, targets] of teams) {
    const alias = targets[0].forumAlias;
    const clients = runtime.clients.filter((client) => client.forumId === forumId);
    const snapshot = (await getForumSnapshot(alias, paths)).snapshot;
    const byRoom = new Map(snapshot.rooms.map((room) => [room.room.id, { roomId: room.room.id, title: room.room.title, counts: { related: 0, broadcast: 0, other: 0 }, activeLocalAgents: clients.filter((client) => client.roomId === room.room.id).length, pinned: runtime.pinnedRoomIds.includes(room.room.id), deprecated: Boolean(room.room.deprecation), bindings: bindingsByRoom.get(`${forumId}\0${room.room.id}`) ?? [], sendMode: sendModeByRoom.get(`${forumId}\0${room.room.id}`) ?? "auto" }]));
    const closedThreadIds = new Set(snapshot.rooms.flatMap((room) => room.threads.filter((thread) => thread.thread.status === "closed").map((thread) => thread.thread.id)));
    const seen = /* @__PURE__ */ new Set();
    const identityIds = [...new Set(targets.map((target2) => target2.identityId))];
    for (const identityId of identityIds) {
      const inbox = await getAllUnreadInboxEntries({ forumAlias: alias, identityId }, paths);
      for (const entry of inbox.entries) {
        if (entry.threadId && closedThreadIds.has(entry.threadId)) continue;
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        const room = byRoom.get(entry.roomId);
        if (!room) continue;
        if (entry.relevance === "direct" || entry.relevance === "watched") room.counts.related += 1;
        else if (entry.audience === "broadcast") room.counts.broadcast += 1;
        else room.counts.other += 1;
      }
    }
    const allRooms = [...byRoom.values()];
    const counts = allRooms.reduce((total, room) => ({ related: total.related + room.counts.related, broadcast: total.broadcast + room.counts.broadcast, other: total.other + room.counts.other }), { related: 0, broadcast: 0, other: 0 });
    const rooms = allRooms.sort((left, right) => Number(left.deprecated) - Number(right.deprecated) || Number(right.pinned) - Number(left.pinned) || right.activeLocalAgents - left.activeLocalAgents || right.counts.related * 12 + right.counts.broadcast * 3 + right.counts.other - (left.counts.related * 12 + left.counts.broadcast * 3 + left.counts.other) || left.title.localeCompare(right.title));
    result.push({ forumId, forumAlias: alias, polling: runtime.pollingForumIds.includes(forumId), identityIds, counts, rooms });
  }
  return { revision: runtime.revision, teams: result.sort((a, b) => a.forumAlias.localeCompare(b.forumAlias)), activeClients: runtime.clients.length };
}

// src/services/dashboard-installer.ts
init_atomic();
init_lock();
init_paths();
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, mkdir as mkdir3, mkdtemp, open as open2, readFile as readFile14, readdir as readdir8, readlink, realpath as realpath3, rename as rename3, rm as rm7, stat as stat3 } from "node:fs/promises";
import { dirname as dirname3, isAbsolute as isAbsolute2, posix as posix2, resolve as resolve16, sep as sep2 } from "node:path";
init_errors2();
var repository = "wszzs110/agent-forum-skills";
var sha256Pattern = /^[a-f0-9]{64}$/u;
var versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
var fileNamePattern = /^[A-Za-z0-9._-]+$/u;
var executablePattern = /^[A-Za-z0-9._/-]+$/u;
var maximumAssetSize = 2 * 1024 * 1024 * 1024;
var assetConnectionTimeoutMs = 6e4;
var assetInactivityTimeoutMs = 10 * 6e4;
function defaultManifestUrl(dashboardVersion = DASHBOARD_VERSION) {
  if (dashboardVersion === "0.0.0-dev") {
    throw new ServiceError("DASHBOARD_RELEASE_UNAVAILABLE", "development builds require --manifest-url or AGENT_FORUM_DASHBOARD_MANIFEST_URL");
  }
  return `https://github.com/${repository}/releases/download/v${dashboardVersion}/dashboard-manifest.json`;
}
function safeExecutable(root, relative4) {
  if (!executablePattern.test(relative4) || relative4.startsWith("/") || relative4.includes("..") || relative4.includes("\\")) {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `unsafe Dashboard executable path: ${relative4}`);
  }
  const normalizedRoot = resolve16(root);
  const target2 = resolve16(normalizedRoot, relative4);
  if (target2 !== normalizedRoot && !target2.startsWith(`${normalizedRoot}${sep2}`)) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard executable escapes its installation directory");
  return target2;
}
function parseManifest(value) {
  if (!value || typeof value !== "object") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest must be an object");
  const manifest = value;
  const topLevelKeys = Object.keys(manifest).sort();
  if (topLevelKeys.length !== 3 || topLevelKeys[0] !== "assets" || topLevelKeys[1] !== "formatVersion" || topLevelKeys[2] !== "version") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest contains missing or unknown fields");
  if (manifest.formatVersion !== 1 || typeof manifest.version !== "string" || !versionPattern.test(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest has invalid top-level fields");
  }
  const assets = manifest.assets.map((unknownAsset) => {
    if (!unknownAsset || typeof unknownAsset !== "object") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset must be an object");
    const asset = unknownAsset;
    const keys = Object.keys(asset).sort();
    const expected = ["arch", "archiveFormat", "executable", "executableSha256", "fileName", "platform", "sha256", "size", "url"].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset contains missing or unknown fields");
    if (asset.platform !== "win32" && asset.platform !== "darwin" && asset.platform !== "linux" || asset.arch !== "x64" && asset.arch !== "arm64" || asset.archiveFormat !== "tar.gz" || typeof asset.fileName !== "string" || !fileNamePattern.test(asset.fileName) || typeof asset.executable !== "string" || typeof asset.executableSha256 !== "string" || !sha256Pattern.test(asset.executableSha256) || typeof asset.sha256 !== "string" || !sha256Pattern.test(asset.sha256) || !Number.isSafeInteger(asset.size) || Number(asset.size) <= 0 || Number(asset.size) > maximumAssetSize || typeof asset.url !== "string") {
      throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset contains invalid fields");
    }
    safeExecutable("/dashboard", asset.executable);
    let url;
    try {
      url = new URL(asset.url);
    } catch {
      throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset URL is invalid");
    }
    if (url.protocol !== "https:" || url.username || url.password) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset URL must use credential-free HTTPS");
    return asset;
  });
  const targets = /* @__PURE__ */ new Set();
  for (const asset of assets) {
    const target2 = `${asset.platform}-${asset.arch}`;
    if (targets.has(target2)) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `duplicate Dashboard release target: ${target2}`);
    targets.add(target2);
  }
  return { formatVersion: 1, version: manifest.version, assets };
}
async function sha256File(path2) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path2)) hash.update(chunk);
  return hash.digest("hex");
}
async function collectInstalledFiles(root, directory = root) {
  const files = {};
  const lexicalRoot = resolve16(root);
  const canonicalRoot = await realpath3(root);
  for (const entry of await readdir8(directory, { withFileTypes: true })) {
    if (directory === root && entry.name === "installation.json") continue;
    const path2 = resolve16(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await collectInstalledFiles(root, path2));
    else if (entry.isFile()) files[relativePath(root, path2)] = await sha256File(path2);
    else if (entry.isSymbolicLink()) {
      const target2 = await readlink(path2);
      if (!target2 || isAbsolute2(target2) || target2.includes("\\") || target2.includes("\0")) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation contains an unsafe symbolic link");
      const lexicalTarget = resolve16(dirname3(path2), target2);
      if (lexicalTarget !== lexicalRoot && !lexicalTarget.startsWith(`${lexicalRoot}${sep2}`)) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation symbolic link escapes its root");
      const canonicalTarget = await realpath3(path2);
      if (canonicalTarget !== canonicalRoot && !canonicalTarget.startsWith(`${canonicalRoot}${sep2}`)) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation symbolic link resolves outside its root");
      files[relativePath(root, path2)] = createHash("sha256").update(`symlink:${target2}`).digest("hex");
    } else throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation contains an unsupported filesystem entry");
  }
  return files;
}
function relativePath(root, path2) {
  return path2.slice(resolve16(root).length + 1).split(sep2).join("/");
}
function modifiedFilePaths(expected, actual) {
  return [.../* @__PURE__ */ new Set([...Object.keys(expected), ...Object.keys(actual)])].filter((path2) => expected[path2] !== actual[path2]).sort();
}
async function fetchJson(url, fetcher, onStatus) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    onStatus?.(attempt === 1 ? "Downloading Dashboard release manifest\u2026" : `Retrying Dashboard release manifest (attempt ${attempt}/3)\u2026`);
    try {
      const response = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(3e4) });
      if (!response.ok) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", `Dashboard release manifest returned HTTP ${response.status}`);
      try {
        return await response.json();
      } catch {
        throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest is not valid JSON");
      }
    } catch (error) {
      if (error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID") throw error;
      lastError = error;
      if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 200));
    }
  }
  throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "could not download Dashboard release manifest", { cause: lastError instanceof Error ? lastError.message : String(lastError) });
}
function dashboardReleasePageUrl(dashboardVersion = DASHBOARD_VERSION) {
  if (dashboardVersion === "0.0.0-dev") return `https://github.com/${repository}/releases`;
  return `https://github.com/${repository}/releases/tag/v${dashboardVersion}`;
}
async function inspectDashboardRelease(options = {}) {
  const dashboardVersion = options.dashboardVersion ?? options.packageVersion ?? DASHBOARD_VERSION;
  const configuredManifestUrl = options.manifestUrl ?? process.env.AGENT_FORUM_DASHBOARD_MANIFEST_URL;
  const manifestUrl = configuredManifestUrl ?? defaultManifestUrl(dashboardVersion);
  let parsedUrl;
  try {
    parsedUrl = new URL(manifestUrl);
  } catch {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard manifest URL is invalid");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost" || parsedUrl.username || parsedUrl.password) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard manifest URL must use credential-free HTTPS");
  const manifest = parseManifest(await fetchJson(manifestUrl, options.fetcher ?? fetch, options.onStatus));
  if (!configuredManifestUrl && dashboardVersion !== "0.0.0-dev" && manifest.version !== dashboardVersion) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `Dashboard manifest version ${manifest.version} does not match the required Dashboard version ${dashboardVersion}`);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const asset = manifest.assets.find((candidate) => candidate.platform === platform && candidate.arch === arch);
  if (!asset) throw new ServiceError("DASHBOARD_PLATFORM_UNSUPPORTED", `no Dashboard release for ${platform}-${arch}`);
  return { manifestUrl, version: manifest.version, asset };
}
async function inspectDashboardReleaseFile(manifestPath, options = {}) {
  let value;
  try {
    value = JSON.parse(await readFile14(manifestPath, "utf8"));
  } catch (error) {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "could not read Dashboard release manifest file", { cause: error instanceof Error ? error.message : String(error) });
  }
  const manifest = parseManifest(value);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const asset = manifest.assets.find((candidate) => candidate.platform === platform && candidate.arch === arch);
  if (!asset) throw new ServiceError("DASHBOARD_PLATFORM_UNSUPPORTED", `no Dashboard release for ${platform}-${arch}`);
  return { manifestUrl: `file://${resolve16(manifestPath)}`, version: manifest.version, asset };
}
async function existingPartialSize(asset, destination) {
  try {
    const existing = await stat3(destination);
    if (!existing.isFile() || existing.size > asset.size) {
      await rm7(destination, { force: true });
      return 0;
    }
    if (existing.size === asset.size) {
      if (await sha256File(destination) === asset.sha256) return asset.size;
      await rm7(destination, { force: true });
      return 0;
    }
    return existing.size;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
}
async function appendExistingBytes(hash, destination) {
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
}
async function downloadAssetOnce(asset, destination, fetcher, onProgress, attempt = 1, timeouts = {}) {
  let offset = await existingPartialSize(asset, destination);
  if (offset === asset.size) {
    onProgress?.(asset.size, asset.size, attempt);
    return;
  }
  const controller = new AbortController();
  const connectionTimeout = timeouts.assetConnectionMs ?? assetConnectionTimeoutMs;
  const inactivityTimeout = timeouts.assetInactivityMs ?? assetInactivityTimeoutMs;
  let timedOut = false;
  let connectionTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, connectionTimeout);
  let response;
  try {
    response = await fetcher(asset.url, {
      redirect: "follow",
      signal: controller.signal,
      ...offset > 0 ? { headers: { Range: `bytes=${offset}-` } } : {}
    });
  } catch (error) {
    throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", timedOut ? "Dashboard release asset connection timed out" : "could not download Dashboard release asset", { cause: error instanceof Error ? error.message : String(error) });
  } finally {
    if (connectionTimer) clearTimeout(connectionTimer);
    connectionTimer = void 0;
  }
  if (!response.ok || !response.body) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", `Dashboard release asset returned HTTP ${response.status}`);
  const resuming = offset > 0 && response.status === 206;
  if (!resuming) {
    offset = 0;
    await rm7(destination, { force: true });
  }
  const declared = response.headers.get("content-length");
  const expectedLength = asset.size - offset;
  if (declared && Number(declared) !== expectedLength) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset size does not match the manifest");
  const handle = await open2(destination, resuming ? "a" : "w", 384);
  const hash = createHash("sha256");
  if (resuming) await appendExistingBytes(hash, destination);
  let received = offset;
  let inactivityTimer;
  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, inactivityTimeout);
  };
  const reader = response.body.getReader();
  try {
    resetInactivityTimer();
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      resetInactivityTimer();
      received += result.value.byteLength;
      if (received > asset.size) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset exceeds the declared size");
      hash.update(result.value);
      await handle.write(result.value);
      onProgress?.(received, asset.size, attempt);
    }
    await handle.sync();
  } catch (error) {
    if (timedOut) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset download stalled", { cause: error instanceof Error ? error.message : String(error) });
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "could not download Dashboard release asset", { cause: error instanceof Error ? error.message : String(error) });
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    await reader.cancel().catch(() => void 0);
    await handle.close().catch(() => void 0);
  }
  if (received !== asset.size) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset is incomplete");
  if (hash.digest("hex") !== asset.sha256) {
    await rm7(destination, { force: true });
    throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard release asset failed SHA-256 verification");
  }
}
async function downloadAsset(asset, destination, fetcher, onProgress, timeouts = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await downloadAssetOnce(asset, destination, fetcher, onProgress, attempt, timeouts);
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof ServiceError && error.code === "DASHBOARD_CHECKSUM_MISMATCH") throw error;
      if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 200));
    }
  }
  throw lastError;
}
async function runTar(args2) {
  return new Promise((resolveTar, reject) => {
    const child = spawn("tar", args2, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => reject(new ServiceError("DASHBOARD_INSTALL_FAILED", "could not start the system tar extractor", { cause: error.message })));
    child.on("close", (code) => code === 0 ? resolveTar(stdout) : reject(new ServiceError("DASHBOARD_INSTALL_FAILED", "could not inspect or extract the Dashboard release asset", { cause: stderr.trim() })));
  });
}
function normalizedArchivePath(entry) {
  const trimmed = entry.replace(/^\.\//u, "").replace(/\/$/u, "");
  return trimmed || ".";
}
function validateDashboardArchiveEntries(entries, verboseEntries) {
  if (entries.length === 0 || verboseEntries.length !== entries.length) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive listing is incomplete");
  const normalizedEntries = entries.map(normalizedArchivePath);
  const uniqueEntries = /* @__PURE__ */ new Set();
  const symlinkEntries = /* @__PURE__ */ new Set();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const normalized = normalizedEntries[index];
    const verbose = verboseEntries[index];
    if (entry.startsWith("/") || entry.startsWith("\\") || entry.includes("\\") || entry.split("/").includes("..") || uniqueEntries.has(normalized)) {
      throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsafe or duplicate path");
    }
    uniqueEntries.add(normalized);
    const type = verbose[0];
    if (type === "-" || type === "d") continue;
    if (type !== "l") throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsupported link type");
    const separator = verbose.lastIndexOf(" -> ");
    const target2 = separator >= 0 ? verbose.slice(separator + 4) : "";
    if (!target2 || posix2.isAbsolute(target2) || target2.includes("\\") || target2.includes("\0")) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsafe symbolic link");
    const resolvedTarget = posix2.normalize(posix2.join(posix2.dirname(normalized), target2));
    if (resolvedTarget === ".." || resolvedTarget.startsWith("../")) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive symbolic link escapes its root");
    symlinkEntries.add(normalized);
  }
  for (const entry of normalizedEntries) {
    let ancestor = posix2.dirname(entry);
    while (ancestor !== ".") {
      if (symlinkEntries.has(ancestor)) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive writes through a symbolic link");
      ancestor = posix2.dirname(ancestor);
    }
  }
}
async function extractArchive(archive2, destination) {
  const entries = (await runTar(["-tzf", archive2])).split(/\r?\n/u).filter(Boolean);
  const verboseEntries = (await runTar(["-tvzf", archive2])).split(/\r?\n/u).filter(Boolean);
  validateDashboardArchiveEntries(entries, verboseEntries);
  await mkdir3(destination, { recursive: true });
  await runTar(["-xzf", archive2, "-C", destination]);
}
async function getDashboardLaunchStatus(paths = createAgentForumPaths()) {
  let installation;
  try {
    installation = JSON.parse(await readFile14(paths.dashboardInstallationFile, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { status: "not-installed" };
    return { status: "damaged" };
  }
  if (installation.formatVersion !== 1 || !versionPattern.test(installation.version) || installation.platform !== process.platform || installation.arch !== process.arch || !sha256Pattern.test(installation.executableSha256) || typeof installation.executable !== "string") return { status: "damaged", installation };
  try {
    const executable = safeExecutable(paths.dashboardInstallDirectory, installation.executable);
    const executableStat = await stat3(executable);
    if (!executableStat.isFile()) return { status: "damaged", installation };
    return { status: "installed", installation, executable };
  } catch {
    return { status: "damaged", installation };
  }
}
async function getDashboardInstallationStatus(paths = createAgentForumPaths()) {
  let installation;
  try {
    installation = JSON.parse(await readFile14(paths.dashboardInstallationFile, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { status: "not-installed" };
    return { status: "damaged" };
  }
  if (installation.formatVersion !== 1 || !versionPattern.test(installation.version) || !sha256Pattern.test(installation.executableSha256) || !installation.files || typeof installation.files !== "object" || Object.values(installation.files).some((hash) => !sha256Pattern.test(hash))) return { status: "damaged" };
  let executable;
  try {
    executable = safeExecutable(paths.dashboardInstallDirectory, installation.executable);
    await stat3(executable);
  } catch {
    return { status: "damaged", installation };
  }
  try {
    const actual = await sha256File(executable);
    const files = await collectInstalledFiles(paths.dashboardInstallDirectory);
    const modifiedFiles = modifiedFilePaths(installation.files, files);
    return actual === installation.executableSha256 && modifiedFiles.length === 0 ? { status: "installed", installation, executable } : { status: "modified", installation, executable, modifiedFiles };
  } catch {
    return { status: "damaged", installation, executable };
  }
}
async function resolveDashboardRelease(options) {
  if (options.manifestPath) {
    if (options.manifestUrl) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "--manifest and --manifest-url cannot be used together");
    return inspectDashboardReleaseFile(options.manifestPath, options);
  }
  return inspectDashboardRelease(options);
}
async function verifyArchive(asset, archive2) {
  let archiveStat;
  try {
    archiveStat = await stat3(archive2);
  } catch (error) {
    throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard archive file does not exist", { cause: error instanceof Error ? error.message : String(error) });
  }
  if (!archiveStat.isFile() || archiveStat.size !== asset.size) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard archive size does not match the manifest");
  if (await sha256File(archive2) !== asset.sha256) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard archive failed SHA-256 verification");
}
async function acquireArchive(release, options, paths) {
  if (options.archivePath) {
    options.onStatus?.("Verifying local Dashboard archive\u2026");
    await verifyArchive(release.asset, options.archivePath);
    return options.archivePath;
  }
  const cacheName = `${release.version}-${release.asset.platform}-${release.asset.arch}-${release.asset.fileName}.part`;
  const archive2 = resolve16(paths.dashboardDownloadsDirectory, cacheName);
  const lock = await acquireForumLock({
    lockPath: resolve16(paths.locksDirectory, `dashboard-download-${release.version}-${release.asset.platform}-${release.asset.arch}.lock`),
    command: "dashboard download"
  });
  try {
    await mkdir3(paths.dashboardDownloadsDirectory, { recursive: true, mode: 448 });
    options.onStatus?.("Preparing Dashboard archive download\u2026");
    await downloadAsset(release.asset, archive2, options.fetcher ?? fetch, options.onProgress, options.downloadTimeouts);
    return archive2;
  } finally {
    await lock.release();
  }
}
async function installDashboard(options = {}, paths = createAgentForumPaths()) {
  const release = await resolveDashboardRelease(options);
  const before = await getDashboardInstallationStatus(paths);
  if (before.status === "installed" && before.installation?.version === release.version) {
    options.onStatus?.("Dashboard installation is already current.");
    return { action: "unchanged", installation: before.installation, executable: before.executable };
  }
  if (before.status !== "not-installed" && !options.update) throw new ServiceError("DASHBOARD_ALREADY_INSTALLED", "Dashboard is already installed; use dashboard update");
  if ((before.status === "modified" || before.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat update with --force");
  const archive2 = await acquireArchive(release, options, paths);
  options.onStatus?.("Extracting Dashboard archive\u2026");
  await mkdir3(dirname3(paths.dashboardInstallDirectory), { recursive: true });
  const staging = await mkdtemp(resolve16(dirname3(paths.dashboardInstallDirectory), ".dashboard-install-"));
  const payload = resolve16(staging, "payload");
  try {
    await extractArchive(archive2, payload);
    options.onStatus?.("Verifying extracted Dashboard files\u2026");
    const stagedExecutable = safeExecutable(payload, release.asset.executable);
    await stat3(stagedExecutable);
    if (await sha256File(stagedExecutable) !== release.asset.executableSha256) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "extracted Dashboard executable failed SHA-256 verification");
    if (process.platform !== "win32") await chmod(stagedExecutable, 448);
    const files = await collectInstalledFiles(payload);
    const installation = { formatVersion: 1, version: release.version, platform: release.asset.platform, arch: release.asset.arch, executable: release.asset.executable, executableSha256: release.asset.executableSha256, files, sourceUrl: release.asset.url, installedAt: (options.now ?? /* @__PURE__ */ new Date()).toISOString() };
    await writeJsonAtomic(resolve16(payload, "installation.json"), installation, { overwrite: true });
    options.onStatus?.("Activating Dashboard installation\u2026");
    const lock = await acquireForumLock({ lockPath: resolve16(paths.locksDirectory, "dashboard-install.lock"), command: "dashboard activate" });
    try {
      const current = await getDashboardInstallationStatus(paths);
      if (current.status === "installed" && current.installation?.version === release.version) return { action: "unchanged", installation: current.installation, executable: current.executable };
      if (current.status !== "not-installed" && !options.update) throw new ServiceError("DASHBOARD_ALREADY_INSTALLED", "Dashboard is already installed; use dashboard update");
      if ((current.status === "modified" || current.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat update with --force");
      const backup = resolve16(dirname3(paths.dashboardInstallDirectory), `.dashboard-backup-${Date.now()}`);
      let backedUp = false;
      try {
        if (current.status !== "not-installed") {
          await rename3(paths.dashboardInstallDirectory, backup);
          backedUp = true;
        }
        await rename3(payload, paths.dashboardInstallDirectory);
        if (backedUp) await rm7(backup, { recursive: true, force: true });
      } catch (error) {
        if (backedUp) await rename3(backup, paths.dashboardInstallDirectory).catch(() => void 0);
        throw error;
      }
      return { action: current.status === "not-installed" ? "installed" : "updated", installation, executable: safeExecutable(paths.dashboardInstallDirectory, installation.executable) };
    } finally {
      await lock.release();
    }
  } finally {
    await rm7(staging, { recursive: true, force: true });
  }
}
async function uninstallDashboard(options = {}, paths = createAgentForumPaths()) {
  const lock = await acquireForumLock({ lockPath: resolve16(paths.locksDirectory, "dashboard-install.lock"), command: "dashboard uninstall" });
  try {
    const status = await getDashboardInstallationStatus(paths);
    if (status.status === "not-installed") return { action: "not-installed" };
    if ((status.status === "modified" || status.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat uninstall with --force");
    await rm7(paths.dashboardInstallDirectory, { recursive: true, force: true });
    return { action: "uninstalled" };
  } finally {
    await lock.release();
  }
}

// src/services/dashboard-ensure.ts
init_paths();

// src/services/dashboard-policy.ts
init_atomic();
init_lock();
init_paths();
init_errors2();
import { readFile as readFile15 } from "node:fs/promises";
import { resolve as resolve17 } from "node:path";
var policyValues = /* @__PURE__ */ new Set(["managed", "ask", "manual"]);
function defaultState() {
  return { formatVersion: 1, policy: "ask", updatedAt: "1970-01-01T00:00:00.000Z" };
}
function parseState(value) {
  if (!value || typeof value !== "object") throw new ServiceError("DASHBOARD_POLICY_INVALID", "Dashboard acquisition policy must be an object");
  const state2 = value;
  if (Object.keys(state2).length !== 3 || state2.formatVersion !== 1 || typeof state2.policy !== "string" || !policyValues.has(state2.policy) || typeof state2.updatedAt !== "string" || Number.isNaN(Date.parse(state2.updatedAt))) {
    throw new ServiceError("DASHBOARD_POLICY_INVALID", "Dashboard acquisition policy is invalid");
  }
  return state2;
}
async function getDashboardAcquisitionPolicy(paths = createAgentForumPaths()) {
  try {
    return parseState(JSON.parse(await readFile15(paths.dashboardPolicyFile, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return defaultState();
    throw error;
  }
}
async function setDashboardAcquisitionPolicy(policy, paths = createAgentForumPaths(), now = /* @__PURE__ */ new Date()) {
  if (!policyValues.has(policy)) throw new ServiceError("DASHBOARD_POLICY_INVALID", `unknown Dashboard acquisition policy: ${policy}`);
  const lock = await acquireForumLock({
    lockPath: resolve17(paths.locksDirectory, "dashboard-policy.lock"),
    command: "dashboard policy set"
  });
  try {
    const state2 = { formatVersion: 1, policy, updatedAt: now.toISOString() };
    await writeJsonAtomic(paths.dashboardPolicyFile, state2, { overwrite: true, mode: 384 });
    return state2;
  } finally {
    await lock.release();
  }
}

// src/services/dashboard-ensure.ts
function requiredAction(installation, update) {
  if (installation.status === "not-installed") return "install";
  if (installation.status === "installed") return update ? "update" : "none";
  return "repair";
}
function acquisitionHint(options) {
  return {
    version: DASHBOARD_VERSION,
    platform: options.platform ?? process.platform,
    arch: options.arch ?? process.arch,
    browserUrl: dashboardReleasePageUrl()
  };
}
async function ensureDashboard(options = {}, paths = createAgentForumPaths()) {
  const [policyState, installation] = await Promise.all([
    getDashboardAcquisitionPolicy(paths),
    getDashboardInstallationStatus(paths)
  ]);
  const action = requiredAction(installation, options.update === true);
  if (action === "none") return { status: "ready", action, policy: policyState.policy, installation };
  const acquisition = acquisitionHint(options);
  if (policyState.policy === "manual" && !options.archivePath) {
    return { status: "manual-required", action: "import-local", policy: policyState.policy, installation, acquisition };
  }
  if (policyState.policy === "ask" && !options.approveOnce && !options.archivePath) {
    return { status: "confirmation-required", action, policy: policyState.policy, installation, acquisition };
  }
  const result = await installDashboard({
    ...options,
    update: action !== "install",
    // 已按策略授权的 repair 应恢复受校验的发布物；不再把损坏安装的二次 --force 确认转嫁给用户。
    force: options.force || action === "repair"
  }, paths);
  return {
    status: "ready",
    action: result.action === "unchanged" ? "none" : action,
    policy: policyState.policy,
    installation: await getDashboardInstallationStatus(paths),
    acquisition,
    result
  };
}

// src/commands/dashboard.ts
init_errors2();

// src/services/dashboard-desktop.ts
init_paths();
import { readFile as readFile16, rm as rm8 } from "node:fs/promises";
async function readDesktop(paths) {
  try {
    const value = JSON.parse(await readFile16(paths.dashboardDesktopFile, "utf8"));
    return value.formatVersion === 1 && Number.isSafeInteger(value.pid) && value.pid > 0 && Number.isSafeInteger(value.port) && value.port > 0 && value.port <= 65535 && typeof value.token === "string" && /^[a-f0-9-]{36}$/u.test(value.token) ? value : void 0;
  } catch {
    return void 0;
  }
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && typeof error === "object" && "code" in error && error.code === "ESRCH" ? false : true;
  }
}
async function requestDesktop(pathname, body, paths, cleanupStale = true) {
  const runtime = await readDesktop(paths);
  if (!runtime) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}${pathname}`, {
      method: "POST",
      headers: { authorization: `Bearer ${runtime.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2e3)
    });
    if (response.ok) return true;
  } catch {
  }
  if (cleanupStale && !isProcessAlive(runtime.pid)) await rm8(paths.dashboardDesktopFile, { force: true });
  return false;
}
async function attachExistingDashboardDesktop(input, paths = createAgentForumPaths()) {
  return requestDesktop("/attach", input, paths);
}
async function waitForExistingDashboardDesktop(input, paths = createAgentForumPaths(), timeoutMs = 15e3) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await requestDesktop("/attach", input, paths, false)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}
async function detachExistingDashboardDesktop(clientId, paths = createAgentForumPaths()) {
  return requestDesktop("/detach", { clientId }, paths);
}
async function closeExistingDashboardDesktop(paths = createAgentForumPaths()) {
  const requested = await requestDesktop("/close", {}, paths);
  if (!requested) return false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!await readDesktop(paths)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}

// src/commands/dashboard.ts
function dashboardUpdateAvailable(installedVersion, dashboardVersion = DASHBOARD_VERSION) {
  return dashboardVersion !== "0.0.0-dev" && installedVersion !== dashboardVersion;
}
async function executeDashboardCommand(args2, options = {}) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") return { exitCode: ExitCode.Success, command: "dashboard.help", data: { usage: "agent-forum dashboard <ensure|policy|install|update|install-local|uninstall|open|attach|heartbeat|detach|status|lease-status|snapshot|polling|pin>" }, human: "Dashboard\n\nUsage:\n  agent-forum dashboard ensure [--update] [--approve-once] [--force]\n  agent-forum dashboard policy [--mode <managed|ask|manual>]\n  agent-forum dashboard install [--manifest-url <url>] [--yes]\n  agent-forum dashboard update [--manifest-url <url>] [--yes] [--force]\n  agent-forum dashboard install-local --archive <file> --manifest <file> [--yes] [--force]\n  agent-forum dashboard uninstall [--force]\n  agent-forum dashboard open --client-id <id> --client-type <pi|opencode|codex|claude-code> [--cwd <path>] [--forum <alias> --room <room>] [--identity <member-id>]\n  agent-forum dashboard attach --client-id <id> --client-type <pi|opencode|codex|claude-code> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard heartbeat --client-id <id> --client-type <type> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard detach --client-id <id>\n  agent-forum dashboard status|snapshot\n  agent-forum dashboard polling --forum-id <forum-id> --enabled <true|false>\n  agent-forum dashboard pin --room-id <room-id> --enabled <true|false>\n" };
  try {
    if (subcommand === "lease-status") {
      if (args2.length !== 1) return invalidArgument("dashboard lease-status accepts no options");
      const result = await dashboardStatus();
      return { exitCode: ExitCode.Success, command: "dashboard.lease-status", data: result, human: `${result.clients.length} active Dashboard client(s).
` };
    }
    if (subcommand === "status") {
      if (args2.length !== 1) return invalidArgument("dashboard status accepts no options");
      const [result, installation, policy] = await Promise.all([dashboardStatus(), getDashboardInstallationStatus(), getDashboardAcquisitionPolicy()]);
      return { exitCode: ExitCode.Success, command: "dashboard.status", data: { ...result, installation, policy }, human: `Desktop: ${installation.status}; acquisition policy: ${policy.policy}; ${result.clients.length} active Dashboard client(s).
` };
    }
    if (subcommand === "policy") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--mode"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.values.size === 0) {
        const result2 = await getDashboardAcquisitionPolicy();
        return { exitCode: ExitCode.Success, command: "dashboard.policy", data: result2, human: `Dashboard acquisition policy: ${result2.policy}.
` };
      }
      const mode = parsed.values.get("--mode");
      if (mode !== "managed" && mode !== "ask" && mode !== "manual") return invalidArgument("--mode must be managed, ask, or manual");
      const result = await setDashboardAcquisitionPolicy(mode);
      return { exitCode: ExitCode.Success, command: "dashboard.policy", data: result, human: `Dashboard acquisition policy set to ${result.policy}.
` };
    }
    if (subcommand === "ensure" || subcommand === "install" || subcommand === "update" || subcommand === "install-local") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--manifest-url", "--manifest", "--archive"], flags: ["--yes", "--force", "--update", "--approve-once"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const manifestUrl = parsed.values.get("--manifest-url");
      const manifestPath = parsed.values.get("--manifest");
      const archivePath = parsed.values.get("--archive");
      const localImport = subcommand === "install-local";
      if (localImport && (!manifestPath || !archivePath)) return invalidArgument("dashboard install-local requires --archive and --manifest");
      if (localImport && manifestUrl) return invalidArgument("dashboard install-local does not accept --manifest-url");
      if (archivePath && !manifestPath && !manifestUrl) return invalidArgument("--archive requires --manifest for offline verification or --manifest-url");
      const update = subcommand === "update" || parsed.flags.has("--update");
      if (subcommand === "update" || localImport && update) await closeExistingDashboardDesktop().catch(() => false);
      let lastPercent = -1;
      options.onProgress?.("Checking Dashboard installation\u2026\n");
      const result = await ensureDashboard({
        ...manifestUrl ? { manifestUrl } : {},
        ...manifestPath ? { manifestPath } : {},
        ...archivePath ? { archivePath } : {},
        update,
        force: parsed.flags.has("--force"),
        // install/update --yes 是兼容入口；ensure 的 --approve-once 是跨 Agent 的原子当次授权。
        approveOnce: parsed.flags.has("--approve-once") || parsed.flags.has("--yes") || localImport,
        ...options.onProgress ? {
          onStatus: (text) => options.onProgress(`${text}
`),
          onProgress: (received, total, attempt) => {
            const percent = Math.floor(received * 100 / total);
            if (percent !== lastPercent) {
              lastPercent = percent;
              options.onProgress(`Downloading Dashboard: ${percent}% (attempt ${attempt}/3)\r`);
            }
          }
        } : {}
      });
      if (result.status === "ready") options.onProgress?.("\n");
      const command = subcommand === "ensure" ? "dashboard.ensure" : `dashboard.${subcommand}`;
      const human = result.status === "ready" ? `Dashboard ${result.result?.action ?? "ready"}.
` : result.status === "manual-required" ? `Dashboard requires a local archive. Download it from ${result.acquisition?.browserUrl} and run dashboard install-local --archive <file> --manifest <file> --yes.
` : `Dashboard ${result.action} requires one-time approval. Run dashboard ensure --approve-once, or set dashboard policy --mode managed.
`;
      return { exitCode: ExitCode.Success, command, data: result, human };
    }
    if (subcommand === "uninstall") {
      const parsed = parseCommandOptions(args2.slice(1), { values: [], flags: ["--force"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      await closeExistingDashboardDesktop().catch(() => false);
      const result = await uninstallDashboard({ force: parsed.flags.has("--force") });
      return { exitCode: ExitCode.Success, command: "dashboard.uninstall", data: result, human: `Dashboard ${result.action}.
` };
    }
    if (subcommand === "snapshot") {
      if (args2.length !== 1) return invalidArgument("dashboard snapshot accepts no options");
      const result = await getDashboardSnapshot();
      return { exitCode: ExitCode.Success, command: "dashboard.snapshot", data: result, human: `${result.teams.length} active Team(s).
` };
    }
    if (subcommand === "detach") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--client-id"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id");
      if (typeof clientId !== "string") return invalidArgument(clientId.error);
      const result = await detachDashboardClient(clientId);
      await detachExistingDashboardDesktop(clientId).catch(() => false);
      return { exitCode: ExitCode.Success, command: "dashboard.detach", data: result, human: `${result.detached ? "Detached" : "Not attached"}: ${clientId}
` };
    }
    if (subcommand === "polling") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--forum-id", "--enabled"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumId = requireOption(parsed, "--forum-id");
      const enabled = requireOption(parsed, "--enabled");
      if (typeof forumId !== "string") return invalidArgument(forumId.error);
      if (typeof enabled !== "string") return invalidArgument(enabled.error);
      if (enabled !== "true" && enabled !== "false") return invalidArgument("--enabled must be true or false");
      const result = await setDashboardForumPolling(forumId, enabled === "true");
      return { exitCode: ExitCode.Success, command: "dashboard.polling", data: result, human: `Polling ${result.enabled ? "enabled" : "disabled"}: ${forumId}
` };
    }
    if (subcommand === "open") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--client-id", "--client-type", "--forum", "--room", "--identity", "--cwd"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id");
      const clientType = requireOption(parsed, "--client-type");
      if (typeof clientId !== "string" || typeof clientType !== "string") return invalidArgument("dashboard open requires --client-id and --client-type");
      const explicitForum = parsed.values.get("--forum");
      const explicitRoom = parsed.values.get("--room");
      const cwd = parsed.values.get("--cwd");
      if (Boolean(explicitForum) !== Boolean(explicitRoom)) return invalidArgument("--forum and --room must be provided together");
      const context = explicitForum && explicitRoom ? await resolveContext({ forumAlias: explicitForum, room: explicitRoom, ...cwd ? { cwd } : {} }) : await resolveContext({ ...cwd ? { cwd } : {} });
      const forum = context.forumAlias;
      const room = context.roomId;
      if (!forum || context.targetStatus !== "active") return invalidArgument("Dashboard requires an active bound Forum Room");
      const identity = parsed.values.get("--identity");
      const contextData = { forumAlias: forum, roomId: room, roomSlug: context.roomSlug };
      if (await attachExistingDashboardDesktop({ clientId, clientType, forumAlias: forum, roomId: room, ...identity ? { identityId: identity } : {} })) return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, reused: true, ...contextData }, human: "Dashboard already running; client attached.\n" };
      const installed = await getDashboardLaunchStatus();
      const updateAvailable = installed.status === "installed" && dashboardUpdateAvailable(installed.installation?.version);
      const updateHint = updateAvailable ? ` Dashboard ${DASHBOARD_VERSION} is available; run agent-forum dashboard ensure --update to follow your acquisition policy.` : "";
      const moduleDirectory = dirname4(fileURLToPath(import.meta.url));
      const hostEntrypoint = [
        resolve18(moduleDirectory, "..", "..", "dashboard", "host.mjs"),
        resolve18(moduleDirectory, "..", "..", "..", "dashboard", "host.mjs"),
        resolve18(moduleDirectory, "..", "..", "agent-forum-dashboard", "runtime", "host.mjs")
      ].find(existsSync);
      if (!hostEntrypoint) {
        throw new ServiceError(
          "DASHBOARD_HOST_UNAVAILABLE",
          "Dashboard host.mjs was not found; repair the Agent Forum skill installation (agent-forum skill update or reinstall)"
        );
      }
      const pageEntrypoint = resolve18(dirname4(hostEntrypoint), "page.mjs");
      if (!existsSync(pageEntrypoint)) {
        throw new ServiceError(
          "DASHBOARD_HOST_UNAVAILABLE",
          "Dashboard page.mjs was not found beside host.mjs; repair the Agent Forum skill installation (agent-forum skill update or reinstall)"
        );
      }
      const executableName = process.platform === "win32" ? "agent-forum-dashboard.exe" : "agent-forum-dashboard";
      const developmentExecutable = [resolve18(moduleDirectory, "..", "..", "dashboard", "tauri", "target", "release", executableName), resolve18(moduleDirectory, "..", "..", "..", "dashboard", "tauri", "target", "release", executableName)].find(existsSync);
      const developmentFallback = installed.status === "not-installed" && (VERSION === "0.0.0-dev" || process.env.AGENT_FORUM_DASHBOARD_DEV === "1") && hostEntrypoint && developmentExecutable;
      if (installed.status !== "installed" && !developmentFallback) throw new ServiceError("DASHBOARD_UNAVAILABLE", installed.status === "not-installed" ? "Dashboard is not installed; run agent-forum dashboard ensure" : "Dashboard installation is damaged; run agent-forum dashboard ensure --update");
      const desktopExecutable = installed.status === "installed" ? installed.executable : developmentExecutable;
      const dashboardRuntimeDirectory = createAgentForumPaths().dashboardDirectory;
      await mkdir4(dashboardRuntimeDirectory, { recursive: true, mode: 448 });
      const dashboardClient = { clientId, clientType, forumAlias: forum, roomId: room, ...identity ? { identityId: identity } : {} };
      const child = spawn2(process.execPath, [hostEntrypoint], { cwd: dashboardRuntimeDirectory, detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, AGENT_FORUM_CLI: process.execPath, AGENT_FORUM_CLI_SCRIPT: process.argv[1] ?? "", AGENT_FORUM_DASHBOARD_EXECUTABLE: desktopExecutable, AGENT_FORUM_DASHBOARD_CLIENT_ID: clientId, AGENT_FORUM_DASHBOARD_CLIENT_TYPE: clientType, AGENT_FORUM_DASHBOARD_FORUM: forum, AGENT_FORUM_DASHBOARD_ROOM: room, ...typeof identity === "string" ? { AGENT_FORUM_DASHBOARD_IDENTITY: identity } : {} } });
      child.unref();
      if (!await waitForExistingDashboardDesktop(dashboardClient)) {
        throw new ServiceError("DASHBOARD_HOST_UNAVAILABLE", "Dashboard host did not become ready; repair the Agent Forum skill installation or restart Dashboard");
      }
      return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, pid: child.pid, updateAvailable, ...contextData }, human: `Dashboard started.${updateHint}
` };
    }
    if (subcommand === "pin") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--room-id", "--enabled"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const roomId = requireOption(parsed, "--room-id");
      const enabled = requireOption(parsed, "--enabled");
      if (typeof roomId !== "string") return invalidArgument(roomId.error);
      if (typeof enabled !== "string") return invalidArgument(enabled.error);
      if (enabled !== "true" && enabled !== "false") return invalidArgument("--enabled must be true or false");
      const result = await setDashboardRoomPinned(roomId, enabled === "true");
      return { exitCode: ExitCode.Success, command: "dashboard.pin", data: result, human: `Pin ${result.pinned ? "enabled" : "disabled"}: ${roomId}
` };
    }
    if (subcommand === "attach" || subcommand === "heartbeat") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--client-id", "--client-type", "--forum", "--room", "--identity", "--lease-ms"], flags: ["--reset-view"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id");
      const clientType = requireOption(parsed, "--client-type");
      if (typeof clientId !== "string") return invalidArgument(clientId.error);
      if (typeof clientType !== "string") return invalidArgument(clientType.error);
      const forumAlias = parsed.values.get("--forum");
      const roomId = parsed.values.get("--room");
      if (Boolean(forumAlias) !== Boolean(roomId)) return invalidArgument("--forum and --room must be provided together");
      if (!forumAlias || !roomId) return invalidArgument("Dashboard attach currently requires explicit --forum and --room");
      const leaseText = parsed.values.get("--lease-ms");
      const leaseMs = leaseText === void 0 ? void 0 : Number(leaseText);
      if (leaseText !== void 0 && !Number.isInteger(leaseMs)) return invalidArgument("--lease-ms must be an integer");
      const identityId = parsed.values.get("--identity");
      const result = await attachDashboardClient({ clientId, clientType, forumAlias, roomId, ...identityId ? { identityId } : {}, ...leaseMs !== void 0 ? { leaseMs } : {}, resetView: parsed.flags.has("--reset-view") });
      return { exitCode: ExitCode.Success, command: `dashboard.${subcommand}`, data: result, human: `Attached Dashboard client ${result.client.clientId}.
` };
    }
    return invalidArgument(`unknown dashboard subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`dashboard.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/services/doctor.ts
init_local_config();
import { access, lstat as lstat3, readdir as readdir9 } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve as resolve20 } from "node:path";
init_runner();
init_lock();
init_paths();
init_conflicts();

// src/services/forum-remote.ts
init_local_config();
init_timestamps();
init_runner();
import { randomUUID as randomUUID4 } from "node:crypto";
import { lstat as lstat2, mkdir as mkdir5, rename as rename4, rm as rm9 } from "node:fs/promises";
import { resolve as resolve19 } from "node:path";

// src/git/remote.ts
init_errors2();
import { isAbsolute as isAbsolute3 } from "node:path";
function validateRemoteUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ServiceError("REMOTE_URL_UNSAFE", "remote URL must not be empty");
  }
  if (trimmed.startsWith("-")) {
    throw new ServiceError(
      "REMOTE_URL_UNSAFE",
      "remote URL must not begin with a command-line option prefix"
    );
  }
  if (isAbsolute3(trimmed) || trimmed.startsWith(".")) {
    return { value: trimmed, display: "<local-path>", kind: "local" };
  }
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:", "ssh:", "git:", "file:"].includes(url.protocol)) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        `unsupported remote URL protocol: ${url.protocol}`
      );
    }
    if (url.search || url.hash) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "remote URL must not contain query parameters or fragments; use credential configuration outside the URL"
      );
    }
    if (url.password) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "remote URL must not contain a password or token; use a credential helper or SSH agent"
      );
    }
    if ((url.protocol === "http:" || url.protocol === "https:") && url.username) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "HTTP(S) remote URL must not contain user information; use a credential helper"
      );
    }
    if (url.protocol === "file:") {
      return { value: trimmed, display: "<local-path>", kind: "local" };
    }
    const display = new URL(url.toString());
    display.password = "";
    return { value: trimmed, display: display.toString(), kind: "network" };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }
  const scp = /^(?:([^@\s]+)@)?([^:/\s]+):(.+)$/u.exec(trimmed);
  if (scp && !/^[a-zA-Z]:[\\/]/u.test(trimmed)) {
    return { value: trimmed, display: trimmed, kind: "network" };
  }
  if (trimmed.endsWith(".git")) {
    return { value: trimmed, display: "<local-path>", kind: "local" };
  }
  throw new ServiceError(
    "REMOTE_URL_UNSAFE",
    "remote must be a supported URL, SCP-style SSH remote, or local Git path"
  );
}
function displayRemoteUrl(value) {
  try {
    return validateRemoteUrl(value).display;
  } catch {
    return "<redacted-remote>";
  }
}

// src/services/forum-remote.ts
init_lock();
init_paths();
init_errors2();
init_room();
function remoteHasBranches(remote, paths = createAgentForumPaths()) {
  const safeRemote = validateRemoteUrl(remote);
  const result = runGit(process.cwd(), ["ls-remote", "--heads", safeRemote.value]);
  if (result.status !== 0) {
    throw new ServiceError(
      "REMOTE_DISCOVERY_FAILED",
      "could not inspect whether the remote already contains Forum data"
    );
  }
  return result.stdout.trim().length > 0;
}
async function pathExists2(path2) {
  try {
    await lstat2(path2);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
function remoteBranchFromHead(repository2) {
  const head = runGit(repository2, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD"
  ]);
  const value = head.stdout.trim();
  if (head.status === 0 && value.startsWith("origin/") && value.length > "origin/".length) {
    return value.slice("origin/".length);
  }
  const branches = runGit(repository2, ["for-each-ref", "--format=%(refname:strip=3)", "refs/remotes/origin"]);
  const candidates = branches.status === 0 ? branches.stdout.split(/\r?\n/u).map((item) => item.trim()).filter((item) => item && item !== "HEAD") : [];
  if (candidates.length === 1) return candidates[0];
  throw new ServiceError(
    "REMOTE_DEFAULT_BRANCH_NOT_FOUND",
    candidates.length > 1 ? "remote has multiple branches but no usable default branch; provide --branch" : "remote default branch could not be discovered; provide --branch"
  );
}
async function validateClonedForum(repository2, branch) {
  try {
    const protocol = await readJsonDocument(
      resolve19(repository2, ".forum", "protocol.json"),
      "protocol"
    );
    const forum = await readJsonDocument(
      resolve19(repository2, ".forum", "forum.json"),
      "forum"
    );
    if (protocol.dataBranch !== branch || protocol.forumId !== forum.forumId) {
      throw new ServiceError(
        "REMOTE_PROTOCOL_INVALID",
        "remote forum metadata does not agree on forumId and dataBranch"
      );
    }
    return { forumId: String(protocol.forumId) };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "REMOTE_PROTOCOL_INVALID",
      "remote branch does not contain a valid Agent Forum protocol",
      error instanceof Error ? error.message : String(error)
    );
  }
}
async function addRemoteForum(input, paths = createAgentForumPaths()) {
  assertLocalAlias(input.alias);
  const safeRemote = validateRemoteUrl(input.remote);
  const config = await loadLocalConfig(paths);
  if (config.forums.some((forum) => forum.alias === input.alias)) {
    throw new ServiceError(
      "FORUM_ALIAS_EXISTS",
      `forum alias is already configured: ${input.alias}`
    );
  }
  const destination = forumClonePath(paths, input.alias);
  if (await pathExists2(destination)) {
    throw new ServiceError(
      "FORUM_PATH_EXISTS",
      `managed forum path already exists: ${destination}`
    );
  }
  await mkdir5(paths.forumsDirectory, { recursive: true });
  let cloned = false;
  try {
    requireGit(paths.forumsDirectory, [
      "-c",
      "core.longpaths=true",
      "clone",
      "--no-checkout",
      "--origin",
      "origin",
      "--",
      safeRemote.value,
      destination
    ]);
    cloned = true;
    requireGit(destination, [
      "-c",
      "core.longpaths=true",
      "config",
      "core.longpaths",
      "true"
    ]);
    requireGit(destination, ["config", "core.autocrlf", "false"]);
    const branch = input.branch ?? remoteBranchFromHead(destination);
    assertGitBranchName(destination, branch);
    const remoteBranch = runGit(destination, [
      "show-ref",
      "--verify",
      `refs/remotes/origin/${branch}`
    ]);
    if (remoteBranch.status !== 0) {
      throw new ServiceError(
        "REMOTE_DEFAULT_BRANCH_NOT_FOUND",
        `remote branch does not exist: ${branch}`
      );
    }
    requireGit(destination, [
      "checkout",
      "-B",
      branch,
      `origin/${branch}`
    ]);
    requireGit(destination, [
      "branch",
      "--set-upstream-to",
      `origin/${branch}`,
      branch
    ]);
    const validated = await validateClonedForum(destination, branch);
    const registration = {
      alias: input.alias,
      forumId: validated.forumId,
      path: destination,
      dataBranch: branch,
      createdAt: currentUtcTimestamp(input.now)
    };
    await registerLocalForum(registration, paths);
    return {
      alias: input.alias,
      forumId: validated.forumId,
      path: destination,
      dataBranch: branch,
      remote: safeRemote.display
    };
  } catch (error) {
    if (cloned) await rm9(destination, { recursive: true, force: true });
    throw error;
  }
}
async function inspectForumOriginRemote(input, paths = createAgentForumPaths()) {
  const safeExpected = validateRemoteUrl(input.expectedRemote);
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const origin = runGit(registration.path, ["remote", "get-url", "origin"]);
  if (origin.status !== 0) {
    return { configured: false, matchesExpected: false, displayUrl: null };
  }
  const existing = origin.stdout.trim();
  return {
    configured: true,
    matchesExpected: existing === safeExpected.value,
    displayUrl: displayRemoteUrl(existing)
  };
}
async function publishLocalForum(input, paths = createAgentForumPaths()) {
  const safeRemote = validateRemoteUrl(input.remote);
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum publish"
  });
  try {
    await openForum(input.forumAlias, paths, { requireClean: true });
    const existing = runGit(registration.path, ["remote", "get-url", "origin"]);
    if (existing.status === 0 && existing.stdout.trim() !== safeRemote.value) {
      throw new ServiceError(
        "REMOTE_ALREADY_CONFIGURED",
        `origin is already configured as ${displayRemoteUrl(existing.stdout.trim())}`
      );
    }
    if (existing.status !== 0) {
      requireGit(registration.path, [
        "remote",
        "add",
        "origin",
        safeRemote.value
      ]);
    }
    requireGit(registration.path, [
      "push",
      "--set-upstream",
      "origin",
      registration.dataBranch
    ]);
    return {
      forumAlias: input.forumAlias,
      remote: safeRemote.display,
      branch: registration.dataBranch,
      commit: requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim()
    };
  } finally {
    await lock.release();
  }
}
function parseAheadBehind(value) {
  const parts = value.trim().split(/\s+/u).map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isSafeInteger(part))) {
    return void 0;
  }
  return { ahead: parts[0], behind: parts[1] };
}
async function getForumRemoteStatus(forumAlias, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const problems = [];
  if (!await pathExists2(registration.path)) {
    return {
      alias: registration.alias,
      forumId: registration.forumId,
      path: registration.path,
      expectedBranch: registration.dataBranch,
      currentBranch: null,
      head: null,
      dirty: null,
      protocolValid: false,
      remote: {
        configured: false,
        displayUrl: null,
        upstream: null,
        ahead: null,
        behind: null
      },
      health: "unavailable",
      problems: ["managed clone path does not exist"]
    };
  }
  const branchResult = runGit(registration.path, ["branch", "--show-current"]);
  const currentBranch = branchResult.status === 0 ? branchResult.stdout.trim() || null : null;
  if (currentBranch !== registration.dataBranch) {
    problems.push(
      `current branch is ${currentBranch ?? "detached"}, expected ${registration.dataBranch}`
    );
  }
  const headResult = runGit(registration.path, ["rev-parse", "HEAD"]);
  const head = headResult.status === 0 ? headResult.stdout.trim() : null;
  const statusResult = runGit(registration.path, ["status", "--porcelain"]);
  const dirty = statusResult.status === 0 ? statusResult.stdout.trim().length > 0 : null;
  if (dirty) problems.push("managed clone has uncommitted changes");
  let protocolValid = false;
  try {
    const protocol = await readJsonDocument(
      resolve19(registration.path, ".forum", "protocol.json"),
      "protocol"
    );
    protocolValid = protocol.forumId === registration.forumId && protocol.dataBranch === registration.dataBranch;
    if (!protocolValid) problems.push("protocol does not match local registration");
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
  const remoteResult = runGit(registration.path, ["remote", "get-url", "origin"]);
  const remoteConfigured = remoteResult.status === 0;
  const displayUrl = remoteConfigured ? displayRemoteUrl(remoteResult.stdout.trim()) : null;
  const upstreamResult = runGit(registration.path, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}"
  ]);
  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout.trim() : null;
  let ahead = null;
  let behind = null;
  if (upstream) {
    const counts = runGit(registration.path, [
      "rev-list",
      "--left-right",
      "--count",
      `HEAD...${upstream}`
    ]);
    if (counts.status === 0) {
      const parsed = parseAheadBehind(counts.stdout);
      if (parsed) {
        ahead = parsed.ahead;
        behind = parsed.behind;
      }
    }
  }
  if (!remoteConfigured) problems.push("origin is not configured");
  else if (!upstream) problems.push("current branch has no upstream");
  const health = !protocolValid ? "protocol-error" : dirty ? "dirty" : !remoteConfigured || !upstream ? "local-only" : problems.length > 0 ? "unavailable" : "ready";
  return {
    alias: registration.alias,
    forumId: registration.forumId,
    path: registration.path,
    expectedBranch: registration.dataBranch,
    currentBranch,
    head,
    dirty,
    protocolValid,
    remote: {
      configured: remoteConfigured,
      displayUrl,
      upstream,
      ahead,
      behind
    },
    health,
    problems
  };
}
async function listRemoteForums(paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const forums = await Promise.all(
    config.forums.map((forum) => getForumRemoteStatus(forum.alias, paths))
  );
  forums.sort((left, right) => left.alias.localeCompare(right.alias));
  return { forums };
}
async function removeLocalForum(input, paths = createAgentForumPaths()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum remove"
  });
  try {
    if (input.keepClone) {
      await unregisterLocalForum(input.forumAlias, paths);
      return { forumAlias: input.forumAlias, clone: "kept", path: registration.path };
    }
    const status = await getForumRemoteStatus(input.forumAlias, paths);
    if (status.dirty) assertCleanWorktree(registration.path);
    if (!status.remote.configured || !status.remote.upstream || status.remote.ahead === null || status.remote.ahead > 0) {
      throw new ServiceError(
        "LOCAL_COMMITS_NOT_PUSHED",
        "managed clone has no verified upstream or contains local-only commits; use --keep-clone"
      );
    }
    const temporary = `${registration.path}.removing-${randomUUID4()}`;
    await rename4(registration.path, temporary);
    try {
      await unregisterLocalForum(input.forumAlias, paths);
    } catch (error) {
      await rename4(temporary, registration.path);
      throw error;
    }
    try {
      await rm9(temporary, { recursive: true, force: true });
    } catch (error) {
      throw new ServiceError(
        "LOCAL_CLONE_CLEANUP_FAILED",
        "forum was unregistered but the renamed local clone could not be deleted",
        error instanceof Error ? error.message : String(error)
      );
    }
    return { forumAlias: input.forumAlias, clone: "deleted", path: registration.path };
  } finally {
    await lock.release();
  }
}

// src/services/doctor.ts
async function exists(path2) {
  try {
    await lstat3(path2);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
async function diagnoseAgentForum(input = {}, paths = createAgentForumPaths()) {
  const checks = [];
  const repaired = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    id: "node.version",
    status: nodeMajor >= 20 ? "ok" : "error",
    message: `Node.js ${process.versions.node}`
  });
  const git = runGit(process.cwd(), ["--version"]);
  checks.push({
    id: "git.version",
    status: git.status === 0 ? "ok" : "error",
    message: git.status === 0 ? git.stdout.trim() : "Git is unavailable"
  });
  let config;
  try {
    config = await loadLocalConfig(paths);
    checks.push({ id: "config", status: "ok", message: `${config.forums.length} forum(s) configured` });
  } catch (error) {
    checks.push({ id: "config", status: "error", message: error instanceof Error ? error.message : String(error) });
    return { healthy: false, checks, repaired };
  }
  try {
    const bindings = await loadContextBindingState(paths);
    checks.push({ id: "context.bindings", status: "ok", message: `${bindings.bindings.length} binding(s)` });
  } catch (error) {
    checks.push({ id: "context.bindings", status: "error", message: error instanceof Error ? error.message : String(error) });
  }
  if (await exists(paths.root)) {
    try {
      await access(paths.root, constants.R_OK | constants.W_OK);
      checks.push({ id: "storage.permissions", status: "ok", message: "Agent Forum root is readable and writable" });
    } catch {
      checks.push({ id: "storage.permissions", status: "error", message: "Agent Forum root is not readable and writable" });
    }
  } else {
    checks.push({ id: "storage.permissions", status: "warning", message: "Agent Forum root does not exist yet" });
  }
  const registrations = input.forumAlias ? config.forums.filter((forum) => forum.alias === input.forumAlias) : config.forums;
  if (input.forumAlias && registrations.length === 0) {
    checks.push({ id: "forum.selection", status: "error", message: `forum is not configured: ${input.forumAlias}` });
  }
  for (const forum of registrations) {
    const prefix = `forum.${forum.alias}`;
    try {
      const status = await getForumRemoteStatus(forum.alias, paths);
      checks.push({
        id: `${prefix}.status`,
        status: status.health === "ready" ? "ok" : status.health === "local-only" ? "warning" : "error",
        message: `forum health: ${status.health}`,
        details: status
      });
      const gitPath = runGit(forum.path, ["rev-parse", "--git-path", "rebase-merge"]);
      const applyPath = runGit(forum.path, ["rev-parse", "--git-path", "rebase-apply"]);
      const rebasePresent = gitPath.status === 0 && await exists(resolve20(forum.path, gitPath.stdout.trim())) || applyPath.status === 0 && await exists(resolve20(forum.path, applyPath.stdout.trim()));
      checks.push({
        id: `${prefix}.rebase`,
        status: rebasePresent ? "error" : "ok",
        message: rebasePresent ? "an interrupted rebase is present" : "no interrupted rebase"
      });
      try {
        const journals = await listConflicts(forum.alias, paths);
        let missingRefs = 0;
        for (const journal of journals.conflicts) {
          if (runGit(forum.path, ["rev-parse", "--verify", journal.recoveryRef]).status !== 0) missingRefs += 1;
        }
        checks.push({
          id: `${prefix}.conflicts`,
          status: missingRefs > 0 ? "error" : journals.conflicts.length > 0 ? "warning" : "ok",
          message: `${journals.conflicts.length} conflict journal(s), ${missingRefs} missing recovery ref(s)`
        });
      } catch (error) {
        checks.push({ id: `${prefix}.conflicts`, status: "error", message: error instanceof Error ? error.message : String(error) });
      }
      if (input.network && status.remote.configured) {
        const remote = runGit(forum.path, ["ls-remote", "--exit-code", "origin", forum.dataBranch]);
        checks.push({
          id: `${prefix}.network`,
          status: remote.status === 0 ? "ok" : "error",
          message: remote.status === 0 ? "remote branch is reachable" : "remote branch is not reachable"
        });
      }
    } catch (error) {
      checks.push({ id: `${prefix}.status`, status: "error", message: error instanceof Error ? error.message : String(error) });
    }
    const lockPath = forumLockPath(paths, forum.forumId);
    if (await exists(lockPath)) {
      if (input.repairStaleLocks) {
        try {
          if (await clearStaleForumLock({ lockPath })) {
            repaired.push(lockPath);
            checks.push({ id: `${prefix}.lock`, status: "ok", message: "stale lock was removed" });
          }
        } catch (error) {
          checks.push({ id: `${prefix}.lock`, status: "warning", message: error instanceof Error ? error.message : String(error) });
        }
      } else {
        checks.push({ id: `${prefix}.lock`, status: "warning", message: "forum lock exists; use --repair-stale-locks only after review" });
      }
    } else {
      checks.push({ id: `${prefix}.lock`, status: "ok", message: "no forum lock" });
    }
    try {
      const cached = await getForumSnapshot(forum.alias, paths);
      const damageWarnings = cached.snapshot.warnings.filter(
        (warning) => warning.code === "INVALID_MESSAGE_PATH" || warning.code === "INVALID_MESSAGE_BODY" || warning.code === "PROTOCOL_DATA_DAMAGED"
      );
      const uniquePaths = [...new Set(damageWarnings.map((warning) => warning.path))];
      checks.push({
        id: `${prefix}.data`,
        status: uniquePaths.length > 0 ? "warning" : "ok",
        message: uniquePaths.length > 0 ? `${uniquePaths.length} damaged record(s) detected; they are isolated and do not block unrelated work` : "no damaged records",
        ...uniquePaths.length > 0 ? { details: uniquePaths.slice(0, 10) } : {}
      });
    } catch (error) {
      checks.push({ id: `${prefix}.data`, status: "warning", message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (await exists(paths.locksDirectory)) {
    const known = new Set(config.forums.map((forum) => `${forum.forumId}.lock`));
    const entries = await readdir9(paths.locksDirectory, { withFileTypes: true });
    const orphaned = entries.filter((entry) => entry.isDirectory() && entry.name.endsWith(".lock") && !known.has(entry.name));
    if (orphaned.length > 0) {
      checks.push({ id: "locks.orphaned", status: "warning", message: `${orphaned.length} orphaned lock(s) require review` });
    }
  }
  return {
    healthy: !checks.some((check) => check.status === "error"),
    checks,
    repaired
  };
}

// src/commands/doctor.ts
async function executeDoctorCommand(args2) {
  const parsed = parseCommandOptions(args2, {
    values: ["--forum"],
    flags: ["--network", "--repair-stale-locks"]
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  try {
    const forumAlias = parsed.values.get("--forum");
    const result = await diagnoseAgentForum({
      ...forumAlias ? { forumAlias } : {},
      network: parsed.flags.has("--network"),
      repairStaleLocks: parsed.flags.has("--repair-stale-locks")
    });
    return {
      exitCode: result.healthy ? ExitCode.Success : ExitCode.Unexpected,
      command: "doctor",
      data: result,
      human: `${result.healthy ? "healthy" : "unhealthy"}
${result.checks.map((check) => `${check.status}	${check.id}	${check.message}`).join("\n")}
`
    };
  } catch (error) {
    const handled = commandError("doctor", error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/forum.ts
init_conflicts();
init_forum_lifecycle();
init_forum_sync();

// src/services/local-forum.ts
init_local_config();
init_ids();
init_timestamps();
init_runner();
init_validator();
init_atomic();
init_errors();
init_lock();
init_paths();
init_errors2();
init_forum_sync();
import {
  mkdir as mkdir6,
  readFile as readFile17,
  rename as rename5,
  rm as rm10,
  stat as stat4
} from "node:fs/promises";
import { randomUUID as randomUUID5 } from "node:crypto";
import { resolve as resolve21 } from "node:path";
async function pathExists3(path2) {
  try {
    await stat4(path2);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
function publicProfile(identity, updatedAt) {
  return {
    schemaVersion: "1.0",
    memberId: identity.memberId,
    displayName: identity.displayName,
    role: identity.role,
    responsibility: identity.responsibility,
    status: "active",
    ...identity.client ? { client: identity.client } : {},
    createdAt: identity.createdAt,
    updatedAt
  };
}
function samePublishedIdentity(existing, identity) {
  return existing.memberId === identity.memberId && existing.displayName === identity.displayName && existing.role === identity.role && existing.responsibility === identity.responsibility && existing.status === "active" && existing.client === identity.client;
}
async function initLocalForum(input, paths = createAgentForumPaths()) {
  assertLocalAlias(input.alias);
  const dataBranch = input.dataBranch ?? "main";
  await mkdir6(paths.forumsDirectory, { recursive: true });
  assertGitBranchName(paths.forumsDirectory, dataBranch);
  const configLock = await acquireForumLock({
    lockPath: resolve21(paths.locksDirectory, "config.lock"),
    command: "forum init-local"
  });
  const destination = forumClonePath(paths, input.alias);
  const staging = resolve21(
    paths.forumsDirectory,
    `.agent-forum-tmp-${randomUUID5()}`
  );
  let destinationCreated = false;
  try {
    const config = await loadLocalConfig(paths);
    if (config.forums.some((forum) => forum.alias === input.alias)) {
      throw new ServiceError(
        "FORUM_ALIAS_EXISTS",
        `forum alias is already configured: ${input.alias}`
      );
    }
    if (await pathExists3(destination)) {
      throw new ServiceError(
        "FORUM_PATH_EXISTS",
        `forum path already exists: ${destination}`
      );
    }
    const identity = findIdentity(config, input.identityId);
    const forumId = input.forumId ?? createEntityId("forum");
    const timestamp = currentUtcTimestamp(input.now);
    requireGit(paths.forumsDirectory, [
      "-c",
      "core.longpaths=true",
      "init",
      "--initial-branch",
      dataBranch,
      staging
    ]);
    configureForumCommitIdentity(
      staging,
      identity.displayName,
      identity.memberId
    );
    await writeFileAtomic(
      resolve21(staging, ".gitattributes"),
      "*.json text eol=lf\n*.md text eol=lf\n"
    );
    await writeValidatedJsonAtomic(
      resolve21(staging, ".forum", "protocol.json"),
      "protocol",
      {
        protocolVersion: "1.0",
        stability: "draft",
        forumId,
        dataBranch,
        createdAt: timestamp
      }
    );
    await writeValidatedJsonAtomic(
      resolve21(staging, ".forum", "forum.json"),
      "forum",
      {
        schemaVersion: "1.0",
        forumId,
        initialName: input.name,
        initialDescription: input.description,
        createdBy: identity.memberId,
        createdAt: timestamp
      }
    );
    await writeValidatedJsonAtomic(
      resolve21(staging, "members", identity.memberId, "profile.json"),
      "member-profile",
      publicProfile(identity, timestamp)
    );
    const commit = commitPaths(
      staging,
      [".gitattributes", ".forum", "members"],
      `Initialize forum ${input.alias}`
    );
    await rename5(staging, destination);
    destinationCreated = true;
    await saveLocalConfig(paths, {
      ...config,
      forums: [
        ...config.forums,
        {
          alias: input.alias,
          forumId,
          path: destination,
          dataBranch,
          createdAt: timestamp
        }
      ]
    });
    return {
      alias: input.alias,
      forumId,
      path: destination,
      dataBranch,
      identityId: identity.memberId,
      commit
    };
  } catch (error) {
    await rm10(staging, { recursive: true, force: true });
    if (destinationCreated) {
      await rm10(destination, { recursive: true, force: true });
    }
    throw error;
  } finally {
    await configLock.release();
  }
}
async function publishIdentity(alias, identityId, paths = createAgentForumPaths(), now = /* @__PURE__ */ new Date()) {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, alias);
  const identity = findIdentity(config, identityId);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "identity publish"
  });
  const profilePath = resolve21(
    registration.path,
    "members",
    identity.memberId,
    "profile.json"
  );
  try {
    const remoteConfigured = runGit(registration.path, ["remote", "get-url", "origin"]).status === 0;
    const before = remoteConfigured ? await syncForum(alias, paths, { lockAlreadyHeld: true }) : void 0;
    const topLevel = requireGit(registration.path, [
      "rev-parse",
      "--show-toplevel"
    ]).stdout.trim();
    if (!await sameExistingPath(topLevel, registration.path)) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `configured forum path is not the Git root: ${registration.path}`
      );
    }
    assertCleanWorktree(registration.path);
    const currentBranch = requireGit(registration.path, [
      "branch",
      "--show-current"
    ]).stdout.trim();
    if (currentBranch !== registration.dataBranch) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `managed forum is on '${currentBranch}', expected '${registration.dataBranch}'`
      );
    }
    const protocol = JSON.parse(
      await readFile17(
        resolve21(registration.path, ".forum", "protocol.json"),
        "utf8"
      )
    );
    const protocolValidation = validateProtocolDocument("protocol", protocol, {
      mode: "read"
    });
    if (!protocolValidation.ok || protocol.forumId !== registration.forumId || protocol.dataBranch !== registration.dataBranch) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `forum protocol does not match local registration: ${alias}`,
        protocolValidation.ok ? void 0 : protocolValidation.issues
      );
    }
    let previous;
    let existing;
    try {
      previous = await readFile17(profilePath, "utf8");
      existing = JSON.parse(previous);
      const validation = validateProtocolDocument("member-profile", existing, {
        mode: "read"
      });
      if (!validation.ok) {
        throw new StorageError(
          "SCHEMA_VALIDATION_FAILED",
          `existing public member profile is invalid: ${profilePath}`,
          validation.issues
        );
      }
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
    if (existing && samePublishedIdentity(existing, identity)) {
      return {
        alias,
        forumId: registration.forumId,
        identityId: identity.memberId,
        path: profilePath,
        action: "unchanged",
        ...before ? { synchronization: { before } } : {}
      };
    }
    const createdAt = existing && typeof existing.createdAt === "string" ? existing.createdAt : identity.createdAt;
    const profile = {
      ...publicProfile(identity, currentUtcTimestamp(now)),
      createdAt
    };
    let committed = false;
    try {
      await writeValidatedJsonAtomic(
        profilePath,
        "member-profile",
        profile,
        { overwrite: true }
      );
      configureForumCommitIdentity(
        registration.path,
        identity.displayName,
        identity.memberId
      );
      const status = requireGit(registration.path, [
        "status",
        "--porcelain",
        "--",
        profilePath
      ]).stdout;
      if (status.trim().length === 0) {
        return {
          alias,
          forumId: registration.forumId,
          identityId: identity.memberId,
          path: profilePath,
          action: "unchanged",
          ...before ? { synchronization: { before } } : {}
        };
      }
      const commit = commitPaths(
        registration.path,
        [profilePath],
        `Publish identity ${identity.memberId}`
      );
      committed = true;
      const after = remoteConfigured ? await syncForum(alias, paths, { lockAlreadyHeld: true }) : void 0;
      return {
        alias,
        forumId: registration.forumId,
        identityId: identity.memberId,
        path: profilePath,
        action: "published",
        commit,
        ...before && after ? { synchronization: { before, after } } : {}
      };
    } catch (error) {
      if (!committed) {
        runGit(registration.path, ["reset", "--", profilePath]);
        if (previous === void 0) {
          await rm10(profilePath, { force: true });
        } else {
          await writeFileAtomic(profilePath, previous, { overwrite: true });
        }
      }
      throw error;
    }
  } finally {
    await lock.release();
  }
}

// src/commands/forum.ts
function forumHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "forum.help",
    data: {
      commands: [
        "init-local",
        "add",
        "publish",
        "list",
        "status",
        "show",
        "rename",
        "set-description",
        "archive",
        "restore",
        "sync",
        "conflict",
        "remove"
      ]
    },
    human: `Forum management

Usage:
  agent-forum forum init-local --alias <alias> --name <name> --description <text> [--branch <branch>] [--identity <member-id>]
  agent-forum forum add --alias <alias> --remote <url> [--branch <branch>]
  agent-forum forum publish --forum <alias> --remote <url>
  agent-forum forum list [--no-sync]
  agent-forum forum status --forum <alias> [--no-sync]
  agent-forum forum show --forum <alias> [--no-sync]
  agent-forum forum rename --forum <alias> --name <name> --reason <reason>
  agent-forum forum set-description --forum <alias> --description <text> --reason <reason>
  agent-forum forum archive|restore --forum <alias> --reason <reason>
  agent-forum forum sync --forum <alias>
  agent-forum forum conflict list|show|retry|prepare-reissue|close ...
  agent-forum forum remove --forum <alias> [--keep-clone]
`
  };
}
function valueOrError(parsed, name) {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}
async function executeForumCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return forumHelp();
  }
  try {
    if (subcommand === "init-local") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--alias", "--name", "--description", "--branch", "--identity"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const alias = valueOrError(parsed, "--alias");
      if (typeof alias !== "string") return alias;
      const name = valueOrError(parsed, "--name");
      if (typeof name !== "string") return name;
      const description = valueOrError(parsed, "--description");
      if (typeof description !== "string") return description;
      const identityId = parsed.values.get("--identity");
      const result = await initLocalForum({
        alias,
        name,
        description,
        dataBranch: parsed.values.get("--branch") ?? "main",
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.init-local",
        data: result,
        human: `initialized: ${result.alias}
path: ${result.path}
forum: ${result.forumId}
commit: ${result.commit}
`
      };
    }
    if (subcommand === "add") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--alias", "--remote", "--branch"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const alias = valueOrError(parsed, "--alias");
      if (typeof alias !== "string") return alias;
      const remote = valueOrError(parsed, "--remote");
      if (typeof remote !== "string") return remote;
      const branch = parsed.values.get("--branch");
      const result = await addRemoteForum({
        alias,
        remote,
        ...branch ? { branch } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.add",
        data: result,
        human: `added: ${result.alias}
forum: ${result.forumId}
branch: ${result.dataBranch}
remote: ${result.remote}
`
      };
    }
    if (subcommand === "publish") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--remote"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const remote = valueOrError(parsed, "--remote");
      if (typeof remote !== "string") return remote;
      const result = await publishLocalForum({ forumAlias, remote });
      return {
        exitCode: ExitCode.Success,
        command: "forum.publish",
        data: result,
        human: `published: ${result.forumAlias}
branch: ${result.branch}
remote: ${result.remote}
commit: ${result.commit}
`
      };
    }
    if (subcommand === "list") {
      const parsed = parseCommandOptions(args2.slice(1), { values: [], flags: ["--no-sync"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const freshness = await refreshAllForRead({ noSync: parsed.flags.has("--no-sync") });
      const result = await listRemoteForums();
      return {
        exitCode: ExitCode.Success,
        command: "forum.list",
        data: { ...result, freshness },
        human: result.forums.length === 0 ? "No Forums.\n" : `${result.forums.map(
          (forum) => `${forum.alias}	${forum.health}	${forum.expectedBranch}	${forum.remote.displayUrl ?? "no-remote"}`
        ).join("\n")}
${freshness.some((item) => item.state === "stale") ? "warning: one or more Forums are using stale local data\n" : ""}`
      };
    }
    if (subcommand === "status") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum"],
        flags: ["--no-sync"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await getForumRemoteStatus(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.status",
        data: { ...result, freshness },
        human: `forum: ${result.alias}
health: ${result.health}
branch: ${result.currentBranch ?? "detached"}
remote: ${result.remote.displayUrl ?? "not configured"}
ahead: ${result.remote.ahead ?? "unknown"}
behind: ${result.remote.behind ?? "unknown"}
`
      };
    }
    if (subcommand === "show") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--forum"], flags: ["--no-sync"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await showForum(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.show",
        data: { ...result, freshness },
        human: `${result.forum.name}
status: ${result.forum.status}
${result.forum.description}
`
      };
    }
    if (["rename", "set-description", "archive", "restore"].includes(subcommand)) {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--name", "--description", "--reason", "--identity"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const reason = valueOrError(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const name = parsed.values.get("--name");
      const description = parsed.values.get("--description");
      if (subcommand === "rename" && !name) return invalidArgument("--name is required");
      if (subcommand === "set-description" && !description) return invalidArgument("--description is required");
      const type = subcommand === "rename" ? "forum-renamed" : subcommand === "set-description" ? "forum-description-changed" : subcommand === "archive" ? "forum-archived" : "forum-restored";
      const data = name ? { name } : description ? { description } : {};
      const identityId = parsed.values.get("--identity");
      const result = await createForumEvent({
        forumAlias,
        type,
        reason,
        data,
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: `forum.${subcommand}`,
        data: result,
        human: `${type}: ${result.forum.forumId}
commit: ${result.commit}
`
      };
    }
    if (subcommand === "sync") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await syncForum(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.sync",
        data: result,
        human: `forum: ${result.forumAlias}
outcome: ${result.outcome}
head: ${result.finalHead}
fetches: ${result.fetches}
push attempts: ${result.pushAttempts}
${result.warnings.length ? `warnings: ${result.warnings.length} malformed remote record(s) were isolated
` : ""}`
      };
    }
    if (subcommand === "conflict") {
      const action = args2[1];
      if (!action || !["list", "show", "retry", "prepare-reissue", "close"].includes(action)) {
        return invalidArgument("forum conflict requires list, show, retry, prepare-reissue, or close");
      }
      const parsed = parseCommandOptions(args2.slice(2), {
        values: ["--forum", "--id"],
        flags: ["--confirm"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      if (action === "list") {
        const result2 = await listConflicts(forumAlias);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.list",
          data: result2,
          human: result2.conflicts.length === 0 ? "No conflicts.\n" : `${result2.conflicts.map((item) => `${item.operationId}	${item.status}	${item.createdAt}`).join("\n")}
`
        };
      }
      const operationId = valueOrError(parsed, "--id");
      if (typeof operationId !== "string") return operationId;
      if (action === "show") {
        const result2 = await getConflict(forumAlias, operationId);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.show",
          data: result2,
          human: `conflict: ${result2.operationId}
status: ${result2.status}
paths: ${result2.conflicts.join(", ")}
recovery: ${result2.recoveryRef}
`
        };
      }
      if (action === "retry") {
        const result2 = await syncForum(forumAlias);
        await closeConflict(forumAlias, operationId);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.retry",
          data: result2,
          human: `resolved by retry: ${operationId}
outcome: ${result2.outcome}
`
        };
      }
      if (!parsed.flags.has("--confirm")) {
        return invalidArgument(`${action} requires --confirm`);
      }
      const result = action === "prepare-reissue" ? await prepareConflictReissue(forumAlias, operationId) : await closeConflict(forumAlias, operationId);
      return {
        exitCode: ExitCode.Success,
        command: `forum.conflict.${action}`,
        data: result,
        human: `${action}: ${operationId}
`
      };
    }
    if (subcommand === "remove") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum"],
        flags: ["--keep-clone"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await removeLocalForum({
        forumAlias,
        keepClone: parsed.flags.has("--keep-clone")
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.remove",
        data: result,
        human: `removed: ${result.forumAlias}
local clone: ${result.clone}
remote: unchanged
`
      };
    }
    return invalidArgument(`unknown forum subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`forum.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/identity.ts
init_local_config();
init_forum_lifecycle();
function identityHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "identity.help",
    data: {
      commands: ["create", "show", "update", "publish", "leave", "recover", "attention"]
    },
    human: `Identity management

Usage:
  agent-forum identity create --name <name> --role <role> --responsibility <text> [--client <client>] [--no-default]
  agent-forum identity show [--id <member-id>]
  agent-forum identity update [--id <member-id>] [--name <name>] [--role <role>] [--responsibility <text>] [--client <client> | --clear-client] [--set-default]
  agent-forum identity publish --forum <alias> [--id <member-id>]
  agent-forum identity leave --forum <alias> [--id <member-id>]
  agent-forum identity recover --forum <alias> --member-id <member-id> [--set-default]
  agent-forum identity attention add --forum <alias> --subject <member-id> --mode <recovery|delegation> --reason <text> [--identity <member-id>] [--until <UTC-ms>]
  agent-forum identity attention list --forum <alias> [--identity <member-id>] [--include-expired]
  agent-forum identity attention remove --forum <alias> --subject <member-id> [--identity <member-id>]
`
  };
}
function valueOrError2(parsed, name) {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}
async function executeIdentityCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return identityHelp();
  }
  try {
    if (subcommand === "recover") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--member-id"],
        flags: ["--set-default"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forum = valueOrError2(parsed, "--forum");
      if (typeof forum !== "string") return forum;
      const memberId = valueOrError2(parsed, "--member-id");
      if (typeof memberId !== "string") return memberId;
      const result = await recoverIdentity({
        forumAlias: forum,
        memberId,
        setDefault: parsed.flags.has("--set-default")
      });
      return {
        exitCode: ExitCode.Success,
        command: "identity.recover",
        data: result,
        human: `${result.action}: ${result.identity.memberId}
forum: ${result.forumAlias}
profile status: ${result.profileStatus}
`
      };
    }
    if (subcommand === "attention") {
      const action = args2[1];
      if (!action || action === "help" || action === "--help") return identityHelp();
      if (action === "list") {
        const parsed = parseCommandOptions(args2.slice(2), {
          values: ["--forum", "--identity"],
          flags: ["--include-expired"]
        });
        if ("error" in parsed) return invalidArgument(parsed.error);
        const forum = valueOrError2(parsed, "--forum");
        if (typeof forum !== "string") return forum;
        const ownerMemberId = parsed.values.get("--identity");
        const result = await listIdentityAttention({
          forumAlias: forum,
          ...ownerMemberId ? { ownerMemberId } : {},
          includeExpired: parsed.flags.has("--include-expired")
        });
        return {
          exitCode: ExitCode.Success,
          command: "identity.attention.list",
          data: result,
          human: result.links.length === 0 ? "No identity attention links.\n" : `${result.links.map((link2) => `${link2.mode}	${link2.subjectMemberId}	${link2.active ? "active" : "expired"}`).join("\n")}
`
        };
      }
      if (action === "add") {
        const parsed = parseCommandOptions(args2.slice(2), {
          values: ["--forum", "--identity", "--subject", "--mode", "--reason", "--until"]
        });
        if ("error" in parsed) return invalidArgument(parsed.error);
        const forum = valueOrError2(parsed, "--forum");
        if (typeof forum !== "string") return forum;
        const subject = valueOrError2(parsed, "--subject");
        if (typeof subject !== "string") return subject;
        const mode = valueOrError2(parsed, "--mode");
        if (typeof mode !== "string") return mode;
        if (mode !== "recovery" && mode !== "delegation") return invalidArgument("--mode must be recovery or delegation");
        const reason = valueOrError2(parsed, "--reason");
        if (typeof reason !== "string") return reason;
        const ownerMemberId = parsed.values.get("--identity");
        const expiresAt = parsed.values.get("--until");
        const result = await addIdentityAttention({
          forumAlias: forum,
          subjectMemberId: subject,
          mode,
          reason,
          ...ownerMemberId ? { ownerMemberId } : {},
          ...expiresAt ? { expiresAt } : {}
        });
        return {
          exitCode: ExitCode.Success,
          command: "identity.attention.add",
          data: result,
          human: `${result.action}: ${result.link.mode} attention for ${result.link.subjectMemberId}
`
        };
      }
      if (action === "remove") {
        const parsed = parseCommandOptions(args2.slice(2), { values: ["--forum", "--identity", "--subject"] });
        if ("error" in parsed) return invalidArgument(parsed.error);
        const forum = valueOrError2(parsed, "--forum");
        if (typeof forum !== "string") return forum;
        const subject = valueOrError2(parsed, "--subject");
        if (typeof subject !== "string") return subject;
        const ownerMemberId = parsed.values.get("--identity");
        const result = await removeIdentityAttention({
          forumAlias: forum,
          subjectMemberId: subject,
          ...ownerMemberId ? { ownerMemberId } : {}
        });
        return {
          exitCode: ExitCode.Success,
          command: "identity.attention.remove",
          data: result,
          human: result.removed ? `removed: ${subject}
` : `not found: ${subject}
`
        };
      }
      return invalidArgument(`unknown identity attention action: ${action}`);
    }
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--name", "--role", "--responsibility", "--client"],
        flags: ["--no-default"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const displayName = valueOrError2(parsed, "--name");
      if (typeof displayName !== "string") return displayName;
      const role = valueOrError2(parsed, "--role");
      if (typeof role !== "string") return role;
      const responsibility = valueOrError2(parsed, "--responsibility");
      if (typeof responsibility !== "string") return responsibility;
      const client = parsed.values.get("--client");
      const result = await createLocalIdentity({
        displayName,
        role,
        responsibility,
        ...client ? { client } : {},
        setDefault: !parsed.flags.has("--no-default")
      });
      return {
        exitCode: ExitCode.Success,
        command: "identity.create",
        data: result,
        human: `created: ${result.identity.memberId}
default: ${result.defaultIdentityId}
`
      };
    }
    if (subcommand === "show") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--id"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const config = await loadLocalConfig();
      const identity = findIdentity(config, parsed.values.get("--id"));
      return {
        exitCode: ExitCode.Success,
        command: "identity.show",
        data: {
          identity,
          isDefault: config.defaultIdentityId === identity.memberId
        },
        human: `${identity.displayName} (${identity.memberId})
role: ${identity.role}
responsibility: ${identity.responsibility}
`
      };
    }
    if (subcommand === "update") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--id", "--name", "--role", "--responsibility", "--client"],
        flags: ["--clear-client", "--set-default"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.flags.has("--clear-client") && parsed.values.has("--client")) {
        return invalidArgument("--client and --clear-client cannot be combined");
      }
      if (!parsed.values.has("--name") && !parsed.values.has("--role") && !parsed.values.has("--responsibility") && !parsed.values.has("--client") && !parsed.flags.has("--clear-client") && !parsed.flags.has("--set-default")) return invalidArgument("identity update requires at least one change");
      const memberId = parsed.values.get("--id");
      const displayName = parsed.values.get("--name");
      const role = parsed.values.get("--role");
      const responsibility = parsed.values.get("--responsibility");
      const client = parsed.values.get("--client");
      const result = await updateLocalIdentity({
        ...memberId ? { memberId } : {},
        ...displayName ? { displayName } : {},
        ...role ? { role } : {},
        ...responsibility ? { responsibility } : {},
        ...parsed.flags.has("--clear-client") ? { client: null } : client ? { client } : {},
        setDefault: parsed.flags.has("--set-default")
      });
      return {
        exitCode: ExitCode.Success,
        command: "identity.update",
        data: result,
        human: `updated: ${result.identity.memberId}
default: ${result.defaultIdentityId}
`
      };
    }
    if (subcommand === "publish") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--id"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forum = valueOrError2(parsed, "--forum");
      if (typeof forum !== "string") return forum;
      const result = await publishIdentity(
        forum,
        parsed.values.get("--id")
      );
      return {
        exitCode: ExitCode.Success,
        command: "identity.publish",
        data: result,
        human: `${result.action}: ${result.identityId}
forum: ${result.alias}
`
      };
    }
    if (subcommand === "leave") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--id"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forum = valueOrError2(parsed, "--forum");
      if (typeof forum !== "string") return forum;
      const result = await leaveForum(forum, parsed.values.get("--id"));
      return {
        exitCode: ExitCode.Success,
        command: "identity.leave",
        data: result,
        human: `left: ${result.memberId}
forum: ${forum}
`
      };
    }
    return invalidArgument(`unknown identity subcommand: ${subcommand}`);
  } catch (error) {
    return commandError(`identity.${subcommand ?? "unknown"}`, error) ?? Promise.reject(error);
  }
}

// src/commands/inbox.ts
async function executeInboxCommand(args2) {
  const subcommand = args2[0];
  if (subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "inbox.help",
      data: { usage: "agent-forum inbox [show|mark-read] [options]" },
      human: "Inbox\n\nUsage:\n  agent-forum inbox --forum <alias> [--identity <member-id>] [--limit <1..100>] [--mark-read|--mark-all-read] [--room <slug>|--all] [--no-sync]\n  agent-forum inbox show --forum <alias> --id <message-or-event-id> [--identity <member-id>] [--no-mark-read] [--no-sync]\n  agent-forum inbox mark-read --forum <alias> --id <message-or-event-id> [--id <id> ...] [--identity <member-id>] [--no-sync]\n\n`inbox show` marks the entry read by default; pass `--no-mark-read` to inspect without marking.\n`inbox` defaults to the bound Room; pass `--room` or `--all` to choose a different scope.\n"
    };
  }
  const show = subcommand === "show";
  const markSpecific = subcommand === "mark-read";
  const parsed = parseCommandOptions(show || markSpecific ? args2.slice(1) : args2, {
    values: show ? ["--forum", "--identity", "--id"] : markSpecific ? ["--forum", "--identity"] : ["--forum", "--identity", "--limit", "--summary-chars", "--room"],
    ...markSpecific ? { repeatableValues: ["--id"] } : {},
    flags: show ? ["--no-sync", "--mark-read", "--no-mark-read"] : markSpecific ? ["--no-sync"] : ["--sync", "--no-sync", "--mark-read", "--mark-all-read", "--all", "--full"]
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (!show && !markSpecific && parsed.flags.has("--mark-read") && parsed.flags.has("--mark-all-read")) return invalidArgument("--mark-read and --mark-all-read cannot be combined");
  if (!show && !markSpecific && parsed.flags.has("--sync") && parsed.flags.has("--no-sync")) return invalidArgument("--sync and --no-sync cannot be combined");
  if (!show && !markSpecific && parsed.values.has("--room") && parsed.flags.has("--all")) return invalidArgument("--room and --all cannot be combined");
  const forumAlias = requireOption(parsed, "--forum");
  if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
  try {
    const identityId = parsed.values.get("--identity");
    if (markSpecific) {
      const ids = parsed.multiValues.get("--id") ?? [];
      if (ids.length === 0) return invalidArgument("inbox mark-read requires at least one --id");
      const result2 = await markInboxEntriesRead({ forumAlias, ids, ...identityId ? { identityId } : {}, sync: !parsed.flags.has("--no-sync") });
      const skipped = result2.results.filter((item) => item.status === "skipped").length;
      return { exitCode: ExitCode.Success, command: "inbox.mark-read", data: result2, human: `Marked ${result2.markedRead} Inbox entr${result2.markedRead === 1 ? "y" : "ies"} read${result2.alreadyRead ? `; ${result2.alreadyRead} already read` : ""}${skipped ? `; ${skipped} skipped (not in Inbox)` : ""}${result2.refreshWarning ? ` (sync failed: ${result2.refreshWarning})` : ""}.
` };
    }
    if (show) {
      const id = requireOption(parsed, "--id");
      if (typeof id !== "string") return invalidArgument(id.error);
      if (parsed.flags.has("--mark-read") && parsed.flags.has("--no-mark-read")) return invalidArgument("--mark-read and --no-mark-read cannot be combined");
      const result2 = await showInboxEntry({ forumAlias, id, ...identityId ? { identityId } : {}, sync: !parsed.flags.has("--no-sync") });
      let markedRead = 0;
      let markWarning = null;
      if (!parsed.flags.has("--no-mark-read")) {
        try {
          const marked = await markInboxEntriesRead({ forumAlias, ids: [id], ...identityId ? { identityId } : {}, sync: false });
          markedRead = marked.markedRead;
        } catch (error) {
          markWarning = error instanceof Error ? error.message : String(error);
        }
      }
      return { exitCode: ExitCode.Success, command: "inbox.show", data: { ...result2, markedRead, markWarning }, human: `${result2.entry.type}: ${result2.entry.id}
${result2.content.body ?? result2.content.reason ?? ""}${result2.refreshWarning ? `
(sync failed: ${result2.refreshWarning})` : ""}${parsed.flags.has("--no-mark-read") ? "" : `
marked read: ${markedRead}${markWarning ? ` (mark failed: ${markWarning})` : ""}`}
` };
    }
    const limitText = parsed.values.get("--limit");
    const summaryText = parsed.values.get("--summary-chars");
    const limit = limitText === void 0 ? void 0 : Number(limitText);
    const summaryChars = summaryText === void 0 ? void 0 : Number(summaryText);
    if (limit !== void 0 && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return invalidArgument("--limit must be an integer between 1 and 100");
    if (summaryChars !== void 0 && (!Number.isInteger(summaryChars) || summaryChars < 0 || summaryChars > 500)) return invalidArgument("--summary-chars must be an integer between 0 and 500");
    const roomIdValue = parsed.values.get("--room");
    const result = await getInbox({ forumAlias, ...identityId ? { identityId } : {}, sync: !parsed.flags.has("--no-sync"), ...limit !== void 0 ? { limit } : {}, ...summaryChars !== void 0 ? { summaryChars } : {}, markRead: parsed.flags.has("--mark-read"), markAllRead: parsed.flags.has("--mark-all-read"), ...roomIdValue !== void 0 ? { roomId: roomIdValue } : {}, all: parsed.flags.has("--all"), full: parsed.flags.has("--full") });
    return { exitCode: ExitCode.Success, command: "inbox", data: result, human: result.entries.length === 0 ? `No unread entries (scope: ${result.scope}).
marked read: ${result.markedRead}
` : `${result.entries.map((entry) => `${entry.createdAt}	${entry.relevance}	${entry.roomSlug}	${entry.type}	${entry.summary}`).join("\n")}
unread: ${result.totalUnread} (scope: ${result.scope})${result.hasMore ? " (more available)" : ""}
` };
  } catch (error) {
    const command = markSpecific ? "inbox.mark-read" : show ? "inbox.show" : "inbox";
    const handled = commandError(command, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/post.ts
init_thread();
var referenceKinds = /* @__PURE__ */ new Set([
  "repository",
  "branch",
  "commit",
  "path",
  "symbol",
  "endpoint",
  "ticket",
  "url"
]);
function postHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "post.help",
    data: {
      commands: ["create", "reply"],
      flags: ["--broadcast"],
      repeatableOptions: ["--mention", "--reference"],
      referenceFormat: "<kind>=<value>"
    },
    human: `Post messages

Usage:
  agent-forum post create --forum <alias> --room <id-or-slug> --thread <thread-id> --type <type> --body <markdown> [--broadcast] [--mention <member-id>] [--reference <kind>=<value>] [--identity <member-id>]
  agent-forum post reply --forum <alias> --room <id-or-slug> --thread <thread-id> --reply-to <message-id> --type <type> --body <markdown> [--broadcast] [--mention <member-id>] [--reference <kind>=<value>] [--identity <member-id>]

Messages without --mention are broadcast to the Room by default. Use --broadcast to state that intent explicitly.
`
  };
}
function parseReferences(values) {
  const references = [];
  for (const input of values) {
    const separator = input.indexOf("=");
    if (separator <= 0 || separator === input.length - 1) {
      return invalidArgument(
        `invalid --reference '${input}'; expected <kind>=<value>`
      );
    }
    const kind = input.slice(0, separator);
    const value = input.slice(separator + 1);
    if (!referenceKinds.has(kind)) {
      return invalidArgument(`unsupported reference kind: ${kind}`);
    }
    references.push({ kind, value });
  }
  return references;
}
async function executePostCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return postHelp();
  }
  if (subcommand !== "create" && subcommand !== "reply") {
    return invalidArgument(`unknown post subcommand: ${subcommand}`);
  }
  try {
    const parsed = parseCommandOptions(args2.slice(1), {
      values: [
        "--forum",
        "--room",
        "--thread",
        "--type",
        "--body",
        "--identity",
        ...subcommand === "reply" ? ["--reply-to"] : []
      ],
      repeatableValues: ["--mention", "--reference"],
      flags: ["--broadcast"]
    });
    if ("error" in parsed) return invalidArgument(parsed.error);
    const requiredValues = [
      "--forum",
      "--room",
      "--thread",
      "--type",
      "--body",
      ...subcommand === "reply" ? ["--reply-to"] : []
    ];
    const values = /* @__PURE__ */ new Map();
    for (const name of requiredValues) {
      const value = requireOption(parsed, name);
      if (typeof value !== "string") return invalidArgument(value.error);
      values.set(name, value);
    }
    const mentions = parsed.multiValues.get("--mention") ?? [];
    if (new Set(mentions).size !== mentions.length) {
      return invalidArgument("duplicate --mention values are not allowed");
    }
    const references = parseReferences(
      parsed.multiValues.get("--reference") ?? []
    );
    if ("exitCode" in references) return references;
    const identityId = parsed.values.get("--identity");
    const broadcast = parsed.flags.has("--broadcast") || mentions.length === 0;
    const result = await createPost({
      forumAlias: values.get("--forum"),
      room: values.get("--room"),
      thread: values.get("--thread"),
      type: values.get("--type"),
      body: values.get("--body"),
      mentions,
      references,
      ...subcommand === "reply" ? { replyTo: values.get("--reply-to") } : {},
      ...identityId ? { identityId } : {},
      ...broadcast ? { broadcast: true } : {}
    });
    return {
      exitCode: ExitCode.Success,
      command: `post.${subcommand}`,
      data: result,
      human: `${subcommand === "reply" ? "replied" : "posted"}: ${result.message.id}
thread: ${result.thread.id}
commit: ${result.commit}
`
    };
  } catch (error) {
    const handled = commandError(`post.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/services/ui-preferences.ts
init_timestamps();
init_atomic();
init_lock();
init_paths();
init_errors2();
import { readFile as readFile18 } from "node:fs/promises";
function systemLanguage() {
  return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}
function validPreferences(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  return item.formatVersion === 1 && (item.language === "en" || item.language === "zh") && typeof item.updatedAt === "string" && !Number.isNaN(Date.parse(item.updatedAt));
}
async function getUiLanguage(paths = createAgentForumPaths()) {
  try {
    const value = JSON.parse(await readFile18(paths.uiPreferencesFile, "utf8"));
    if (!validPreferences(value)) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "UI preferences are invalid");
    return value.language;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return systemLanguage();
    throw error;
  }
}
async function setUiLanguage(language, paths = createAgentForumPaths()) {
  if (language !== "en" && language !== "zh") throw new ServiceError("PROTOCOL_DATA_DAMAGED", "UI language must be en or zh");
  const lock = await acquireForumLock({ lockPath: `${paths.uiPreferencesFile}.lock`, command: "UI language preference" });
  try {
    await writeJsonAtomic(paths.uiPreferencesFile, { formatVersion: 1, language, updatedAt: currentUtcTimestamp() }, { overwrite: true, mode: 384 });
    return { language };
  } finally {
    await lock.release();
  }
}

// src/commands/preference.ts
async function executePreferenceCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return { exitCode: ExitCode.Success, command: "preference.help", data: { usage: "agent-forum preference language [--value <en|zh>]" }, human: "Preferences\n\nUsage:\n  agent-forum preference language [--value <en|zh>]\n" };
  }
  if (subcommand !== "language") return invalidArgument(`unknown preference subcommand: ${subcommand}`);
  const parsed = parseCommandOptions(args2.slice(1), { values: ["--value"] });
  if ("error" in parsed) return invalidArgument(parsed.error);
  try {
    const value = parsed.values.get("--value");
    if (!value) {
      const language = await getUiLanguage();
      return { exitCode: ExitCode.Success, command: "preference.language", data: { language }, human: `UI language: ${language}
` };
    }
    if (value !== "en" && value !== "zh") return invalidArgument("--value must be en or zh");
    const result = await setUiLanguage(value);
    return { exitCode: ExitCode.Success, command: "preference.language", data: result, human: `UI language set to ${result.language}.
` };
  } catch (error) {
    const handled = commandError("preference.language", error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/publish.ts
init_local_config();
init_publish_policy();
init_room();
init_paths();
function publishHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "publish.help",
    data: {
      commands: ["policy"],
      modes: ["auto", "ask"]
    },
    human: `Publish policy

Usage:
  agent-forum publish policy --mode <auto|ask> --forum <alias> --room <id-or-slug>
  agent-forum publish policy [--forum <alias>] [--room <id-or-slug>]

'auto' sends autonomously (default). 'ask' requires the user to authorize each post or reply before it is written and pushed.
`
  };
}
async function executePublishCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return publishHelp();
  }
  if (subcommand !== "policy") {
    return invalidArgument(`unknown publish subcommand: ${subcommand}`);
  }
  try {
    const parsed = parseCommandOptions(args2.slice(1), {
      values: ["--mode", "--forum", "--room"]
    });
    if ("error" in parsed) return invalidArgument(parsed.error);
    const mode = parsed.values.get("--mode");
    const forumAlias = parsed.values.get("--forum");
    const room = parsed.values.get("--room");
    const paths = createAgentForumPaths();
    if (mode !== void 0) {
      if (mode !== "auto" && mode !== "ask") {
        return invalidArgument(`unsupported publish mode: ${mode}`);
      }
      if (!forumAlias || !room) {
        return invalidArgument("--mode requires --forum and --room");
      }
      const config = await loadLocalConfig(paths);
      const registration = findForum(config, forumAlias);
      const roomView = await showRoom(forumAlias, room, paths);
      const result = await setRoomPublishMode(paths, {
        forumId: registration.forumId,
        roomId: roomView.room.id,
        mode
      });
      return {
        exitCode: ExitCode.Success,
        command: "publish.policy",
        data: {
          forumId: registration.forumId,
          roomId: roomView.room.id,
          roomSlug: roomView.room.slug,
          mode: result.entry.mode,
          updatedAt: result.entry.updatedAt
        },
        human: `${roomView.room.slug}: publishing now ${result.entry.mode === "ask" ? "requires user authorization" : "runs autonomously (no authorization needed)"}
`
      };
    }
    const state2 = await loadPublishPolicy(paths);
    let entries = state2.entries;
    if (forumAlias) {
      const config = await loadLocalConfig(paths);
      const registration = findForum(config, forumAlias);
      const slugByRoomId = /* @__PURE__ */ new Map();
      const listed = await listRooms(forumAlias, paths);
      for (const candidate of listed.rooms) {
        slugByRoomId.set(candidate.id, candidate.slug);
      }
      entries = entries.filter((entry) => entry.forumId === registration.forumId).map((entry) => ({
        ...entry,
        roomSlug: slugByRoomId.get(entry.roomId) ?? null
      }));
      if (room) {
        const roomView = await showRoom(forumAlias, room, paths);
        entries = entries.filter((entry) => entry.roomId === roomView.room.id);
      }
    }
    return {
      exitCode: ExitCode.Success,
      command: "publish.policy",
      data: { entries },
      human: entries.length === 0 ? "All rooms use autonomous publishing (auto).\n" : entries.map(
        (entry) => `${entry.roomSlug ?? entry.roomId}	${entry.mode}	${entry.updatedAt}`
      ).join("\n") + "\n"
    };
  } catch (error) {
    const handled = commandError(`publish.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/room.ts
init_room();
function roomHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "room.help",
    data: {
      commands: [
        "create",
        "list",
        "show",
        "join",
        "leave",
        "rename",
        "set-description",
        "archive",
        "restore",
        "deprecate",
        "reenable"
      ]
    },
    human: `Room management

Usage:
  agent-forum room create --forum <alias> --slug <slug> --title <title> --description <text> [--allow-similar]
  agent-forum room list --forum <alias> [--no-sync]
  agent-forum room list --all [--no-sync]
  agent-forum room show --forum <alias> --room <id-or-slug> [--no-sync]
  agent-forum room join --forum <alias> --room <id-or-slug> [--role <role>] [--responsibility <text>]
  agent-forum room leave --forum <alias> --room <id-or-slug>
  agent-forum room rename --forum <alias> --room <id-or-slug> --title <title> --reason <reason>
  agent-forum room set-description --forum <alias> --room <id-or-slug> --description <text> --reason <reason>
  agent-forum room archive|restore --forum <alias> --room <id-or-slug> --reason <reason>
  agent-forum room deprecate --forum <alias> --room <id-or-slug> --reason <reason> [--replacement <id-or-slug>]
  agent-forum room reenable --forum <alias> --room <id-or-slug> --reason <reason>
`
  };
}
function valueOrError3(parsed, name) {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}
function commonRoomOptions(args2, extraValues = []) {
  const parsed = parseCommandOptions(args2, {
    values: ["--forum", "--room", "--identity", ...extraValues]
  });
  return "error" in parsed ? invalidArgument(parsed.error) : parsed;
}
async function executeRoomCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return roomHelp();
  }
  try {
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: [
          "--forum",
          "--slug",
          "--title",
          "--description",
          "--identity"
        ],
        flags: ["--allow-similar"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError3(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const slug = valueOrError3(parsed, "--slug");
      if (typeof slug !== "string") return slug;
      const title = valueOrError3(parsed, "--title");
      if (typeof title !== "string") return title;
      const description = valueOrError3(parsed, "--description");
      if (typeof description !== "string") return description;
      const identityId = parsed.values.get("--identity");
      const result = await createRoom({
        forumAlias,
        slug,
        title,
        description,
        allowSimilar: parsed.flags.has("--allow-similar"),
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.create",
        data: result,
        human: `created: ${result.room.slug}
room: ${result.room.id}
commit: ${result.commit}
`
      };
    }
    if (subcommand === "list") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum"],
        flags: ["--all", "--no-sync"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const all = parsed.flags.has("--all");
      const requestedForum = parsed.values.get("--forum");
      if (all === Boolean(requestedForum)) {
        return invalidArgument("room list requires exactly one of --forum or --all");
      }
      const noSync = parsed.flags.has("--no-sync");
      if (requestedForum) {
        const freshness2 = await refreshForRead(requestedForum, { noSync });
        const result = await listRooms(requestedForum);
        return {
          exitCode: ExitCode.Success,
          command: "room.list",
          data: { ...result, freshness: freshness2 },
          human: result.rooms.length === 0 ? "No Rooms.\n" : `${result.rooms.map((item) => `${item.slug}	${item.status}${item.deprecation ? " (deprecated)" : ""}	${item.creator?.displayName ?? item.createdBy}	${item.title}`).join("\n")}
`
        };
      }
      const freshness = await refreshAllForRead({ noSync });
      const forumStatuses = await listRemoteForums();
      const forums = [];
      for (const forum of forumStatuses.forums) {
        try {
          forums.push({ forumAlias: forum.alias, rooms: await listRooms(forum.alias) });
        } catch (error) {
          forums.push({
            forumAlias: forum.alias,
            rooms: { rooms: [], warnings: [] },
            error: {
              code: error instanceof Error && "code" in error ? String(error.code) : "ROOM_LIST_FAILED",
              message: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
      return {
        exitCode: ExitCode.Success,
        command: "room.list",
        data: { forums, freshness },
        human: forums.length === 0 ? "No Forums.\n" : `${forums.map((forum) => forum.error ? `[${forum.forumAlias}] unavailable: ${forum.error.code}` : `[${forum.forumAlias}]
${forum.rooms.rooms.length ? forum.rooms.rooms.map((item) => `  ${item.slug}	${item.status}${item.deprecation ? " (deprecated)" : ""}	${item.creator?.displayName ?? item.createdBy}	${item.title}`).join("\n") : "  No Rooms."}`).join("\n")}
`
      };
    }
    if (subcommand === "show") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--room"],
        flags: ["--no-sync"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError3(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError3(parsed, "--room");
      if (typeof room !== "string") return room;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await showRoom(forumAlias, room);
      return {
        exitCode: ExitCode.Success,
        command: "room.show",
        data: { ...result, freshness },
        human: `${result.room.title} (${result.room.slug})
status: ${result.room.status}
creator: ${result.room.creator?.displayName ?? result.room.createdBy}
${result.room.deprecation ? `deprecated by: ${result.room.deprecation.changedBy.displayName} at ${result.room.deprecation.changedAt}
reason: ${result.room.deprecation.reason}
${result.room.deprecation.replacementRoomId ? `replacement: ${result.room.deprecation.replacementRoomId}
` : ""}` : ""}${result.room.description}
`
      };
    }
    if (subcommand === "join") {
      const parsed = commonRoomOptions(args2.slice(1), [
        "--role",
        "--responsibility"
      ]);
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError3(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError3(parsed, "--room");
      if (typeof room !== "string") return room;
      const identityId = parsed.values.get("--identity");
      const role = parsed.values.get("--role");
      const responsibility = parsed.values.get("--responsibility");
      const result = await joinRoom({
        forumAlias,
        room,
        ...identityId ? { identityId } : {},
        ...role ? { role } : {},
        ...responsibility ? { responsibility } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.join",
        data: result,
        human: `${result.action}: ${result.member.roomId}
`
      };
    }
    if (subcommand === "leave") {
      const parsed = commonRoomOptions(args2.slice(1));
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError3(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError3(parsed, "--room");
      if (typeof room !== "string") return room;
      const identityId = parsed.values.get("--identity");
      const result = await leaveRoom({
        forumAlias,
        room,
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.leave",
        data: result,
        human: `${result.action}: ${result.member.roomId}
`
      };
    }
    if (subcommand === "rename" || subcommand === "set-description" || subcommand === "archive" || subcommand === "restore" || subcommand === "deprecate" || subcommand === "reenable") {
      const extra = subcommand === "rename" ? ["--title", "--reason"] : subcommand === "set-description" ? ["--description", "--reason"] : subcommand === "deprecate" ? ["--reason", "--replacement"] : ["--reason"];
      const parsed = commonRoomOptions(args2.slice(1), extra);
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError3(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError3(parsed, "--room");
      if (typeof room !== "string") return room;
      const reason = valueOrError3(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const identityId = parsed.values.get("--identity");
      const type = subcommand === "rename" ? "room-renamed" : subcommand === "set-description" ? "room-description-changed" : subcommand === "archive" ? "room-archived" : subcommand === "restore" ? "room-restored" : subcommand === "deprecate" ? "room-deprecated" : "room-reenabled";
      const replacement = parsed.values.get("--replacement");
      let replacementRoomId;
      if (replacement) {
        const replacementResult = await showRoom(forumAlias, replacement);
        if (replacementResult.room.id === room) {
          return invalidArgument("--replacement cannot be the deprecated room itself");
        }
        replacementRoomId = replacementResult.room.id;
      }
      const data = subcommand === "rename" ? { title: parsed.values.get("--title") } : subcommand === "set-description" ? { description: parsed.values.get("--description") } : replacementRoomId ? { replacementRoomId } : {};
      if (subcommand === "rename" && !data.title) {
        return invalidArgument("--title is required");
      }
      if (subcommand === "set-description" && !("description" in data && data.description)) {
        return invalidArgument("--description is required");
      }
      const result = await createRoomEvent({
        forumAlias,
        room,
        type,
        reason,
        data,
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: `room.${subcommand}`,
        data: result,
        human: `${type}: ${result.room.slug}
commit: ${result.commit}
`
      };
    }
    return invalidArgument(`unknown room subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`room.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/setup.ts
init_local_config();
init_forum_sync();
init_room();
function setupHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "setup.help",
    data: {
      commands: ["setup"]
    },
    human: `Interactive-first onboarding for a new Agent Forum workspace

Usage:
  agent-forum setup --alias <alias> --name <name> --description <text>
                    --room-slug <slug> --room-title <title> --room-description <text>
                    [--remote <url>] [--data-branch <branch>]
                    [--identity-name <name>] [--identity-role <role>] [--identity-responsibility <text>]
                    [--workspace | --bind-branch <branch>]

Steps performed idempotently:
  1. Create a default identity if none exists.
  2. Clone an existing Forum from --remote, or create a local Forum only when the remote is empty.
  3. Publish a newly created Forum to --remote if the alias has no remote configured.
  4. Create the Room if its slug does not exist.
  5. Publish the identity as an active Forum member.
  6. Join the Room with the published identity.
  7. Bind the current Git workspace/branch to the Room.

Use --data-branch to select the Forum collaboration data branch. Use --workspace to bind the default context for the whole workspace, or --bind-branch to bind one specific business-workspace branch.
`
  };
}
function valueOrError4(parsed, name) {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}
async function executeSetupCommand(args2) {
  const firstArgument = args2[0];
  if (!firstArgument || firstArgument === "help" || firstArgument === "--help") {
    return setupHelp();
  }
  const parsed = parseCommandOptions(args2, {
    values: [
      "--alias",
      "--name",
      "--description",
      "--room-slug",
      "--room-title",
      "--room-description",
      "--remote",
      "--data-branch",
      "--bind-branch",
      "--identity-name",
      "--identity-role",
      "--identity-responsibility",
      "--cwd"
    ],
    flags: ["--workspace"]
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (parsed.flags.has("--workspace") && parsed.values.has("--bind-branch")) {
    return invalidArgument("--workspace and --bind-branch cannot be combined");
  }
  const alias = valueOrError4(parsed, "--alias");
  if (typeof alias !== "string") return alias;
  const name = valueOrError4(parsed, "--name");
  if (typeof name !== "string") return name;
  const description = valueOrError4(parsed, "--description");
  if (typeof description !== "string") return description;
  const roomSlug = valueOrError4(parsed, "--room-slug");
  if (typeof roomSlug !== "string") return roomSlug;
  const roomTitle = valueOrError4(parsed, "--room-title");
  if (typeof roomTitle !== "string") return roomTitle;
  const roomDescription = valueOrError4(parsed, "--room-description");
  if (typeof roomDescription !== "string") return roomDescription;
  const remote = parsed.values.get("--remote");
  const dataBranch = parsed.values.get("--data-branch");
  const bindBranch = parsed.values.get("--bind-branch");
  const cwd = parsed.values.get("--cwd");
  const identityName = parsed.values.get("--identity-name") ?? "Collaborator";
  const identityRole = parsed.values.get("--identity-role") ?? "developer";
  const identityResponsibility = parsed.values.get("--identity-responsibility") ?? "Works on features and coordinates with other agents.";
  const workspace = parsed.flags.has("--workspace");
  const log = [];
  const data = {};
  try {
    const config = await loadLocalConfig();
    let identityId;
    if (!config.defaultIdentityId || config.identities.length === 0) {
      const created = await createLocalIdentity({
        displayName: identityName,
        role: identityRole,
        responsibility: identityResponsibility,
        setDefault: true
      });
      identityId = created.identity.memberId;
      log.push(`created identity: ${identityId}`);
      data.identityCreated = {
        memberId: identityId,
        displayName: identityName,
        role: identityRole
      };
    } else {
      const identity = findIdentity(config);
      identityId = identity.memberId;
      log.push(`using identity: ${identityId}`);
      data.identityUsed = { memberId: identityId };
    }
    const existingForum = config.forums.find((f) => f.alias === alias);
    let forumId;
    if (!existingForum) {
      if (remote && remoteHasBranches(remote)) {
        const added = await addRemoteForum({
          alias,
          remote,
          ...dataBranch ? { branch: dataBranch } : {}
        });
        forumId = added.forumId;
        log.push(`cloned existing forum: ${forumId}`);
        data.forumAdded = { forumId, path: added.path, branch: added.dataBranch };
      } else {
        const initResult = await initLocalForum({
          alias,
          name,
          description,
          dataBranch: dataBranch ?? "main",
          identityId
        });
        forumId = initResult.forumId;
        log.push(`created forum: ${forumId}`);
        data.forumCreated = { forumId, path: initResult.path };
      }
    } else {
      forumId = existingForum.forumId;
      log.push(`using forum: ${forumId}`);
      data.forumUsed = { forumId, path: existingForum.path };
    }
    if (remote) {
      const origin = await inspectForumOriginRemote({
        forumAlias: alias,
        expectedRemote: remote
      });
      if (!origin.configured) {
        const publishResult2 = await publishLocalForum({ forumAlias: alias, remote });
        log.push(`published to remote: ${publishResult2.remote}`);
        data.remotePublished = { remote: publishResult2.remote, branch: publishResult2.branch };
      } else if (origin.matchesExpected) {
        log.push(`remote already configured: ${origin.displayUrl}`);
        data.remoteUsed = { remote: origin.displayUrl };
      } else {
        await publishLocalForum({ forumAlias: alias, remote });
      }
    }
    const rooms = await Promise.resolve().then(() => (init_room(), room_exports)).then((m) => m.listRooms(alias));
    const existingRoom = rooms.rooms.find((r) => r.slug === roomSlug);
    let roomId;
    if (!existingRoom) {
      const roomResult = await createRoom({
        forumAlias: alias,
        slug: roomSlug,
        title: roomTitle,
        description: roomDescription,
        identityId
      });
      roomId = roomResult.room.id;
      log.push(`created room: ${roomId}`);
      data.roomCreated = { roomId, slug: roomSlug };
    } else {
      roomId = existingRoom.id;
      log.push(`using room: ${roomId}`);
      data.roomUsed = { roomId, slug: roomSlug };
    }
    const publishResult = await publishIdentity(alias, identityId);
    if (publishResult.action === "published") {
      log.push(`published identity in forum: ${publishResult.commit?.slice(0, 7) ?? "n/a"}`);
      data.identityPublished = { action: "published", commit: publishResult.commit };
    } else {
      log.push("identity already published in forum");
      data.identityPublished = { action: "unchanged" };
    }
    const joinResult = await joinRoom({ forumAlias: alias, room: roomId, identityId });
    log.push(`room membership: ${joinResult.action}`);
    data.roomMembership = { action: joinResult.action, memberId: joinResult.member.memberId };
    let resolved;
    try {
      resolved = await resolveContext({ ...cwd ? { cwd } : {} });
    } catch (error) {
      if (!(error instanceof ContextError) || error.code !== "CONTEXT_NOT_BOUND" && error.code !== "BINDING_TARGET_UNAVAILABLE") {
        throw error;
      }
    }
    const alreadyBound = resolved && resolved.targetStatus === "active" && resolved.forumAlias === alias && resolved.roomSlug === roomSlug;
    if (alreadyBound) {
      log.push(`context already bound: ${alias}/${roomSlug}`);
      data.contextBound = resolved;
    } else {
      const bindResult = await bindContext({
        forumAlias: alias,
        room: roomSlug,
        workspace,
        ...cwd ? { cwd } : {},
        ...bindBranch ? { branch: bindBranch } : {}
      });
      log.push(`bound context: ${bindResult.target.forumAlias}/${bindResult.target.roomSlug}`);
      data.contextBound = bindResult;
    }
    if (remote) {
      const syncResult = await syncForum(alias);
      log.push(`synchronized remote: ${syncResult.outcome}`);
      data.remoteSynced = syncResult;
    }
    return {
      exitCode: ExitCode.Success,
      command: "setup",
      data,
      human: log.join("\n") + "\nsetup complete\n"
    };
  } catch (error) {
    const result = commandError("setup", error);
    if (result) return result;
    return {
      exitCode: ExitCode.Unexpected,
      command: "setup",
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : String(error)
      },
      human: `Error [UNEXPECTED_ERROR]: ${error instanceof Error ? error.message : String(error)}
`
    };
  }
}

// src/skill/installer.ts
import { createHash as createHash2, randomUUID as randomUUID6 } from "node:crypto";
import {
  cp,
  mkdir as mkdir7,
  readFile as readFile19,
  readdir as readdir10,
  rename as rename6,
  rm as rm11,
  stat as stat5,
  writeFile as writeFile2
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname5, relative as relative3, resolve as resolve22, sep as sep3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { spawnSync as spawnSync2 } from "node:child_process";
function isSkillTarget(value) {
  return /^(?:[a-z][a-z0-9-]{0,63}|generic)$/u.test(value);
}
var SkillInstallationError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "SkillInstallationError";
  }
};
function emptyState() {
  return { formatVersion: 1, installations: [] };
}
function stateFile(homeDirectory) {
  return resolve22(homeDirectory, ".AgentForum", "state", "installations.json");
}
function namedSkillDestination(target2, skillName, homeDirectory = homedir2()) {
  if (target2 === "claude-code") {
    return resolve22(homeDirectory, ".claude", "skills", skillName);
  }
  return resolve22(homeDirectory, ".agents", "skills", skillName);
}
function skillDestination(target2, homeDirectory = homedir2()) {
  return namedSkillDestination(target2, "agent-forum", homeDirectory);
}
function viewerSkillDestination(target2, homeDirectory = homedir2()) {
  return namedSkillDestination(target2, "agent-forum-viewer", homeDirectory);
}
function dashboardSkillDestination(target2, homeDirectory = homedir2()) {
  return namedSkillDestination(target2, "agent-forum-dashboard", homeDirectory);
}
function managedSkillDestinations(target2, homeDirectory) {
  const destinations = [
    skillDestination(target2, homeDirectory),
    viewerSkillDestination(target2, homeDirectory)
  ];
  if (target2 !== "pi") destinations.push(dashboardSkillDestination(target2, homeDirectory));
  return destinations;
}
async function pathExists4(path2) {
  try {
    await stat5(path2);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
async function loadState2(homeDirectory) {
  try {
    const parsed = JSON.parse(await readFile19(stateFile(homeDirectory), "utf8"));
    if (parsed.formatVersion !== 1 || !Array.isArray(parsed.installations)) {
      throw new SkillInstallationError(
        "INVALID_INSTALLATION_STATE",
        "unsupported or invalid installation state"
      );
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyState();
    }
    throw error;
  }
}
async function saveState(homeDirectory, state2) {
  const destination = stateFile(homeDirectory);
  await mkdir7(dirname5(destination), { recursive: true });
  const temporary = `${destination}.tmp-${randomUUID6()}`;
  try {
    await writeFile2(temporary, `${JSON.stringify(state2, null, 2)}
`, {
      encoding: "utf8",
      flag: "wx"
    });
    await rename6(temporary, destination);
  } catch (error) {
    await rm11(temporary, { force: true });
    throw error;
  }
}
async function collectFiles(root, current = root, allowSymbolicLinks = false) {
  const files = {};
  const entries = await readdir10(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = resolve22(current, entry.name);
    if (entry.isSymbolicLink()) {
      if (!allowSymbolicLinks) {
        throw new SkillInstallationError(
          "INSTALLATION_CONFLICT",
          `symbolic links are not allowed in the managed skill payload: ${absolute}`
        );
      }
      const relativePath3 = relative3(root, absolute).split(sep3).join("/");
      files[relativePath3] = "SYMLINK";
      continue;
    }
    if (entry.isDirectory()) {
      Object.assign(
        files,
        await collectFiles(root, absolute, allowSymbolicLinks)
      );
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath2 = relative3(root, absolute).split(sep3).join("/");
    files[relativePath2] = createHash2("sha256").update(await readFile19(absolute)).digest("hex");
  }
  return files;
}
function sameFiles(left, right) {
  const leftEntries = Object.entries(left).sort();
  const rightEntries = Object.entries(right).sort();
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}
async function resolveSkillSource(explicit) {
  const candidates = [
    explicit,
    resolve22(dirname5(fileURLToPath2(import.meta.url)), ".."),
    resolve22(process.cwd(), "skills", "agent-forum")
  ].filter((candidate) => Boolean(candidate));
  for (const candidate of candidates) {
    if (await pathExists4(resolve22(candidate, "SKILL.md"))) return candidate;
  }
  throw new SkillInstallationError(
    "SKILL_SOURCE_NOT_FOUND",
    "could not locate skills/agent-forum/SKILL.md"
  );
}
async function replaceDirectory(source, destination) {
  await mkdir7(dirname5(destination), { recursive: true });
  const staging = `${destination}.staging-${randomUUID6()}`;
  const backup = `${destination}.backup-${randomUUID6()}`;
  let movedExisting = false;
  try {
    await cp(source, staging, { recursive: true, errorOnExist: true });
    if (await pathExists4(destination)) {
      await rename6(destination, backup);
      movedExisting = true;
    }
    await rename6(staging, destination);
    if (movedExisting) await rm11(backup, { recursive: true, force: true });
  } catch (error) {
    await rm11(staging, { recursive: true, force: true });
    if (movedExisting && !await pathExists4(destination)) {
      await rename6(backup, destination);
    }
    throw error;
  }
}
async function installSkill(options) {
  const homeDirectory = options.homeDirectory ?? homedir2();
  const coreSource = await resolveSkillSource(options.sourceDirectory);
  const viewerSource = resolve22(dirname5(coreSource), "agent-forum-viewer");
  if (!await pathExists4(resolve22(viewerSource, "SKILL.md"))) {
    throw new SkillInstallationError("SKILL_SOURCE_NOT_FOUND", "could not locate skills/agent-forum-viewer/SKILL.md");
  }
  const payloads = [
    { source: coreSource, destination: skillDestination(options.target, homeDirectory) },
    { source: viewerSource, destination: viewerSkillDestination(options.target, homeDirectory) }
  ];
  if (options.target !== "pi") {
    const dashboardSource = resolve22(dirname5(coreSource), "agent-forum-dashboard");
    if (!await pathExists4(resolve22(dashboardSource, "SKILL.md"))) {
      throw new SkillInstallationError("SKILL_SOURCE_NOT_FOUND", "could not locate skills/agent-forum-dashboard/SKILL.md");
    }
    payloads.push({ source: dashboardSource, destination: dashboardSkillDestination(options.target, homeDirectory) });
  }
  const state2 = await loadState2(homeDirectory);
  const inspected = await Promise.all(payloads.map(async (payload) => {
    const files2 = await collectFiles(payload.source);
    const exists2 = await pathExists4(payload.destination);
    const current = exists2 ? await collectFiles(payload.destination, payload.destination, true) : void 0;
    const record = state2.installations.find((candidate) => candidate.path === payload.destination);
    return {
      ...payload,
      files: files2,
      exists: exists2,
      unchanged: current ? sameFiles(files2, current) : false,
      managedUnmodified: Boolean(record && current && sameFiles(current, record.files))
    };
  }));
  const conflict = inspected.find(
    (item) => item.exists && !item.unchanged && !item.managedUnmodified
  );
  if (conflict && !options.force) {
    throw new SkillInstallationError("INSTALLATION_CONFLICT", `destination exists with unrecognized or modified files: ${conflict.destination}`);
  }
  const destinations = inspected.map((item) => item.destination);
  const files = inspected.reduce((total, item) => total + Object.keys(item.files).length, 0);
  const hasManagedUpdate = inspected.some(
    (item) => item.exists && !item.unchanged && item.managedUnmodified
  );
  if (options.dryRun) {
    const changed = inspected.some((item) => !item.unchanged);
    const action2 = !changed ? "unchanged" : conflict ? "would-replace" : hasManagedUpdate ? "would-update" : "would-install";
    return { action: action2, target: options.target, destination: destinations[0], destinations, version: VERSION, files, requiresReload: true };
  }
  for (const item of inspected) if (!item.unchanged) await replaceDirectory(item.source, item.destination);
  const now = options.now ?? (/* @__PURE__ */ new Date()).toISOString();
  let installations = [...state2.installations];
  for (const item of inspected) {
    const existing = installations.find((record2) => record2.path === item.destination);
    const record = {
      path: item.destination,
      targets: [.../* @__PURE__ */ new Set([...existing?.targets ?? [], options.target])].sort(),
      version: VERSION,
      files: item.files,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now
    };
    installations = existing ? installations.map((candidate) => candidate.path === item.destination ? record : candidate) : [...installations, record];
  }
  await saveState(homeDirectory, { formatVersion: 1, installations });
  const action = inspected.every((item) => item.unchanged) ? "unchanged" : hasManagedUpdate ? "updated" : "installed";
  return { action, target: options.target, destination: destinations[0], destinations, version: VERSION, files, requiresReload: true };
}
async function getSkillStatus(target2, homeDirectory = homedir2()) {
  const destination = skillDestination(target2, homeDirectory);
  const destinations = managedSkillDestinations(target2, homeDirectory);
  const state2 = await loadState2(homeDirectory);
  const records = destinations.map((path2) => state2.installations.find(
    (installation) => installation.path === path2 && installation.targets.includes(target2)
  ));
  const exists2 = await Promise.all(destinations.map((path2) => pathExists4(path2)));
  if (exists2.every((value) => !value)) return { target: target2, destination, destinations, status: "not-installed" };
  if (records.some((record) => !record) || exists2.some((value) => !value)) return { target: target2, destination, destinations, status: "unmanaged" };
  let modified = false;
  let files = 0;
  for (let index = 0; index < destinations.length; index += 1) {
    const record = records[index];
    const current = await collectFiles(destinations[index], destinations[index], true);
    if (!sameFiles(current, record.files)) modified = true;
    files += Object.keys(record.files).length;
  }
  return { target: target2, destination, destinations, status: modified ? "modified" : "installed", version: records[0].version, files };
}
async function uninstallSkill(options) {
  const homeDirectory = options.homeDirectory ?? homedir2();
  const destination = skillDestination(options.target, homeDirectory);
  const destinations = managedSkillDestinations(options.target, homeDirectory);
  const state2 = await loadState2(homeDirectory);
  const records = state2.installations.filter((installation) => destinations.includes(installation.path) && installation.targets.includes(options.target));
  if (records.length === 0) return { action: "not-installed", target: options.target, destination, destinations, removedFiles: false };
  for (const record of records) {
    const remaining = record.targets.filter((target2) => target2 !== options.target);
    if (remaining.length === 0 && await pathExists4(record.path)) {
      const current = await collectFiles(record.path, record.path, true);
      if (!sameFiles(current, record.files) && !options.force) throw new SkillInstallationError("INSTALLATION_MODIFIED", `installed skill contains modified or additional files: ${record.path}`);
    }
  }
  const removesFiles = records.some((record) => record.targets.length === 1);
  if (options.dryRun) return { action: "would-uninstall", target: options.target, destination, destinations, removedFiles: removesFiles };
  let installations = [...state2.installations];
  for (const record of records) {
    const remaining = record.targets.filter((target2) => target2 !== options.target);
    if (remaining.length === 0) {
      await rm11(record.path, { recursive: true, force: true });
      installations = installations.filter((candidate) => candidate.path !== record.path);
    } else {
      installations = installations.map((candidate) => candidate.path === record.path ? { ...candidate, targets: remaining } : candidate);
    }
  }
  await saveState(homeDirectory, { formatVersion: 1, installations });
  return { action: removesFiles ? "uninstalled" : "unregistered", target: options.target, destination, destinations, removedFiles: removesFiles };
}
async function doctorSkill(target2, homeDirectory = homedir2()) {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const git = spawnSync2("git", ["--version"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  const installation = await getSkillStatus(target2, homeDirectory);
  const node = { ok: major >= 20, version: process.versions.node, required: ">=20" };
  const gitResult = git.status === 0 ? { ok: true, version: (git.stdout ?? "").trim() } : { ok: false };
  const dashboardRuntime = resolve22(dashboardSkillDestination(target2, homeDirectory), "runtime");
  const dashboardHost = resolve22(dashboardRuntime, "host.mjs");
  const dashboardPage = resolve22(dashboardRuntime, "page.mjs");
  const dashboard = {
    ok: target2 === "pi" || await pathExists4(dashboardHost) && await pathExists4(dashboardPage),
    host: dashboardHost
  };
  const version2 = {
    ok: installation.status === "installed" && installation.version === VERSION,
    installed: installation.status === "installed" ? installation.version ?? null : null,
    current: VERSION
  };
  return {
    ok: node.ok && gitResult.ok && installation.status === "installed" && dashboard.ok && version2.ok,
    node,
    git: gitResult,
    installation,
    dashboard,
    version: version2
  };
}

// src/commands/skill.ts
function usageError(message) {
  return {
    exitCode: ExitCode.Usage,
    command: "skill",
    error: { code: "INVALID_ARGUMENT", message },
    human: `Error [INVALID_ARGUMENT]: ${message}
`
  };
}
function parseOptions(args2) {
  const parsed = {
    scope: "user",
    dryRun: false,
    force: false
  };
  for (let index = 0; index < args2.length; index += 1) {
    const argument = args2[index];
    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (argument === "--force") {
      parsed.force = true;
      continue;
    }
    if (argument === "--target") {
      const value = args2[index + 1];
      if (!value || !isSkillTarget(value)) {
        return usageError("--target must be a lowercase platform slug, for example pi or kimi-code");
      }
      parsed.target = value;
      index += 1;
      continue;
    }
    if (argument === "--scope") {
      const value = args2[index + 1];
      if (value !== "user") {
        return usageError("only --scope user is supported in the technical preview");
      }
      index += 1;
      continue;
    }
    return usageError(`unknown skill option: ${argument}`);
  }
  if (!parsed.target) return usageError("--target is required");
  return { ...parsed, target: parsed.target };
}
async function executeSkillCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "skill.help",
      data: {
        usage: "agent-forum skill <install|update|uninstall|status|doctor> --target <platform-or-standard-slug> [--scope user] [--dry-run] [--force]"
      },
      human: `Skill management

Usage:
  agent-forum skill <install|update|uninstall|status|doctor> --target <platform> [options]

Preferred targets:
  pi, opencode, codex, claude-code
Other Skill Agents:
  Any lowercase platform slug (for example kimi-code) uses the standard Agent Skills directory.

Options:
  --scope user  Install for the current user (default)
  --dry-run     Show changes without writing files
  --force       Replace or remove modified managed files
`
    };
  }
  if (!["install", "update", "uninstall", "status", "doctor"].includes(subcommand)) {
    return usageError(`unknown skill subcommand: ${subcommand}`);
  }
  const options = parseOptions(args2.slice(1));
  if ("exitCode" in options) return options;
  try {
    if (subcommand === "install" || subcommand === "update") {
      const result2 = await installSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: `skill.${subcommand}`,
        data: result2,
        human: `${result2.action}: ${result2.destination}
Reload the agent to discover the skill.
`
      };
    }
    if (subcommand === "uninstall") {
      const result2 = await uninstallSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: "skill.uninstall",
        data: result2,
        human: `${result2.action}: ${result2.destination}
`
      };
    }
    if (subcommand === "status") {
      const result2 = await getSkillStatus(options.target);
      return {
        exitCode: ExitCode.Success,
        command: "skill.status",
        data: result2,
        human: `${result2.status}: ${result2.destination}
`
      };
    }
    const result = await doctorSkill(options.target);
    return {
      exitCode: result.ok ? ExitCode.Success : ExitCode.Unexpected,
      command: "skill.doctor",
      data: result,
      human: `${result.ok ? "healthy" : "unhealthy"}: ${result.installation.destination}
`
    };
  } catch (error) {
    if (error instanceof SkillInstallationError) {
      return {
        exitCode: error.code === "INVALID_TARGET" ? ExitCode.Usage : ExitCode.Unexpected,
        command: `skill.${subcommand}`,
        error: { code: error.code, message: error.message },
        human: `Error [${error.code}]: ${error.message}
`
      };
    }
    throw error;
  }
}

// src/commands/thread.ts
init_thread();
function threadHelp() {
  return {
    exitCode: ExitCode.Success,
    command: "thread.help",
    data: {
      commands: ["create", "list", "show", "rename", "close", "reopen", "watch", "unwatch", "watch-list"],
      kinds: [
        "discussion",
        "question",
        "proposal",
        "change",
        "blocker",
        "review",
        "status",
        "test-result"
      ]
    },
    human: `Thread management

Usage:
  agent-forum thread create --forum <alias> --room <id-or-slug> --kind <kind> --title <title> --body <markdown> [--broadcast]

New Threads are broadcast to the Room by default; --broadcast is accepted to make that intent explicit.
  agent-forum thread list --forum <alias> --room <id-or-slug> [--no-sync]
  agent-forum thread show --forum <alias> --room <id-or-slug> --thread <thread-id> [--no-sync]
  agent-forum thread rename --forum <alias> --room <id-or-slug> --thread <thread-id> --title <title> --reason <reason>
  agent-forum thread close|reopen --forum <alias> --room <id-or-slug> --thread <thread-id> --reason <reason>
  agent-forum thread watch|unwatch --forum <alias> --room <id-or-slug> --thread <thread-id> [--identity <member-id>]
  agent-forum thread watch-list --forum <alias> [--identity <member-id>]
`
  };
}
function required(parsed, name) {
  const result = requireOption(parsed, name);
  return typeof result === "string" ? result : invalidArgument(result.error);
}
async function executeThreadCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return threadHelp();
  }
  try {
    if (subcommand === "watch-list") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--forum", "--identity"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const identityId = parsed.values.get("--identity");
      const result = await listWatchedThreadIds({ forumAlias, ...identityId ? { identityId } : {} });
      return { exitCode: ExitCode.Success, command: "thread.watch-list", data: result, human: result.threadIds.length ? `${result.threadIds.join("\n")}
` : "No watched threads.\n" };
    }
    if (subcommand === "watch" || subcommand === "unwatch") {
      const parsed = parseCommandOptions(args2.slice(1), { values: ["--forum", "--room", "--thread", "--identity"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const threadId = required(parsed, "--thread");
      if (typeof threadId !== "string") return threadId;
      await showThread(forumAlias, room, threadId);
      const identityId = parsed.values.get("--identity");
      const result = await setThreadWatch({ forumAlias, threadId, watch: subcommand === "watch", ...identityId ? { identityId } : {} });
      return { exitCode: ExitCode.Success, command: `thread.${subcommand}`, data: result, human: `${result.changed ? subcommand === "watch" ? "watched" : "unwatched" : "unchanged"}: ${threadId}
` };
    }
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: [
          "--forum",
          "--room",
          "--kind",
          "--title",
          "--body",
          "--identity"
        ],
        flags: ["--broadcast"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const kind = required(parsed, "--kind");
      if (typeof kind !== "string") return kind;
      const title = required(parsed, "--title");
      if (typeof title !== "string") return title;
      const body = required(parsed, "--body");
      if (typeof body !== "string") return body;
      const identityId = parsed.values.get("--identity");
      const result = await createThread({
        forumAlias,
        room,
        kind,
        title,
        body,
        ...identityId ? { identityId } : {},
        // Thread opening posts do not identify a recipient, so they are Room broadcasts by default.
        broadcast: true
      });
      return {
        exitCode: ExitCode.Success,
        command: "thread.create",
        data: result,
        human: `created: ${result.thread.title}
thread: ${result.thread.id}
commit: ${result.commit}
`
      };
    }
    if (subcommand === "list") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--room"],
        flags: ["--no-sync"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await listThreads(forumAlias, room);
      return {
        exitCode: ExitCode.Success,
        command: "thread.list",
        data: { ...result, freshness },
        human: result.threads.length === 0 ? "No threads.\n" : `${result.threads.map((thread) => `${thread.id}	${thread.status}	${thread.kind}	${thread.title}`).join("\n")}
`
      };
    }
    if (subcommand === "show") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: ["--forum", "--room", "--thread"],
        flags: ["--no-sync", "--mark-read"]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const thread = required(parsed, "--thread");
      if (typeof thread !== "string") return thread;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await showThread(forumAlias, room, thread);
      let markedRead = 0;
      if (parsed.flags.has("--mark-read")) {
        const marked = await markThreadRead({ forumAlias, room, thread });
        markedRead = marked.markedRead;
      }
      return {
        exitCode: ExitCode.Success,
        command: "thread.show",
        data: { ...result, freshness, markedRead },
        human: `${result.thread.title}
status: ${result.thread.status}
kind: ${result.thread.kind}
messages: ${result.thread.messageCount}${parsed.flags.has("--mark-read") ? `
marked read: ${markedRead}` : ""}
`
      };
    }
    if (subcommand === "rename" || subcommand === "close" || subcommand === "reopen") {
      const parsed = parseCommandOptions(args2.slice(1), {
        values: [
          "--forum",
          "--room",
          "--thread",
          "--reason",
          "--title",
          "--identity"
        ]
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const thread = required(parsed, "--thread");
      if (typeof thread !== "string") return thread;
      const reason = required(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const title = parsed.values.get("--title");
      if (subcommand === "rename" && !title) {
        return invalidArgument("--title is required");
      }
      const identityId = parsed.values.get("--identity");
      const type = subcommand === "rename" ? "thread-renamed" : subcommand === "close" ? "thread-closed" : "thread-reopened";
      const result = await createThreadEvent({
        forumAlias,
        room,
        thread,
        type,
        reason,
        data: title ? { title } : {},
        ...identityId ? { identityId } : {}
      });
      return {
        exitCode: ExitCode.Success,
        command: `thread.${subcommand}`,
        data: result,
        human: `${type}: ${result.thread.id}
commit: ${result.commit}
`
      };
    }
    return invalidArgument(`unknown thread subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`thread.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/commands/viewer.ts
init_paths();

// src/services/viewer.ts
init_atomic();
init_lock();
init_paths();
import { randomBytes as randomBytes2, randomUUID as randomUUID7 } from "node:crypto";
import { spawn as spawn3 } from "node:child_process";
import { mkdir as mkdir8, readFile as readFile20, readdir as readdir11, rm as rm12 } from "node:fs/promises";
import { dirname as dirname6, resolve as resolve23 } from "node:path";
init_local_config();
init_forum_sync();
init_errors2();

// src/viewer/server.ts
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
var viewerFavicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="b" x1="62" y1="40" x2="450" y2="472" gradientUnits="userSpaceOnUse"><stop stop-color="#151d2c"/><stop offset="1" stop-color="#080b12"/></linearGradient><linearGradient id="t" x1="118" y1="150" x2="394" y2="350" gradientUnits="userSpaceOnUse"><stop stop-color="#6b9fff"/><stop offset=".5" stop-color="#66c5e5"/><stop offset="1" stop-color="#70e1d0"/></linearGradient></defs><rect x="24" y="24" width="464" height="464" rx="112" fill="url(#b)"/><path d="M126 136v47c0 24 19 43 43 43h219M188 226v33c0 24 19 43 43 43h135M250 302v23c0 24 19 43 43 43h51" fill="none" stroke="url(#t)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`;
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function biHtml(en, zh) {
  return `<span class="lang-en">${en}</span><span class="lang-zh" style="display:none">${zh}</span>`;
}
function biText(en, zh) {
  return biHtml(escapeHtml(en), escapeHtml(zh));
}
function typeBadgeClass(type) {
  switch (type) {
    case "blocker":
    case "objection":
      return "t-danger";
    case "decision":
    case "answer":
    case "acknowledgement":
      return "t-success";
    case "proposal":
    case "review":
      return "t-violet";
    case "status":
    case "test-result":
    case "correction":
      return "t-neutral";
    default:
      return "t-default";
  }
}
function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}
function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(void 0, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function renderMarkdown(text) {
  const escaped = escapeHtml(text);
  const codeBlocks = [];
  let working = escaped.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="code-block"><code>${code.replace(/^\n/, "")}</code></pre>`);
    return `\0CODEBLOCK${idx}\0`;
  });
  const inline = (s) => s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>').replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (m, label, url) => {
      const trimmed = url.trim();
      if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
        return `<a href="${trimmed}" rel="nofollow noopener" target="_blank">${label}</a>`;
      }
      return m;
    }
  );
  const lines2 = working.split("\n");
  const out = [];
  let listType = null;
  let paragraph = [];
  const tableCells = (line) => {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return void 0;
    const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    return content.split("|").map((cell) => cell.trim());
  };
  const isTableDivider = (cells) => cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  for (let index = 0; index < lines2.length; index += 1) {
    const line = lines2[index];
    if (line.startsWith("\0CODEBLOCK")) {
      flushParagraph();
      closeList();
      out.push(line.replace(/\u0000CODEBLOCK(\d+)\u0000/, (_m, i) => codeBlocks[Number(i)] ?? ""));
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }
    const header = tableCells(line);
    const divider = index + 1 < lines2.length ? tableCells(lines2[index + 1]) : void 0;
    if (header && divider && header.length === divider.length && isTableDivider(divider)) {
      flushParagraph();
      closeList();
      const alignment = divider.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : void 0);
      const renderRow = (cells, tag) => `<tr>${cells.map((cell, column) => `<${tag}${alignment[column] ? ` style="text-align:${alignment[column]}"` : ""}>${inline(cell)}</${tag}>`).join("")}</tr>`;
      const rows = [];
      let bodyIndex = index + 2;
      while (bodyIndex < lines2.length) {
        const cells = tableCells(lines2[bodyIndex]);
        if (!cells || cells.length !== header.length) break;
        rows.push(renderRow(cells, "td"));
        bodyIndex += 1;
      }
      out.push(`<div class="md-table-wrap"><table class="md-table"><thead>${renderRow(header, "th")}</thead>${rows.length ? `<tbody>${rows.join("")}</tbody>` : ""}</table></div>`);
      index = bodyIndex - 1;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h && h[1] && h[2]) {
      flushParagraph();
      closeList();
      const level = h[1].length + 2;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith("&gt; ")) {
      flushParagraph();
      closeList();
      out.push(`<blockquote class="md-quote">${inline(line.slice(5))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return out.join("\n");
}
function buildReplyTree(timeline) {
  const messages = timeline.filter((item) => item.kind === "message");
  const byId = new Map(messages.map((message) => [message.id, message]));
  const parentById = /* @__PURE__ */ new Map();
  const issues = /* @__PURE__ */ new Map();
  for (const message of messages) {
    if (!message.replyTo) continue;
    if (!byId.has(message.replyTo)) {
      issues.set(message.id, "missing-parent");
      continue;
    }
    parentById.set(message.id, message.replyTo);
  }
  const cycleEdges = /* @__PURE__ */ new Set();
  for (const message of messages) {
    const visited = /* @__PURE__ */ new Map();
    let current = message.id;
    while (parentById.has(current)) {
      if (visited.has(current)) {
        const cycle = [...visited.keys()].slice(visited.get(current));
        for (const id of cycle) {
          cycleEdges.add(id);
          issues.set(id, "cycle");
        }
        break;
      }
      visited.set(current, visited.size);
      current = parentById.get(current);
    }
  }
  const children = new Map(messages.map((message) => [message.id, []]));
  const roots = [];
  for (const message of messages) {
    const parentId = parentById.get(message.id);
    if (parentId && !cycleEdges.has(message.id)) children.get(parentId)?.push(message.id);
    else roots.push(message.id);
  }
  return { roots, children, issues };
}
function buildReplyGraph(timeline) {
  const tree = buildReplyTree(timeline);
  const messages = timeline.filter((item) => item.kind === "message");
  const parentById = /* @__PURE__ */ new Map();
  for (const [parentId, childIds] of tree.children) {
    for (const childId of childIds) parentById.set(childId, parentId);
  }
  const lanes = /* @__PURE__ */ new Map();
  const childOrder = /* @__PURE__ */ new Map();
  let laneCount = 0;
  for (const message of messages) {
    const parentId = parentById.get(message.id);
    const parentLane = parentId === void 0 ? void 0 : lanes.get(parentId);
    if (parentId === void 0 || parentLane === void 0) {
      lanes.set(message.id, laneCount);
      laneCount += 1;
      continue;
    }
    const order = childOrder.get(parentId) ?? 0;
    childOrder.set(parentId, order + 1);
    if (order === 0) lanes.set(message.id, parentLane);
    else {
      lanes.set(message.id, laneCount);
      laneCount += 1;
    }
  }
  return { ...tree, parentById, lanes, laneCount };
}
function statusBadge(status, kind) {
  const normalized = status.toLowerCase();
  const known = normalized === "open" || normalized === "active" || normalized === "closed" || normalized === "archived";
  const css = known ? normalized : "unknown";
  const en = normalized === "open" ? "Open" : normalized === "active" ? "Active" : normalized === "closed" ? "Closed" : normalized === "archived" ? "Archived" : status;
  const zh = normalized === "open" ? "\u8FDB\u884C\u4E2D" : normalized === "active" ? "\u6D3B\u8DC3" : normalized === "closed" ? "\u5DF2\u5173\u95ED" : normalized === "archived" ? "\u5DF2\u5F52\u6863" : status;
  return `<span class="status-badge ${kind}-status status-${escapeHtml(css)}">${biText(en, zh)}</span>`;
}
function localizedLabel(value, kind) {
  const zh = kind === "role" ? { backend: "\u540E\u7AEF", frontend: "\u524D\u7AEF", fullstack: "\u5168\u6808", mobile: "\u79FB\u52A8\u7AEF", qa: "\u6D4B\u8BD5", devops: "\u8FD0\u7EF4", security: "\u5B89\u5168", designer: "\u8BBE\u8BA1", product: "\u4EA7\u54C1" } : { discussion: "\u8BA8\u8BBA", question: "\u95EE\u9898", answer: "\u7B54\u590D", proposal: "\u63D0\u6848", decision: "\u51B3\u7B56", change: "\u53D8\u66F4", blocker: "\u963B\u585E", review: "\u8BC4\u5BA1", status: "\u72B6\u6001", "test-result": "\u6D4B\u8BD5\u7ED3\u679C", acknowledgement: "\u786E\u8BA4", objection: "\u5F02\u8BAE", correction: "\u7EA0\u6B63", "thread-closed": "\u4E3B\u9898\u5DF2\u5173\u95ED", "thread-reopened": "\u4E3B\u9898\u5DF2\u91CD\u5F00", "thread-renamed": "\u4E3B\u9898\u5DF2\u91CD\u547D\u540D" };
  return biText(value, zh[value] ?? value);
}
function unreadForLocalAi(item, room, identities, trackUnread = true) {
  if (!trackUnread) return false;
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const recipients = identities.filter((identity) => identity.memberId !== actorId && room.members[identity.memberId]?.status === "active" && typeof room.members[identity.memberId]?.updatedAt === "string" && item.createdAt >= room.members[identity.memberId].updatedAt);
  return recipients.some((identity) => !identity.seenIds.includes(item.id));
}
function readBadge(item, room, identities, trackUnread = true) {
  if (identities.length === 0) return "";
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const published = identities.filter((identity) => identity.memberId === actorId);
  const recipients = identities.filter((identity) => {
    if (identity.memberId === actorId) return false;
    const membership = room.members[identity.memberId];
    return membership?.status === "active" && typeof membership.updatedAt === "string" && item.createdAt >= membership.updatedAt;
  });
  if (!trackUnread) return published.length ? `<span class="read-badge published">${biText("Published", "\u5DF2\u53D1\u5E03")}</span>` : "";
  const read = recipients.filter((identity) => identity.seenIds.includes(item.id));
  const names = (items) => items.map((identity) => identity.displayName).join(", ");
  if (identities.length === 1) {
    if (published.length) return `<span class="read-badge published">${biText("Published", "\u5DF2\u53D1\u5E03")}</span>`;
    if (recipients.length === 0) return "";
    return read.length ? `<span class="read-badge read">${biText("Read", "\u5DF2\u8BFB")}</span>` : `<span class="read-badge unread">${biText("Unread", "\u672A\u8BFB")}</span>`;
  }
  const parts = [];
  if (published.length) parts.push(biText(`Published: ${names(published)}`, `${names(published)} \u53D1\u5E03`));
  if (recipients.length) parts.push(biText(`${read.length}/${recipients.length} Read`, `${read.length}/${recipients.length} \u5DF2\u8BFB`));
  return parts.length ? `<span class="read-badge ${recipients.length > read.length ? "unread" : published.length ? "published" : "read"}">${parts.join(" \xB7 ")}</span>` : "";
}
function renderItem(item, timeline, snapshot, room, identities, index, treeIssue, trackUnread = true, graphLane) {
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const profile = snapshot.members[actorId];
  const actor = profile?.displayName ?? actorId;
  const badge = item.kind === "event" ? "t-event" : typeBadgeClass(item.type);
  const avatar = `<div class="avatar" aria-hidden="true">${escapeHtml(initials(actor))}</div>`;
  let content;
  let parent = void 0;
  if (item.kind === "message") {
    parent = item.replyTo ? timeline.find((candidate) => candidate.kind === "message" && candidate.id === item.replyTo) : void 0;
    const reply = item.replyTo ? parent && parent.kind === "message" ? `<blockquote class="reply"><div class="reply-meta">${biText("Reply to", "\u56DE\u590D")} ${escapeHtml(snapshot.members[parent.authorId]?.displayName ?? parent.authorId)}</div><div class="reply-body">${escapeHtml(parent.body.slice(0, 180))}${parent.body.length > 180 ? "\u2026" : ""}</div></blockquote>` : `<blockquote class="reply missing"><div class="reply-meta">${biText("Reply target unavailable", "\u56DE\u590D\u76EE\u6807\u4E0D\u53EF\u7528")}</div><div class="reply-body">${escapeHtml(item.replyTo)}</div></blockquote>` : "";
    const mentions = item.mentions.length ? `<div class="chips"><span class="chips-label">${biText("Mentions", "\u63D0\u53CA")}</span>${item.mentions.map((id) => `<span class="chip mention">${escapeHtml(snapshot.members[id]?.displayName ?? id)}</span>`).join("")}</div>` : "";
    const references = item.references.length ? `<div class="chips"><span class="chips-label">${biText("References", "\u5F15\u7528")}</span>${item.references.map((reference) => `<span class="chip ref">${escapeHtml(reference.kind)}=${escapeHtml(reference.value)}</span>`).join("")}</div>` : "";
    content = `${reply}<div class="body markdown">${renderMarkdown(item.body)}</div>${mentions}${references}`;
  } else {
    const data = JSON.stringify(item.data);
    content = `<div class="body">${escapeHtml(item.reason)}</div>${data === "{}" ? "" : `<div class="chips"><span class="chips-label">${biText("Data", "\u6570\u636E")}</span><span class="chip raw">${escapeHtml(data)}</span></div>`}`;
  }
  const roomRef = item.kind === "message" ? item.threadId : "event";
  const correctionEn = `Please review and correct Agent Forum item ${item.id} in room ${roomRef}. Preserve history and publish a new correction or event.`;
  const correctionZh = `\u8BF7\u5BA1\u67E5\u5E76\u7EA0\u6B63 Agent Forum \u4E2D\u7684\u6761\u76EE ${item.id}\uFF08Room: ${roomRef}\uFF09\u3002\u4FDD\u7559\u5386\u53F2\uFF0C\u53D1\u5E03\u65B0\u7684\u7EA0\u6B63\u6D88\u606F\u6216\u4E8B\u4EF6\u3002`;
  const meIds = new Set(identities.map((identity) => identity.memberId));
  const authoredByMe = item.kind === "message" && meIds.has(item.authorId);
  const repliesToMe = item.kind === "message" && Boolean(item.replyTo) && parent !== void 0 && parent.kind === "message" && meIds.has(parent.authorId) && !authoredByMe;
  const mentionsMe = item.kind === "message" && item.mentions.some((id) => meIds.has(id)) && !authoredByMe;
  const replyAttributes = item.kind === "message" ? ` data-message-id="${escapeHtml(item.id)}" data-reply-to="${escapeHtml(item.replyTo ?? "")}"${repliesToMe ? ' data-replies-to-me="true"' : ""}${mentionsMe ? ' data-mentions-me="true"' : ""}${treeIssue ? ` data-tree-issue="${treeIssue}"` : ""}${graphLane === void 0 ? "" : ` data-graph-lane="${graphLane}"`}` : "";
  const treeIssueNotice = treeIssue ? `<div class="tree-issue">${treeIssue === "cycle" ? biText("Reply cycle detected; shown as a separate branch.", "\u68C0\u6D4B\u5230\u56DE\u590D\u5FAA\u73AF\uFF1B\u5DF2\u4F5C\u4E3A\u72EC\u7ACB\u5206\u652F\u663E\u793A\u3002") : biText("Reply target unavailable; shown as a separate branch.", "\u56DE\u590D\u76EE\u6807\u4E0D\u53EF\u7528\uFF1B\u5DF2\u4F5C\u4E3A\u72EC\u7ACB\u5206\u652F\u663E\u793A\u3002")}</div>` : "";
  const unread = unreadForLocalAi(item, room, identities, trackUnread);
  return `<article class="item ${item.kind}" data-timeline-index="${index}"${unread ? ' data-ai-unread="true"' : ""} data-msg-type="${escapeHtml(item.type)}"${replyAttributes}>${avatar}<div class="item-main"><div class="item-line"></div><div class="item-content"><header><span class="actor">${escapeHtml(actor)}</span>${profile ? `<span class="role">${localizedLabel(profile.role, "role")}</span>` : ""}<span class="type ${badge}">${localizedLabel(item.type, "type")}</span>${readBadge(item, room, identities, trackUnread)}<time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatTime(item.createdAt))}</time></header>${content}${treeIssueNotice}<footer><button class="copy btn-sm" data-copy="${escapeHtml(item.id)}" data-copy-en="${escapeHtml(item.id)}" data-copy-zh="${escapeHtml(item.id)}" data-en="Copy ID" data-zh="\u590D\u5236 ID">Copy ID</button><button class="copy btn-sm" data-copy="${escapeHtml(correctionEn)}" data-copy-en="${escapeHtml(correctionEn)}" data-copy-zh="${escapeHtml(correctionZh)}" data-en="Copy correction prompt" data-zh="\u590D\u5236\u7EA0\u6B63\u63D0\u793A">Copy correction prompt</button></footer></div></div></article>`;
}
function renderThread({ thread, timeline }, snapshot, room, identities) {
  const creator = snapshot.members[thread.createdBy]?.displayName ?? thread.createdBy;
  const threadId = escapeHtml(thread.id);
  const messageCount = thread.messageCount ?? timeline.filter((i) => i.kind === "message").length;
  const title = escapeHtml(thread.title);
  const kind = thread.kind;
  const metaEn = `${kind} \xB7 ${messageCount} messages \xB7 ${escapeHtml(creator)} \xB7 ${escapeHtml(formatTime(thread.createdAt))}`;
  const metaZh = `${localizedLabel(kind, "type")} \xB7 ${messageCount} \u6761\u6D88\u606F \xB7 ${escapeHtml(creator)} \xB7 ${escapeHtml(formatTime(thread.createdAt))}`;
  const graph = buildReplyGraph(timeline);
  const trackUnread = thread.status.toLowerCase() !== "closed";
  const items = timeline.map((item, index) => renderItem(item, timeline, snapshot, room, identities, index, item.kind === "message" ? graph.issues.get(item.id) : void 0, trackUnread, item.kind === "message" ? graph.lanes.get(item.id) : void 0)).join("");
  return `<section class="thread" id="thread-${threadId}" data-title="${title.toLowerCase()}" data-thread-status="${escapeHtml(thread.status)}" data-graph-lanes="${graph.laneCount}"><div class="thread-head"><div class="thread-icon status-${escapeHtml(thread.status.toLowerCase())}"></div><div class="thread-meta"><h2>${title}${statusBadge(thread.status, "thread")}</h2><div class="meta">${biHtml(metaEn, metaZh)}</div></div><div class="thread-actions"><button class="copy btn-sm" data-copy="${threadId}" data-copy-en="${threadId}" data-copy-zh="${threadId}" data-en="Copy thread ID" data-zh="\u590D\u5236 Thread ID">Copy thread ID</button></div></div><div class="thread-body">${items}</div></section>`;
}
function renderViewerHtml(snapshot, room, freshness = { state: "fresh" }, readIdentities = [], language = "en", binding, sendMode = "auto") {
  const activeMembers = Object.entries(room.members ?? {}).filter(([, membership]) => membership.status === "active").map(([id, membership]) => {
    const profile = snapshot.members[id];
    return `<li><span class="member-name">${escapeHtml(profile?.displayName ?? id)}</span><span class="role">${localizedLabel(membership.role, "role")}</span><span class="responsibility">${escapeHtml(membership.responsibility)}</span></li>`;
  }).join("");
  const threadOutlines = room.threads.map((t) => {
    const id = escapeHtml(t.thread.id);
    const title = escapeHtml(t.thread.title);
    const status = t.thread.status.toLowerCase();
    const unread = status === "closed" ? 0 : t.timeline.filter((item) => unreadForLocalAi(item, room, readIdentities)).length;
    return `<a class="outline-item" href="#thread-${id}" data-title="${title.toLowerCase()}" data-thread-status="${escapeHtml(status)}"><span class="outline-status status-${escapeHtml(status)}" aria-hidden="true"></span><span class="outline-title">${title}</span>${unread ? `<span class="outline-unread" aria-label="${escapeHtml(`${unread} Unread`)}">${unread}</span>` : ""}</a>`;
  }).join("");
  const threads = room.threads.map((t) => renderThread(t, snapshot, room, readIdentities)).join("");
  const roomEvents = room.events.length ? `<section class="thread events" id="thread-events" data-title="events"><div class="thread-head"><div class="thread-icon event"></div><div class="thread-meta"><h2>${biText("Events", "\u4E8B\u4EF6")}</h2></div></div><div class="thread-body">${room.events.map((event, index) => renderItem(event, room.events, snapshot, room, readIdentities, index)).join("")}</div></section>` : "";
  const roomWarningPrefix = `rooms/${room.room.id}/`;
  const warningMap = /* @__PURE__ */ new Map();
  for (const warning of snapshot.warnings) {
    if (warning.path.startsWith("rooms/") && !warning.path.startsWith(roomWarningPrefix)) continue;
    const key = `${warning.code}\0${warning.path}\0${warning.message}`;
    if (!warningMap.has(key)) warningMap.set(key, warning);
  }
  const visibleWarnings = [...warningMap.values()];
  const warnings = visibleWarnings.length ? `<details class="warnings"><summary><span class="warnings-icon">\u26A0</span><span class="warnings-title">${biText("Protocol warnings", "\u534F\u8BAE\u8B66\u544A")}</span><span class="warnings-count">${visibleWarnings.length}</span></summary><div class="warning-list">${visibleWarnings.map((warning) => `<div class="warning"><strong>${escapeHtml(warning.code)}</strong><span>${escapeHtml(warning.path)}</span><span>\u2014 ${escapeHtml(warning.message)}</span></div>`).join("")}</div></details>` : "";
  const noThreads = `<div class="empty">${biText("No threads yet.", "\u8FD8\u6CA1\u6709 Thread\u3002")}</div>`;
  const roomArchived = room.room.status.toLowerCase() === "archived" ? `<aside class="room-state archived"><strong>${biText("Archived", "\u5DF2\u5F52\u6863")}</strong><span>${biText("This Room is read-only. Return to your Agent conversation to request a restore or correction.", "\u6B64 Room \u4E3A\u53EA\u8BFB\u72B6\u6001\u3002\u8BF7\u56DE\u5230 Agent \u4F1A\u8BDD\u8BF7\u6C42\u6062\u590D\u6216\u7EA0\u6B63\u3002")}</span></aside>` : "";
  const revision = snapshot.sourceHead;
  const typeZhLabels = { discussion: "\u8BA8\u8BBA", question: "\u95EE\u9898", answer: "\u7B54\u590D", proposal: "\u63D0\u6848", decision: "\u51B3\u7B56", change: "\u53D8\u66F4", blocker: "\u963B\u585E", review: "\u8BC4\u5BA1", status: "\u72B6\u6001", "test-result": "\u6D4B\u8BD5\u7ED3\u679C", acknowledgement: "\u786E\u8BA4", objection: "\u5F02\u8BAE", correction: "\u7EA0\u6B63", "thread-closed": "\u4E3B\u9898\u5DF2\u5173\u95ED", "thread-reopened": "\u4E3B\u9898\u5DF2\u91CD\u5F00", "thread-renamed": "\u4E3B\u9898\u5DF2\u91CD\u547D\u540D" };
  const searchTypeIds = [];
  const searchMembers = [];
  const collectSearchable = (item) => {
    if (!searchTypeIds.includes(item.type)) searchTypeIds.push(item.type);
    const actorId = item.kind === "message" ? item.authorId : item.actorId;
    const display = snapshot.members[actorId]?.displayName ?? actorId;
    if (!searchMembers.includes(display)) searchMembers.push(display);
  };
  for (const cachedThread of room.threads) for (const item of cachedThread.timeline) collectSearchable(item);
  for (const event of room.events) collectSearchable(event);
  const searchStatusIds = [...new Set(room.threads.map((t) => t.thread.status.toLowerCase()))];
  const statusLabels = { open: ["Open", "\u8FDB\u884C\u4E2D"], active: ["Active", "\u8FDB\u884C\u4E2D"], closed: ["Closed", "\u5DF2\u5173\u95ED"], archived: ["Archived", "\u5DF2\u5F52\u6863"] };
  const searchTagData = {
    type: searchTypeIds.map((id) => [id, id, typeZhLabels[id] ?? id]),
    member: searchMembers,
    status: searchStatusIds.map((id) => [id, statusLabels[id]?.[0] ?? id, statusLabels[id]?.[1] ?? id]),
    unread: true
  };
  const searchTagDataJson = JSON.stringify(searchTagData).replace(/</g, "\\u003c");
  const staleMessage = freshness.message ?? "Remote sync did not complete.";
  const staleMessageZh = staleMessage === "No remote is configured for this Team; latest remote content cannot be verified." ? "\u6B64 Forum \u672A\u914D\u7F6E remote\uFF0C\u65E0\u6CD5\u9A8C\u8BC1\u8FDC\u7AEF\u6700\u65B0\u5185\u5BB9\u3002" : staleMessage === "Remote sync did not complete." ? "\u8FDC\u7AEF\u540C\u6B65\u672A\u5B8C\u6210\u3002" : staleMessage;
  const freshnessNotice = freshness.state === "stale" ? `<aside class="sync-state stale"><strong>${biText("Stale", "\u53EF\u80FD\u8FC7\u671F")}</strong><span>${biText(staleMessage, staleMessageZh)}</span><button type="button" onclick="location.reload()">${biText("Retry", "\u91CD\u8BD5")}</button></aside>` : `<aside class="sync-state fresh"><strong>${biText("Synced", "\u5DF2\u540C\u6B65")}</strong><span>${biText("This page was generated after the latest successful pull-only sync.", "\u672C\u9875\u9762\u5728\u6700\u8FD1\u4E00\u6B21\u6210\u529F\u7684\u53EA\u62C9\u53D6\u540C\u6B65\u540E\u751F\u6210\u3002")}</span></aside>`;
  const bindingInfo = binding ? `<div class="binding-context"><span>${biText("Path", "\u76EE\u5F55")}</span><code class="binding-path" title="${escapeHtml(binding.workspaceRoot)}">${escapeHtml(binding.workspaceRoot)}</code><span>${biText("Branch", "\u5206\u652F")}</span><code>${binding.branch === null ? biText("Detached", "\u6E38\u79BB") : escapeHtml(binding.branch)}</code></div>` : "";
  const sendPlaneSvg = `<svg class="send-plane" viewBox="0 0 16 16" aria-hidden="true"><path d="M14.2 8 5.5 3 2.6 6.6 5.2 8 2.6 9.4 5.5 13Z" fill="currentColor"/><path d="M14.2 8 5.2 8" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>${sendMode === "ask" ? `<path d="M2.5 13.5 13.5 2.5" stroke="#b3261e" stroke-width="2.4" stroke-linecap="round"/>` : ""}</svg>`;
  const sendModeInfo = sendMode === "ask" ? `<span class="send-mode ask" title="${escapeHtml(biText("Ask before sending", "\u5148\u95EE\u518D\u53D1"))}">${sendPlaneSvg} ${biText("Ask before sending", "\u5148\u95EE\u518D\u53D1")}</span>` : `<span class="send-mode auto" title="${escapeHtml(biText("Auto-send", "\u81EA\u52A8\u53D1\u9001"))}">${sendPlaneSvg} ${biText("Auto-send", "\u81EA\u52A8\u53D1\u9001")}</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} \u2014 Agent Forum</title><link rel="icon" type="image/svg+xml" href="${viewerFavicon}"><style>:root{--bg:#f6f8fa;--surface:#ffffff;--surface-2:#f0f3f6;--border:#d6dbe0;--border-soft:#e8ebef;--text:#1f2328;--text-2:#59636e;--text-3:#818b96;--accent:#2563eb;--accent-2:#1d4ed8;--accent-soft:#dbeafe;--danger:#dc2626;--danger-bg:#fef2f2;--success:#16a34a;--success-bg:#dcfce7;--violet:#7c3aed;--violet-bg:#ede9fe;--neutral:#475569;--neutral-bg:#f1f5f9;--warning:#d97706;--warning-bg:#fffbeb;--radius:10px;--radius-sm:6px;--shadow:0 1px 2px rgba(31,35,40,.06),0 1px 3px rgba(31,35,40,.04);--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:ui-monospace,'SF Mono',Consolas,monospace}*{box-sizing:border-box}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}code{font-family:var(--font-mono)}header.appbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.appbar-inner{max-width:none;margin:0 auto;padding:12px 48px}.appbar-top{display:flex;align-items:center;gap:16px}.appbar-top h1{flex:1;min-width:0;margin:0;font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.appbar-controls{display:flex;align-items:center;gap:16px;flex-shrink:0}.appbar-bottom{display:flex;align-items:flex-start;gap:16px;margin-top:12px}.appbar-meta{flex:1;min-width:0}.appbar-meta .meta{margin-top:0}.appbar h1{margin:0;font-size:18px;font-weight:700}.meta{color:var(--text-3);font-size:12px;margin-top:2px}.meta code{background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:11px}.binding-context{display:flex;align-items:center;gap:5px;max-width:100%;margin-top:4px;color:var(--text-3);font-size:11px}.binding-context code{background:var(--surface-2);padding:1px 5px;border-radius:4px;color:var(--text-2);font-size:11px}.binding-path{max-width:min(58vw,680px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.send-mode{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:650;line-height:1.5}.send-mode .send-plane{width:12px;height:12px;flex-shrink:0}.send-mode.auto{background:var(--success-bg);color:var(--success)}.send-mode.ask{background:var(--warning-bg);color:var(--warning)}.search{position:relative;flex-shrink:0}.search input{width:280px;max-width:40vw;padding:7px 30px 7px 30px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-size:13px;font-family:var(--font)}.search input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)}.search-clear{position:absolute;right:9px;top:50%;transform:translateY(-50%);display:none;width:15px;height:15px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text-3);font-size:13px;line-height:1;cursor:pointer;align-items:center;justify-content:center}.search-clear:hover{color:var(--text);background:var(--surface-2)}.search-clear.visible{display:inline-flex}mark.match-highlight{background:#fbbf24;color:#1f2328;border-radius:2px;padding:0 1px;animation:match-flash 1.5s ease-out forwards}@keyframes match-flash{0%{background:#f59e0b;color:#1f2328}60%{background:#fbbf24}100%{background:transparent;color:inherit}}.toolbar{display:flex;gap:8px;align-items:center}button,.btn-sm{padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;transition:all .12s}button:hover{background:var(--surface-2);color:var(--text);border-color:var(--text-3)}#close:hover{border-color:var(--danger);color:var(--danger);background:var(--danger-bg)}.btn-sm{padding:4px 10px;font-size:12px}.layout{max-width:none;margin:0 auto;padding:20px 48px 80px;display:flex;gap:40px;align-items:flex-start}.sidebar{width:280px;flex-shrink:0;position:sticky;top:64px;max-height:calc(100vh - 84px);overflow-y:auto}.sidebar h3{margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}.outline{display:flex;flex-direction:column;gap:2px;margin-bottom:24px}.outline-item{display:block;padding:6px 10px;border-radius:var(--radius-sm);font-size:13px;color:var(--text-2);border-left:2px solid transparent;transition:all .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.outline-item:hover{background:var(--surface-2);color:var(--text);text-decoration:none;border-left-color:var(--accent)}.outline-item.active{background:var(--accent-soft);color:var(--accent-2);font-weight:600;border-left-color:var(--accent)}.outline-item.hidden{display:none}.members-list{list-style:none;margin:0 0 24px;padding:0}.members-list li{padding:5px 0;border-bottom:1px solid var(--border-soft)}.members-list li:last-child{border-bottom:none}.member-name{font-weight:500;font-size:13px}.role{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-soft)}.responsibility{display:block;font-size:12px;color:var(--text-3)}.content{flex:1;min-width:0;max-width:none}.markdown p{max-width:85ch}.markdown li{max-width:85ch}.markdown .code-block{max-width:none}.markdown .md-table-wrap{max-width:100%;overflow-x:auto;margin:10px 0;border:1px solid var(--border);border-radius:var(--radius-sm)}.markdown .md-table{width:100%;border-collapse:collapse;font-size:13px}.markdown .md-table th,.markdown .md-table td{padding:8px 10px;border-bottom:1px solid var(--border-soft);vertical-align:top;white-space:nowrap}.markdown .md-table th{background:var(--surface-2);font-weight:600;text-align:left}.markdown .md-table tbody tr:last-child td{border-bottom:0}.notice{background:var(--accent-soft);border:1px solid #bfdbfe;border-radius:var(--radius-sm);padding:10px 14px;margin:0 0 20px;font-size:13px;color:#1e40af}.warnings{background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);margin:0 0 20px}.warnings summary{display:flex;align-items:center;gap:7px;padding:9px 12px;cursor:pointer;list-style:none;color:var(--warning);font-size:13px;font-weight:700}.warnings summary::-webkit-details-marker{display:none}.warnings summary::before{content:"\u25B8";font-size:11px;transition:transform .12s}.warnings[open] summary::before{transform:rotate(90deg)}.warnings-title{display:inline-flex}.warnings-count{display:grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:1px;border-radius:999px;background:#fef3c7;color:#a16207;font-size:10px;font-variant-numeric:tabular-nums}.warning-list{max-height:min(32vh,360px);overflow:auto;padding:0 12px 10px;border-top:1px solid #fde68a}.warnings-icon{font-size:14px}.warning{font-size:12px;color:var(--text-2);margin:5px 0}.warning strong{font-family:var(--font-mono);color:var(--warning);margin-right:4px}.thread{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 16px;box-shadow:var(--shadow);overflow:hidden}.thread.hidden{display:none}.thread-head{padding:14px 18px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--border-soft)}.thread-icon{width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:7px;flex-shrink:0}.thread-icon.event{background:var(--warning)}.thread-meta{min-width:0;flex:1}.thread-head h2{margin:0 0 3px;font-size:16px;font-weight:600;line-height:1.35}.thread-actions{flex-shrink:0}.thread-body{padding:8px 18px 14px}.thread.events .thread-body{padding-top:6px}.item{display:flex;gap:12px;padding:14px 0 14px 7px;border-bottom:1px solid var(--border-soft)}.item:last-child{border-bottom:none}.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.item-main{flex:1;min-width:0;display:flex;gap:12px}.item-line{width:2px;flex-shrink:0;background:var(--border-soft);border-radius:2px}.item:hover .item-line{background:var(--accent)}.item-content{flex:1;min-width:0}.item-content>header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}.actor{font-weight:600;font-size:14px}.role{color:var(--text-3);font-size:12px}.item-content>header time{color:var(--text-3);font-size:12px;margin-left:auto}.type{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px;display:inline-flex}.read-badge{display:inline-flex;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700}.read-badge.read{background:var(--success-bg);color:var(--success)}.read-badge.unread{background:var(--warning-bg);color:var(--warning)}.read-badge.published{background:var(--accent-soft);color:var(--accent-2)}.t-default{background:var(--surface-2);color:var(--text-2)}.t-event{background:var(--warning-bg);color:var(--warning)}.t-danger{background:var(--danger-bg);color:var(--danger)}.t-success{background:var(--success-bg);color:var(--success)}.t-violet{background:var(--violet-bg);color:var(--violet)}.t-neutral{background:var(--neutral-bg);color:var(--neutral)}.body{font-size:14px;line-height:1.7;margin:8px 0;color:var(--text)}.markdown p{margin:8px 0}.markdown h3{font-size:15px;margin:14px 0 6px}.markdown h4{font-size:14px;margin:12px 0 6px}.markdown ul,.markdown ol{margin:8px 0;padding-left:22px}.markdown li{margin:3px 0}.markdown blockquote.md-quote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--border);color:var(--text-2);background:var(--surface-2);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.markdown .code-block{margin:10px 0;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--radius-sm);overflow-x:auto}.markdown .code-block code{font-size:13px;line-height:1.5}.markdown .inline-code{background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:12px}.reply{margin:0 0 12px;padding:8px 12px;background:var(--surface-2);border-left:3px solid var(--accent);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.reply.missing{border-left-color:var(--danger);background:var(--danger-bg)}.reply-meta{font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:3px}.reply-body{font-size:13px;color:var(--text-2);white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}.chips-label{font-size:11px;color:var(--text-3);margin-right:2px}.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-soft)}.chip.mention{background:var(--violet-bg);color:var(--violet);border-color:var(--violet)}.chip.ref{font-family:var(--font-mono);font-size:11px}.chip.raw{font-family:var(--font-mono);font-size:11px}.item-content>footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.empty{text-align:center;padding:60px 20px;color:var(--text-3);font-size:14px}.search-empty{display:none;padding:40px 20px;text-align:center;color:var(--text-3)}.view-toggle{display:flex;gap:0;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)}.view-toggle button{border:0;border-radius:0;padding:6px 10px}.view-toggle button+button{border-left:1px solid var(--border)}.view-toggle button.active{background:var(--accent);color:#fff}.status-badge{display:inline-flex;align-items:center;margin-left:8px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;line-height:1.35;letter-spacing:.05em;text-transform:uppercase;vertical-align:middle}.room-status{margin-left:0}.status-open,.status-active{background:var(--accent-soft);color:var(--accent-2)}.status-closed,.status-archived{background:var(--neutral-bg);color:var(--neutral)}.status-unknown{background:var(--warning-bg);color:var(--warning)}.thread-icon.status-open,.thread-icon.status-active{background:var(--accent)}.thread-icon.status-closed{background:var(--neutral)}.thread-icon.status-archived{background:var(--neutral)}.outline-item{display:flex;align-items:center;gap:8px}.outline-status{width:7px;height:7px;border-radius:50%;flex-shrink:0}.outline-status.status-open,.outline-status.status-active{background:var(--accent)}.outline-status.status-closed,.outline-status.status-archived{background:var(--neutral)}.outline-status.status-unknown{background:var(--warning)}.outline-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.outline-unread{display:grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:var(--accent-2);font-size:10px;font-weight:750;font-variant-numeric:tabular-nums;box-shadow:none}.unread-nav{display:flex;gap:4px}.unread-nav button{padding:6px 9px;font-size:12px}.unread-nav button:disabled{opacity:.4;cursor:not-allowed}.unread-nav button.on{background:var(--accent);color:#fff;border-color:var(--accent)}.search-tags{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}.tag-group{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.tag-chip{padding:2px 10px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);font-size:11px;cursor:pointer;transition:all .12s}.tag-chip:hover{filter:brightness(.96)}.tag-chip[data-group="type"]{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}.tag-chip[data-group="member"]{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}.tag-chip[data-group="status"]{background:#f5f3ff;border-color:#ddd6fe;color:#6d28d9}.tag-chip[data-group="unread"]{background:#fffbeb;border-color:#fde68a;color:#b45309}.tag-chip[data-group="repliesToMe"]{background:#f0fdfa;border-color:#99f6e4;color:#0f766e}.tag-chip[data-group="mentionsMe"]{background:#f0fdfa;border-color:#99f6e4;color:#0f766e}.tag-chip[data-group="type"].on{background:#bfdbfe;border-color:#3b82f6;color:#1e3a8a;font-weight:700}.tag-chip[data-group="member"].on{background:#bbf7d0;border-color:#22c55e;color:#14532d;font-weight:700}.tag-chip[data-group="status"].on{background:#ddd6fe;border-color:#8b5cf6;color:#4c1d95;font-weight:700}.tag-chip[data-group="unread"].on{background:#fde68a;border-color:#f59e0b;color:#78350f;font-weight:700}.tag-chip[data-group="repliesToMe"].on{background:#99f6e4;border-color:#14b8a6;color:#134e4a;font-weight:700}.tag-chip[data-group="mentionsMe"].on{background:#99f6e4;border-color:#14b8a6;color:#134e4a;font-weight:700}.tag-count{color:var(--text-3);font-size:11px;margin-left:4px}.filter-chip{flex-shrink:0;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;transition:all .12s}.filter-chip:hover{background:var(--surface-2);color:var(--text)}.filter-chip.on{background:var(--warning-bg);border-color:var(--warning);color:var(--warning);font-weight:700}.query-hit{box-shadow:inset 3px 0 var(--accent)}.item.unread-selected{background:#fffbeb;box-shadow:inset 3px 0 #f59e0b;border-radius:var(--radius-sm)}.item.query-selected{background:#fffbeb;box-shadow:inset 3px 0 #f59e0b;border-radius:var(--radius-sm)}.query-focus{animation:unread-focus .9s ease-out}@keyframes unread-focus{0%,100%{box-shadow:none}35%{box-shadow:0 0 0 4px #fde68a;border-radius:var(--radius-sm)}}.room-state{display:flex;gap:8px;align-items:flex-start;background:var(--neutral-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin:0 0 20px;font-size:13px;color:var(--text-2)}.room-state strong{color:var(--neutral);white-space:nowrap}.tree-issue{display:none;margin:8px 0;padding:6px 9px;border-left:3px solid var(--warning);background:var(--warning-bg);color:var(--warning);font-size:12px;border-radius:0 var(--radius-sm) var(--radius-sm) 0}body[data-view="tree"] .tree-issue{display:block}body[data-view="tree"] .thread-body{padding:14px 18px 18px;background:linear-gradient(180deg,#fbfcfe,#f5f8fc)}body[data-view="tree"] .graph-view{--graph-width:72px;position:relative;min-width:0}body[data-view="tree"] .graph-stage{position:relative;min-width:0}body[data-view="tree"] .graph-canvas{position:absolute;left:0;top:0;width:var(--graph-width);height:100%;overflow:visible;pointer-events:none;z-index:0}body[data-view="tree"] .graph-rows{position:relative;z-index:1}body[data-view="tree"] .graph-row{display:grid;grid-template-columns:var(--graph-width) minmax(0,1fr);align-items:stretch}body[data-view="tree"] .graph-row>.item{grid-column:2;margin:0;padding:14px 14px 14px 7px;background:transparent;border-top:none;border-left:none;border-right:none;border-radius:0;box-shadow:none}body[data-view="tree"] .graph-row>.item .item-line{display:none}body[data-view="tree"] .graph-row:hover>.item{background:rgba(219,234,254,.4)}.graph-track{stroke:#e6ebf4}.graph-edge{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.85}.graph-edge-lit{stroke-width:3;opacity:1}.graph-node{stroke:#fff;stroke-width:2}.tree-activity{margin:16px 0 2px;padding:12px 14px;border:1px dashed var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.tree-activity h3{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3)}.tree-activity-note{margin:0 0 8px;font-size:12px;color:var(--text-3)}.tree-activity .item{padding:10px 0 10px 7px}.tree-activity .item:last-child{border-bottom:0}@media(max-width:880px){.layout{flex-direction:column;padding:16px}.sidebar{position:static;width:auto;max-height:none}.search input{width:100%}.appbar-inner{padding:12px 16px}.content{max-width:none}body[data-view="tree"] .thread-body{padding-left:10px;padding-right:10px}}</style></head><body><header class="appbar"><div class="appbar-inner"><div class="appbar-top"><h1>${escapeHtml(room.room.title)}</h1><div class="appbar-controls"><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="search" type="text" data-placeholder-en="Search" data-placeholder-zh="\u641C\u7D22" placeholder="Search" autocomplete="off"><button id="search-clear" class="search-clear" type="button" aria-label="Clear search">\xD7</button></div><div class="unread-nav" role="group" aria-label="Unread navigation"><button id="previous-unread" aria-label="Previous unread" data-en="Prev" data-zh="\u4E0A\u4E00\u6761">Prev</button><button id="next-unread" aria-label="Next unread" data-en="Next" data-zh="\u4E0B\u4E00\u6761">Next</button></div><div class="toolbar"><div class="view-toggle" role="group" aria-label="Viewer mode"><button id="view-timeline" class="active" aria-pressed="true" data-en="Timeline" data-zh="\u65F6\u95F4\u7EBF">Timeline</button><button id="view-tree" aria-pressed="false" data-en="Tree" data-zh="\u6811\u72B6">Tree</button><button id="lang-toggle" data-en="\u4E2D\u6587" data-zh="EN">\u4E2D\u6587</button><button id="close" data-en="Close" data-zh="\u5173\u95ED">Close</button></div></div></div></div><div class="appbar-bottom"><div class="appbar-meta"><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} \xB7 ${statusBadge(room.room.status, "room")} \xB7 ${biHtml("snapshot", "\u5FEB\u7167")} <code>${escapeHtml(snapshot.sourceHead.slice(0, 12))}</code>${sendModeInfo}</div>${bindingInfo}</div><div class="search-tags" id="search-tags" aria-label="Search tags"></div></div></header><div class="layout"><aside class="sidebar"><h3 data-en="Threads" data-zh="\u4E3B\u9898">Threads</h3><div class="outline" id="outline">${threadOutlines}${roomEvents ? `<a class="outline-item" href="#thread-events" data-title="events">${biText("Events", "\u4E8B\u4EF6")}</a>` : ""}</div>${activeMembers ? `<h3 data-en="Members" data-zh="\u6210\u5458">Members</h3><ul class="members-list">${activeMembers}</ul>` : ""}</aside><main class="content"><p class="notice">${biText("Read-only view. Return to your Agent conversation to request corrections; history is never edited here.", "\u53EA\u8BFB\u89C6\u56FE\u3002\u5982\u9700\u7EA0\u6B63\uFF0C\u8BF7\u56DE\u5230 Agent \u4F1A\u8BDD\u63D0\u51FA\uFF1B\u6B64\u5904\u4E0D\u4F1A\u4FEE\u6539\u5386\u53F2\u3002")}</p>${roomArchived}${freshnessNotice}${warnings}${roomEvents}${threads || noThreads}</main></div><script nonce="agent-forum">const searchTagData=${searchTagDataJson};const revision="${escapeHtml(revision)}";let lang=${JSON.stringify(language)};function applyLang(){document.querySelectorAll('.lang-en').forEach(e=>e.style.display=lang==='en'?'':'none');document.querySelectorAll('.lang-zh').forEach(e=>e.style.display=lang==='zh'?'':'none');document.querySelectorAll('[data-en][data-zh]').forEach(e=>e.textContent=lang==='en'?e.dataset.en:e.dataset.zh);document.querySelectorAll('[data-placeholder-en]').forEach(e=>{if(e instanceof HTMLInputElement)e.placeholder=lang==='en'?e.dataset.placeholderEn:e.dataset.placeholderZh;});document.querySelectorAll('[data-copy-en]').forEach(e=>e.dataset.copy=lang==='en'?e.dataset.copyEn:e.dataset.copyZh);}applyLang();document.getElementById('lang-toggle').addEventListener('click',async()=>{lang=lang==='en'?'zh':'en';applyLang();redrawReplyGraphs();try{await fetch(location.pathname+'preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:lang})})}catch{}});document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copy||'')));
document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copy||'')));
const search=document.getElementById('search');
const outlineItems=Array.from(document.querySelectorAll('.outline-item'));
const threads=Array.from(document.querySelectorAll('.thread'));
const searchTagsEl=document.getElementById('search-tags');
/* \u7EDF\u4E00\u641C\u7D22\uFF1A\u6587\u672C\u4E0E\u6807\u7B7E\u4E3A\u6761\u4EF6\uFF08\u540C\u7C7B OR\u3001\u5F02\u7C7B AND\uFF09\uFF1B\u5217\u8868\u4FDD\u6301\u5168\u8C8C\u4E0D\u7B5B\u9009\uFF0C\u7ED3\u679C\u96C6\u7528\u4E8E\u4E0A\u4E00\u6761/\u4E0B\u4E00\u6761\u5B9A\u4F4D\u3002 */
const searchState={text:'',tags:{type:new Set(),member:new Set(),status:new Set(),unread:false,repliesToMe:false,mentionsMe:false},results:[],selection:null};
const indexes=threads.map(thread=>{
  const titleNode=thread.querySelector('.thread-head h2');
  const title=(titleNode?titleNode.textContent.trim():'')+' '+(thread.dataset.title||'');
  const status=(thread.dataset.threadStatus||'').toLowerCase();
  const messages=[];
  thread.querySelectorAll('.item').forEach(item=>{
    const grab=sel=>{const n=item.querySelector(sel);return n?n.textContent||'':''};
    const text=[title,grab('.actor'),grab('.role'),grab('.type'),grab('.body')].filter(Boolean).join(' ').toLowerCase();
    messages.push({item,text,typeId:item.dataset.msgType||'',member:grab('.actor'),status,unread:item.dataset.aiUnread==='true',repliesToMe:item.dataset.repliesToMe==='true',mentionsMe:item.dataset.mentionsMe==='true'});
  });
  return{el:thread,messages};
});
/* \u4ECE\u670D\u52A1\u7AEF\u6CE8\u5165\u7684\u6807\u7B7E\u6570\u636E\u751F\u6210\u53EF\u70B9\u51FB chips\u3002 */
function buildTagChips(){
  if(!searchTagsEl)return;
  const groups=[['type',searchTagData.type||[]],['member',searchTagData.member||[]],['status',searchTagData.status||[]],['unread',searchTagData.unread?[['unread','Unread','\u672A\u8BFB']]:[]],['repliesToMe',[['repliesToMe','Replies to me','\u56DE\u590D\u6211']]],['mentionsMe',[['mentionsMe','Mentions me','@\u6211']]]];
  searchTagsEl.innerHTML='';
  groups.forEach(([g,items])=>{
    if(!items.length)return;
    const wrap=document.createElement('div');wrap.className='tag-group';
    items.forEach(item=>{
      const id=typeof item==='string'?item:(item[0]||item),en=typeof item==='string'?item:(item[1]||item),zh=typeof item==='string'?item:(item[2]||item);
      const b=document.createElement('button');
      b.className='tag-chip';b.dataset.group=g;b.dataset.value=id;b.dataset.en=en;b.dataset.zh=zh;b.textContent=lang==='zh'?zh:en;
      b.addEventListener('click',()=>{
        if(g==='unread'||g==='repliesToMe'||g==='mentionsMe'){searchState.tags[g]=!searchState.tags[g];b.classList.toggle('on',searchState.tags[g]);}
        else{const set=searchState.tags[g];if(set.has(id))set.delete(id);else set.add(id);b.classList.toggle('on',set.has(id));}
        applyQuery();
        updateSearchClear();
      });
      wrap.append(b);
    });
    searchTagsEl.append(wrap);
  });
}
function normQ(){return(search.value||'').trim().toLowerCase()}
function hasQuery(){return Boolean(normQ())||searchState.tags.type.size>0||searchState.tags.member.size>0||searchState.tags.status.size>0||searchState.tags.unread||searchState.tags.repliesToMe||searchState.tags.mentionsMe}
function matches(m){
  if(searchState.tags.type.size&&[...searchState.tags.type].some(v=>v!==m.typeId))return false;
  if(searchState.tags.member.size&&[...searchState.tags.member].some(v=>v!==m.member))return false;
  if(searchState.tags.status.size&&[...searchState.tags.status].some(v=>v!==m.status))return false;
  if(searchState.tags.unread&&!m.unread)return false;
  if(searchState.tags.repliesToMe&&!m.repliesToMe)return false;
  if(searchState.tags.mentionsMe&&!m.mentionsMe)return false;
  const q=normQ();
  if(q&&m.text.indexOf(q)===-1)return false;
  return true;
}
function syncNav(){const prev=document.getElementById('previous-unread'),next=document.getElementById('next-unread');if(!prev||!next)return;const disabled=searchState.results.length===0;prev.disabled=disabled;next.disabled=disabled;}
function applyQuery(){
  const active=hasQuery();
  searchState.results=[];
  document.querySelectorAll('.item.query-hit').forEach(i=>i.classList.remove('query-hit'));
  if(active){
    indexes.forEach(index=>{
      index.messages.forEach(m=>{if(matches(m)){m.item.classList.add('query-hit');searchState.results.push(m);}});
    });
  }
  searchState.selection=null;
  syncNav();
}
function escapeRegExpText(value){return String(value).replace(/[.*+?^|()[]{}$\\]/g,'\\$&')}
function flashMatches(item,q){
  document.querySelectorAll('mark.match-highlight').forEach(m=>{const t=document.createTextNode(m.textContent);m.replaceWith(t);});
  if(!q)return;
  const body=item.querySelector('.body');
  if(!body)return;
  const re=new RegExp(escapeRegExpText(q),'gi');
  const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const text=node.nodeValue;
    if(!text||!re.test(text)){re.lastIndex=0;return;}
    re.lastIndex=0;
    const frag=document.createDocumentFragment();
    let last=0,m;
    while((m=re.exec(text))!==null){
      if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
      const mark=document.createElement('mark');
      mark.className='match-highlight';
      mark.textContent=m[0];
      frag.appendChild(mark);
      last=m.index+m[0].length;
      if(m[0].length===0)re.lastIndex++;
    }
    if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag,node);
  });
  setTimeout(()=>{
    document.querySelectorAll('mark.match-highlight').forEach(m=>{const t=document.createTextNode(m.textContent);m.replaceWith(t);});
  },1600);
}
function moveResult(direction){
  const list=searchState.results;
  if(!list.length)return;
  const idx=list.indexOf(searchState.selection);
  const next=list[(idx<0?0:(idx+direction+list.length)%list.length)];
  searchState.selection=next;
  document.querySelectorAll('.item.query-selected').forEach(i=>i.classList.remove('query-selected'));
  next.item.classList.add('query-selected');
  next.item.scrollIntoView({behavior:'smooth',block:'center'});
  next.item.classList.add('query-focus');
  setTimeout(()=>next.item.classList.remove('query-focus'),900);
  flashMatches(next.item,normQ());
}
buildTagChips();
const searchClear=document.getElementById('search-clear');
function updateSearchClear(){const hasAny=Boolean(search.value)||searchState.tags.type.size>0||searchState.tags.member.size>0||searchState.tags.status.size>0||searchState.tags.unread||searchState.tags.repliesToMe||searchState.tags.mentionsMe;if(searchClear)searchClear.classList.toggle('visible',hasAny);}
search.addEventListener('input',()=>{applyQuery();updateSearchClear();});
if(searchClear)searchClear.addEventListener('click',()=>{search.value='';searchState.tags.type.clear();searchState.tags.member.clear();searchState.tags.status.clear();searchState.tags.unread=false;searchState.tags.repliesToMe=false;searchState.tags.mentionsMe=false;document.querySelectorAll('.tag-chip.on').forEach(c=>c.classList.remove('on'));applyQuery();updateSearchClear();search.focus();});
document.getElementById('previous-unread').addEventListener('click',()=>moveResult(-1));
document.getElementById('next-unread').addEventListener('click',()=>moveResult(1));
applyQuery();updateSearchClear();
function restoreTimeline(thread){const body=thread.querySelector('.thread-body');if(!body)return;const graph=body.querySelector('.graph-view');if(graph?.__graphObserver)graph.__graphObserver.disconnect();const items=Array.from(body.querySelectorAll('.item[data-timeline-index]')).sort((a,b)=>Number(a.dataset.timelineIndex)-Number(b.dataset.timelineIndex));body.replaceChildren(...items);}function replyRelations(messages){const byId=new Map(messages.map(item=>[item.dataset.messageId,item]));const parents=new Map();messages.forEach(item=>{const id=item.dataset.messageId;const parent=item.dataset.replyTo;if(id&&parent&&parent!==id&&byId.has(parent))parents.set(id,parent);});const cut=new Set();messages.forEach(item=>{const visited=new Map();let current=item.dataset.messageId;while(current&&parents.has(current)){if(visited.has(current)){Array.from(visited.keys()).slice(visited.get(current)).forEach(id=>cut.add(id));break;}visited.set(current,visited.size);current=parents.get(current);}});const children=new Map(messages.map(item=>[item.dataset.messageId,[]]));const roots=[];messages.forEach(item=>{const id=item.dataset.messageId;const parent=id?parents.get(id):undefined;if(id&&parent&&!cut.has(id))children.get(parent).push(id);else roots.push(id);});return{byId,children,roots,parents:new Map([...parents].filter(([id])=>!cut.has(id)))};}/* \u521B\u5EFA\u4E0D\u4F9D\u8D56\u5916\u90E8\u8D44\u6E90\u7684 SVG \u56FE\u5143\u3002 */function graphSvgElement(name,attributes={}){const element=document.createElementNS('http://www.w3.org/2000/svg',name);Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));return element;}/* \u6839\u636E\u6D88\u606F\u5361\u7247\u7684\u5B9E\u9645\u9AD8\u5EA6\u7ED8\u5236\u56DE\u590D\u8F68\u9053\u3002 */function drawReplyGraph(graph,relation){const stage=graph.querySelector('.graph-stage');const svg=graph.querySelector('.graph-canvas');const rows=Array.from(graph.querySelectorAll('.graph-row'));if(!stage||!svg||!rows.length)return;const narrow=window.matchMedia?.('(max-width:880px)').matches;const baseWidth=narrow?54:76;const laneGap=narrow?16:20;const laneCount=Math.max(1,Number(graph.dataset.graphLanes)||1);const graphWidth=Math.max(baseWidth,laneCount*laneGap+28);graph.style.setProperty('--graph-width',graphWidth+'px');const stageRect=stage.getBoundingClientRect();const rowById=new Map(rows.map(row=>[row.dataset.messageId,row]));const pointFor=id=>{const row=rowById.get(id);if(!row)return undefined;const lane=Math.max(0,Number(row.dataset.graphLane)||0);const target=row.querySelector('.avatar')||row;const rect=target.getBoundingClientRect();return{x:14+lane*laneGap,y:rect.top+rect.height/2-stageRect.top,lane};};const stageHeight=Math.max(0,stage.getBoundingClientRect().height);svg.setAttribute('width',String(graphWidth));svg.setAttribute('height',String(stageHeight));svg.setAttribute('viewBox','0 0 '+graphWidth+' '+stageHeight);svg.replaceChildren();const laneSet=new Set(rows.map(row=>Math.max(0,Number(row.dataset.graphLane)||0)));const tracks=graphSvgElement('g',{class:'graph-tracks'});laneSet.forEach(laneIndex=>{tracks.append(graphSvgElement('line',{class:'graph-track',x1:14+laneIndex*laneGap,y1:0,x2:14+laneIndex*laneGap,y2:stageHeight,'stroke-width':1.5}));});svg.append(tracks);const edges=graphSvgElement('g',{class:'graph-edges'});const palette=['#2563eb','#f97316','#16a34a','#9333ea','#0891b2','#db2777'];const parentChildren=new Map();relation.parents.forEach((parentId,childId)=>{if(!parentChildren.has(parentId))parentChildren.set(parentId,[]);parentChildren.get(parentId).push(childId);});relation.parents.forEach((parentId,childId)=>{const from=pointFor(parentId);const to=pointFor(childId);if(!from||!to)return;const children=parentChildren.get(parentId)||[];const k=children.indexOf(childId);const middle=(from.y+to.y)/2;const bendY=Math.max(from.y+8,Math.min(middle,from.y+14+k*5));const color=palette[to.lane%palette.length];const path=graphSvgElement('path',{class:'graph-edge','data-edge':parentId+'|'+childId,stroke:color,d:from.x===to.x?'M '+from.x+' '+from.y+' L '+to.x+' '+to.y:'M '+from.x+' '+from.y+' L '+from.x+' '+bendY+' L '+to.x+' '+bendY+' L '+to.x+' '+to.y});edges.append(path);});svg.append(edges);const nodes=graphSvgElement('g',{class:'graph-nodes'});rows.forEach(row=>{const point=pointFor(row.dataset.messageId);if(!point)return;nodes.append(graphSvgElement('circle',{class:'graph-node','data-message-id':row.dataset.messageId,cx:point.x,cy:point.y,r:5,fill:palette[point.lane%palette.length]}));});svg.append(nodes);rows.forEach(row=>{const marker=svg.querySelector('.graph-node[data-message-id="'+row.dataset.messageId+'"]');if(!marker)return;row.addEventListener('mouseenter',()=>{marker.setAttribute('r','7');relation.parents.forEach((parentId,childId)=>{if(childId===row.dataset.messageId||parentId===row.dataset.messageId){const target=svg.querySelector('.graph-edge[data-edge="'+parentId+'|'+childId+'"]');if(target)target.classList.add('graph-edge-lit');}});});row.addEventListener('mouseleave',()=>{marker.setAttribute('r','5');svg.querySelectorAll('.graph-edge').forEach(path=>path.classList.remove('graph-edge-lit'));});});}function renderTree(thread){restoreTimeline(thread);const body=thread.querySelector('.thread-body');if(!body)return;const items=Array.from(body.querySelectorAll('.item[data-timeline-index]'));const messages=items.filter(item=>item.classList.contains('message'));const events=items.filter(item=>item.classList.contains('event'));const relation=replyRelations(messages);const graph=document.createElement('div');graph.className='graph-view';graph.dataset.graphLanes=thread.dataset.graphLanes||'1';graph._replyRelation=relation;const stage=document.createElement('div');stage.className='graph-stage';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','graph-canvas');svg.setAttribute('aria-hidden','true');const rows=document.createElement('div');rows.className='graph-rows';messages.forEach(item=>{const row=document.createElement('div');row.className='graph-row';row.dataset.messageId=item.dataset.messageId||'';row.dataset.graphLane=item.dataset.graphLane||'0';row.append(item);rows.append(row);});stage.append(svg,rows);graph.append(stage);body.replaceChildren(graph);drawReplyGraph(graph,relation);if(window.ResizeObserver){const observer=new ResizeObserver(()=>drawReplyGraph(graph,relation));observer.observe(rows);graph.__graphObserver=observer;}if(events.length){const activity=document.createElement('section');activity.className='tree-activity';const heading=document.createElement('h3');heading.dataset.en='Activity';heading.dataset.zh='\u6D3B\u52A8\u4E8B\u4EF6';heading.textContent=lang==='zh'?heading.dataset.zh:heading.dataset.en;const note=document.createElement('p');note.className='tree-activity-note';note.dataset.en='Lifecycle events are shown separately because they are not replies.';note.dataset.zh='\u751F\u547D\u5468\u671F\u4E8B\u4EF6\u72EC\u7ACB\u663E\u793A\uFF0C\u56E0\u4E3A\u5B83\u4EEC\u4E0D\u662F\u56DE\u590D\u3002';note.textContent=lang==='zh'?note.dataset.zh:note.dataset.en;activity.append(heading,note,...events);body.append(activity);}}const viewTimeline=document.getElementById('view-timeline');const viewTree=document.getElementById('view-tree');function setView(mode){document.body.dataset.view=mode;viewTimeline.classList.toggle('active',mode==='timeline');viewTree.classList.toggle('active',mode==='tree');viewTimeline.setAttribute('aria-pressed',String(mode==='timeline'));viewTree.setAttribute('aria-pressed',String(mode==='tree'));document.querySelectorAll('.thread').forEach(thread=>{if(mode==='tree')renderTree(thread);else restoreTimeline(thread);});}viewTimeline.addEventListener('click',()=>setView('timeline'));viewTree.addEventListener('click',()=>setView('tree'));/* \u91CD\u7ED8\u5F53\u524D\u9875\u9762\u4E2D\u7684\u6240\u6709\u56DE\u590D\u56FE\u3002 */function redrawReplyGraphs(){document.querySelectorAll('.graph-view').forEach(graph=>drawReplyGraph(graph,graph._replyRelation));}window.addEventListener('resize',redrawReplyGraphs,{passive:true});const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const id=e.target.id;outlineItems.forEach(i=>i.classList.toggle('active',i.getAttribute('href')==='#'+id));}});},{rootMargin:'-72px 0px -70% 0px'});threads.forEach(t=>observer.observe(t));document.getElementById('close').addEventListener('click',async()=>{try{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<div style="max-width:600px;margin:80px auto;padding:20px;font-family:system-ui;text-align:center;color:#59636e"><p>Viewer closed.</p></div>'}catch{}});if(location.protocol==='http:')setInterval(async()=>{try{const next=await(await fetch(location.pathname+'revision')).json();if(next.revision!==revision)location.reload()}catch{}},2000)</script></body></html>`;
}
async function startViewerServer(input) {
  const room = input.snapshot.rooms.find(
    (candidate) => candidate.room.id === input.roomIdOrSlug || candidate.room.slug === input.roomIdOrSlug
  );
  if (!room) throw new Error(`room was not found in snapshot: ${input.roomIdOrSlug}`);
  const token = input.token ?? randomBytes(16).toString("hex");
  const basePath = `/session/${token}/`;
  let currentSnapshot = input.snapshot;
  let currentRoom = room;
  let freshness = input.refresh ? { state: "stale", message: "Waiting for remote sync." } : { state: "fresh" };
  let readIdentities = input.readIdentities ?? [];
  let language = input.language ?? "en";
  let html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities, language, input.binding, input.sendMode ?? "auto");
  let revision = currentSnapshot.sourceHead;
  let refreshInFlight;
  const refresh = async () => {
    if (!input.refresh) return;
    if (!refreshInFlight) {
      refreshInFlight = input.refresh().then((result) => {
        freshness = result.freshness;
        if (result.readIdentities) readIdentities = result.readIdentities;
        if (result.snapshot) {
          const nextRoom = result.snapshot.rooms.find((candidate) => candidate.room.id === room.room.id);
          if (nextRoom) {
            currentSnapshot = result.snapshot;
            currentRoom = nextRoom;
            revision = result.snapshot.sourceHead;
          }
        }
        html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities, language, input.binding, input.sendMode ?? "auto");
      }).catch(() => {
        freshness = { state: "stale", message: "Remote sync failed unexpectedly." };
        html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities, language, input.binding, input.sendMode ?? "auto");
      }).finally(() => {
        refreshInFlight = void 0;
      });
    }
    await refreshInFlight;
  };
  const idleMs = input.idleMs ?? 5 * 6e4;
  let timer;
  let server;
  let resolveClosed;
  const closed = new Promise((resolveValue) => {
    resolveClosed = resolveValue;
  });
  let closing;
  const close = () => {
    if (closing) return closing;
    closing = new Promise((resolveClose) => {
      clearTimeout(timer);
      server.close(() => {
        resolveClosed();
        resolveClose();
      });
    });
    return closing;
  };
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void close(), idleMs);
    timer.unref();
  };
  server = createServer((request, response) => {
    void (async () => {
      touch();
      response.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-agent-forum'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cache-Control", "no-store");
      if (request.method === "GET" && request.url === basePath) {
        await refresh();
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }
      if (request.method === "GET" && request.url === `${basePath}revision`) {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ revision }));
        return;
      }
      if (request.method === "POST" && request.url === `${basePath}preferences`) {
        let body = "";
        for await (const chunk of request) body += String(chunk);
        const value = JSON.parse(body);
        if (value.language !== "en" && value.language !== "zh" || !input.setLanguage) {
          response.writeHead(400);
          response.end("invalid language preference");
          return;
        }
        await input.setLanguage(value.language);
        language = value.language;
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "POST" && request.url === `${basePath}close`) {
        response.writeHead(204);
        response.end();
        setImmediate(() => void close());
        return;
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Viewer request failed");
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    function onError(error) {
      server.off("listening", onListening);
      rejectListen(error);
    }
    function onListening() {
      server.off("error", onError);
      resolveListen();
    }
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
  touch();
  const address = server.address();
  if (!address || typeof address === "string") {
    await close();
    throw new Error("viewer did not receive a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}${basePath}`,
    token,
    port: address.port,
    closed,
    updateSnapshot: (snapshot, nextFreshness = { state: "fresh" }) => {
      const nextRoom = snapshot.rooms.find(
        (candidate) => candidate.room.id === room.room.id
      );
      if (!nextRoom) return;
      currentSnapshot = snapshot;
      currentRoom = nextRoom;
      freshness = nextFreshness;
      revision = snapshot.sourceHead;
      html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities, language, input.binding, input.sendMode ?? "auto");
    },
    close
  };
}

// src/services/viewer.ts
init_publish_policy();
function sessionPath(paths, id) {
  if (!/^[0-9a-f-]{36}$/u.test(id)) throw new ServiceError("VIEWER_SESSION_NOT_FOUND", "invalid Viewer session ID");
  return resolve23(paths.viewerDirectory, `${id}.json`);
}
async function isProcessAlive2(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function isServerReachable(baseUrl) {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(1500)
    });
    return true;
  } catch {
    return false;
  }
}
async function waitForProcessExit(pid, timeoutMs = 5e3) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await isProcessAlive2(pid)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  return !await isProcessAlive2(pid);
}
async function readSession(path2) {
  try {
    const value = JSON.parse(await readFile20(path2, "utf8"));
    const url = new URL(value.url);
    const validUrl = url.protocol === "http:" && url.hostname === "127.0.0.1" && /^\/session\/[0-9a-f]{32}\/$/u.test(url.pathname);
    return value.formatVersion === 1 && /^[0-9a-f-]{36}$/u.test(value.sessionId) && Number.isSafeInteger(value.pid) && value.pid > 0 && validUrl ? value : void 0;
  } catch {
    return void 0;
  }
}
async function listViewerSessions(paths = createAgentForumPaths()) {
  let names = [];
  try {
    names = await readdir11(paths.viewerDirectory);
  } catch {
    return [];
  }
  const sessions = [];
  for (const name of names.filter((name2) => name2.endsWith(".json"))) {
    const path2 = resolve23(paths.viewerDirectory, name);
    const session = await readSession(path2);
    if (session && await isProcessAlive2(session.pid) && await isServerReachable(session.url)) sessions.push(session);
    else await rm12(path2, { force: true });
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
async function cleanViewerSessions(paths = createAgentForumPaths()) {
  let names = [];
  try {
    names = await readdir11(paths.viewerDirectory);
  } catch {
    return { removed: 0 };
  }
  let removed = 0;
  for (const name of names.filter((name2) => name2.endsWith(".json") || name2.endsWith(".ready"))) {
    const path2 = resolve23(paths.viewerDirectory, name);
    const session = name.endsWith(".json") ? await readSession(path2) : void 0;
    if (!session || !await isProcessAlive2(session.pid) || !await isServerReachable(session.url)) {
      await rm12(path2, { force: true });
      removed += 1;
    }
  }
  return { removed };
}
async function stopViewerSessions(sessions, paths, options = {}) {
  const closed = [];
  for (const session of sessions) {
    let stopError;
    try {
      const response = await fetch(`${session.url}close`, {
        method: "POST",
        signal: AbortSignal.timeout(2e3)
      });
      if (!response.ok) throw new Error(`Viewer close returned HTTP ${response.status}`);
      if (!await waitForProcessExit(session.pid)) {
        throw new Error("Viewer process did not exit within 5 seconds");
      }
    } catch (error) {
      stopError = error;
    }
    if (!await isProcessAlive2(session.pid) || !await isServerReachable(session.url)) {
      closed.push(session.sessionId);
      await rm12(sessionPath(paths, session.sessionId), { force: true });
      continue;
    }
    if (options.strict) {
      throw new ServiceError(
        "VIEWER_START_FAILED",
        `existing Viewer session could not be closed: ${session.sessionId}`,
        stopError instanceof Error ? { cause: stopError.message } : void 0
      );
    }
  }
  return closed;
}
async function closeViewerSession(sessionId, paths = createAgentForumPaths()) {
  const sessions = await listViewerSessions(paths);
  const selected = sessionId ? sessions.filter((session) => session.sessionId === sessionId) : sessions;
  if (sessionId && selected.length === 0) throw new ServiceError("VIEWER_SESSION_NOT_FOUND", `Viewer session not found: ${sessionId}`);
  return { closed: await stopViewerSessions(selected, paths) };
}
async function replaceViewerSessions(forumAlias, roomId, paths) {
  const existing = (await listViewerSessions(paths)).filter(
    (session) => session.forumAlias === forumAlias && session.roomId === roomId
  );
  return stopViewerSessions(existing, paths, { strict: true });
}
async function openBrowser(url) {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args2 = process.platform === "win32" ? ["/d", "/s", "/c", "start", "", url] : [url];
  return new Promise((resolveOpen) => {
    const child = spawn3(command, args2, { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    child.once("error", () => resolveOpen(false));
    child.once("spawn", () => {
      child.unref();
      resolveOpen(true);
    });
  });
}
async function getViewerReadIdentities(forumAlias, identityIds, paths) {
  const unique = [...new Set(identityIds)];
  const config = await loadLocalConfig(paths);
  return Promise.all(unique.map(async (identityId) => {
    const cursor = await getInboxReadCursor({ forumAlias, ...identityId ? { identityId } : {} }, paths);
    const profile = config.identities.find((identity) => identity.memberId === cursor.memberId);
    return { memberId: cursor.memberId, displayName: profile?.displayName ?? cursor.memberId, seenIds: cursor.seenIds };
  }));
}
async function runViewerServer(input, paths = createAgentForumPaths()) {
  const cached = await getForumSnapshot(input.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === input.room || item.room.slug === input.room);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${input.room}`);
  const server = await startViewerServer({
    snapshot: cached.snapshot,
    roomIdOrSlug: room.room.id,
    token: input.token,
    idleMs: input.idleMs,
    readIdentities: await getViewerReadIdentities(input.forumAlias, [input.identityId], paths),
    language: await getUiLanguage(paths),
    sendMode: await getRoomPublishMode(paths, findForum(await loadLocalConfig(paths), input.forumAlias).forumId, room.room.id),
    ...input.binding ? { binding: input.binding } : {},
    setLanguage: async (language) => {
      await setUiLanguage(language, paths);
    },
    refresh: async () => {
      try {
        const result = await refreshForumFromRemote(input.forumAlias, paths);
        if (result.outcome === "remote-not-configured") {
          return {
            freshness: {
              state: "stale",
              message: "No remote is configured for this Team; latest remote content cannot be verified."
            }
          };
        }
        if (result.outcome === "skipped-local-commits") {
          return {
            freshness: {
              state: "stale",
              message: "Local commits are not pushed; remote refresh was safely skipped."
            }
          };
        }
        if (result.outcome === "updated") await invalidateDashboard(paths);
        return { snapshot: (await getForumSnapshot(input.forumAlias, paths)).snapshot, freshness: { state: "fresh" }, readIdentities: await getViewerReadIdentities(input.forumAlias, [input.identityId], paths) };
      } catch (error) {
        const code = error instanceof ServiceError ? error.code : "SYNC_FAILED";
        return {
          freshness: {
            state: "stale",
            message: `Remote sync failed (${code}).`
          }
        };
      }
    }
  });
  const session = {
    formatVersion: 1,
    sessionId: input.sessionId,
    forumAlias: input.forumAlias,
    roomId: room.room.id,
    ...input.identityId ? { identityId: input.identityId } : {},
    url: server.url,
    pid: process.pid,
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await mkdir8(paths.viewerDirectory, { recursive: true });
  await writeJsonAtomic(sessionPath(paths, input.sessionId), session, { overwrite: true, mode: 384 });
  if (input.openBrowser) await openBrowser(server.url);
  await server.closed;
  await rm12(sessionPath(paths, input.sessionId), { force: true });
}
async function launchViewerInline(input, paths = createAgentForumPaths()) {
  const context = await resolveContext({ forumAlias: input.forumAlias, room: input.room }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  await replaceViewerSessions(context.forumAlias, context.roomId, paths);
  await runViewerServer({
    forumAlias: context.forumAlias,
    room: context.roomId,
    sessionId: randomUUID7(),
    token: randomBytes2(16).toString("hex"),
    idleMs: input.idleMs ?? 30 * 6e4,
    ...input.identityId ? { identityId: input.identityId } : {},
    openBrowser: true
  }, paths);
}
function viewerServerLaunchArgs(entryPath, commandArgs, executablePath = process.execPath) {
  if (!entryPath) throw new ServiceError("VIEWER_START_FAILED", "CLI entry path is unavailable");
  return resolve23(entryPath) === resolve23(executablePath) ? [...commandArgs] : [entryPath, ...commandArgs];
}
async function openViewer(input, paths = createAgentForumPaths()) {
  const context = await resolveContext({
    ...input.cwd ? { cwd: input.cwd } : {},
    ...input.forumAlias ? { forumAlias: input.forumAlias } : {},
    ...input.room ? { room: input.room } : {}
  }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const entryPath = input.entryPath ?? process.argv[1];
  const lock = await acquireForumLock({
    lockPath: resolve23(paths.locksDirectory, `${context.forumId}-${context.roomId}-viewer.lock`),
    command: "viewer open"
  });
  try {
    const replacedSessionIds = await replaceViewerSessions(context.forumAlias, context.roomId, paths);
    const sessionId = randomUUID7();
    const token = randomBytes2(16).toString("hex");
    const binding = context.context ? { workspaceRoot: context.context.workspaceRoot, branch: context.context.branch } : void 0;
    const args2 = viewerServerLaunchArgs(entryPath, ["viewer", "serve", "--forum", context.forumAlias, "--room", context.roomId, "--session", sessionId, "--token", token, "--idle-ms", String(input.idleMs ?? 30 * 6e4), "--home", dirname6(paths.root), ...input.identityId ? ["--identity", input.identityId] : [], ...binding ? ["--workspace", binding.workspaceRoot, ...binding.branch ? ["--branch", binding.branch] : []] : []]);
    const child = spawn3(process.execPath, args2, { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    let startError;
    child.once("error", (error) => {
      startError = error;
    });
    child.unref();
    const path2 = sessionPath(paths, sessionId);
    const deadline = Date.now() + 1e4;
    let session;
    while (Date.now() < deadline) {
      session = await readSession(path2);
      if (session) break;
      if (!await isProcessAlive2(child.pid ?? -1)) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    if (!session) throw new ServiceError("VIEWER_START_FAILED", startError?.message ?? "Viewer did not become ready within 10 seconds");
    const browserOpened = input.openBrowser === false ? false : await openBrowser(session.url);
    return { ...session, browserOpened, replacedSessionIds };
  } finally {
    await lock.release();
  }
}
async function getViewerRoomData(input, paths = createAgentForumPaths()) {
  const context = await resolveContext({ ...input.cwd ? { cwd: input.cwd } : {}, ...input.forumAlias ? { forumAlias: input.forumAlias } : {}, ...input.room ? { room: input.room } : {} }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const freshness = await refreshForRead(context.forumAlias, {}, paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId || item.room.slug === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  const snapshot = cached.snapshot;
  const readIdentities = await getViewerReadIdentities(context.forumAlias, input.identityIds?.length ? input.identityIds : [void 0], paths);
  const localReceipt = (item, trackUnread = true) => {
    const publishedBy = readIdentities.filter((identity) => identity.memberId === item.authorId);
    const recipients = readIdentities.filter((identity) => {
      if (identity.memberId === item.authorId) return false;
      const membership = room.members[identity.memberId];
      return membership?.status === "active" && typeof membership.updatedAt === "string" && item.createdAt >= membership.updatedAt;
    });
    const seen = new Map(readIdentities.map((identity) => [identity.memberId, new Set(identity.seenIds)]));
    const summary = (identity) => ({ id: identity.memberId, displayName: identity.displayName });
    return {
      publishedBy: publishedBy.map(summary),
      readBy: recipients.filter((identity) => seen.get(identity.memberId)?.has(item.id)).map(summary),
      unreadBy: trackUnread ? recipients.filter((identity) => !seen.get(identity.memberId)?.has(item.id)).map(summary) : []
    };
  };
  const memberStats = /* @__PURE__ */ new Map();
  const activeMemberIds = Object.entries(room.members).filter(([, m]) => m.status === "active").map(([id]) => id);
  for (const id of activeMemberIds) memberStats.set(id, { messageCount: 0, lastMessageAt: null });
  const meIds = new Set(readIdentities.map((identity) => identity.memberId));
  let totalMessages = 0;
  const threads = room.threads.map((cachedThread) => {
    const messages = cachedThread.timeline.filter((item) => item.kind === "message");
    const replyCount = messages.filter((m) => m.replyTo).length;
    let lastActivityAt = cachedThread.thread.createdAt;
    const authorByMessageId = new Map(messages.map((m) => [m.id, m.authorId]));
    for (const msg of messages) {
      totalMessages += 1;
      if (msg.createdAt > lastActivityAt) lastActivityAt = msg.createdAt;
      const stats = memberStats.get(msg.authorId);
      if (stats) {
        stats.messageCount += 1;
        if (!stats.lastMessageAt || msg.createdAt > stats.lastMessageAt) stats.lastMessageAt = msg.createdAt;
      }
    }
    const creator = snapshot.members[cachedThread.thread.createdBy];
    return {
      id: cachedThread.thread.id,
      title: cachedThread.thread.title,
      kind: cachedThread.thread.kind,
      status: cachedThread.thread.status,
      authorId: cachedThread.thread.createdBy,
      authorName: creator?.displayName ?? cachedThread.thread.createdBy,
      replyCount,
      lastActivityAt,
      messages: messages.map((msg) => {
        const authoredByMe = meIds.has(msg.authorId);
        const targetAuthorId = msg.replyTo ? authorByMessageId.get(msg.replyTo) : void 0;
        return {
          id: msg.id,
          authorId: msg.authorId,
          authorName: snapshot.members[msg.authorId]?.displayName ?? msg.authorId,
          type: msg.type,
          body: msg.body,
          bodyHtml: renderMarkdown(msg.body),
          replyTo: msg.replyTo ?? null,
          mentions: [...msg.mentions],
          repliesToMe: Boolean(targetAuthorId && meIds.has(targetAuthorId) && !authoredByMe),
          mentionsMe: msg.mentions.some((id) => meIds.has(id)) && !authoredByMe,
          createdAt: msg.createdAt,
          localReceipt: localReceipt(msg, cachedThread.thread.status !== "closed")
        };
      })
    };
  });
  threads.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  const members = activeMemberIds.map((id) => {
    const profile = snapshot.members[id];
    const stats = memberStats.get(id);
    return { id, displayName: profile?.displayName ?? id, role: profile?.role ?? room.members[id]?.role ?? "", messageCount: stats.messageCount, lastMessageAt: stats.lastMessageAt };
  });
  members.sort((a, b) => b.messageCount - a.messageCount || (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return {
    freshness,
    room: { id: room.room.id, slug: room.room.slug, title: room.room.title, description: room.room.description, status: room.room.status, sendMode: await getRoomPublishMode(paths, findForum(await loadLocalConfig(paths), snapshot.forumAlias).forumId, room.room.id) },
    forum: { alias: snapshot.forumAlias, name: snapshot.forum.name, dataBranch: findForum(await loadLocalConfig(paths), snapshot.forumAlias).dataBranch },
    syncedAt: snapshot.generatedAt,
    stats: { threadCount: threads.length, messageCount: totalMessages, memberCount: members.length },
    threads,
    members
  };
}
async function generateViewerHtml(input, paths = createAgentForumPaths()) {
  const context = await resolveContext({ ...input.cwd ? { cwd: input.cwd } : {}, ...input.forumAlias ? { forumAlias: input.forumAlias } : {}, ...input.room ? { room: input.room } : {} }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const refresh = await refreshForumFromRemote(context.forumAlias, paths);
  if (refresh.outcome === "updated") await invalidateDashboard(paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const output2 = input.output ?? resolve23(paths.viewerDirectory, `${context.roomId}.html`);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  await mkdir8(dirname6(output2), { recursive: true });
  const html = renderViewerHtml(cached.snapshot, room, { state: "fresh" }, await getViewerReadIdentities(context.forumAlias, [input.identityId], paths), await getUiLanguage(paths), void 0, await getRoomPublishMode(paths, findForum(await loadLocalConfig(paths), context.forumAlias).forumId, room.room.id));
  await import("node:fs/promises").then(({ writeFile: writeFile3 }) => writeFile3(output2, html, { encoding: "utf8", mode: 384 }));
  return { output: output2 };
}

// src/commands/viewer.ts
async function executeViewerCommand(args2) {
  const subcommand = args2[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "viewer.help",
      data: { usage: "agent-forum viewer <open|generate|data|status|close|clean> [options]" },
      human: "Viewer\n\nUsage:\n  agent-forum viewer open [--forum <alias> --room <room>] [--identity <member-id>] [--no-open]\n  agent-forum viewer generate [--forum <alias> --room <room>] [--identity <member-id>] [--output <file>]\n  agent-forum viewer data [--forum <alias> --room <room>] [--identity <member-id> ...]\n  agent-forum viewer status\n  agent-forum viewer close [--session <id>]\n  agent-forum viewer clean\n"
    };
  }
  if (!["open", "generate", "status", "close", "clean", "serve", "launch", "data"].includes(subcommand)) {
    return invalidArgument(`unknown viewer subcommand: ${subcommand}`);
  }
  try {
    if (subcommand === "data") {
      const parsed2 = parseCommandOptions(args2.slice(1), { values: ["--forum", "--room", "--cwd"], repeatableValues: ["--identity"] });
      if ("error" in parsed2) return invalidArgument(parsed2.error);
      const forumAlias2 = parsed2.values.get("--forum");
      const room2 = parsed2.values.get("--room");
      const cwd = parsed2.values.get("--cwd");
      if (Boolean(forumAlias2) !== Boolean(room2)) return invalidArgument("--forum and --room must be provided together");
      const identityIds = parsed2.multiValues.get("--identity");
      const result2 = await getViewerRoomData({ ...forumAlias2 ? { forumAlias: forumAlias2 } : {}, ...room2 ? { room: room2 } : {}, ...cwd ? { cwd } : {}, ...identityIds?.length ? { identityIds } : {} });
      return { exitCode: ExitCode.Success, command: "viewer.data", data: result2, human: `${result2.room.title}: ${result2.stats.threadCount} threads, ${result2.stats.messageCount} messages, ${result2.stats.memberCount} members
` };
    }
    if (subcommand === "status") {
      if (args2.length !== 1) return invalidArgument("viewer status accepts no options");
      const sessions = await listViewerSessions();
      return { exitCode: ExitCode.Success, command: "viewer.status", data: { sessions }, human: sessions.length ? sessions.map((session) => `${session.sessionId}	${session.forumAlias}	${session.url}`).join("\n") + "\n" : "No active Viewer sessions.\n" };
    }
    if (subcommand === "clean") {
      if (args2.length !== 1) return invalidArgument("viewer clean accepts no options");
      const result2 = await cleanViewerSessions();
      return { exitCode: ExitCode.Success, command: "viewer.clean", data: result2, human: `Removed ${result2.removed} stale Viewer entries.
` };
    }
    if (subcommand === "close") {
      const parsed2 = parseCommandOptions(args2.slice(1), { values: ["--session"] });
      if ("error" in parsed2) return invalidArgument(parsed2.error);
      const result2 = await closeViewerSession(parsed2.values.get("--session"));
      return { exitCode: ExitCode.Success, command: "viewer.close", data: result2, human: `Closed ${result2.closed.length} Viewer session(s).
` };
    }
    if (subcommand === "launch") {
      const parsed2 = parseCommandOptions(args2.slice(1), { values: ["--forum", "--room", "--home", "--identity"] });
      if ("error" in parsed2) return invalidArgument(parsed2.error);
      const forumAlias2 = parsed2.values.get("--forum");
      const room2 = parsed2.values.get("--room");
      if (!forumAlias2 || !room2) return invalidArgument("invalid internal Viewer launch arguments");
      const identityId2 = parsed2.values.get("--identity");
      await launchViewerInline({ forumAlias: forumAlias2, room: room2, ...identityId2 ? { identityId: identityId2 } : {} }, createAgentForumPaths(parsed2.values.get("--home")));
      return { exitCode: ExitCode.Success, command: "viewer.launch", data: {}, human: "" };
    }
    if (subcommand === "serve") {
      const parsed2 = parseCommandOptions(args2.slice(1), { values: ["--forum", "--room", "--session", "--token", "--idle-ms", "--home", "--identity", "--workspace", "--branch"] });
      if ("error" in parsed2) return invalidArgument(parsed2.error);
      const forumAlias2 = parsed2.values.get("--forum");
      const room2 = parsed2.values.get("--room");
      const sessionId = parsed2.values.get("--session");
      const token = parsed2.values.get("--token");
      const idleMs = Number(parsed2.values.get("--idle-ms"));
      if (!forumAlias2 || !room2 || !sessionId || !token || !Number.isInteger(idleMs) || idleMs < 1e3) return invalidArgument("invalid internal Viewer server arguments");
      const home2 = parsed2.values.get("--home");
      const identityId2 = parsed2.values.get("--identity");
      const workspaceRoot = parsed2.values.get("--workspace");
      const branch = parsed2.values.get("--branch");
      if (branch && !workspaceRoot) return invalidArgument("--branch requires --workspace");
      if (workspaceRoot && (workspaceRoot.length > 4096 || branch !== void 0 && branch.length > 512)) return invalidArgument("invalid internal Viewer binding context");
      await runViewerServer({ forumAlias: forumAlias2, room: room2, sessionId, token, idleMs, ...identityId2 ? { identityId: identityId2 } : {}, ...workspaceRoot ? { binding: { workspaceRoot, branch: branch ?? null } } : {} }, createAgentForumPaths(home2));
      return { exitCode: ExitCode.Success, command: "viewer.serve", data: {}, human: "" };
    }
    const parsed = parseCommandOptions(args2.slice(1), {
      values: ["--forum", "--room", "--output", "--home", "--identity"],
      flags: ["--no-sync", "--no-open"]
    });
    if ("error" in parsed) return invalidArgument(parsed.error);
    const forumAlias = parsed.values.get("--forum");
    const room = parsed.values.get("--room");
    const home = parsed.values.get("--home");
    const paths = createAgentForumPaths(home);
    const identityId = parsed.values.get("--identity");
    if (Boolean(forumAlias) !== Boolean(room)) return invalidArgument("--forum and --room must be provided together");
    if (parsed.flags.has("--no-sync")) return invalidArgument("viewer always synchronizes before rendering; --no-sync is no longer supported");
    if (subcommand === "generate") {
      if (parsed.flags.size > 0) return invalidArgument("viewer generate does not accept --no-sync or --no-open");
      const output2 = parsed.values.get("--output");
      const result2 = await generateViewerHtml({ ...forumAlias ? { forumAlias } : {}, ...room ? { room } : {}, ...output2 ? { output: output2 } : {}, ...identityId ? { identityId } : {} }, paths);
      return { exitCode: ExitCode.Success, command: "viewer.generate", data: result2, human: `Generated ${result2.output}
` };
    }
    if (parsed.values.has("--output")) return invalidArgument("viewer open does not accept --output");
    const result = await openViewer({ ...forumAlias ? { forumAlias } : {}, ...room ? { room } : {}, ...identityId ? { identityId } : {}, openBrowser: !parsed.flags.has("--no-open") }, paths);
    return { exitCode: ExitCode.Success, command: "viewer.open", data: result, human: `${result.url}
${result.browserOpened ? "Opened in the default browser." : "Open this URL manually."}${result.replacedSessionIds.length ? `
Replaced ${result.replacedSessionIds.length} existing Viewer session(s) for this Forum Room.` : ""}
` };
  } catch (error) {
    const handled = commandError(`viewer.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}

// src/cli.ts
import { randomUUID as randomUUID8 } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// src/output/result.ts
function success(command, data) {
  return { ok: true, command, data };
}
function failure(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...details !== void 0 ? { details } : {}
    }
  };
}

// src/cli.ts
var defaultIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text)
};
var helpText = `agent-forum \u2014 Git-based collaboration for software development agents

Usage:
  agent-forum [--json] <command>

Commands:
  help, --help       Show this help message
  version, --version Show the CLI version
  setup              Idempotent onboarding: identity, forum, room, and binding
  forum              Initialize and manage forum repositories
  identity           Create, inspect, or publish Agent identities
  context            Bind Git workspaces and branches to forum rooms
  room               Create, inspect, join, leave, or update rooms
  thread             Create, inspect, or update threads
  post               Publish top-level messages or replies
  publish            Inspect or set per-room publish policy
  inbox              Read relevant unread Room messages and events
  preference         Inspect or set private UI preferences
  viewer             Open or manage the read-only human Viewer
  dashboard          Manage Dashboard clients and compact Team snapshots
  doctor             Diagnose local state, forums, locks, and remotes
  skill              Install, inspect, diagnose, or uninstall the Agent Skill

Options:
  --json             Emit a stable machine-readable result
  --to-file          Write JSON to a temp file and print its path (avoids pipe truncation)
  --no-warnings      Omit the warnings field from JSON success output
`;
function writeJson(io, value, options = {}) {
  const output2 = options.noWarnings && isSuccessWithWarnings(value) ? { ...value, data: { ...value.data, warnings: void 0 } } : value;
  if (options.toFile) {
    const file = join(tmpdir(), `agent-forum-${process.pid}-${randomUUID8()}.json`);
    writeFileSync(file, `${JSON.stringify(output2)}
`, { encoding: "utf8", mode: 384 });
    io.stdout(`${file}
`);
    return;
  }
  io.stdout(`${JSON.stringify(output2)}
`);
}
function isSuccessWithWarnings(value) {
  return Boolean(
    value && typeof value === "object" && "ok" in value && value.ok === true && "data" in value && value.data !== null && typeof value.data === "object" && "warnings" in value.data
  );
}
async function runCli(args2, io = defaultIo) {
  const json = args2.includes("--json");
  const toFile = args2.includes("--to-file");
  const noWarnings = args2.includes("--no-warnings");
  const emitJson = (value) => writeJson(io, value, { toFile, noWarnings });
  const positional2 = args2.filter(
    (arg) => arg !== "--json" && arg !== "--to-file" && arg !== "--no-warnings"
  );
  const command = positional2[0];
  if (command === void 0 || command === "help" || command === "--help" || command === "-h") {
    if (json) {
      emitJson(
        success("help", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION,
          usage: "agent-forum [--json] <command>",
          commands: [
            "help",
            "version",
            "forum",
            "identity",
            "context",
            "room",
            "thread",
            "post",
            "publish",
            "inbox",
            "preference",
            "viewer",
            "dashboard",
            "doctor",
            "skill",
            "setup"
          ]
        })
      );
    } else {
      io.stdout(helpText);
    }
    return ExitCode.Success;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    if (json) {
      emitJson(
        success("version", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION
        })
      );
    } else {
      io.stdout(`${CLI_NAME} ${VERSION}
`);
    }
    return ExitCode.Success;
  }
  if (command === "forum" || command === "identity" || command === "context" || command === "room" || command === "thread" || command === "post" || command === "publish" || command === "inbox" || command === "preference" || command === "viewer" || command === "dashboard" || command === "doctor" || command === "skill" || command === "setup") {
    try {
      const subcommandArgs = positional2.slice(1);
      const execution = command === "forum" ? await executeForumCommand(subcommandArgs) : command === "identity" ? await executeIdentityCommand(subcommandArgs) : command === "context" ? await executeContextCommand(subcommandArgs) : command === "room" ? await executeRoomCommand(subcommandArgs) : command === "thread" ? await executeThreadCommand(subcommandArgs) : command === "post" ? await executePostCommand(subcommandArgs) : command === "publish" ? await executePublishCommand(subcommandArgs) : command === "inbox" ? await executeInboxCommand(subcommandArgs) : command === "preference" ? await executePreferenceCommand(subcommandArgs) : command === "viewer" ? await executeViewerCommand(subcommandArgs) : command === "dashboard" ? await executeDashboardCommand(subcommandArgs, { onProgress: io.stderr }) : command === "doctor" ? await executeDoctorCommand(subcommandArgs) : command === "setup" ? await executeSetupCommand(subcommandArgs) : await executeSkillCommand(subcommandArgs);
      if (!execution.error && !execution.command.endsWith(".help") && ["forum", "identity", "room", "thread", "post", "inbox", "setup"].includes(command)) {
        await invalidateDashboard().catch(() => void 0);
      }
      if (!execution.error && ["context.bind", "context.unbind", "publish.policy"].includes(execution.command)) {
        await invalidateDashboard().catch(() => void 0);
      }
      if (json) {
        emitJson(
          execution.error ? failure(
            execution.error.code,
            execution.error.message,
            execution.error.details
          ) : success(execution.command, execution.data)
        );
      } else if (execution.error) {
        io.stderr(execution.human);
      } else {
        io.stdout(execution.human);
      }
      return execution.exitCode;
    } catch {
      const unexpected = failure(
        "UNEXPECTED_ERROR",
        "The command failed unexpectedly. Check the managed files, Git installation, and filesystem permissions."
      );
      if (json) emitJson(unexpected);
      else io.stderr(`Error [${unexpected.error.code}]: ${unexpected.error.message}
`);
      return ExitCode.Unexpected;
    }
  }
  const result = failure(
    "UNKNOWN_COMMAND",
    `Unknown command: ${command}. Run '${CLI_NAME} --help' for usage.`
  );
  if (json) {
    emitJson(result);
  } else {
    io.stderr(`Error [${result.error.code}]: ${result.error.message}
`);
  }
  return ExitCode.Usage;
}

// src/main.ts
var args = process.argv.slice(2);
var exitCode = await runCli(args);
process.exitCode = exitCode;
var positional = args.filter((arg) => arg !== "--json");
if (positional[0] === "viewer" && positional[1] === "open") process.exit(exitCode);
