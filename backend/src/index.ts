export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
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
        if (!id) return new Response("Missing ID", { status: 400 });
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
    } catch (e: any) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Auto-Cleanup: Delete rows > 24 hours old
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    await env.DB.prepare("DELETE FROM MediaPayloads WHERE created_at < ?").bind(oneDayAgo).run();
    console.log("Cleanup run complete");
  },
};

// --- Handlers ---

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { key, username, password } = await request.json() as any;

  if (!key || !username || !password) {
    return new Response("Missing fields", { status: 400 });
  }

  // Atomic Invite System
  const accessKey = await env.DB.prepare("SELECT * FROM AccessKeys WHERE key_string = ?").bind(key).first();

  if (!accessKey) {
    return new Response("Invalid Key", { status: 403 });
  }
  if (accessKey.is_used) {
    return new Response("Key Already Used", { status: 403 });
  }

  // Inserting User and Updating Key Transactionally could be done with batch, 
  // but D1 batch doesn't easily support using the result of one insert in the next update in a single round-trip without stored procedures (which D1 lacks).
  // However, we can Optimistically lock or just do strict sequential checks.
  // Ideally, 'is_used' check should be part of the final update condition to ensure atomicity.

  try {
    // 1. Create User
    const result = await env.DB.prepare("INSERT INTO Users (username, password_hash) VALUES (?, ?)").bind(username, password).run();

    if (!result.success) {
      throw new Error("Failed to create user");
    }

    // Get the new user ID (SQLite last_insert_rowid equivalent logic needed if not returned, usually result.meta.last_row_id)
    const userId = result.meta.last_row_id;

    // 2. Mark Key as Used ATOMICALLY (Only if it is still unused)
    const updateResult = await env.DB.prepare("UPDATE AccessKeys SET is_used = 1, claimed_by_user_id = ? WHERE key_string = ? AND is_used = 0")
      .bind(userId, key)
      .run();

    if (updateResult.meta.changes === 0) {
      // Race condition detected! Rollback user creation (manual rollback since no multi-statement transaction block in this simplified logic)
      await env.DB.prepare("DELETE FROM Users WHERE id = ?").bind(userId).run();
      return new Response("Invalid or Expired Key (Race Condition)", { status: 403 });
    }

    return new Response(JSON.stringify({ success: true, userId: userId }), { status: 200 });

  } catch (e: any) {
    return new Response("Registration Failed: " + e.message, { status: 500 });
  }
}

async function handleMediaUpload(request: Request, env: Env): Promise<Response> {
  // Assuming raw body is the image for simplicity or multipart. 
  // Requirement says: "Android compresses image -> Worker saves binary"
  // Let's assume the body IS the binary data.

  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  const arrayBuffer = await request.arrayBuffer();

  if (arrayBuffer.byteLength > 1024 * 1024 * 5) { // 5MB Limit safety
    return new Response("File too large", { status: 413 });
  }

  const result = await env.DB.prepare("INSERT INTO MediaPayloads (file_data, mime_type, created_at) VALUES (?, ?, ?)")
    .bind(arrayBuffer, contentType, Date.now())
    .run();

  if (result.success) {
    return new Response(JSON.stringify({ mediaId: result.meta.last_row_id }), { status: 200 });
  } else {
    return new Response("Upload Failed", { status: 500 });
  }
}

async function handleMediaDownload(id: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare("SELECT file_data, mime_type FROM MediaPayloads WHERE id = ?").bind(id).first();

  if (!result || !result.file_data) {
    return new Response("Media Not Found", { status: 404 });
  }

  // Convert number array back to Uint8Array if D1 returns it that way, 
  // but usually D1 client returns ArrayBuffer or Array for Blob.
  // Note: In Cloudflare Workers D1, BLOBs are returned as ArrayBuffers (or Arrays of numbers depending on driver).
  // We assume standard ArrayBuffer compatible response.

  return new Response(result.file_data as any, {
    headers: { "Content-Type": result.mime_type as string }
  });
}

async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  const { sender_id, receiver_id, text_content, media_id_ref } = await request.json() as any;

  // Privacy Wall: Admin Constraints checking would go here (omitted for brevity)

  const result = await env.DB.prepare("INSERT INTO Messages (sender_id, receiver_id, text_content, media_id_ref, timestamp) VALUES (?, ?, ?, ?, ?)")
    .bind(sender_id, receiver_id, text_content, media_id_ref, Date.now())
    .run();

  return new Response(JSON.stringify({ success: result.success }), { status: 200 });
}

async function handleSyncMessages(request: Request, env: Env): Promise<Response> {
  // Simplified sync
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const lastTimestamp = url.searchParams.get("after") || 0;

  if (!userId) return new Response("User ID required", { status: 400 });

  const messages = await env.DB.prepare(
    "SELECT * FROM Messages WHERE (sender_id = ? OR receiver_id = ?) AND timestamp > ? ORDER BY timestamp ASC"
  ).bind(userId, userId, lastTimestamp).all();

  return new Response(JSON.stringify(messages.results));
}

async function handleGenerateKey(request: Request, env: Env): Promise<Response> {
  // In a real app, verify Admin Auth here.
  const key = "KEY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  await env.DB.prepare("INSERT INTO AccessKeys (key_string) VALUES (?)").bind(key).run();
  return new Response(JSON.stringify({ key }));
}

async function handleGetStats(request: Request, env: Env): Promise<Response> {
  const result = await env.DB.prepare("SELECT COUNT(*) as count FROM Users").first();
  const count = result?.count || 0;
  return new Response(JSON.stringify({ userCount: count }));
}
