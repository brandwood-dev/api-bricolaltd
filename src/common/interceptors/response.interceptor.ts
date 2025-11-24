import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const res: any = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data: any) => {
        try {
          // If response already handled (e.g., using @Res() for CSV/file), pass through
          if (res?.headersSent || res?.writableEnded) {
            return data;
          }

          // Detect non-JSON content types (CSV, binary, Excel, PDF)
          const contentType = res?.getHeader?.('Content-Type');
          const ct =
            typeof contentType === 'string' ? contentType.toLowerCase() : '';
          const isNonJsonContent =
            ct.includes('text/csv') ||
            ct.includes('application/octet-stream') ||
            ct.includes('application/vnd.openxmlformats') ||
            ct.includes('application/pdf');

          // Detect streams or buffers
          const isStream =
            data && typeof data === 'object' && typeof data.pipe === 'function';
          const isBuffer =
            typeof Buffer !== 'undefined' && Buffer.isBuffer?.(data);

          // Avoid wrapping or transforming non-JSON payloads
          if (isNonJsonContent || isStream || isBuffer) {
            return data;
          }

          // Avoid double-wrapping if payload already matches our envelope
          if (
            data &&
            typeof data === 'object' &&
            'success' in data &&
            'data' in data
          ) {
            return data as ApiResponse<T>;
          }

          // Default: wrap JSON payloads
          return {
            success: true,
            data: data as T,
            message: 'Request successful',
          };
        } catch {
          return {
            success: true,
            data: data as T,
            message: 'Request successful',
          };
        }
      }),
    );
  }
}
