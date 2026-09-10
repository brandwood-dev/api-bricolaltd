import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class BookingGlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Une erreur est survenue.',
        details: null as unknown,
      },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      const message =
        typeof raw === 'string'
          ? raw
          : (raw as any)?.message ?? JSON.stringify(raw);
      payload.error.code = this.httpStatusToCode(status, message);
      payload.error.message = message;
      return res.status(status).json(payload);
    }

    if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      const pgCode = (exception as any).code;
      if (pgCode === '23505') {
        payload.error.code = 'DUPLICATE_CONSTRAINT';
        payload.error.message =
          'Réservation déjà existante ou contrainte empêchant la création.';
      } else if (pgCode === '23503') {
        payload.error.code = 'FOREIGN_KEY_VIOLATION';
        payload.error.message =
          'Référence invalide (utilisateur ou outil introuvable).';
      } else {
        payload.error.code = 'DATABASE_ERROR';
        payload.error.message =
          'Erreur base de données. Réessayez ultérieurement.';
      }
      console.error('[DB ERROR]', exception);
      return res.status(status).json(payload);
    }

    console.error('[UNHANDLED ERROR]', exception);
    return res.status(status).json(payload);
  }

  private httpStatusToCode(status: number, msg: string): string {
    if (status === 400) {
      if (/déjà réservé|already booked|tool is already booked/i.test(msg)) {
        return 'TOOL_ALREADY_BOOKED';
      }
      if (/disponible|not available|tool is not available/i.test(msg)) {
        return 'TOOL_NOT_AVAILABLE';
      }
      if (
        /fin.*après début|end.*must.*after.*start|end date must be after start date/i.test(
          msg,
        )
      ) {
        return 'INVALID_DATE_RANGE';
      }
      if (/passé|in the past|date cannot be in the past/i.test(msg)) {
        return 'DATE_IN_THE_PAST';
      }
      if (/pickup/i.test(msg)) {
        return 'INVALID_PICKUP_TIME';
      }
      if (/min.*1 jour|minimum.*1 day|minimum|duration|short.*duration|1 jour complet/i.test(msg)) {
        return 'DURATION_TOO_SHORT';
      }
      if (/format.*date|invalid date format|format.*invalide/i.test(msg)) {
        return 'INVALID_DATE_FORMAT';
      }
      return 'VALIDATION_ERROR';
    }
    if (status === 401) return 'AUTH_REQUIRED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    return `HTTP_${status}`;
  }
}
