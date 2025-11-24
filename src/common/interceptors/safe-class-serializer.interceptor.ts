import {
  ClassSerializerInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export class SafeClassSerializerInterceptor extends ClassSerializerInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res: any = context.switchToHttp().getResponse();

    const responseHandled = !!res?.headersSent || !!res?.writableEnded;
    const contentType = res?.getHeader?.('Content-Type');
    const ct = typeof contentType === 'string' ? contentType.toLowerCase() : '';
    const isNonJsonContent =
      ct.includes('text/csv') ||
      ct.includes('application/octet-stream') ||
      ct.includes('application/vnd.openxmlformats') ||
      ct.includes('application/pdf');

    // Bypass class-transformer for non-JSON or already-handled responses
    if (responseHandled || isNonJsonContent) {
      return next.handle();
    }

    return super.intercept(context, next);
  }
}
