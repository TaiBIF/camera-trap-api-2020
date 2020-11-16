from pymongo import MongoClient
from bson.objectid import ObjectId

PROJECT_ID = ''

def main(project_id):
    client = MongoClient('mongodb://mongo:27017')
    db = client['cameraTrap_prod']
    c_proj = db['Projects']
    c_sa = db['StudyAreas']
    c_cl = db['CameraLocations']
    
    project = c_proj.find_one({'_id': ObjectId(project_id)})
    sa_list = c_sa.find({'project': ObjectId(project_id)})
    cl_list = c_cl.find({'project': ObjectId(project_id)})

    #for i in sa_list:
    res = c_sa.insert_one({
        'project': ObjectId(project_id),
        'state': 'active',
        'title': {
            'zh-TW': 'FOOO',
        },
        'createTime': now,
        'updateTime': now
    })

    '''res = c_sa.insert_one({
        'project': ObjectId(project_id),
        'studyArea':ObjectId('FOOOOO'),
        'state': 'active',
        'name': 'FOOOOx',
        #settingTime
    })'''


main(project_id)
