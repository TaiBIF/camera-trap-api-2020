import json
import pprint

from django.shortcuts import render
from django.http import HttpResponse
from pymongo import MongoClient
from bson.objectid import ObjectId


def dashboard_json(request):
    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    projects = db['Projects']

    sort = request.GET.get('sort', '')
    rows = []
    for i in projects.find():
        _id = str(i['_id'])
        count = db['Annotations'].find({'project': ObjectId(_id)}).count()
        rows.append({
            '_id': _id,
            'title': i['title'],
            'funder': i.get('funder',''),
            'principal_investigator': i.get('principalInvestigator', ''),
            'start_time': i['startTime'].strftime('%Y-%m-%d'),
            'end_time': i['endTime'].strftime('%Y-%m-%d'),
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
