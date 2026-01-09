var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-XsgUMh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-XsgUMh/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === "/" && request.method === "GET") {
        return new Response("LineChat Backend is Running!", { status: 200, headers: corsHeaders });
      } else if (path === "/register" && request.method === "POST") {
        return await handleRegister(request, env);
      } else if (path === "/upload" && request.method === "POST") {
        return await handleMediaUpload(request, env);
      } else if (path.startsWith("/media/") && request.method === "GET") {
        const id = path.split("/").pop();
        if (!id)
          return new Response("Missing ID", { status: 400 });
        return await handleMediaDownload(id, env);
      } else if (path === "/send" && request.method === "POST") {
        return await handleSendMessage(request, env);
      } else if (path === "/sync" && request.method === "GET") {
        return await handleSyncMessages(request, env);
      } else if (path === "/admin/generate-key" && request.method === "POST") {
        return await handleGenerateKey(request, env);
      } else if (path === "/admin/stats" && request.method === "GET") {
        return await handleGetStats(request, env);
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
  },
  async scheduled(event, env, ctx) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1e3;
    await env.DB.prepare("DELETE FROM MediaPayloads WHERE created_at < ?").bind(oneDayAgo).run();
    console.log("Cleanup run complete");
  }
};
async function handleRegister(request, env) {
  const { key, username, password } = await request.json();
  if (!key || !username || !password) {
    return new Response("Missing fields", { status: 400 });
  }
  const accessKey = await env.DB.prepare("SELECT * FROM AccessKeys WHERE key_string = ?").bind(key).first();
  if (!accessKey) {
    return new Response("Invalid Key", { status: 403 });
  }
  if (accessKey.is_used) {
    return new Response("Key Already Used", { status: 403 });
  }
  try {
    const result = await env.DB.prepare("INSERT INTO Users (username, password_hash) VALUES (?, ?)").bind(username, password).run();
    if (!result.success) {
      throw new Error("Failed to create user");
    }
    const userId = result.meta.last_row_id;
    const updateResult = await env.DB.prepare("UPDATE AccessKeys SET is_used = 1, claimed_by_user_id = ? WHERE key_string = ? AND is_used = 0").bind(userId, key).run();
    if (updateResult.meta.changes === 0) {
      await env.DB.prepare("DELETE FROM Users WHERE id = ?").bind(userId).run();
      return new Response("Invalid or Expired Key (Race Condition)", { status: 403 });
    }
    return new Response(JSON.stringify({ success: true, userId }), { status: 200 });
  } catch (e) {
    return new Response("Registration Failed: " + e.message, { status: 500 });
  }
}
__name(handleRegister, "handleRegister");
async function handleMediaUpload(request, env) {
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > 1024 * 1024 * 5) {
    return new Response("File too large", { status: 413 });
  }
  const result = await env.DB.prepare("INSERT INTO MediaPayloads (file_data, mime_type, created_at) VALUES (?, ?, ?)").bind(arrayBuffer, contentType, Date.now()).run();
  if (result.success) {
    return new Response(JSON.stringify({ mediaId: result.meta.last_row_id }), { status: 200 });
  } else {
    return new Response("Upload Failed", { status: 500 });
  }
}
__name(handleMediaUpload, "handleMediaUpload");
async function handleMediaDownload(id, env) {
  const result = await env.DB.prepare("SELECT file_data, mime_type FROM MediaPayloads WHERE id = ?").bind(id).first();
  if (!result || !result.file_data) {
    return new Response("Media Not Found", { status: 404 });
  }
  return new Response(result.file_data, {
    headers: { "Content-Type": result.mime_type }
  });
}
__name(handleMediaDownload, "handleMediaDownload");
async function handleSendMessage(request, env) {
  const { sender_id, receiver_id, text_content, media_id_ref } = await request.json();
  const result = await env.DB.prepare("INSERT INTO Messages (sender_id, receiver_id, text_content, media_id_ref, timestamp) VALUES (?, ?, ?, ?, ?)").bind(sender_id, receiver_id, text_content, media_id_ref, Date.now()).run();
  return new Response(JSON.stringify({ success: result.success }), { status: 200 });
}
__name(handleSendMessage, "handleSendMessage");
async function handleSyncMessages(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const lastTimestamp = url.searchParams.get("after") || 0;
  if (!userId)
    return new Response("User ID required", { status: 400 });
  const messages = await env.DB.prepare(
    "SELECT * FROM Messages WHERE (sender_id = ? OR receiver_id = ?) AND timestamp > ? ORDER BY timestamp ASC"
  ).bind(userId, userId, lastTimestamp).all();
  return new Response(JSON.stringify(messages.results));
}
__name(handleSyncMessages, "handleSyncMessages");
async function handleGenerateKey(request, env) {
  const key = "KEY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  await env.DB.prepare("INSERT INTO AccessKeys (key_string) VALUES (?)").bind(key).run();
  return new Response(JSON.stringify({ key }));
}
__name(handleGenerateKey, "handleGenerateKey");
async function handleGetStats(request, env) {
  const result = await env.DB.prepare("SELECT COUNT(*) as count FROM Users").first();
  const count = result?.count || 0;
  return new Response(JSON.stringify({ userCount: count }));
}
__name(handleGetStats, "handleGetStats");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-XsgUMh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-XsgUMh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
