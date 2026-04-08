import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDiscordCredentials } from "@/lib/discord-credentials";

// Discord fetch with automatic retry on 429 rate-limit responses
async function discordFetch(url, options, maxRetries = 4) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      let wait = 2000; // default 2s
      try {
        const body = await res.clone().json();
        wait = Math.ceil((body.retry_after || 2) * 1000);
      } catch {}
      console.warn(`Discord rate limited — retrying in ${wait}ms (attempt ${attempt + 1})`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("Discord rate limit exceeded after max retries");
}

export async function POST(request) {
  try {
    const formData   = await request.formData();
    const fileBlob   = formData.get("file");
    const filename   = formData.get("filename");
    const size       = parseInt(formData.get("size")        || "0");
    const chunkIndex = parseInt(formData.get("chunkIndex")  || "0");
    const totalChunks= parseInt(formData.get("totalChunks") || "1");
    const isEncrypted= formData.get("encrypted") === "true";
    let fileId   = formData.get("fileId");
    let threadId = formData.get("threadId");

    if (!fileBlob || !filename) {
      return NextResponse.json({ error: "Missing file or filename" }, { status: 400 });
    }

    const { token, channelId } = getDiscordCredentials(request);
    if (!token || !channelId) {
      return NextResponse.json({ error: "Discord credentials not configured" }, { status: 500 });
    }

    if (chunkIndex === 0) {
      // Use just the basename for the thread name (max 100 chars)
      const threadName = (filename.split("/").pop() || filename).slice(0, 100);

      const threadRes = await discordFetch(
        `https://discord.com/api/v10/channels/${channelId}/threads`,
        {
          method: "POST",
          headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: threadName, type: 11, auto_archive_duration: 1440 })
        }
      );

      if (!threadRes.ok) {
        const err = await threadRes.text();
        console.error("Failed to create thread:", err);
        return NextResponse.json({ error: "Failed to create Discord thread", details: err }, { status: 500 });
      }

      threadId = (await threadRes.json()).id;

      const newFile = await prisma.file.create({
        data: {
          filename,
          size,
          discordMessageId: threadId,
          isSplit: totalChunks > 1,
          chunkCount: totalChunks,
          encrypted: isEncrypted,
          extension: filename.includes(".") ? filename.split(".").pop().toLowerCase().slice(0, 20) : ""
        }
      });
      fileId = newFile.id;
    }

    const fd = new FormData();
    fd.append("file", fileBlob, `${filename.split("/").pop()}.part${chunkIndex + 1}`);

    const uploadRes = await discordFetch(
      `https://discord.com/api/v10/channels/${threadId}/messages`,
      { method: "POST", headers: { Authorization: `Bot ${token}` }, body: fd }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("Discord chunk upload failed:", err);
      return NextResponse.json({ error: "Discord chunk upload failed", details: err }, { status: 500 });
    }

    const messageId = (await uploadRes.json()).id;
    await prisma.fileChunk.create({ data: { fileId, partNumber: chunkIndex + 1, discordMessageId: messageId } });

    return NextResponse.json({ success: true, fileId, threadId, messageId, chunkIndex });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
