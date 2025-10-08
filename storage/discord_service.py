import discord
from discord import Intents, Client, File
from discord.errors import LoginFailure
import os
import re
from django.conf import settings
from .models import UploadedFile, FilePart
from splitter import split_files, merge_files
import tempfile
import asyncio
from asgiref.sync import sync_to_async

class DiscordService:
    def __init__(self):
        self.client = None

    def rename_file(self, file_path: str) -> str:
        directory, original_name = os.path.split(file_path)
        name, extension = os.path.splitext(original_name)
        changed_name = re.sub(r'[^\w.]', '_', name)
        new_name = f"{changed_name}{extension}"
        new_path = os.path.join(directory, new_name)
        os.rename(file_path, new_path)
        return new_path
        
    async def upload_file_from_path(self, file_path: str, file_record: UploadedFile, token: str):
        """Upload a file from a path using a robust, self-contained client session."""
        intents = Intents.default()
        intents.guilds = True
        client = Client(intents=intents)

        try:
            # Use async with to ensure the client is logged in and properly closed.
            async with client:
                await client.login(token)
                
                # Get guild
                guild = await client.fetch_guild(int(settings.SERVER_ID))
                if not guild:
                    raise Exception("Could not access Discord server")

                # Create Discord channel
                channel_name = file_record.discord_channel_name
                new_channel = await guild.create_text_channel(name=channel_name)
                
                # Update database with channel ID
                file_record.discord_channel_id = str(new_channel.id)
                await sync_to_async(file_record.save)()

                # Handle splitting for large files
                if file_record.file_size > settings.SIZE_LIMIT:
                    split_files(file_path, settings.SIZE_LIMIT, str(settings.TEMP_DIRECTORY))
                    files_to_upload = [settings.TEMP_DIRECTORY / f for f in sorted(os.listdir(settings.TEMP_DIRECTORY))]
                    file_record.split_count = len(files_to_upload)
                    await sync_to_async(file_record.save)()
                else:
                    files_to_upload = [file_path]

                # Upload files to Discord
                for i, part_path in enumerate(files_to_upload):
                    with open(part_path, 'rb') as f:
                        filename = os.path.basename(part_path) if len(files_to_upload) > 1 else file_record.original_filename
                        discord_file = File(f, filename=filename)
                        message = await new_channel.send(f"📎 Part {i+1}/{len(files_to_upload)}:", file=discord_file)
                    
                    # Create FilePart record
                    await sync_to_async(FilePart.objects.create)(
                        uploaded_file=file_record,
                        part_number=i + 1,
                        discord_message_id=str(message.id),
                        part_filename=filename
                    )
                    
                    # Clean up split files (but not the original temp file)
                    if str(part_path) != file_path:
                        os.remove(str(part_path))
        except LoginFailure:
            raise Exception("Improper token has been passed.")
            
    async def upload_file(self, uploaded_file, file_record: UploadedFile):
        """Upload a file to Discord using the proven working pattern"""
        
        # Save uploaded file temporarily first
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_record.file_extension) as temp_file:
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name
        
        try:
            await self._perform_upload(file_record, source_path=temp_file_path)
        finally:
            # Clean up original temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    
    async def download_file(self, file_record: UploadedFile, token: str):
        """Download a file from Discord using the working pattern"""
        client = Client(intents=Intents.default())
        download_completed = False
        download_error = None
        result_path = None
        
        @client.event
        async def on_ready():
            nonlocal download_completed, download_error, result_path
            try:
                guild = client.get_guild(int(settings.SERVER_ID))
                channel = guild.get_channel(int(file_record.discord_channel_id))
                
                if not channel:
                    raise Exception("Discord channel not found")
                
                # Download all file parts
                messages = [message async for message in channel.history(limit=None)]
                
                for part in file_record.parts.all():
                    for message in messages:
                        if str(message.id) == part.discord_message_id:
                            for attachment in message.attachments:
                                await attachment.save(settings.TEMP_DIRECTORY / attachment.filename)
                            break
                
                # Merge files if split
                if file_record.is_split:
                    output_path = settings.OUTPUT_DIRECTORY / file_record.original_filename
                    merge_files(
                        str(settings.TEMP_DIRECTORY),
                        str(settings.OUTPUT_DIRECTORY),
                        file_record.original_filename
                    )
                    
                    # Clean up temporary files
                    for part in file_record.parts.all():
                        temp_file = settings.TEMP_DIRECTORY / part.part_filename
                        if temp_file.exists():
                            os.remove(temp_file)
                            
                    result_path = output_path
                else:
                    # Single file
                    part = file_record.parts.first()
                    temp_file = settings.TEMP_DIRECTORY / part.part_filename
                    output_file = settings.OUTPUT_DIRECTORY / file_record.original_filename
                    import shutil
                    shutil.move(temp_file, output_file)
                    result_path = output_file
                
                download_completed = True
                        
            except Exception as e:
                download_error = e
                download_completed = True
            finally:
                await client.close()
        
        try:
            await client.start(token)
        except Exception as e:
            if not download_completed:
                raise e
        
        if download_error:
            raise download_error

        return result_path
    
    async def delete_file(self, file_record: UploadedFile, token: str):
        """Delete a file from Discord using the working pattern"""
        client = Client(intents=Intents.default())
        delete_completed = False
        delete_error = None
        
        @client.event
        async def on_ready():
            nonlocal delete_completed, delete_error
            try:
                guild = client.get_guild(int(settings.SERVER_ID))
                channel = guild.get_channel(int(file_record.discord_channel_id))
                
                if channel:
                    await channel.delete()
                
                delete_completed = True
                        
            except Exception as e:
                delete_error = e
                delete_completed = True
            finally:
                await client.close()
        
        try:
            await client.start(token)
        except Exception as e:
            if not delete_completed:
                raise e
        
        if delete_error:
            raise delete_error
