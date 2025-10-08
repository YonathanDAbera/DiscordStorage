import json
from channels.generic.websocket import AsyncWebsocketConsumer

class UploadConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.file_id = self.scope['url_route']['kwargs']['file_id']
        self.room_group_name = f'upload_{self.file_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'upload_progress',
                'message': message
            }
        )

    async def upload_progress(self, event):
        message = event['message']

        await self.send(text_data=json.dumps({
            'message': message
        }))
