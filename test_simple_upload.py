#!/usr/bin/env python
"""
Simple Discord upload test using a more direct approach
"""

import os
import sys
import django
import asyncio
from pathlib import Path

# Setup Django
sys.path.append('/Users/yabera/Desktop/DiscordStorage')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'discordstorage.settings')
django.setup()

import discord
from discord import Intents, Client, File
from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from storage.models import UploadedFile, FilePart
from asgiref.sync import sync_to_async

class SimpleDiscordUploader:
    """Simplified Discord uploader"""
    
    async def upload_syllabus(self):
        """Upload the syllabus file directly to Discord"""
        
        print("🚀 Simple Discord Upload Test")
        print("=" * 50)
        
        # Setup Discord client
        intents = Intents.default()
        intents.guilds = True
        intents.message_content = True
        client = Client(intents=intents)
        
        @client.event
        async def on_ready():
            try:
                print(f"✅ Connected as: {client.user.name}")
                
                # Get guild
                guild = client.get_guild(int(settings.SERVER_ID))
                if not guild:
                    print(f"❌ Could not find guild: {settings.SERVER_ID}")
                    return
                
                print(f"🏠 Found guild: {guild.name}")
                
                # Get or create user
                user, created = await sync_to_async(User.objects.get_or_create)(
                    username='admin',
                    defaults={'email': 'admin@example.com'}
                )
                
                # Prepare syllabus file
                syllabus_path = Path('/Users/yabera/Desktop/DiscordStorage/Syllabus_COMP112_F24__4_.docx')
                if not syllabus_path.exists():
                    print(f"❌ Syllabus file not found")
                    return
                
                print(f"📄 Found file: {syllabus_path.name} ({syllabus_path.stat().st_size} bytes)")
                
                # Create database record
                file_record = await sync_to_async(UploadedFile.objects.create)(
                    user=user,
                    original_filename=syllabus_path.name,
                    file_size=syllabus_path.stat().st_size,
                    file_extension=syllabus_path.suffix,
                    discord_channel_name="test_syllabus_upload",
                    is_split=False
                )
                
                print(f"💾 Created database record: {file_record.id}")
                
                # Create Discord channel
                channel_name = f"test-upload-{file_record.id.hex[:8]}"
                new_channel = await guild.create_text_channel(name=channel_name)
                print(f"📡 Created Discord channel: {new_channel.name}")
                
                # Update database with channel ID
                file_record.discord_channel_id = str(new_channel.id)
                await sync_to_async(file_record.save)()
                
                # Upload file to Discord
                with open(syllabus_path, 'rb') as f:
                    discord_file = File(f, filename=syllabus_path.name)
                    message = await new_channel.send("📎 Uploading syllabus file:", file=discord_file)
                
                print(f"✅ File uploaded to Discord!")
                print(f"📨 Message ID: {message.id}")
                
                # Create FilePart record
                await sync_to_async(FilePart.objects.create)(
                    uploaded_file=file_record,
                    part_number=1,
                    discord_message_id=str(message.id),
                    part_filename=syllabus_path.name
                )
                
                print(f"📦 Created FilePart record")
                
                # Test download
                print(f"\n⬇️ Testing download...")
                
                # Get the message and download the file
                downloaded_message = await new_channel.fetch_message(message.id)
                if downloaded_message.attachments:
                    attachment = downloaded_message.attachments[0]
                    output_path = Path(settings.OUTPUT_DIRECTORY) / attachment.filename
                    
                    # Create output directory if it doesn't exist
                    output_path.parent.mkdir(exist_ok=True)
                    
                    await attachment.save(output_path)
                    print(f"✅ Downloaded file to: {output_path}")
                    
                    # Check file size
                    if output_path.exists():
                        downloaded_size = output_path.stat().st_size
                        original_size = syllabus_path.stat().st_size
                        print(f"📏 Original size: {original_size} bytes")
                        print(f"📏 Downloaded size: {downloaded_size} bytes")
                        print(f"✅ Size match: {'Yes' if downloaded_size == original_size else 'No'}")
                    
                else:
                    print(f"❌ No attachments found in message")
                
                print(f"\n🎉 Upload and download test completed!")
                print(f"🌐 Check your Discord server for the new channel: {new_channel.name}")
                
                # Get file count using async
                file_count = await sync_to_async(UploadedFile.objects.count)()
                print(f"💾 Database now has {file_count} files")
                
            except Exception as e:
                print(f"❌ Error during upload: {e}")
                import traceback
                traceback.print_exc()
            finally:
                await client.close()
        
        # Start the client
        await client.start(settings.DISCORD_TOKEN)

async def main():
    uploader = SimpleDiscordUploader()
    await uploader.upload_syllabus()

if __name__ == "__main__":
    asyncio.run(main())
