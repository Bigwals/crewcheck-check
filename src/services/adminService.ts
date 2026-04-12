import { getPool, sql } from '../config/db';
import { randomUUID } from 'crypto';
import { sendPushToMany } from '../helper/notifications';

export interface AdminUserFilters {
  search?: string;
  role?: string;
  status?: boolean;
  base?: string;
  page: number;
  limit: number;
}

export interface UpdateAdminUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  base?: string;
  isReserve?: string;
  activeStatus?: boolean;
}

export interface BroadcastNotificationPayload {
  title: string;
  message: string;
  activeOnly?: boolean;
  base?: string;
}

export interface CreateAdminUserPayload {
  email: string;
  passwordHash: string;
  crewId?: number;
  firstName?: string;
  lastName?: string;
}

const ADMIN_ROLE_ID = 1;

const parseReserveToBit = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'reserve' || normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'line holder' || normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
};

const applyUserFilters = (request: any, filters: AdminUserFilters): string => {
  const where: string[] = ['RoleID <> @adminRoleId'];
  request.input('adminRoleId', sql.Int, ADMIN_ROLE_ID);

  if (filters.search) {
    request.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
    where.push(`
      (
        CAST(CrewID AS NVARCHAR(50)) LIKE @search
        OR FirstName LIKE @search
        OR LastName LIKE @search
        OR Email LIKE @search
      )
    `);
  }

  if (filters.role) {
    const isReserveBit = parseReserveToBit(filters.role);
    if (typeof isReserveBit === 'boolean') {
      request.input('isReserve', sql.Bit, isReserveBit);
      where.push('ISNULL(IsReserve, 0) = @isReserve');
    }
  }

  if (typeof filters.status === 'boolean') {
    request.input('activeStatus', sql.Bit, filters.status);
    where.push('ActiveStatus = @activeStatus');
  }

  if (filters.base) {
    request.input('base', sql.NVarChar, filters.base.trim());
    where.push('Base = @base');
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
};

export const findAdminByEmail = async (email: string) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .input('adminRoleId', sql.Int, ADMIN_ROLE_ID)
    .query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Email = @email AND RoleID = @adminRoleId
    `);

  return result.recordset[0] ?? null;
};

export const elevateUserToAdmin = async (crewId: number, email: string, passwordHash: string) => {
  const pool = await getPool();

  await pool
    .request()
    .input('crewId', sql.Int, crewId)
    .input('email', sql.NVarChar, email)
    .input('passwordHash', sql.NVarChar, passwordHash)
    .input('roleId', sql.Int, ADMIN_ROLE_ID)
    .query(`
      UPDATE Users
      SET
        PasswordHash = @passwordHash,
        RoleID = @roleId,
        ActiveStatus = 1
      WHERE CrewID = @crewId AND Email = @email
    `);

  const result = await pool
    .request()
    .input('crewId', sql.Int, crewId)
    .input('email', sql.NVarChar, email)
    .query(`
      SELECT TOP 1 *
      FROM Users
      WHERE CrewID = @crewId AND Email = @email
    `);

  return result.recordset[0] ?? null;
};

export const elevateUserToAdminByEmail = async (email: string, passwordHash: string) => {
  const pool = await getPool();

  await pool
    .request()
    .input('email', sql.NVarChar, email)
    .input('passwordHash', sql.NVarChar, passwordHash)
    .input('roleId', sql.Int, ADMIN_ROLE_ID)
    .query(`
      UPDATE Users
      SET
        PasswordHash = @passwordHash,
        RoleID = @roleId,
        ActiveStatus = 1
      WHERE Email = @email
    `);

  const result = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Email = @email
      ORDER BY CreatedAt DESC
    `);

  return result.recordset[0] ?? null;
};

