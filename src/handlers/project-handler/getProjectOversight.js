const xlsx = require('node-xlsx');
const ProjectModel = require('../../models/data/project-model');
const CameraLocationModel = require('../../models/data/camera-location-model');
const CameraLocationState = require('../../models/const/camera-location-state');
const StudyAreaModel = require('../../models/data/study-area-model');
const StudyAreaState = require('../../models/const/study-area-state');
const AnnotationModel = require('../../models/data/annotation-model');
const AnnotationState = require('../../models/const/annotation-state');
// const PageList = require('../../models/page-list');
const errors = require('../../models/errors');
const helpers = require('../../common/helpers');
/**
  GET /api/v1/projects/:projectId/oversight
*/

const fetchYearStats = async (cameraLocationId, year) => {
  /* refer:
   *  https://stackoverflow.com/questions/52021756/mongodb-aggregate-with-nested-group
   */
  // const mx = month.toString().padStart(2, '0');
  const annotations = AnnotationModel.aggregate([
    {
      $addFields: {
        year: { $year: '$time' },
        md: { $dateToString: { format: '%m-%d', date: '$time' } },
        ym: { $dateToString: { format: '%Y-%m', date: '$time' } },
      },
    },
    {
      $match: {
        cameraLocation: cameraLocationId,
        state: AnnotationState.active,
        year,
      },
    },
    {
      $group: {
        _id: {
          // year: {$year: '$time'},
          // month: {$month: '$time'},
          // day: {$dayOfMonth: '$time'},
          ym: { $dateToString: { format: '%Y-%m', date: '$time' } },
          ymd: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          // year: '$year'
        },
        data: { $push: '$$ROOT' },
        // data: { "$push": "$ },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: { ym: '$_id.ym' },
        // data: {
        //  '$push': { k: '$_id.ymd', v: '$data' }
        // },
        count: { $sum: 1 },
      },
    },
  ]);
  // console.log(annotations)
  return annotations;
};

