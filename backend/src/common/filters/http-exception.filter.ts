import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    const body: Record<string, unknown> = {
      statusCode,
      message: typeof payload === 'string' ? payload : (payload as { message?: unknown }).message,
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 透传业务异常携带的结构化信息（如集中度超限的具体资产）
    if (typeof payload === 'object' && payload !== null) {
      const { errorCode, details } = payload as { errorCode?: unknown; details?: unknown };
      if (errorCode !== undefined) body.errorCode = errorCode;
      if (details !== undefined) body.details = details;
    }

    response.status(statusCode).json(body);
  }
}
