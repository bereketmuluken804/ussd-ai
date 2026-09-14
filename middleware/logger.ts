import { Request, Response, NextFunction } from "express";

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
 
  const logData: Record<string, unknown> = {
    timestamp,
    method,
    url,
    ip,
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    logData.body = req.body;
  }

  console.log(JSON.stringify(logData));

  next();
}