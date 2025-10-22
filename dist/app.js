"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
app.use('/uploads', express_1.default.static('uploads'));
app.get('/', (req, res) => {
    res.send('Welcome to Crew-Check-Backend');
});
// ✅ Start cronjob
// startSequenceJob();
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/user', userRoutes);
app.use('/api/v1', routes_1.default);
// Global error handler
// app.use(errorHandler);
exports.default = app;
