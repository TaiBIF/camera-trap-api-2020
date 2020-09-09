const moment = require('moment');
require('twix');
const _ = require('underscore');
const mongoose = require('mongoose');
const { ObjectID } = require('mongodb');
const CameraLocationModel = require('../../models/data/camera-location-model');
const CameraLocationState = require('../../models/const/camera-location-state');
const AnnotationModel = require('../../models/data/annotation-model');
const AnnotationState = require('../../models/const/annotation-state');
const SpeciesModel = require('../../models/data/species-model');
const DataFieldModel = require('../../models/data/data-field-model');

const fetchCameraLocations = async cameraLocationIds => {
  const cameraLocations = await CameraLocationModel.where({
    _id: { $in: cameraLocationIds },
  }).where({ state: CameraLocationState.active });

  return cameraLocations;
};

const getAnnotationQuery = form => {
  const query = AnnotationModel.where({ state: AnnotationState.active })
    .populate('species')
    .populate('studyArea')
    .populate('file')
    .sort('cameraLocation time filename');

  if (form.cameraLocationIds.length) {
    query.where({
      cameraLocation: { $in: form.cameraLocationIds },
    });
  }

  if (form.speciesIds.length) {
    query.where({
      species: {
        $in: form.speciesIds,
      },
    });
  }

  if (form.startDateTime) {
    query.where({ time: { $gte: form.startDateTime } });
  }

  if (form.endDateTime) {
    query.where({ time: { $lte: form.endDateTime } });
  }

  const otherDataFields = Object.keys(form);
  if (otherDataFields.length) {
    otherDataFields.forEach(dataFieldId => {
      if (!mongoose.Types.ObjectId.isValid(dataFieldId)) {
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(dataFieldId)) {
        return;
      }
      const dataFieldValue = form[dataFieldId];
      query.where({
        fields: {
          $elemMatch: {
            dataField: dataFieldId,
            'value.text': dataFieldValue,
          },
        },
      });
    });
  }

  return query;
};

const getMonthRange = (startDate, endDate) => {
  const s = moment(startDate);
  const e = moment(endDate);

  const result = [];
  while (s.isBefore(e)) {
    result.push(s.format('YYYY-MM'));
    s.add(1, 'month');
  }
  return result;
};

