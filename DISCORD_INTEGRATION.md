# Discord Bot Integration Guide

## How the Discord Bot Works with Django

Your Discord bot now integrates with Django in several ways:

### 1. Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Django Web    │    │  Discord Bot    │    │   Discord API   │
│   Application   │◄──►│   (Separate)    │◄──►│   (Channels)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Bot Commands  │    │  File Storage   │
│  (File Metadata)│    │   (User Help)   │    │  (Split Files)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. Two Ways to Run the Bot

#### Option A: As a Django Management Command
```bash
python manage.py runbot
```

#### Option B: As a Standalone Script
```bash
python django_discord_bot.py
```

### 3. Bot Functionality

The Discord bot now serves as a **companion interface** to your web application:

- **Information Provider**: Shows file lists, upload instructions
- **Quick Access**: Provides links to web interface features
- **Status Updates**: Can announce when files are uploaded/downloaded
- **Help System**: Guides users to the web interface

### 4. File Operations Flow

#### Upload Process:
1. User visits Django web interface
2. Uploads file through web form
3. Django `DiscordService` handles Discord API calls
4. File is split (if large) and uploaded to Discord channels
5. Metadata stored in Django database
6. Bot can announce completion (optional)

#### Download Process:
1. User requests download via web interface
2. Django retrieves file metadata from database
3. `DiscordService` downloads file parts from Discord
4. Files are merged and served to user
5. Bot can provide download status (optional)

### 5. Key Benefits

- **Separation of Concerns**: Web UI for file operations, bot for quick info
- **Persistent Storage**: Django database tracks all file metadata
- **User Management**: Django handles authentication and user files
- **Scalability**: Bot and web app can run on different servers
- **Reliability**: If bot goes down, web interface still works

### 6. Environment Setup

Make sure your `.env` file contains:
```
DISCORD_TOKEN=your_bot_token_here
SERVER_ID=your_discord_server_id
CHANNEL_ID=your_default_channel_id
```

### 7. Running Both Services

Terminal 1 (Django Web App):
```bash
python manage.py runserver
```

Terminal 2 (Discord Bot):
```bash
python manage.py runbot
```

Or use the standalone bot:
```bash
python django_discord_bot.py
```

### 8. Bot Commands

Users can interact with the bot via:
- `upload` - Get upload instructions
- `download` - See available files
- `list` - List stored files
- `help` - Show available commands

### 9. Future Enhancements

You could add:
- Real-time upload progress notifications via bot
- User authentication through Discord
- File sharing between users
- Storage quota management
- Automated cleanup of old files

The bot now works as a helpful companion to your main web application rather than handling file operations directly.
