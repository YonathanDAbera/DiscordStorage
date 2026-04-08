import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderPath = searchParams.get("path");

  if (!folderPath) {
    return new NextResponse("Missing path parameter", { status: 400 });
  }

  const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
  const prefix = `${folderPath}/`;

  try {
    // Find all files in this folder (and subfolders)
    const files = await prisma.file.findMany({
      where: { filename: { startsWith: prefix } },
      include: { chunks: { orderBy: { partNumber: "asc" } } }
    });

    if (files.length === 0) {
      return new NextResponse("Folder not found or empty", { status: 404 });
    }

    const zip = new JSZip();

    for (const fileRecord of files) {
      const channelId = fileRecord.discordMessageId;
      const buffers = [];

      for (const chunk of fileRecord.chunks) {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages/${chunk.discordMessageId}`,
          { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
        );

        if (!msgRes.ok) {
          console.error(`Failed to fetch message ${chunk.discordMessageId}: ${msgRes.status}`);
          continue;
        }

        const msgData = await msgRes.json();
        if (msgData.attachments?.length > 0) {
          const attachRes = await fetch(msgData.attachments[0].url);
          if (attachRes.ok) {
            buffers.push(await attachRes.arrayBuffer());
          }
        }
      }

      // Merge chunk buffers into one
      const total = buffers.reduce((acc, b) => acc + b.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const buf of buffers) {
        merged.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      // Store with relative path inside the ZIP (strip the folder prefix)
      const relativePath = fileRecord.filename.slice(prefix.length);
      zip.file(relativePath, merged);
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const folderName = folderPath.split("/").pop();

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${folderName}.zip"`,
        "Content-Type": "application/zip",
        "Content-Length": zipBuffer.length.toString()
      }
    });
  } catch (err) {
    console.error("Folder download error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
