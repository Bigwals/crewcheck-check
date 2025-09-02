"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const statusCodes_1 = require("../constants/statusCodes");
const responseMessages_1 = require("../constants/responseMessages");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.AUTHORIZATION_TOKEN_MISSING });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded) {
            res.status(404).json({ message: "Not Found" });
            return;
        }
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
        return;
    }
};
exports.authenticate = authenticate;
