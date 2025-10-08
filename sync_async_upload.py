#!/usr/bin/env python
"""
Upload script with proper sync/async separation
"""
import os
import sys
import django
import asyncio
import json
from pathlib import Path
from contextlib import suppress

# Setup Django
sys.path.append('/Users/yabera/Desktop/DiscordStorage')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'discordstorage.settings')
django.setup()

from django.conf import settings
import discord
from discord.errors import LoginFailure
from discord import Intents, Client, File
from storage.models import UploadedFile, FilePart
from splitter import split_files

def sync_upload_process(file_record_id, file_path, token: str):
    """Synchronous wrapper for the upload process"""
    try:
        # Get file record synchronously
        file_record = UploadedFile.objects.get(id=file_record_id)

        # Run Discord upload in async context
        result = asyncio.run(discord_upload_async(file_record, file_path, token))
        
        if result['success']:
            # Update database synchronously
            file_record.discord_channel_id = result['channel_id']
            file_record.save()

            for part_info in result['parts']:
                FilePart.objects.create(
                    uploaded_file=file_record,
                    **part_info
                )
            return {"status": "success", "message": "Upload completed"}
        else:
            return {"status": "error", "message": result['error']}
            
    except Exception as e:
        # On any exception, ensure the file record is cleaned up if it exists
        with suppress(UploadedFile.DoesNotExist):
            UploadedFile.objects.get(id=file_record_id).delete()
        return {"status": "error", "message": str(e)}
    finally:
        # Always clean up the temporary file passed from the view
        os.remove(file_path)

async def discord_upload_async(file_record, file_path, token: str):
    """Pure async Discord operations"""
    intents = Intents.default()
    intents.guilds = True
    intents.message_content = True
    client = Client(intents=intents)
    
    try:
        async with client:
            await client.login(token)

            # Get guild
            guild = await client.fetch_guild(int(settings.SERVER_ID))
            if not guild:
                raise Exception("Guild not found")

            # Create Discord channel
            channel_name = file_record.discord_channel_name
            new_channel = await guild.create_text_channel(name=channel_name)
            channel_id = str(new_channel.id)

            # Handle splitting for large files
            if file_record.file_size > settings.SIZE_LIMIT:
                split_files(file_path, settings.SIZE_LIMIT, str(settings.TEMP_DIRECTORY))
                files_to_upload = [settings.TEMP_DIRECTORY / f for f in sorted(os.listdir(settings.TEMP_DIRECTORY))]
                file_record.split_count = len(files_to_upload)
                await sync_to_async(file_record.save)()
            else:
                files_to_upload = [Path(file_path)]

            # Upload files to Discord
            parts_info = []
            for i, part_path in enumerate(files_to_upload):
                with open(part_path, 'rb') as f:
                    filename = os.path.basename(part_path) if len(files_to_upload) > 1 else file_record.original_filename
                    discord_file = File(f, filename=filename)
                    message = await new_channel.send(f"📎 Part {i+1}/{len(files_to_upload)}:", file=discord_file)

                # Store part info to be saved to DB later
                parts_info.append({
                    'part_number': i + 1,
                    'discord_message_id': str(message.id),
                    'part_filename': filename,
                })
    
                # Clean up split files (but not the original temp file)
                if str(part_path) != file_path:
                    os.remove(str(part_path))
            
            return {'success': True, 'error': None, 'channel_id': channel_id, 'parts': parts_info}

    except LoginFailure:
        # Re-raise with our specific error message for the view to catch.
        return {'success': False, 'error': "Improper token has been passed.", 'channel_id': None, 'parts': []}
    except Exception as e:
        return {'success': False, 'error': str(e), 'channel_id': None, 'parts': []}


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({"status": "error", "message": "Usage: script file_record_id file_path token"}))
        sys.exit(1)
    
    file_record_id = sys.argv[1]
    file_path = sys.argv[2]
    token = sys.argv[3]
    
    result = sync_upload_process(file_record_id, file_path, token)
    print(json.dumps(result))
