const auth = require('../auth/authorization');
const errors = require('../models/errors');
const UserPermission = require('../models/const/user-permission');
const ProjectModel = require('../models/data/project-model');
const AbnormalCameraLocationModel = require('../models/data/abnormal-camera-location-model');
const AbnormalCameraLocationForm = require('../forms/abnormal-camera-location/abnormal-camera-location-form');

exports.addAbnormalCameraLocation = auth(UserPermission.all(), (req, res) => {
  /*
  POST /api/v1/projects/:projectId/study-areas/:studyAreaId/abnormal-camera-location
   */
  const form = new AbnormalCameraLocationForm(req.body);
  const errorMessage = form.validate();

  if (errorMessage) {
    throw new errors.Http400(errorMessage);
  }

  return Promise.all([ProjectModel.findById(req.params.projectId)])
    .then(([project]) => {
      if (!project) {
        throw new errors.Http404();
      }
      if (!project.canManageBy(req.user)) {
        throw new errors.Http403();
      }

      const abnormalCameraLocation = new AbnormalCameraLocationModel({
        ...form,
        project,
      });
      return abnormalCameraLocation.save();
    })
    .then(abnormalCameraLocation => {
      res.json(abnormalCameraLocation.dump());
    });
});
