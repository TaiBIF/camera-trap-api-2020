import json
import pprint
from datetime import datetime, timedelta

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
    c_study_areas = db['StudyAreas']
    c_camera_locations = db['CameraLocations']

    project_list = projects.find();
    results = []
    for i in project_list:
        _id = str(i['_id'])
        count = db['Annotations'].find({'project': ObjectId(_id)}).count()
        count_file = db['Annotations'].find({'project': ObjectId(_id), 'file': {'$exists': True}}).count()
        count_sa = c_study_areas.find({'project': ObjectId(_id)}).count()
        count_cl = c_camera_locations.find({'project': ObjectId(_id)}).count()
        results.append({
            'obj': i,
            'id': _id,
            'num_of_annotations': count,
            'num_of_annotations_with_file': count_file,
            'num_of_study_area': count_sa,
            'num_of_camera_location': count_cl,
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

def delete_studyarea(request, project_id, study_area_id):
    if not request.user.is_authenticated:
        return redirect('/')

    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    #project = c_proj.find_one({'_id': ObjectId(project_id)})

    sa = db['StudyAreas'].remove({
        'project': ObjectId(project_id),
        '_id': ObjectId(study_area_id)})

    return redirect('/dashboard/project/{}/'.format(project_id))


def sh(request, project_id, index_id):
    import pandas as pd
    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    c_sa = db['StudyAreas']
    c_cl = db['CameraLocations']

    f = open('./scripts/cam-loc-id.txt', 'r')
    tmp = f.read()
    cl_id_map = {}
    for i in tmp.split('|'):
        x = i.split(',')
        cl_id_map[x[0]] = x[1]
    #print (ct_map)

    LIN_AREA_LIST = ['台東處','屏東處','東勢處','花蓮處','南投處','嘉義處','新竹處','羅東處']
    LIN_AREA_ID = [
        '5d19e2a7bad3f6ac15d9ff2c',
        '5d19e25abad3f61536d9fd9f',
        '5d19e1b9bad3f67f67d9facf',
        '5d19e304bad3f65b13da015e',
        '5d19e1ccbad3f64504d9fb32',
        '5d19e241bad3f66c46d9fcea',
        '5d19e16cbad3f64359d9f9d4',
        '5d19e12bbad3f6ef77d9f958'
    ]
    sa_count = 0
    for i in LIN_AREA_LIST[index_id:index_id+1]:
        sa_count += 1
        df = pd.read_excel('./scripts/{}.xlsx'.format(i))
        #df = df[0:3]

        for j in df.iterrows():
            sa = j[1][0]
            ssa = j[1][1] if not pd.isna(j[1][1]) else ''
            cl = j[1][2]
            fn = j[1][3]
            dt = j[1][4]
            dt_str = str(dt)
            sp = j[1][5] if not pd.isna(j[1][5]) else ''
            mm = j[1][6] if not pd.isna(j[1][6]) else ''

            x = {
                'rawData': [sa, ssa, cl, fn, dt_str, sp, mm],
                'failures': [],
                'createTime': datetime.utcnow(),
                'updateTime': datetime.utcnow(),
                'tags': [],
                'fields': [{
                    'dataField': ObjectId('5fa0cc0677db0600515f1093')
                }, {
                    'dataField': ObjectId('5fa0cc0677db0600515f1094'),
                    'value': {
                        'text': cl
                    }
                }, {
                    'dataField': ObjectId('5fa0cc0677db0600515f1095'),
                    'value': {
                        'text': fn
                    }
                }, {
                    'dataField': ObjectId('5fa0cc0677db0600515f1096'),
                    'value': {
                        'text': dt_str
                    }
                }, {
                    'dataField': ObjectId('5fa0cc0677db0600515f1097'),
                    'value': {
                        'text': sp
                    }
                }],
                'project': ObjectId('5ceb7c2ff974a98437bb3843'), #ObjectId('5fa0cc6e8a90a70037d0130c'),
                'studyArea': ObjectId(LIN_AREA_ID[index_id]), #ObjectId('5fa0cc798a90a70037d0131d')
                'cameraLocation': ObjectId(cl_id_map[cl]), #ObjectId('5fa0d0a58a90a70037d01336')
                'filename': fn,
                'time': dt + timedelta(hours=-8),
                #'file': ObjectId('5fa36705dd092e004050036c'),
                'state': 'active',
                #'species': ObjectId('5fa0cc0677db0600515f10b1'),
                'totalMilliseconds': (dt.hour * 3600 * 1000) + (dt.minute * 60 * 1000) + (dt.second * 1000),
                '__v': 0,
                'importNote': '201117',
                'speciesName': sp
            }
            #print (dt.hour, dt.minute, dt.second)
            
            db['Annotations'].insert(x)
    return redirect('/dashboard/project/{}/'.format(project_id))
