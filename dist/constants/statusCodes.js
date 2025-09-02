"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusCode = void 0;
class StatusCode {
    static OK = 200;
    static CREATED = 201;
    static NO_CONTENT = 204;
    static BAD_REQUEST = 400;
    static UNAUTHORIZED = 401;
    static FORBIDDEN = 403;
    static NOT_FOUND = 404;
    static CONFLICT = 409;
    static INTERNAL_SERVER_ERROR = 500;
    static SERVICE_UNAVAILABLE = 503;
    // Optional: Add a method if you want to describe the status
    static getMessage(code) {
        switch (code) {
            case this.OK: return "OK";
            case this.CREATED: return "Created";
            case this.BAD_REQUEST: return "Bad Request";
            case this.UNAUTHORIZED: return "Unauthorized";
            case this.FORBIDDEN: return "Forbidden";
            case this.NOT_FOUND: return "Not Found";
            case this.CONFLICT: return "Conflict";
            case this.INTERNAL_SERVER_ERROR: return "Internal Server Error";
            case this.SERVICE_UNAVAILABLE: return "Service Unavailable";
            default: return "Unknown Status";
        }
    }
}
exports.StatusCode = StatusCode;
