import multer, { StorageEngine } from 'multer';
import { Request } from 'express';
import { fileTypeFilter } from './fileValidator';

const storage: StorageEngine = multer.diskStorage({
    destination: function (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void
    ) {
        cb(null, 'uploads/');
    },
    filename: function (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void
    ) {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

export const upload = multer({
    storage,
    fileFilter: fileTypeFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
});
