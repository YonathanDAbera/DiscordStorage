#!/usr/bin/env python
"""
Test Discord bot connection
"""

import os
import sys
import django
import asyncio
from dotenv import load_dotenv

# Setup Django
sys.path.append('/Users/yabera/Desktop/DiscordStorage')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'discordstorage.settings')
django.setup()

import discord
from discord import Intents, Client
from django.conf import settings

async def test_discord_connection():
    """Test Discord bot connection and permissions"""
    
    print("🤖 Testing Discord Bot Connection")
    print("=" * 50)
    
    print(f"🔑 Token: {settings.DISCORD_TOKEN[:20]}...")
    print(f"🏠 Server ID: {settings.SERVER_ID}")
    print(f"📡 Channel ID: {settings.CHANNEL_ID}")
    
    # Setup Discord client
    intents = Intents.default()
    intents.guilds = True
    intents.message_content = True
    client = Client(intents=intents)
    
    @client.event
    async def on_ready():
        print(f"✅ Bot connected as: {client.user.name}")
        print(f"🆔 Bot ID: {client.user.id}")
        
        # Test guild access
        guild = client.get_guild(int(settings.SERVER_ID))
        if guild:
            print(f"✅ Found guild: {guild.name}")
            print(f"👥 Members: {guild.member_count}")
            print(f"📝 Channels: {len(guild.text_channels)}")
            
            # List some channels
            print(f"📋 Text channels:")
            for channel in guild.text_channels[:5]:  # First 5 channels
                print(f"   - {channel.name} (ID: {channel.id})")
            
            # Test channel creation permissions
            try:
                print(f"\n🧪 Testing channel creation...")
                test_channel = await guild.create_text_channel("test-django-upload")
                print(f"✅ Created test channel: {test_channel.name}")
                
                # Test file upload to the channel
                print(f"📎 Testing file upload...")
                test_message = "Test message from Django backend!"
                message = await test_channel.send(test_message)
                print(f"✅ Sent test message: {message.id}")
                
                # Clean up - delete test channel
                await test_channel.delete()
                print(f"🗑️ Cleaned up test channel")
                
            except discord.Forbidden:
                print(f"❌ No permission to create channels")
            except Exception as e:
                print(f"❌ Channel test failed: {e}")
        else:
            print(f"❌ Could not access guild with ID: {settings.SERVER_ID}")
            print(f"💡 Make sure the bot is invited to the server")
        
        await client.close()
    
    try:
        await client.start(settings.DISCORD_TOKEN)
    except discord.LoginFailure:
        print(f"❌ Invalid Discord token")
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_discord_connection())
