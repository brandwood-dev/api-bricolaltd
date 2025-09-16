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
    // Use multer.fields() to handle multiple field names
    const uploadHandler = this.upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'additionalImages', maxCount: 10 },
      { name: 'files', maxCount: 10 } // Keep backward compatibility
    ]);

    uploadHandler(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      
      // Transform the files structure for backward compatibility
      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
        const files: Express.Multer.File[] = [];
        
        // Add mainImage first if it exists
        if (req.files['mainImage']) {
          files.push(...req.files['mainImage']);
        }
        
        // Add additionalImages
        if (req.files['additionalImages']) {
          files.push(...req.files['additionalImages']);
        }
        
        // Add legacy 'files' field
        if (req.files['files']) {
          files.push(...req.files['files']);
        }
        
        // Set the combined files array for backward compatibility
        (req as any).files = files;
      }
      
      next();
    });
  }
}