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
        const mimetype = String(file?.mimetype || '').toLowerCase();
        const originalname = String(file?.originalname || '').toLowerCase();
        const safeMime =
          mimetype.startsWith('image/') || mimetype.startsWith('video/');
        const fallbackByName =
          /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|mp4|mov|m4v|avi|wmv|mkv)$/i.test(
            originalname,
          );

        if (safeMime || fallbackByName || !file?.mimetype) {
          // mimetype absent ou non standard → on accepte, la validation se fera côté S3/entity
          cb(null, true);
        } else {
          cb(
            new Error(
              `Only image and video files are allowed! Received mimetype=${String(file?.mimetype)} for file=${String(file?.originalname)}`,
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

    try {
      uploadHandler(req, res, (err: any) => {
        if (err) {
          const message =
            err && err.message ? String(err.message) : 'File upload failed';
          console.error('[FileUploadMiddleware] upload error', {
            method: req.method,
            url: req.url,
            fieldName: this.options.fieldName,
            isMultiple: this.options.isMultiple,
            maxCount: this.options.maxCount,
            contentType: req.headers['content-type'],
            contentLength: Number(req.headers['content-length'] || 0),
            errorName: err ? (err as any).name : null,
            errorMessage: err ? (err as any).message : null,
          });
          return res.status(400).json({ message, statusCode: 400 });
        }

        try {
          next();
        } catch (syncErr) {
          console.error('[FileUploadMiddleware] next() sync error', syncErr);
          return res.status(500).json({
            message:
              syncErr instanceof Error
                ? syncErr.message
                : 'Unexpected upload error',
            statusCode: 500,
          });
        }
      });
    } catch (syncErr) {
      console.error('[FileUploadMiddleware] uploadHandler sync error', syncErr);
      return res.status(500).json({
        message:
          syncErr instanceof Error
            ? syncErr.message
            : 'Unexpected upload error',
        statusCode: 500,
      });
    }
  }
}
