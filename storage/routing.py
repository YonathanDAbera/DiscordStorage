from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/upload/(?P<file_id>\w+)/$', consumers.UploadConsumer.as_asgi()),
]
