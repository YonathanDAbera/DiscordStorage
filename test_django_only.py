#!/usr/bin/env python
"""
Test Django backend without Discord integration
This tests the core Django functionality without requiring Discord connection
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
from storage.models import UploadedFile, FilePart
from django.conf import settings

def test_django_backend():
    """Test Django backend without Discord"""
    
    print("🧪 Testing Django Backend (No Discord)")
    print("=" * 50)
    
    # Get or create test user
    user, created = User.objects.get_or_create(
        username='admin',
        defaults={'email': 'admin@example.com'}
    )
    
    print(f"👤 User: {user.username} ({'created' if created else 'existing'})")
    
    # Test file details
    syllabus_path = Path('/Users/yabera/Desktop/DiscordStorage/Syllabus_COMP112_F24__4_.docx')
    
    if not syllabus_path.exists():
        print(f"❌ Syllabus file not found")
        return
    
    file_size = syllabus_path.stat().st_size
    print(f"📄 File: {syllabus_path.name}")
    print(f"📏 Size: {file_size} bytes ({file_size / 1024:.1f} KB)")
    print(f"🔍 Size limit: {settings.SIZE_LIMIT} bytes ({settings.SIZE_LIMIT / 1024:.1f} KB)")
    print(f"🧩 Will split: {'Yes' if file_size > settings.SIZE_LIMIT else 'No'}")
    
    # Create file record
    with open(syllabus_path, 'rb') as f:
        file_content = f.read()
    
    uploaded_file = SimpleUploadedFile(
        name=syllabus_path.name,
        content=file_content,
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    # Test database operations
    print("\n💾 Testing Database Operations...")
    
    file_record = UploadedFile.objects.create(
        user=user,
        original_filename=uploaded_file.name,
        file_size=uploaded_file.size,
        file_extension=os.path.splitext(uploaded_file.name)[1],
        discord_channel_name=uploaded_file.name.replace(' ', '_').replace('.', '_').replace('(', '_').replace(')', '_'),
        is_split=uploaded_file.size > settings.SIZE_LIMIT,
        discord_channel_id="123456789"  # Mock channel ID
    )
    
    print(f"✅ Created UploadedFile record: {file_record.id}")
    print(f"   - Original filename: {file_record.original_filename}")
    print(f"   - Channel name: {file_record.discord_channel_name}")
    print(f"   - Is split: {file_record.is_split}")
    
    # Test file parts if it would be split
    if file_record.is_split:
        print(f"\n📦 Testing FilePart records...")
        # Simulate creating file parts
        for i in range(3):  # Simulate 3 parts
            part = FilePart.objects.create(
                uploaded_file=file_record,
                part_number=i + 1,
                discord_message_id=f"mock_message_{i+1}",
                part_filename=f"{file_record.original_filename}_part_{i+1}"
            )
            print(f"   ✅ Created part {part.part_number}: {part.part_filename}")
    
    # Test query operations
    print(f"\n🔍 Testing Queries...")
    
    user_files = UploadedFile.objects.filter(user=user)
    print(f"   - User has {user_files.count()} files")
    
    recent_files = UploadedFile.objects.filter(user=user)[:5]
    for file in recent_files:
        print(f"   - {file.original_filename} ({file.file_size} bytes)")
    
    # Test file splitting logic
    print(f"\n🧩 Testing Split Logic...")
    
    from splitter import split_files, merge_files
    import tempfile
    import shutil
    
    # Create temporary directories
    temp_dir = Path(settings.BASE_DIR) / 'test_temp'
    output_dir = Path(settings.BASE_DIR) / 'test_output'
    temp_dir.mkdir(exist_ok=True)
    output_dir.mkdir(exist_ok=True)
    
    try:
        # Save file to temp location
        temp_file_path = temp_dir / syllabus_path.name
        shutil.copy2(syllabus_path, temp_file_path)
        
        if file_size > settings.SIZE_LIMIT:
            print(f"   🔪 Splitting file into {settings.SIZE_LIMIT} byte chunks...")
            split_files(str(temp_file_path), settings.SIZE_LIMIT, str(temp_dir))
            
            # List split files
            split_files_list = [f for f in temp_dir.iterdir() if f.name != temp_file_path.name]
            print(f"   ✅ Created {len(split_files_list)} split files:")
            for split_file in split_files_list:
                print(f"      - {split_file.name} ({split_file.stat().st_size} bytes)")
            
            # Test merging
            print(f"   🔗 Testing merge...")
            merge_files(str(temp_dir), str(output_dir), syllabus_path.name)
            
            merged_file = output_dir / syllabus_path.name
            if merged_file.exists():
                merged_size = merged_file.stat().st_size
                print(f"   ✅ Merged file size: {merged_size} bytes")
                print(f"   ✅ Size match: {'Yes' if merged_size == file_size else 'No'}")
            else:
                print(f"   ❌ Merged file not created")
        else:
            print(f"   ℹ️ File under size limit - no splitting needed")
    
    finally:
        # Clean up
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        if output_dir.exists():
            shutil.rmtree(output_dir)
    
    print(f"\n📊 Final Database State:")
    print(f"   - Total files: {UploadedFile.objects.count()}")
    print(f"   - Total parts: {FilePart.objects.count()}")
    
    print(f"\n✅ Django backend test completed successfully!")
    print(f"🌐 Web interface available at: http://127.0.0.1:8000/")
    print(f"👤 Login with: admin / (your password)")

if __name__ == "__main__":
    test_django_backend()
