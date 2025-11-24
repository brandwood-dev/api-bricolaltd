/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import multer, { Multer } from 'multer';

@Injectable()
export class NewsFileUploadMiddleware implements NestMiddleware {
  private upload: Multer;

  constructor() {
    this.upload = this.createMulterInstance();
  }

  private createMulterInstance(): Multer {
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        console.log('[NewsFileUploadMiddleware] File filter check:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          fieldname: file.fieldname,
        });
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/')
        ) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Only image and video files are allowed! Received: ${file.mimetype} for file: ${file.originalname}`,
            ) as unknown as null,
            false,
          );
        }
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Handle multiple field names without altering req.files shape
    const uploadHandler = this.upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'additionalImages', maxCount: 10 },
      { name: 'files', maxCount: 10 }, // Backward compatibility
      { name: 'image', maxCount: 1 }, // For section image uploads
    ]);

    uploadHandler(req, res, (err: any) => {
      if (err) {
        console.error('[NewsFileUploadMiddleware] Multer error:', err);
        return res.status(400).json({ message: err.message });
      }

      const f: any = (req as any).files;
      if (Array.isArray(f)) {
        console.log('[NewsFileUploadMiddleware] files array received', {
          count: f.length,
          names: f.map((ff: any) => ff?.originalname).filter(Boolean),
        });
      } else if (f && typeof f === 'object') {
        const keys = Object.keys(f);
        const summary = keys.map((k) => ({
          field: k,
          count: Array.isArray((f as any)[k]) ? (f as any)[k].length : 0,
          names: Array.isArray((f as any)[k])
            ? (f as any)[k].map((ff: any) => ff?.originalname).filter(Boolean)
            : [],
        }));
        console.log(
          '[NewsFileUploadMiddleware] files fields received',
          summary,
        );
      } else {
        console.log('[NewsFileUploadMiddleware] no files received');
      }

      // IMPORTANT: Do not transform req.files; keep original mapping
      next();
    });
  }
}