export const createAdminUser = async (payload: CreateAdminUserPayload) => {
  const pool = await getPool();

  let nextCrewId = payload.crewId;
  if (!nextCrewId) {
    const nextCrewIdResult = await pool.request().query(`
      SELECT ISNULL(MAX(CrewID), 0) + 1 AS nextCrewId
      FROM Users
    `);
    nextCrewId = Number(nextCrewIdResult.recordset?.[0]?.nextCrewId || 1);
  }

  const now = new Date();

  await pool
    .request()
    .input('userId', sql.UniqueIdentifier, randomUUID())
    .input('crewId', sql.Int, nextCrewId)
    .input('firstName', sql.NVarChar, payload.firstName?.trim() || 'Admin')
    .input('lastName', sql.NVarChar, payload.lastName?.trim() || 'User')
    .input('hireDate', sql.DateTime, now)
    .input('occDate', sql.DateTime, now)
    .input('base', sql.NVarChar, 'N/A')
    .input('seniority', sql.Int, 0)
    .input('airline', sql.NVarChar, 'CrewCheck')
    .input('email', sql.NVarChar, payload.email)
    .input('sex', sql.Bit, 0)
    .input('passwordHash', sql.NVarChar, payload.passwordHash)
    .input('phoneNumber', sql.NVarChar, '0000000000')
    .input('purser', sql.NVarChar, 'false')
    .input('speaker', sql.NVarChar, 'false')
    .input('roleId', sql.Int, ADMIN_ROLE_ID)
    .input('activeStatus', sql.Bit, 1)
    .input('defaultLanguage', sql.VarChar, 'en')
    .input('createdAt', sql.DateTime, now)
    .query(`
      INSERT INTO Users
        (UserID, CrewID, FirstName, LastName, HireDate, OccDate, Base, Seniority, Airline, Email, Sex, PasswordHash, PhoneNumber, Purser, Speaker, RoleID, ActiveStatus, defaultLanguage, CreatedAt)
      VALUES
        (@userId, @crewId, @firstName, @lastName, @hireDate, @occDate, @base, @seniority, @airline, @email, @sex, @passwordHash, @phoneNumber, @purser, @speaker, @roleId, @activeStatus, @defaultLanguage, @createdAt)
    `);

  const result = await pool
    .request()
    .input('email', sql.NVarChar, payload.email)
    .input('adminRoleId', sql.Int, ADMIN_ROLE_ID)
    .query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Email = @email AND RoleID = @adminRoleId
      ORDER BY CreatedAt DESC
    `);

  return result.recordset[0] ?? null;
};

export const getAdminUsers = async (filters: AdminUserFilters) => {
  const fetchAll = filters.limit === 0;
  const offset = fetchAll ? 0 : (filters.page - 1) * filters.limit;
  const pool = await getPool();

  const countRequest = pool.request();
  const countWhereClause = applyUserFilters(countRequest, filters);
  const countResult = await countRequest.query(`
    SELECT COUNT(1) AS total
    FROM Users
    ${countWhereClause}
  `);

  const dataRequest = pool.request();
  const dataWhereClause = applyUserFilters(dataRequest, filters);
  const selectFields = `
    SELECT
      CrewID AS crewId,
      Seniority AS seniorityNo,
      FirstName AS firstName,
      LastName AS lastName,
      CONCAT(FirstName, ' ', LastName) AS name,
      CASE WHEN ISNULL(IsReserve, 0) = 1 THEN 'Reserve' ELSE 'Line Holder' END AS role,
      CASE WHEN ActiveStatus = 1 THEN 'Active' ELSE 'Inactive' END AS status,
      ActiveStatus AS activeStatus,
      Base AS base,
      Email AS email,
      PhoneNumber AS phoneNumber,
      RoleID AS roleId
    FROM Users
    ${dataWhereClause}
    ORDER BY Seniority ASC, CrewID ASC
  `;

  let dataResult;
  if (fetchAll) {
    dataResult = await dataRequest.query(selectFields);
  } else {
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, filters.limit);
    dataResult = await dataRequest.query(`${selectFields}\nOFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
  }

  const total = Number(countResult.recordset?.[0]?.total ?? 0);

  return {
    users: dataResult.recordset,
    pagination: {
      page: fetchAll ? 1 : filters.page,
      limit: fetchAll ? total : filters.limit,
      total,
      totalPages: fetchAll ? 1 : total > 0 ? Math.ceil(total / filters.limit) : 0,
    },
  };
};

