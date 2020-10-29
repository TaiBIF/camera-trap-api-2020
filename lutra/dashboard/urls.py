from django.urls import path

from . import views

urlpatterns = [
    path('json/', views.dashboard_json, name='dashboard-json'),
    path('', views.dashboard, name='dashboard'),
    path('project/<str:id>/', views.project_detail, name='project'),
    path('project/<str:project_id>/member/<str:user_id>/delete', views.delete_project_member, name='delete-project-member'),
]
