from django.urls import path

from . import views

urlpatterns = [
    path('json/', views.dashboard_json, name='dashboard-json'),
    path('', views.dashboard, name='dashboard'),
    path('project/<str:id>/', views.project_detail, name='project'),
    path('project/<str:project_id>/member/<str:user_id>/delete', views.delete_project_member, name='delete-project-member'),
    path('project/<str:project_id>/studyarea/<str:study_area_id>/delete-annotation', views.delete_studyarea_annotation, name='delete-studyarea-annotation'),
    path('project/<str:project_id>/studyarea/<str:study_area_id>/delete', views.delete_studyarea, name='delete-studyarea'),
    path('project/<str:project_id>/<int:index_id>/sh/', views.sh, name='project-sh'),
]
