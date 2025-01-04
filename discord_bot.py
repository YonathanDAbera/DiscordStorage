from typing import Final
import os
from dotenv import load_dotenv
from discord import Intents, Client, File
from splitter import split_files 

# Load the bot token from environment variables
load_dotenv()
TOKEN: Final = os.getenv('DISCORD_TOKEN')
CHANNEL_ID: Final = os.getenv('CHANNEL_ID')

# Client setup
intents = Intents.default()
intents.guilds=True
intents.message_content = True
client = Client(intents=intents)

# Configuration for file splitting
TEMP_DIRECTORY = './temporary/'
FILE_PATH = '/Users/yabera/Desktop/DiscordStorage/Syllabus_COMP112_F24 (4).docx'
SIZE_LIMIT = 1000000  # 1 MB

# Function to split files

# Function to upload split files
async def upload_files(channel):
    try:
        # List files in the temporary directory
        files = os.listdir(TEMP_DIRECTORY)

        # Send each file to the specified channel
        for file_name in files:
            file_path = os.path.join(TEMP_DIRECTORY, file_name)
            await channel.send(file=File(file_path))

        # Clean up temporary files after sending
        for file_name in files:
            os.remove(os.path.join(TEMP_DIRECTORY, file_name))

    except Exception as e:
        print(f"An error occurred while uploading files: {e}")

# Event triggered when the client is ready
@client.event
async def on_ready():
    print(f'{client.user} has connected to Discord!')
    channel = client.get_channel(int(CHANNEL_ID))
    print(channel)

    if channel:
        try:
            # Split the file
            print("Splitting the file...")
            split_files(FILE_PATH, SIZE_LIMIT)

            # Upload the split files
            print("Uploading files...")
            await upload_files(channel)

        except Exception as e:
            print(f"An error occurred during the process: {e}")
    else:
        print("Target channel not found. Please check the channel ID.")

# Main entry point
def main():
    client.run(TOKEN)

if __name__ == '__main__':
    main()
