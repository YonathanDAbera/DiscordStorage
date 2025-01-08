from typing import Final
import os
import re
from dotenv import load_dotenv
from discord import Intents, Client, File
from splitter import split_files, merge_files 

# Load the bot token from environment variables
load_dotenv()
TOKEN: Final = os.getenv('DISCORD_TOKEN')
CHANNEL_ID: Final = os.getenv('CHANNEL_ID')
SERVER_ID: Final = os.getenv('SERVER_ID')  

# Client setup
intents = Intents.default()
intents.guilds=True
intents.message_content = True
client = Client(intents=intents)

# Configuration for file splitting
TEMP_DIRECTORY = './temporary/'
FILE_PATH = '/Users/yabera/Desktop/DiscordStorage/Syllabus_COMP112_F24 (4).docx'
SIZE_LIMIT = 1000000  # 1 MB

def rename_file(file_path: str) -> str:
    directory, original_name = os.path.split(file_path)
    name, extension = os.path.splitext(original_name)

    changed_name = re.sub(r'[^\w.]', '_', name)
    new_name = f"{changed_name}{extension}"
    new_path = os.path.join(directory, new_name)
    os.rename(file_path, new_path)
    
    return new_path


async def upload_files():
    try:
        split_files(rename_file(FILE_PATH), SIZE_LIMIT)
   
        files = os.listdir(TEMP_DIRECTORY)

        guild = client.get_guild(int(SERVER_ID))

        new_channel = await guild.create_text_channel(name=f'{FILE_PATH.split('/')[-1]}')
        
        count = 0
        for channel in guild.text_channels:
            if channel.name == new_channel.name:
                count += 1
        if count > 1:
            await new_channel.delete()
            return print('Channel already exists')

        for file_name in files:
            file_path = os.path.join(TEMP_DIRECTORY, file_name)
            await new_channel.send(file=File(file_path))

        # Clean up temporary files after sending
        for file_name in files:
            os.remove(os.path.join(TEMP_DIRECTORY, file_name))

    except Exception as e:
        print(f"An error occurred while uploading files: {e}")

async def download_files():
    try:
        guild = client.get_guild(int(SERVER_ID))
        for channel in guild.text_channels:
            if channel.name == 'syllabus_comp112_f24-4docx':
               current_channel = channel
        messages = [message async for message in current_channel.history(limit=float('inf'))]
        for message in messages:
            for attachment in message.attachments:
                await attachment.save(f'/Users/yabera/Desktop/DiscordStorage/temporary/{attachment.filename}')

        
        merge_files('/Users/yabera/Desktop/DiscordStorage/temporary/','/Users/yabera/Desktop/DiscordStorage/output/', str(attachment.filename)) #Would be easier to save the file extension somewhere, maybe firebase

    except Exception as e:
        print(f"An error occurred while downloading files: {e}")

# Event triggered when the client is ready
@client.event
async def on_ready():
    print(f'{client.user} has connected to Discord!')

@client.event
async def on_message(message):
    if message.author == client.user:
        return
    elif 'download' in message.content:
        await download_files()
    elif 'upload' in message.content:
        await upload_files()

# Main entry point
def main():
    client.run(TOKEN)

if __name__ == '__main__':
    main()
