import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDiscordCredentials } from "@/lib/discord-credentials";

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const fileRecord = await prisma.file.findUnique({
      where: { id },
      include: { chunks: { orderBy: { partNumber: "asc" } } }
    });
    if (!fileRecord) return new NextResponse("File not found", { status: 404 });

    const { token } = getDiscordCredentials(request);
    const channelId = fileRecord.discordMessageId;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const chunk of fileRecord.chunks) {
            const msgRes = await fetch(
              `https://discord.com/api/v10/channels/${channelId}/messages/${chunk.discordMessageId}`,
              { headers: { Authorization: `Bot ${token}` } }
            );
            if (!msgRes.ok) { console.error(`Message fetch failed: ${msgRes.status}`); continue; }

            const msgData = await msgRes.json();
            if (msgData.attachments?.[0]) {
              const attRes = await fetch(msgData.attachments[0].url);
              if (attRes.ok && attRes.body) {
                const reader = attRes.body.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              }
            }
          }
        } catch (err) { controller.error(err); }
        finally { controller.close(); }
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileRecord.filename.split("/").pop()}"`,
        "Content-Type": "application/octet-stream",
      }
    });
  } catch (err) {
    console.error("Download error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
