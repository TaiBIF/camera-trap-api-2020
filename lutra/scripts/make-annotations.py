import datetime

from pymongo import MongoClient
from bson.objectid import ObjectId

import pandas as pd

PROJECT_ID = ''

client = MongoClient('mongodb://mongo:27017')
db = client['cameraTrap_prod']
c_proj = db['Projects']
c_sa = db['StudyAreas']
c_cl = db['CameraLocations']

f = open('./scripts/cam-loc-id.txt', 'r')
tmp = f.read()
ct_map = {}
for i in tmp.split('|'):
    x = i.split(',')
    ct_map[x[0]] = x[1]

LIN_AREA_LIST = ['台東處','屏東處','東勢處','花蓮處','南投處','嘉義處','新竹處','羅東處']
for i in LIN_AREA_LIST[0]:
    df = pd.read_excel('{}.xlsx'.format(i))
    df = df[0:3]
    for j in df.iterrows():
        x = {
            'rawData': [j[1][0], j[1][1], j[1][2], j[1][3], j[1][4], j[1][5], j[1][6]],
            'failures': [],
            'createTime': datetime.now(),
            'updateTime': datetime.now(),
            'tags': [],
            'fields': [],
        }
        print (x)

