/* eslint-env node */
const fs = require('fs');
const config = require('config');
const moment = require('moment');
const csvParse = require('csv-parse/lib/sync');
const Promise = require('bluebird');
const utils = require('../../common/utils');
const errors = require('../../models/errors');
const AnnotationModel = require('../../models/data/annotation-model');
const AnnotationState = require('../../models/const/annotation-state');
const FileModel = require('../../models/data/file-model');
const ProjectModel = require('../../models/data/project-model');
const CameraLocationModel = require('../../models/data/camera-location-model');
const CameraLocationState = require('../../models/const/camera-location-state');
const UploadSessionErrorType = require('../../models/const/upload-session-error-type');
const StudyAreaState = require('../../models/const/study-area-state');
const logger = require('../../logger');
const extractFileByPath = require('./extractFileByPath');
const fetchCsvFileContent = require('./fetchCsvFileContent');
const createFileModels = require('./createFileModels');
const uploadErrors = require('./errors');
const XLSX = require('xlsx')

const saveAllFileObjectWithCsv = require('./saveAllFileObjectWithCsv');
const saveAllFileObjectWithAnnotationCsv = require('./saveAllFileObjectWithAnnotationCsv');

const saveAnnotationConcurrency = 10;
const csvOptions = {
  bom: true,
};

const fetchZipToTargetFromS3 = (keyname, filename) => {
  const s3 = utils.getS3();
  const file = fs.createWriteStream(filename);

  return new Promise((resolve, reject) => {
    file.on('close', () => {
      resolve(file);
    });

    s3.getObject({
      Bucket: config.s3.bucket,
      Key: `${config.s3.folders.annotationZIPs}/${keyname}`,
    })
      .createReadStream()
      .on('error', error => {
        reject(error);
      })
      .pipe(file);
  });
};

const fetchFiles = filePath =>
  fs.readdirSync(filePath).map(filename => filename);

const saveAllFileObjectWithNewAnnotaions = (
  files,
  project,
  cameraLocation,
  uploadSession,
  startWorkingDate,
  endWorkingDate,
) =>
  Promise.resolve(files).map(
    file => {
      const annotation = new AnnotationModel({
        project,
        studyArea: cameraLocation.studyArea,
        cameraLocation,
        uploadSession,
        state: AnnotationState.active,
        file,
        filename: file.originalFilename,
        time: file.exif.dateTime,
        startWorkingDate,
        endWorkingDate,
      });
      return annotation.save();
    },
    { concurrency: saveAnnotationConcurrency },
  );

