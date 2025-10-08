#!/usr/bin/env python
"""
Simple Discord token validation in Django context
"""
import os
import sys
import django

# Add project to path
sys.path.append('/Users/yabera/Desktop/DiscordStorage')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'discordstorage.settings')
django.setup()

from django.conf import settings
import requests

def test_token_validity():
    print("🧪 Testing Discord token validity")
    
    token = settings.DISCORD_TOKEN
    if not token:
        print("❌ No token found in settings")
        return False
    
    print(f"🔑 Token: {token[:20]}...")
    print(f"🏠 Server ID: {settings.SERVER_ID}")
    
    # Test token with Discord API directly
    headers = {
        'Authorization': f'Bot {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test by getting bot user info
        response = requests.get('https://discord.com/api/v10/users/@me', headers=headers)
        
        if response.status_code == 200:
            bot_info = response.json()
            print(f"✅ Token valid! Bot: {bot_info['username']}#{bot_info['discriminator']}")
            print(f"🆔 Bot ID: {bot_info['id']}")
            return True
        else:
            print(f"❌ Token invalid. Status: {response.status_code}")
            print(f"❌ Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing token: {e}")
        return False

if __name__ == "__main__":
    test_token_validity()
