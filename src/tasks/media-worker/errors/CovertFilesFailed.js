/* eslint-env node */
const UploadSessionErrorType = require('../../../models/const/upload-session-error-type');

function ConvertFilesFailed(message) {
  this.name = 'ConvertFilesFailed';
  this.message = message || '上傳檔案類型錯誤，請見教育手冊';
  this.type = UploadSessionErrorType.convertFilesFailed;
}

ConvertFilesFailed.prototype = new Error();
ConvertFilesFailed.prototype.constructor = ConvertFilesFailed;

module.exports = ConvertFilesFailed;
