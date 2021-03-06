const mongoose = require('mongoose');
const utils = require('../../common/utils');
const ProjectCameraState = require('../const/project-camera-state');

const { Schema } = mongoose;
utils.connectDatabase();
const schema = utils.generateSchema(
  {
    project: {
      type: Schema.ObjectId,
      ref: 'ProjectModel',
      required: true,
      index: {
        name: 'Project',
      },
    },
    state: {
      // 狀態
      // 相機使用軟刪除，因為報表須提供「相機撤除」的資料
      type: String,
      default: ProjectCameraState.active,
      enum: ProjectCameraState.all(),
    },
    name: {
      // index: UniqueName
      type: String,
      required: true,
      index: {
        name: 'Name',
      },
    },
    nickname: {
      // 自訂相機名稱
      type: String,
      index: {
        name: 'Nickname',
      },
    },
    sn: {
      // 相機序號
      required: true,
      type: String,
    },
    vn: {
      // 廠商維護編號
      required: true,
      type: String,
    },
    // 相機財產編號
    propertyNumber: {
      type: String,
    },
    manufacturer: {
      // 廠牌
      required: true,
      type: String,
    },
    model: {
      // 型號
      required: true,
      type: String,
    },
    batteryType: {
      // 電池類型
      type: String,
    },
    brightness: {
      // 光強度
      type: String,
    },
    sensitivity: {
      // 敏感度
      type: String,
    },
    videoLength: {
      // 影片長度
      type: Number,
    },
    continuousShots: {
      // 連拍張數
      type: Number,
    },
    sensingDistance: {
      // 感應距離
      type: Number,
    },
  },
  {
    collection: 'ProjectCameras',
  },
);
schema.index(
  { project: 1, nickname: 1, name: 1 },
  {
    name: 'ProjectCamerasName',
    background: true,
    unique: true,
    partialFilterExpression: {
      state: ProjectCameraState.active,
    },
  },
);

const model = mongoose.model('ProjectCameraModel', schema);

model.prototype.dump = function() {
  const doc = {
    id: `${this._id}`,
    project:
      this.project && typeof this.project.dump === 'function'
        ? this.project.dump()
        : this.project,
    state: this.state,
    name: this.name,
    nickname: this.nickname,
    sn: this.sn,
    vn: this.vn,
    propertyNumber: this.propertyNumber,
    manufacturer: this.manufacturer,
    model: this.model,
    batteryType: this.batteryType,
    brightness: this.brightness,
    sensitivity: this.sensitivity,
    videoLength: this.videoLength,
    continuousShots: this.continuousShots,
    sensingDistance: this.sensingDistance,
    displayName: this.sn || this.vn || this.propertyNumber,
  };

  return doc;
};

module.exports = model;
