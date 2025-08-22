// middleware/s3UploadMiddleware.js
const path = require("path");
const { Upload } = require("@aws-sdk/lib-storage");
const s3 = require("../lib/s3Client");

async function s3UploadMiddleware(req, res, next) {
  try {
    if (!req.file) return next();

    const userIdPart =
      req.user && req.user._id ? String(req.user._id) : "anonymous";
    const extension = path.extname(req.file.originalname) || "";
    const key = `profile/${userIdPart}-${Date.now()}${extension}`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const parallelUpload = new Upload({
      client: s3,
      params: uploadParams,
    });

    await parallelUpload.done();

    const region = process.env.AWS_REGION;
    const bucket = process.env.S3_BUCKET_NAME;

    if (region === "us-east-1") {
      req.file.s3Url = `https://${bucket}.s3.amazonaws.com/${key}`;
    } else {
      req.file.s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = s3UploadMiddleware;