export const getUserByCrewId = async (crewId: number) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('crewId', sql.Int, crewId)
    .query(`
      SELECT TOP 1
        CrewID AS crewId,
        Seniority AS seniorityNo,
        FirstName AS firstName,
        LastName AS lastName,
        Email AS email,
        PhoneNumber AS phoneNumber,
        Base AS base,
        CASE WHEN ISNULL(IsReserve, 0) = 1 THEN 'Reserve' ELSE 'Line Holder' END AS role,
        ActiveStatus AS activeStatus,
        CASE WHEN ActiveStatus = 1 THEN 'Active' ELSE 'Inactive' END AS status,
        RoleID AS roleId,
        UserID AS userId,
        Airline AS airline,
        Purser AS purser,
        Speaker AS speaker
      FROM Users
      WHERE CrewID = @crewId
    `);

  return result.recordset[0] ?? null;
};

export const updateAdminUser = async (crewId: number, payload: UpdateAdminUserPayload) => {
  const pool = await getPool();

  const request = pool.request();
  const setClauses: string[] = [];

  request.input('crewId', sql.Int, crewId);

  if (payload.firstName !== undefined) {
    request.input('firstName', sql.NVarChar, payload.firstName);
    setClauses.push('FirstName = @firstName');
  }

  if (payload.lastName !== undefined) {
    request.input('lastName', sql.NVarChar, payload.lastName);
    setClauses.push('LastName = @lastName');
  }

  if (payload.email !== undefined) {
    request.input('email', sql.NVarChar, payload.email);
    setClauses.push('Email = @email');
  }

  if (payload.phoneNumber !== undefined) {
    request.input('phoneNumber', sql.NVarChar, payload.phoneNumber);
    setClauses.push('PhoneNumber = @phoneNumber');
  }

  if (payload.base !== undefined) {
    request.input('base', sql.NVarChar, payload.base);
    setClauses.push('Base = @base');
  }

  if (payload.isReserve !== undefined) {
    const isReserveBit = parseReserveToBit(payload.isReserve);
    if (typeof isReserveBit === 'boolean') {
      request.input('isReserve', sql.Bit, isReserveBit);
      setClauses.push('IsReserve = @isReserve');
    }
  }

  if (payload.activeStatus !== undefined) {
    request.input('activeStatus', sql.Bit, payload.activeStatus);
    setClauses.push('ActiveStatus = @activeStatus');
  }

  if (setClauses.length > 0) {
    await request.query(`
      UPDATE Users
      SET ${setClauses.join(', ')}
      WHERE CrewID = @crewId
    `);
  }

  return getUserByCrewId(crewId);
};

export const getUsersForCsvExport = async (filters: Omit<AdminUserFilters, 'page' | 'limit'>) => {
  const pool = await getPool();
  const request = pool.request();

  const where = applyUserFilters(request, {
    ...filters,
    page: 1,
    limit: 100,
  });

  const result = await request.query(`
    SELECT
      CrewID AS crewId,
      Seniority AS seniorityNo,
      FirstName AS firstName,
      LastName AS lastName,
      CONCAT(FirstName, ' ', LastName) AS name,
      CASE WHEN ISNULL(IsReserve, 0) = 1 THEN 'Reserve' ELSE 'Line Holder' END AS role,
      CASE WHEN ActiveStatus = 1 THEN 'Active' ELSE 'Inactive' END AS status,
      Base AS base,
      Email AS email,
      PhoneNumber AS phoneNumber
    FROM Users
    ${where}
    ORDER BY Seniority ASC, CrewID ASC
  `);

  return result.recordset;
};


