from django.db import models
from django.contrib.auth.models import User
import uuid

class UploadedFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_files')
    original_filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    upload_date = models.DateTimeField(auto_now_add=True)
    discord_channel_name = models.CharField(max_length=255)
    discord_channel_id = models.CharField(max_length=255, null=True, blank=True)
    is_split = models.BooleanField(default=False)
    split_count = models.IntegerField(default=1)
    file_extension = models.CharField(max_length=10)
    
    class Meta:
        ordering = ['-upload_date']
    
    def __str__(self):
        return f"{self.original_filename} - {self.user.username}"

class FilePart(models.Model):
    uploaded_file = models.ForeignKey(UploadedFile, on_delete=models.CASCADE, related_name='parts')
    part_number = models.IntegerField()
    discord_message_id = models.CharField(max_length=255)
    part_filename = models.CharField(max_length=255)
    
    class Meta:
        ordering = ['part_number']
        unique_together = ['uploaded_file', 'part_number']
    
    def __str__(self):
        return f"{self.uploaded_file.original_filename} - Part {self.part_number}"
