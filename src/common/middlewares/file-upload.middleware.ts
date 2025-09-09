/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import multer, { Multer } from 'multer';

export interface FileUploadOptions {
  fieldName?: string;
  maxCount?: number;
  isMultiple?: boolean;
}

@Injectable()
export class FileUploadMiddleware implements NestMiddleware {
  protected options: FileUploadOptions;
  private upload: Multer;

  constructor(options: FileUploadOptions = {}) {
    // Always initialize options safely
    this.options = {
      fieldName: options.fieldName || 'files',
      maxCount: options.maxCount || 10,
      isMultiple: options.isMultiple ?? true,
    };
    this.upload = this.createMulterInstance();
  }

  static register(
    options: FileUploadOptions = {},
  ): typeof FileUploadMiddleware {
    @Injectable()
    class ConfiguredMiddleware extends FileUploadMiddleware {
      constructor() {
        super(options);
      }
    }
    return ConfiguredMiddleware;
  }

  private createMulterInstance(): Multer {
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/')
        ) {
          cb(null, true);
        } else {
          cb(
            new Error(
              'Only image and video files are allowed!',
            ) as unknown as null,
            false,
          );
        }
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    const uploadHandler = this.options.isMultiple
      ? this.upload.array(this.options.fieldName!, this.options.maxCount!)
      : this.upload.single(this.options.fieldName!);

    uploadHandler(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  }
}