module.exports = async (req, res) => {
  const findInYear = req.query.year
    ? parseInt(req.query.year, 10)
    : new Date().getFullYear();

  let studyAreaCameraLocations = [];
  const data = {};
  const dataXlsx = {};
  const dataMonth = {};

  const project = await ProjectModel.findById(req.params.projectId).populate(
    'cameraLocations',
  );
  if (!project) {
    throw new errors.Http404();
  }

  if (!project.canAccessBy(req.user)) {
    throw new errors.Http403('The user is not a project member.');
  }

  const studyAreas = await StudyAreaModel.where({
    project: req.params.projectId,
    state: StudyAreaState.active,
    parent: { $exists: false },
  });
  // console.log(studyAreas);

  const subStudyAreas = await StudyAreaModel.where({
    project: req.params.projectId,
    state: StudyAreaState.active,
    parent: { $exists: true },
  });
  // console.log(subStudyAreas);

  const cameraLocations = await CameraLocationModel.where({
    project: req.params.projectId,
    state: CameraLocationState.active,
  });

  const daysInMonth = helpers.getDaysInMonth(findInYear);

  await Promise.all(
    cameraLocations.map(async c => {
      const yearStats = await fetchYearStats(c._id, findInYear);
      // console.log(c._id, yearStats);
      // console.log(c._id)
      // console.log(yearStats)

      const row = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //  for 12 months
      const row2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //  for 12 months
      // for (const x of yearStats) { // lint error
      yearStats.forEach(x => {
        const monthIndex = parseInt(x._id.ym.split('-')[1], 10) - 1;
        row[monthIndex] = [x.count, daysInMonth[monthIndex]];
        row2[monthIndex] = x.count;
      });
      data[c._id] = row;
      dataXlsx[c.name] = row;
      dataMonth[c.name] = row2;
    }),
  );
  // console.log(data)

  // add a new function to generate month list

  const Jan = [];
  const Feb = [];
  const Mar = [];
  const Apr = [];
  const May = [];
  const Jun = [];
  const Jul = [];
  const Aug = [];
  const Sep = [];
  const Oct = [];
  const Nov = [];
  const Dec = [];

  for (var key in dataMonth) {
    Jan.push(dataMonth[key][0]);
    Feb.push(dataMonth[key][1]);
    Mar.push(dataMonth[key][2]);
    Apr.push(dataMonth[key][3]);
    May.push(dataMonth[key][4]);
    Jun.push(dataMonth[key][5]);
    Jul.push(dataMonth[key][6]);
    Aug.push(dataMonth[key][7]);
    Sep.push(dataMonth[key][8]);
    Oct.push(dataMonth[key][9]);
    Nov.push(dataMonth[key][10]);
    Dec.push(dataMonth[key][11]);
  }
  const LocNum = cameraLocations.length;

  const Month = [
    {
      Jan: Jan.reduce((a, b) => a + b, 0) / (daysInMonth[0] * LocNum),
      Feb: Feb.reduce((a, b) => a + b, 0) / (daysInMonth[1] * LocNum),
      Mar: Mar.reduce((a, b) => a + b, 0) / (daysInMonth[2] * LocNum),
      Apr: Apr.reduce((a, b) => a + b, 0) / (daysInMonth[3] * LocNum),
      May: May.reduce((a, b) => a + b, 0) / (daysInMonth[4] * LocNum),
      Jun: Jun.reduce((a, b) => a + b, 0) / (daysInMonth[5] * LocNum),
      Jul: Jul.reduce((a, b) => a + b, 0) / (daysInMonth[6] * LocNum),
      Aug: Aug.reduce((a, b) => a + b, 0) / (daysInMonth[7] * LocNum),
      Sep: Sep.reduce((a, b) => a + b, 0) / (daysInMonth[8] * LocNum),
      Oct: Oct.reduce((a, b) => a + b, 0) / (daysInMonth[9] * LocNum),
      Nov: Nov.reduce((a, b) => a + b, 0) / (daysInMonth[10] * LocNum),
      Dec: Dec.reduce((a, b) => a + b, 0) / (daysInMonth[11] * LocNum),
    },
  ];
  // console.log(Month)

  studyAreaCameraLocations = studyAreas.map(sa => ({
    _id: sa.id,
    title: sa.title['zh-TW'],
    cameraLocations: cameraLocations
      .filter(c => c.studyArea.toString() === sa._id.toString())
      .map(x => ({
        _id: x._id,
        name: x.name,
      })),
    children: subStudyAreas
      .filter(ssa => ssa.parent.toString() === sa._id.toString())
      .map(x => ({
        _id: x.id,
        title: x.title['zh-TW'],
        cameraLocations: cameraLocations
          .filter(c => c.studyArea.toString() === x._id.toString())
          .map(y => ({
            _id: y._id,
            name: y.name,
          })),
      })),
  }));

  if (!/\.xlsx$/i.test(req.path)) {
    res.json({
      data,
      studyAreaCameraLocations,
      findInYear,
      Month,
    });
    return;
  }

  // add a dataframe for export
  const renderPercentage = function(v) {
    if (v == 0) {
      return '0%';
    }
    const d = Math.floor((v[0] / v[1]) * 10000) / 100;
    return `${d}%`;
  };

  const xlsxData = [];
  for (var key in dataXlsx) {
    var value = dataXlsx[key];
    const range = [...Array(12).keys()];
    const rr = [];
    rr.push(key);
    for (const a in range) {
      rr.push(renderPercentage(value[a]));
    }
    xlsxData.push(rr);
  }

  const headers = [
    '相機位置',
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ];
  xlsxData.unshift(headers);
  // console.log(xlsxData)

  // Averaging and Miss-averaging table
  const LoctNum = f => {
    const i = Math.floor(f * 10000) / 100;
    return `${i}%`;
  };

  const LossNum = f => {
    const i = Math.floor((100 - Math.floor(f * 10000) / 100) * 10000) / 10000;
    return `${i}%`;
  };

  const row3 = ['全部相機'];
  const row4 = ['全部相機'];
  for (var key in Month[0]) {
    var value = Month[0][key];
    row3.push(LoctNum(value));
    row4.push(LossNum(value));
  }
  xlsxData.push(['當月相機運作總平均']);
  xlsxData.push(row3);
  xlsxData.push(['當月缺繳比例']);
  xlsxData.push(row4);

  res.setHeader('Content-disposition', 'attachment; filename=annotations.xlsx');
  res.setHeader(
    'Content-type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8',
  );
  const buffer = xlsx.build([{ name: 'annotations', data: xlsxData }]);
  res.end(buffer);
};
