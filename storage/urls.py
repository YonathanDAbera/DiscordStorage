from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('upload/', views.upload_page, name='upload_page'),
    path('upload/file/', views.upload_file, name='upload_file'),
    path('download/', views.download_page, name='download_page'),
    path('download/<uuid:file_id>/', views.download_file, name='download_file'),
    path('manage/', views.manage_page, name='manage_page'),
    path('delete/<uuid:file_id>/', views.delete_file, name='delete_file'),
]