module.exports = async (workerData, uploadSession, user, tempDir, tempFile) => {
  const project = await ProjectModel.findById(workerData.projectId).populate(
    'dataFields',
  );
  if (!project) {
    throw new errors.Http400('no project data');
  }

  if (!project.canAccessBy(user)) {
    uploadSession.errorType = UploadSessionErrorType.permissionDenied;
    throw new errors.Http400('no permission');
  }

  const file = await FileModel.findById(workerData.fileId)
    .where({ project: workerData.projectId })
    .populate('exif');

  if (!file) {
    throw new errors.Http400('no file data');
  }

  const keyname = file.getFilename();

  const cameraLocation = await CameraLocationModel.findById(
    workerData.cameraLocationId,
  )
    .where({ project: workerData.projectId })
    .where({ state: CameraLocationState.active })
    .populate('studyArea');

  if (!cameraLocation) {
    throw new Error(UploadSessionErrorType.imagesAndCsvNotMatch);
  }

  if (
    !cameraLocation.studyArea ||
    cameraLocation.studyArea.state !== StudyAreaState.active
  ) {
    throw new errors.Http404(`Study area is not found`);
  }

  const startFetchZipTime = moment();
  await fetchZipToTargetFromS3(keyname, tempFile.name);
  logger.info(
    `zip worker job. start fetch zip ${moment().to(startFetchZipTime, true)}`,
  );

  const startExtractZipTime = moment();
  // const extractedFiles = await extractFileByPath(tempFile.name, tempDir.name);
  await extractFileByPath(tempFile.name, tempDir.name);
  logger.info(
    `zip worker job. extract file ${moment().to(startExtractZipTime, true)}`,
  );
  // console.log(extractedFiles);



  //count the file number for reading the sub-zip file
  //logger.info(tempDir.name)
  const filesPathForLen = fetchFiles(tempDir.name);
  const checkFolder = filesPathForLen.filter(elm => elm.match(/.*\.(csv|xlsx|xls|jpg|mp4|avi)/i));

  let dirPath;
  let filesPath;
  let csvFiles;
  let csvFilePath;

  if (checkFolder.length == 0) {
    dirPath = `${tempDir.name}/${filesPathForLen}`
    filesPath = fetchFiles(dirPath);
    //logger.info(filesPath);
    csvFiles = filesPath.filter(elm => elm.match(/.*\.(csv|xlsx|xls)/i));
    csvFilePath = `${dirPath}/${csvFiles[0]}`;

  } else {
    dirPath = `${tempDir.name}`
    filesPath = fetchFiles(dirPath);
    csvFiles = filesPath.filter(elm => elm.match(/.*\.(csv|xlsx|xls)/i));
    csvFilePath = `${dirPath}/${csvFiles[0]}`;

  }
  //logger.info(dirPath)


  const hasCsvFile = csvFiles.length > 0;
  //logger.info(csvFiles.length);

  const startWorkingDate =
    workerData.workingRange !== undefined &&
    workerData.workingRange.split(',').length === 2
      ? workerData.workingRange.split(',')[0]
      : undefined;
  const endWorkingDate =
    workerData.workingRange !== undefined &&
    workerData.workingRange.split(',').length === 2
      ? workerData.workingRange.split(',')[1]
      : undefined;

  if (!hasCsvFile) {
    logger.info(`zip worker job. save with Files`);
    let dirname;
    if(checkFolder.length == 0) {
      dirname = `${tempDir.name}/${filesPathForLen}`
    } else {
      dirname = tempDir.name
    }
    //logger.info(dirname)
    let files = [];
    try {
      files = await createFileModels(filesPath, dirname, project, user);
    } catch (e) {
      throw new uploadErrors.ConvertFilesFailed(e.message);
    }

    const fileArr = Object.values(files);

    await saveAllFileObjectWithNewAnnotaions(
      fileArr,
      project,
      cameraLocation,
      uploadSession,
      startWorkingDate,
      endWorkingDate,
    );
    return;
  }


  //read csv or xlsx file into array
  let csvArray;
  let excelRead;
  let sheet_name_list;
  if(`${csvFiles[0]}`.includes('.csv')) {
    csvArray = csvParse(await fetchCsvFileContent(csvFilePath), csvOptions);
  } else if(`${csvFiles[0]}`.includes('.xlsx')) {
    excelRead = XLSX.readFile(csvFilePath)
    sheet_name_list = excelRead.SheetNames
    csvArray = XLSX.utils.sheet_to_json(excelRead.Sheets[sheet_name_list[0]], {raw:false, header:1})
  } else if(`${csvFiles[0]}`.includes('.xls')) {
    excelRead = XLSX.readFile(csvFilePath)
    sheet_name_list = excelRead.SheetNames
    csvArray = XLSX.utils.sheet_to_json(excelRead.Sheets[sheet_name_list[0]], {raw:false, header:1})

  } else {
    throw new uploadErrors.ConvertFilesFailed();
  }
  logger.info(csvArray)
  
  /*if (csvArray.length !== filesPath.length) {
    throw new uploadErrors.InconsistentQuantity(
      `CSV: ${csvArray.length - 1}, media files: ${filesPath - 1}`,
    );
  }*/

  // check csv content
  const csvHeaderRow = csvArray[0];
  const csvContentArray = csvArray.slice(1);

  // 找出是否有 annotation 欄位
  const withAnntationId =
    csvHeaderRow.filter(row => row === 'Annotation id').length > 0;

  // check csv validate
  const timePattern = /20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1]) (2[0-3]|[01][0-9]):[0-5][0-9]:[0-5][0-9]/;
  csvContentArray.forEach(
    ([studyAreaName, subStudyAreaName, cameraLocationName, filename, time]) => {
      logger.info(studyAreaName, subStudyAreaName, cameraLocationName, filename, time);
      if (!filesPath.includes(filename)) {
        throw new uploadErrors.ImagesAndCsvNotMatch();
      }

      if (!time.match(timePattern)) {
        throw new uploadErrors.CsvTimeFormatUnValid();
      }
    },
  );

  let fileObjects = [];
  try {
    fileObjects = await createFileModels(
      filesPath,
      dirPath,
      project,
      user,
    );
  } catch (e) {
    throw new uploadErrors.ConvertFilesFailed(e.message);
  }

  logger.info(
    `zip worker job. Convert files done: ${Object.keys(fileObjects).length}`,
  );
  if (withAnntationId) {
    await saveAllFileObjectWithAnnotationCsv(
      csvArray,
      fileObjects,
      user,
      project.dataFields,
      startWorkingDate,
      endWorkingDate,
    );
  } else {
    await saveAllFileObjectWithCsv(
      csvArray,
      fileObjects,
      project,
      user,
      cameraLocation,
      startWorkingDate,
      endWorkingDate,
    );
  }
};
