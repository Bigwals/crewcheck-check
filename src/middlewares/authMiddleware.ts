import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { StatusCode } from '../constants/statusCodes';
import { Messages } from '../constants/responseMessages';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(StatusCode.BAD_REQUEST).json({ message: Messages.AUTHORIZATION_TOKEN_MISSING });
    return;
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(404).json({ message: "Not Found" });
      return;
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const roleId = Number((req as any)?.user?.roleId);

  if (roleId !== 1) {
    res.status(StatusCode.FORBIDDEN).json({ message: Messages.FORBIDDEN });
    return;
  }

  next();
};