export const getAdminDashboardData = async (days: number = 7) => {
  const pool = await getPool();

  // 1) Top cards
  const statsResult = await pool.request().query(`
    SELECT
      COUNT(CASE WHEN RoleID <> 1 THEN 1 END) AS totalSignups,
      COUNT(CASE WHEN RoleID <> 1 AND ISNULL(OtpVerified, 0) = 1 THEN 1 END) AS totalVerifiedUsers,
      COUNT(CASE WHEN RoleID <> 1 AND ISNULL(ActiveStatus, 0) = 1 THEN 1 END) AS registeredSubscribers,
      COUNT(CASE WHEN RoleID <> 1 AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 END) AS dailyUsers
    FROM Users;
  `);

  // 2) Revenue chart (placeholder trend from user growth)
  // Agar aapke paas actual revenue table ho, is query ko us se replace kar dena.
  const trendResult = await pool.request().input('days', sql.Int, days).query(`
    WITH DateSeries AS (
      SELECT CAST(DATEADD(DAY, -(@days - 1), CAST(GETDATE() AS DATE)) AS DATE) AS d
      UNION ALL
      SELECT DATEADD(DAY, 1, d)
      FROM DateSeries
      WHERE d < CAST(GETDATE() AS DATE)
    ),
    DailySignup AS (
      SELECT CAST(CreatedAt AS DATE) AS d, COUNT(*) AS c
      FROM Users
      WHERE RoleID <> 1
      GROUP BY CAST(CreatedAt AS DATE)
    )
    SELECT
      FORMAT(ds.d, 'dd MMM') AS label,
      ISNULL(s.c, 0) * 100 AS amount
    FROM DateSeries ds
    LEFT JOIN DailySignup s ON s.d = ds.d
    OPTION (MAXRECURSION 100);
  `);

  const stats = statsResult.recordset[0] || {
    totalSignups: 0,
    totalVerifiedUsers: 0,
    registeredSubscribers: 0,
    dailyUsers: 0,
  };

  const revenueSeries = trendResult.recordset || [];

  const totalRevenue = revenueSeries.reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
  const previous = revenueSeries.slice(0, -1).reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
  const change = totalRevenue - previous;

  return {
    stats: {
      totalSignups: Number(stats.totalSignups || 0),
      totalVerifiedUsers: Number(stats.totalVerifiedUsers || 0),
      registeredSubscribers: Number(stats.registeredSubscribers || 0),
      dailyUsers: Number(stats.dailyUsers || 0),
    },
    revenue: {
      currency: 'USD',
      total: totalRevenue,
      change,
      series: revenueSeries, 
    },
  };
};

export const sendAdminBroadcastNotification = async (payload: BroadcastNotificationPayload) => {
  const pool = await getPool();
  const request = pool.request();

  const where: string[] = [
    'RoleID <> @adminRoleId',
    'DeviceToken IS NOT NULL',
    "LTRIM(RTRIM(DeviceToken)) <> ''",
  ];

  request.input('adminRoleId', sql.Int, ADMIN_ROLE_ID);

  if (payload.activeOnly !== false) {
    where.push('ActiveStatus = 1');
  }

  if (payload.base && payload.base.trim()) {
    request.input('base', sql.NVarChar, payload.base.trim());
    where.push('Base = @base');
  }

  const result = await request.query(`
    SELECT DeviceToken
    FROM Users
    WHERE ${where.join(' AND ')}
  `);

  const tokens = result.recordset.map((row: any) => row.DeviceToken as string);
  const deliveryStats = await sendPushToMany(tokens, payload.title, payload.message);

  return {
    targetedUsers: tokens.length,
    successCount: deliveryStats.successCount,
    failureCount: deliveryStats.failureCount,
  };
};