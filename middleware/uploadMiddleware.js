const multer = require("multer");
const fs = require("fs");
const path = require("path");

function ensureDirectoryExists(directoryPath) {
	if (!fs.existsSync(directoryPath)) {
		fs.mkdirSync(directoryPath, { recursive: true });
	}
}

const profileImagesDirectory = path.join(__dirname, "..", "uploads", "profile");
ensureDirectoryExists(profileImagesDirectory);

const profileImageStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, profileImagesDirectory);
	},
	filename: function (req, file, cb) {
		const extension = path.extname(file.originalname);
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const userIdPart = req.user && req.user._id ? String(req.user._id) : "anonymous";
		cb(null, `${userIdPart}-${uniqueSuffix}${extension}`);
	}
});

function imageFileFilter(req, file, cb) {
	if (!file || !file.mimetype) {
		return cb(null, false);
	}
	if (file.mimetype.startsWith("image/")) {
		cb(null, true);
	} else {
		cb(new Error("Only image files are allowed"));
	}
}

const uploadProfileImage = multer({
	storage: profileImageStorage,
	fileFilter: imageFileFilter,
	limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

module.exports = { uploadProfileImage };


