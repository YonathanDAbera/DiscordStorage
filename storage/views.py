from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import views as auth_views
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib import messages
from .models import UploadedFile, FilePart
from .discord_service import DiscordService
from .forms import FileUploadForm
import os
import json
import asyncio
from asgiref.sync import sync_to_async
from django.views.decorators.http import require_http_methods

def index(request):
    return render(request, 'storage/index.html')

@login_required
def dashboard(request):
    user_files = UploadedFile.objects.filter(user=request.user).order_by('-upload_date')
    return render(request, 'storage/dashboard.html', {'files': user_files})

@login_required
def upload_page(request):
    form = FileUploadForm()
    return render(request, 'storage/upload.html', {'form': form})

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def upload_file(request):
    if request.method == 'POST':
        form = FileUploadForm(request.POST, request.FILES)
        if form.is_valid():
            uploaded_file = form.cleaned_data['file']
            
            # Create file record
            file_record = UploadedFile.objects.create(
                user=request.user,
                original_filename=uploaded_file.name,
                file_size=uploaded_file.size,
                file_extension=os.path.splitext(uploaded_file.name)[1],
                discord_channel_name=uploaded_file.name.replace(' ', '_').replace('.', '_').replace('(', '_').replace(')', '_'),
                is_split=uploaded_file.size > settings.SIZE_LIMIT
            )
            
            # Save file temporarily and process upload
            import tempfile
            import subprocess
            
            # Save uploaded file to temporary location
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_record.file_extension) as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name

            # Launch the upload process in a non-blocking background subprocess.
            # We use Popen instead of run to avoid waiting for it to complete.
            # The subprocess is responsible for its own error handling and cleanup.
            python_path = os.path.join(settings.BASE_DIR, 'env', 'bin', 'python')
            # Ensure we are using the most robust script
            script_path = os.path.join(settings.BASE_DIR, 'sync_async_upload.py')
            token = settings.DISCORD_TOKEN

            print(f"🚀 Launching background upload for {uploaded_file.name}...")

            # We pass the temp_file_path to the subprocess, which will be responsible
            # for cleaning it up after the upload is complete or fails.
            subprocess.Popen([
                python_path, script_path, str(file_record.id), temp_file_path, token
            ])
            
            return JsonResponse({
                'status': 'success', 
                'message': f'Upload started for {uploaded_file.name}. Processing in background...',
                'file_id': str(file_record.id)
            })
    
    return JsonResponse({'status': 'error', 'message': 'Invalid form data'})

@login_required
def download_page(request):
    user_files = UploadedFile.objects.filter(user=request.user)
    return render(request, 'storage/download.html', {'files': user_files})

@login_required
def download_file(request, file_id):
    file_record = get_object_or_404(UploadedFile, id=file_id, user=request.user)
    
    discord_service = DiscordService()
    try:
        file_path = asyncio.run(discord_service.download_file(file_record, settings.DISCORD_TOKEN))
        response = FileResponse(
            open(file_path, 'rb'),
            as_attachment=True,
            filename=file_record.original_filename
        )
        return response
    except Exception as e:
        messages.error(request, f'Error downloading file: {str(e)}')
        return redirect('download_page')

@login_required
def manage_page(request):
    user_files = UploadedFile.objects.filter(user=request.user)
    return render(request, 'storage/manage.html', {'files': user_files})

@login_required
def delete_file(request, file_id):
    file_record = get_object_or_404(UploadedFile, id=file_id, user=request.user)
    
    if request.method == 'POST':
        discord_service = DiscordService()
        try:
            asyncio.run(discord_service.delete_file(file_record, settings.DISCORD_TOKEN))
            file_record.delete()
            messages.success(request, f'File {file_record.original_filename} deleted successfully!')
        except Exception as e:
            messages.error(request, f'Error deleting file: {str(e)}')
    
    return redirect('manage_page')

class CustomLoginView(auth_views.LoginView):
    template_name = 'registration/login.html'
    redirect_authenticated_user = True
