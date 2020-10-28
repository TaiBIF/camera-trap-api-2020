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

    project = c_proj.find_one({'_id': ObjectId(id)})
    members = [{'id': str(x['user']), 'role': x['role']} for x in project['members']]
    for i in members:
        user = c_user.find_one({'_id': ObjectId(i['id'])})
        i['user'] = user
        #print (user)

    return render(request, 'project-detail.html', {
        'item': project,
        'member_list': members
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
