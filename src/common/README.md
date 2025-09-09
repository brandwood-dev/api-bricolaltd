# S3 Integration for File Uploads

## Overview

This module provides integration with Amazon S3 for uploading, retrieving, and deleting files such as images and videos. It includes:

- `S3Service`: Handles all S3 operations (upload, delete, generate presigned URLs)
- `FileUploadMiddleware`: Processes file uploads using Multer
- `S3Module`: Encapsulates the S3 service for use in other modules

## Configuration

Add the following environment variables to your `.env` file:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET=your_bucket_name
```

## Usage

### 1. Import the S3Module

The S3Module is already imported globally through the CommonModule. You can inject the S3Service in any service:

```typescript
import { S3Service } from '../common/services/s3.service';

@Injectable()
export class YourService {
  constructor(private readonly s3Service: S3Service) {}
  
  // Use s3Service methods here
}
```

### 2. Apply the FileUploadMiddleware

In your module file:

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FileUploadMiddleware } from '../common/middlewares/file-upload.middleware';

@Module({
  // your module configuration
})
export class YourModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FileUploadMiddleware)
      .forRoutes(
        { path: 'your-endpoint', method: RequestMethod.POST },
        { path: 'your-endpoint/:id', method: RequestMethod.PATCH }
      );
  }
}
```

### 3. Access the Uploaded File in Controller

```typescript
@Post()
@ApiConsumes('multipart/form-data')
create(@Body() createDto: CreateDto, @Req() req: any) {
  const file = req.file;
  return this.yourService.create(createDto, file);
}
```

### 4. Handle the File in Service

```typescript
async create(createDto: CreateDto, file?: Express.Multer.File) {
  let fileUrl = null;
  
  if (file) {
    const uploadResult = await this.s3Service.uploadFile(file);
    fileUrl = uploadResult.url;
  }
  
  // Save the fileUrl to your entity
  const newEntity = this.repository.create({
    ...createDto,
    fileUrl,
  });
  
  return this.repository.save(newEntity);
}
```

## Supported File Types

The middleware is configured to accept the following file types:

- Images: jpeg, jpg, png, gif, webp
- Videos: mp4, webm, ogg

File size is limited to 10MB by default.