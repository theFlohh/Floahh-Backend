// middleware/uploadProfileImage.js
const multer = require('multer');
const path = require('path');

function imageFileFilter(req, file, cb) {
  if (!file || !file.mimetype) return cb(null, false);
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'));
}

const memoryStorage = multer.memoryStorage();

const uploadProfileImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB (same as before)
});

module.exports = { uploadProfileImage };
