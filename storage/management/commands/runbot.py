from django.core.management.base import BaseCommand
from django.conf import settings
import discord
from discord import Intents, Client, Message
import asyncio
from storage.models import UploadedFile

class Command(BaseCommand):
    help = 'Run the Discord bot'

    def handle(self, *args, **options):
        """Run the Discord bot as a Django management command"""
        
        # Bot setup
        intents = Intents.default()
        intents.guilds = True
        intents.message_content = True
        client = Client(intents=intents)

        @client.event
        async def on_ready():
            self.stdout.write(
                self.style.SUCCESS(f'{client.user} has connected to Discord!')
            )

        @client.event
        async def on_message(message: Message):
            # Ignore messages from the bot itself
            if message.author == client.user:
                return
            
            # Only respond in DMs or when mentioned
            if not isinstance(message.channel, discord.DMChannel) and not client.user.mentioned_in(message):
                return
            
            content = message.content.lower()
            
            try:
                if 'upload' in content:
                    await self.handle_upload_command(message)
                elif 'download' in content:
                    await self.handle_download_command(message)
                elif 'list' in content or 'files' in content:
                    await self.handle_list_command(message)
                elif 'help' in content:
                    await self.handle_help_command(message)
                else:
                    await message.reply("Type 'help' for available commands.")
            
            except Exception as e:
                await message.reply(f"An error occurred: {str(e)}")
                self.stdout.write(self.style.ERROR(f"Error: {e}"))

        try:
            client.run(settings.DISCORD_TOKEN)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('Bot stopped.'))

    async def handle_upload_command(self, message):
        """Handle upload command"""
        embed = discord.Embed(
            title="File Upload",
            description="Use the web interface to upload files:",
            color=0x00ff00
        )
        embed.add_field(
            name="Upload URL", 
            value="http://127.0.0.1:8000/upload/", 
            inline=False
        )
        await message.reply(embed=embed)

    async def handle_download_command(self, message):
        """Handle download command"""
        files = UploadedFile.objects.all()[:5]
        
        if not files:
            await message.reply("No files available.")
            return
        
        embed = discord.Embed(
            title="Recent Files",
            description="Visit the download page:",
            color=0x0099ff
        )
        
        for file in files:
            embed.add_field(
                name=file.original_filename,
                value=f"{file.file_size // 1024}KB",
                inline=True
            )
        
        embed.add_field(
            name="Download URL",
            value="http://127.0.0.1:8000/download/",
            inline=False
        )
        
        await message.reply(embed=embed)

    async def handle_list_command(self, message):
        """List files"""
        files = UploadedFile.objects.all()[:10]
        
        if not files:
            await message.reply("No files stored.")
            return
        
        file_list = "\n".join([
            f"• {file.original_filename}"
            for file in files
        ])
        
        embed = discord.Embed(
            title="Stored Files",
            description=file_list,
            color=0xffff00
        )
        
        await message.reply(embed=embed)

    async def handle_help_command(self, message):
        """Show help"""
        embed = discord.Embed(
            title="Commands",
            description="Available commands:",
            color=0xff9900
        )
        
        embed.add_field(name="upload", value="Upload instructions", inline=False)
        embed.add_field(name="download", value="Download links", inline=False)
        embed.add_field(name="list", value="List files", inline=False)
        embed.add_field(name="help", value="This message", inline=False)
        
        await message.reply(embed=embed)
