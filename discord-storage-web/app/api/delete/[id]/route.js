import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDiscordCredentials } from "@/lib/discord-credentials";

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const fileRecord = await prisma.file.findUnique({ where: { id } });
    if (!fileRecord) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const { token, channelId: mainChannelId } = getDiscordCredentials(request);

    if (fileRecord.discordMessageId && fileRecord.discordMessageId !== mainChannelId) {
      const res = await fetch(`https://discord.com/api/v10/channels/${fileRecord.discordMessageId}`,
        { method: "DELETE", headers: { Authorization: `Bot ${token}` } });
      if (!res.ok && res.status !== 404) console.error("Thread delete failed:", await res.text());
    } else if (fileRecord.discordMessageId === mainChannelId) {
      const withChunks = await prisma.file.findUnique({ where: { id }, include: { chunks: true } });
      if (withChunks?.chunks?.length) {
        await Promise.allSettled(withChunks.chunks.map(c =>
          fetch(`https://discord.com/api/v10/channels/${mainChannelId}/messages/${c.discordMessageId}`,
            { method: "DELETE", headers: { Authorization: `Bot ${token}` } })
        ));
      }
    }

    await prisma.file.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
