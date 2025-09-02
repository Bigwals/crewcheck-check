"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileTypeFilter = void 0;
const fileTypeFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/gif',
        'application/pdf',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file
    }
    else {
        cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
};
exports.fileTypeFilter = fileTypeFilter;
