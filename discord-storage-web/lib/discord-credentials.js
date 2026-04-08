/** Read Discord credentials from request headers (user-supplied) or fall back to .env */
export function getDiscordCredentials(request) {
  const token     = request.headers.get("X-Discord-Token")      || process.env.DISCORD_TOKEN;
  const channelId = request.headers.get("X-Discord-Channel-Id") || process.env.DISCORD_CHANNEL_ID;
  return { token, channelId };
}