module.exports = async (req, res) => {
  const form = req.query;
  const {
    cameraLocationIds = [],
    startDateTime,
    endDateTime,
    range,
    speciesIds,
  } = form;
  const calculateTimeIntervel = parseInt(form.calculateTimeIntervel || 0, 10);
  const species = await SpeciesModel.find({
    _id: { $in: speciesIds },
  });

  const cameraLocations = await fetchCameraLocations(cameraLocationIds);
  const annotationQuery = getAnnotationQuery(form);
  const annotations = await annotationQuery;

  const numSpeciesDataField = await DataFieldModel.findOne({
    'title.zh-TW': '隻數',
  });

  const userid = [];
  cameraLocationIds.forEach(stringId => {
    userid.push(new ObjectID(stringId));
  });

  const timesTT = await AnnotationModel.aggregate([
    {
      $match: { cameraLocation: { $in: userid } },
    },

    {
      $sort: {
        time: -1.0,
      },
    },
    {
      $group: {
        _id: '$cameraLocation',
        starttimes: {
          $first: {
            $arrayElemAt: ['$rawData', 4.0],
          },
        },
        endtimes: {
          $last: {
            $arrayElemAt: ['$rawData', 4.0],
          },
        },
      },
    },
  ]);
  // console.log(timesTT)
  const timesArray = [];
  const totalTest = {};
  await timesTT.forEach(t => {
    const Start = moment(t.starttimes).format('YYYY-MM-DDTHH:mm:ss');
    const End = moment(t.endtimes).format('YYYY-MM-DDTHH:mm:ss');

    if (moment(End).isAfter(Start)) {
      const durationsT = moment(End).diff(Start);
      totalTest[t._id] = durationsT;

      // console.log(totalTest)

      timesArray.push({
        id: t._id,
        start: Start,
        end: End,
      });
    } else {
      const durationsT = moment(Start).diff(End);
      totalTest[t._id] = durationsT;

      // console.log(totalTest)

      timesArray.push({
        id: t._id,
        start: End,
        end: Start,
      });
    }
  });

  const result = _.groupBy(timesArray, 'id');

  /* const times = {};
  const totalTime = {};
  trips.forEach(t => {
    t.studyAreas.forEach(s => {
      s.cameraLocations.forEach(
        ({ cameraLocation: cameraLocationId, title, projectCameras }) => {
          projectCameras.forEach(({ startActiveDate, endActiveDate }) => {
            if (typeof times[title] === 'undefined') {
              times[title] = [];
            }

            if (typeof totalTime[title] === 'undefined') {
              totalTime[title] = 0;
            }
            const durations = moment(endActiveDate).diff(startActiveDate);
            totalTime[title] += durations;
            times[title].push({
              cameraLocationId,
              startTime: startActiveDate,
              endTime: endActiveDate,
            });
          });
        },
      );
    });
  }); */

  const data = [];
  if (range === 'month') {
    const monthList = getMonthRange(startDateTime, endDateTime);
    species.forEach(({ _id: s }) => {
      cameraLocations.forEach(c => {
        const workingCameraRange = result[c._id];
        monthList.forEach(m => {
          let totalPics = 0;
          let lastValidAnnotationTime;
          annotations
            .filter(({ cameraLocation }) => `${cameraLocation}` === `${c._id}`)
            .filter(({ time }) => moment(time).format('YYYY-MM') === m)
            .filter(
              ({ species: { _id: annotationSpeicesId } }) =>
                `${annotationSpeicesId}` === `${s}`,
            )
            .forEach(({ time, fields }) => {
              if (!lastValidAnnotationTime) {
                lastValidAnnotationTime = time;
                totalPics = 1;
              }
              if (
                moment(time).diff(lastValidAnnotationTime) >
                calculateTimeIntervel
              ) {
                lastValidAnnotationTime = time;
                totalPics += 1;

                // 加算隻數欄位
                if (fields.length > 0) {
                  const hasNumSpecies = fields.find(
                    x =>
                      x.dataField.toString() ===
                      numSpeciesDataField._id.toString(),
                  );
                  const addNumValue = parseInt(hasNumSpecies.value.text, 10);
                  if (addNumValue > 1) {
                    totalPics += addNumValue;
                  }
                }
              }
            });

          // 整理時數
          const beginT = moment(m).startOf('month');
          const endT = moment(m).endOf('month');
          let hours = 0;

          workingCameraRange.forEach(({ start, end }) => {
            const range1 = moment(start).twix(end);
            const range2 = moment(beginT).twix(endT);

            const rr = range1.intersection(range2);
            const duration = rr._end.diff(rr._start);
            hours += moment
              .duration(duration < 0 ? 0 : rr._end.diff(rr._start))
              .asHours();
          });

          const totalHours = parseFloat(hours.toFixed(4));
          data.push({
            species: s,
            cameraLocationId: c._id,
            title: c.name,
            count: parseFloat((totalPics / totalHours).toFixed(5)) * 1000,
            month: moment(m).format('M'),
            year: moment(m).format('Y'),
          });
        });
      });
    });
  } else {
    species.forEach(({ _id: s }) => {
      cameraLocations.forEach(c => {
        let total = 0;
        let lastValidAnnotationTime;
        annotations
          .filter(({ cameraLocation }) => `${cameraLocation}` === `${c._id}`)
          .filter(
            ({ species: { _id: annotationSpeicesId } }) =>
              `${annotationSpeicesId}` === `${s}`,
          )
          .forEach(({ time }) => {
            if (!lastValidAnnotationTime) {
              lastValidAnnotationTime = time;
              total = 1;
            }

            if (
              moment(time).diff(lastValidAnnotationTime) > calculateTimeIntervel
            ) {
              lastValidAnnotationTime = time;
              total += 1;
            }
          });

        data.push({
          species: s,
          cameraLocationId: c._id,
          title: c.name,
          count: total,
        });
      });
    });
  }
  res.json({
    species,
    data,
  });
};
