import json
import pprint

from django.shortcuts import render, redirect
from django.http import HttpResponse
from pymongo import MongoClient
from bson.objectid import ObjectId

def dashboard(request):
    if not request.user.is_authenticated:
        return redirect('/')

    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    projects = db['Projects']

    project_list = projects.find();
    results = []
    for i in project_list:
        _id = str(i['_id'])
        count = db['Annotations'].find({'project': ObjectId(_id)}).count()
        results.append({
            'obj': i,
            'id': _id,
            'num_of_annotations': count,
        })
    contaxt = {
        'items': results,
    }
    return render(request, 'project-list.html', contaxt)


def dashboard_json(request):
    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    projects = db['Projects']

    sort = request.GET.get('sort', '')
    rows = []
    for i in projects.find():
        _id = str(i['_id'])
        count = db['Annotations'].find({'project': ObjectId(_id)}).count()
        #print (i['members'])
        rows.append({
            '_id': _id,
            'title': i['title'],
            'funder': i.get('funder',''),
            'principal_investigator': i.get('principalInvestigator', ''),
            'start_time': i['startTime'].strftime('%Y-%m-%d'),
            'end_time': i['endTime'].strftime('%Y-%m-%d'),
            'areas': [str(x) for x in i['areas']],
            'members': [str(x) for x in i['members']],
            'count': count,
        })


    if sort == 'count':
        rows = sorted(rows, key=lambda x: x['count'], reverse=True)
    elif sort == 'start_time':
        rows = sorted(rows, key=lambda x: x['start_time'], reverse=True)

    data = {
        'results': rows,
        'count': projects.count(),
    }
    return HttpResponse(
        json.dumps(data),
        content_type='application/json'
    )

def project_detail(request, id):
    if not request.user.is_authenticated:
        return redirect('/')
    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    c_user = db['Users']
    c_study_areas = db['StudyAreas']
    c_camera_locations = db['CameraLocations']
    c_file = db['Files']

    project = c_proj.find_one({'_id': ObjectId(id)})
    study_areas = c_study_areas.find({'project': ObjectId(id)})
    members = [{'id': str(x['user']), 'role': x['role']} for x in project['members']]

    study_area_list = []
    for i in study_areas:
        sa_count = 0
        sa_count_has_file = 0
        camera_location_list = c_camera_locations.find({'project': ObjectId(id), 'studyArea': ObjectId(i['_id'])})
        cl_list = []
        for j in camera_location_list:
            args = {
                'project': ObjectId(id),
                'studyArea': ObjectId(i['_id']),
                'cameraLocation': ObjectId(j['_id']),
            }
            count = db['Annotations'].find(args).count()
            args_has_file = args
            args_has_file['file'] = {'$exists': True }
            count_has_file = db['Annotations'].find(args_has_file).count()

            sa_count += count
            sa_count_has_file += count_has_file

            cl_list.append({'name': j['name'], 'id':j['_id'], 'count': count, 'count_has_file': count_has_file})
        study_area_list.append({
            'id': i['_id'],
            'name': i['title']['zh-TW'],
            'cl_list': cl_list,
            'count': sa_count,
            'count_has_file': sa_count_has_file,
        })


    for i in members:
        user = c_user.find_one({'_id': ObjectId(i['id'])})
        i['user'] = user
        #print (user)

    return render(request, 'project-detail.html', {
        'item': project,
        'member_list': members,
        'study_area_list': study_area_list,
        'item_id': id,
    })

def delete_project_member(request, project_id, user_id):
    if not request.user.is_authenticated:
        return redirect('/')

    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    project = c_proj.find_one({'_id': ObjectId(project_id)})
    tmp_members = project['members']
    new_members = []
    for i in tmp_members:
        if user_id != str(i['user']):
            new_members.append(i)
    #print (len(tmp_members), len(new_members))
    #project['members'] = new_members
    res = c_proj.update_one({
        '_id': ObjectId(project_id)
    }, {
        '$set': {'members': new_members}
    }, upsert=False)

    return redirect('/dashboard/project/{}/'.format(project_id))


def delete_studyarea_annotation(request, project_id, study_area_id):
    if not request.user.is_authenticated:
        return redirect('/')

    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    project = c_proj.find_one({'_id': ObjectId(project_id)})
    cl = request.GET.get('camera-location', '')

    args = {
        'project': ObjectId(project_id),
        'studyArea': ObjectId(study_area_id),
    }
    if cl:
        args['cameraLocation'] = ObjectId(cl)

    annotations = db['Annotations'].remove(args)


    return redirect('/dashboard/project/{}/'.format(project_id))
