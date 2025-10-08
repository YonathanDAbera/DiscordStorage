#!/usr/bin/env python
"""
Test script to upload the syllabus file through Django backend
Run this script to test the upload functionality
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
sys.path.append('/Users/yabera/Desktop/DiscordStorage')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'discordstorage.settings')
django.setup()

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from storage.models import UploadedFile
from storage.discord_service import DiscordService
import asyncio

def test_syllabus_upload():
    """Test uploading the syllabus file"""
    
    # Get or create a test user
    user, created = User.objects.get_or_create(
        username='admin',
        defaults={'email': 'admin@example.com'}
    )
    if created:
        user.set_password('admin123')
        user.save()
        print(f"Created test user: {user.username}")
    else:
        print(f"Using existing user: {user.username}")
    
    # Path to syllabus file
    syllabus_path = Path('/Users/yabera/Desktop/DiscordStorage/Syllabus_COMP112_F24__4_.docx')
    
    if not syllabus_path.exists():
        print(f"❌ Syllabus file not found at: {syllabus_path}")
        return
    
    print(f"📄 Found syllabus file: {syllabus_path.name}")
    print(f"📏 File size: {syllabus_path.stat().st_size} bytes")
    
    # Read the file
    with open(syllabus_path, 'rb') as f:
        file_content = f.read()
    
    # Create Django uploaded file object
    uploaded_file = SimpleUploadedFile(
        name=syllabus_path.name,
        content=file_content,
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    # Create file record in database
    print("💾 Creating database record...")
    file_record = UploadedFile.objects.create(
        user=user,
        original_filename=uploaded_file.name,
        file_size=uploaded_file.size,
        file_extension=os.path.splitext(uploaded_file.name)[1],
        discord_channel_name=uploaded_file.name.replace(' ', '_').replace('.', '_').replace('(', '_').replace(')', '_'),
        is_split=uploaded_file.size > 1000000  # 1MB limit
    )
    
    print(f"✅ Database record created with ID: {file_record.id}")
    print(f"📊 File details:")
    print(f"   - Original filename: {file_record.original_filename}")
    print(f"   - File size: {file_record.file_size} bytes")
    print(f"   - Discord channel name: {file_record.discord_channel_name}")
    print(f"   - Will be split: {file_record.is_split}")
    
    # Test Discord service upload
    print("\n🚀 Starting Discord upload...")
    discord_service = DiscordService()
    
    try:
        asyncio.run(discord_service.upload_file(uploaded_file, file_record))
        print("✅ Upload completed successfully!")
        
        # Refresh from database to get updated info
        file_record.refresh_from_db()
        print(f"📡 Discord channel ID: {file_record.discord_channel_id}")
        print(f"🧩 Split count: {file_record.split_count}")
        
        # Show file parts if any
        parts = file_record.parts.all()
        if parts:
            print(f"📦 File parts ({len(parts)}):")
            for part in parts:
                print(f"   - Part {part.part_number}: {part.part_filename}")
        else:
            print("📄 Single file (not split)")
            
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")
        # Clean up the database record
        file_record.delete()
        return
    
    print(f"\n🎉 Test completed! File uploaded successfully.")
    print(f"🌐 You can now view it in the web interface at http://127.0.0.1:8000/")
    
    return file_record

def test_download():
    """Test downloading the most recent file"""
    
    # Get the most recent file
    recent_file = UploadedFile.objects.first()
    if not recent_file:
        print("❌ No files found to download")
        return
    
    print(f"⬇️ Testing download of: {recent_file.original_filename}")
    
    discord_service = DiscordService()
    
    try:
        output_path = asyncio.run(discord_service.download_file(recent_file))
        print(f"✅ Download completed!")
        print(f"📁 File saved to: {output_path}")
        
        # Check if file exists and size matches
        if output_path.exists():
            downloaded_size = output_path.stat().st_size
            print(f"📏 Downloaded size: {downloaded_size} bytes")
            print(f"📏 Original size: {recent_file.file_size} bytes")
            
            if downloaded_size == recent_file.file_size:
                print("✅ File sizes match - download successful!")
            else:
                print("⚠️ File sizes don't match - possible corruption")
        else:
            print("❌ Downloaded file not found")
            
    except Exception as e:
        print(f"❌ Download failed: {str(e)}")

if __name__ == "__main__":
    print("🧪 Discord Storage Backend Test")
    print("=" * 50)
    
    # Test upload
    file_record = test_syllabus_upload()
    
    if file_record:
        print("\n" + "=" * 50)
        print("Testing download...")
        test_download()
    
    print("\n✨ Test complete!")
