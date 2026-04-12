import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';
import { StatusCode } from '../constants/statusCodes';
import { Messages } from '../constants/responseMessages';
import {
  adminLoginSchema,
  adminSignupSchema,
  adminListUsersQuerySchema,
  adminBroadcastSchema,
  adminUpdateUserSchema,
} from '../validations/authValidation';
import {
  elevateUserToAdminByEmail,
  createAdminUser,
  findAdminByEmail,
  getAdminUsers,
  getUserByCrewId,
  updateAdminUser,
  getUsersForCsvExport,
  getAdminDashboardData,
  sendAdminBroadcastNotification,
} from '../services/adminService';

const toCsv = (rows: Record<string, any>[]): string => {
  if (!rows.length) {
    return 'crewId,seniorityNo,name,role,status,base,email,phoneNumber\n';
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: any) => {
    const raw = value === null || value === undefined ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }

  return `${lines.join('\n')}\n`;
};

const parseStatus = (status?: string): boolean | undefined => {
  if (!status) return undefined;

  const normalized = status.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'true') return true;
  if (normalized === 'inactive' || normalized === 'false') return false;

  return undefined;
};

export const adminSignup = async (req: Request, res: Response): Promise<any> => {
  try {
    const { crewId, firstName, lastName, email, password } = adminSignupSchema.parse(req.body);

    const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT) || 10);
    let adminUser = await elevateUserToAdminByEmail(email, hashedPassword);

    if (!adminUser) {
      adminUser = await createAdminUser({
        email,
        passwordHash: hashedPassword,
        crewId,
        firstName,
        lastName,
      });
    }

    if (!adminUser) {
      return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }

    const token = generateToken({
      id: adminUser.UserID,
      crewId: adminUser.CrewID,
      email: adminUser.Email,
      roleId: adminUser.RoleID,
    });

    return res.status(StatusCode.CREATED).json({
      message: 'Admin signup successful.',
      admin: {
        userId: adminUser.UserID,
        crewId: adminUser.CrewID,
        firstName: adminUser.FirstName,
        lastName: adminUser.LastName,
        email: adminUser.Email,
        roleId: adminUser.RoleID,
      },
      token,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const adminLogin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);

    const admin = await findAdminByEmail(email);
    if (!admin || !admin.PasswordHash) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
    }

    const isMatch = await bcrypt.compare(password, admin.PasswordHash);
    if (!isMatch) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
    }

    const token = generateToken({
      id: admin.UserID,
      crewId: admin.CrewID,
      email: admin.Email,
      roleId: admin.RoleID,
    });

    return res.status(StatusCode.OK).json({
      message: 'Admin login successful.',
      admin: {
        userId: admin.UserID,
        crewId: admin.CrewID,
        firstName: admin.FirstName,
        lastName: admin.LastName,
        email: admin.Email,
        roleId: admin.RoleID,
      },
      token,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const listAdminUsers = async (req: Request, res: Response): Promise<any> => {
  try {
    const query = adminListUsersQuerySchema.parse(req.query);

    const result = await getAdminUsers({
      search: query.search,
      role: query.role,
      status: parseStatus(query.status),
      base: query.base,
      page: 1,
      limit: 0,
    });

    return res.status(StatusCode.OK).json({
      message: 'Users fetched successfully.',
      ...result,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const getAdminUserDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const crewId = Number(req.params.crewId);
    if (!crewId || Number.isNaN(crewId)) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
    }

    const user = await getUserByCrewId(crewId);
    if (!user) {
      return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
    }

    return res.status(StatusCode.OK).json({
      message: 'User details fetched successfully.',
      user,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const updateAdminUserDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const crewId = Number(req.params.crewId);
    if (!crewId || Number.isNaN(crewId)) {
      return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
    }

    const body = adminUpdateUserSchema.parse(req.body);
    const updated = await updateAdminUser(crewId, body);

    if (!updated) {
      return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
    }

    return res.status(StatusCode.OK).json({
      message: Messages.PROFILE_UPDATED,
      user: updated,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const exportAdminUsersCsv = async (req: Request, res: Response): Promise<any> => {
  try {
    const query = adminListUsersQuerySchema.parse(req.query);

    const rows = await getUsersForCsvExport({
      search: query.search,
      role: query.role,
      status: parseStatus(query.status),
      base: query.base,
    });
    
    const csv = toCsv(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');

    return res.status(StatusCode.OK).send(csv);
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const getAdminDashboard = async (req: Request, res: Response): Promise<any> => {
  try {
    const days = Number(req.query.days || 7);
    const data = await getAdminDashboardData(days);

    return res.status(StatusCode.OK).json({
      message: 'Dashboard fetched successfully.',
      ...data,
    });
  } catch (error: any) {
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};

export const broadcastAdminNotification = async (req: Request, res: Response): Promise<any> => {
  try {
    const normalizedPayload = {
      title: req.body?.title,
      message: req.body?.message ?? req.body?.text ?? req.body?.body,
      activeOnly: req.body?.activeOnly,
      base: req.body?.base,
    };

    const parsedPayload = adminBroadcastSchema.safeParse(normalizedPayload);
    if (!parsedPayload.success) {
      console.warn('Invalid broadcast payload received:', {
        body: req.body,
        errors: parsedPayload.error.flatten(),
      });

      return res.status(StatusCode.BAD_REQUEST).json({
        message: 'Invalid notification payload.',
        errors: parsedPayload.error.flatten(),
      });
    }

    const payload = parsedPayload.data;
    const result = await sendAdminBroadcastNotification(payload);

    return res.status(StatusCode.OK).json({
      message: 'Notification broadcasted successfully.',
      ...result,
    });
  } catch (error: any) {
    console.error('broadcastAdminNotification error:', error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      message: Messages.INTERNAL_SERVER_ERROR,
      error: error.message,
    });
  }
};