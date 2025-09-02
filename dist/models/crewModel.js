"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crew = void 0;
const mongoose_1 = require("mongoose");
// Mongoose schema definition
const CrewSchema = new mongoose_1.Schema({
    UserID: {
        type: String
    },
    CrewID: {
        type: Number
    },
    FirstName: { type: String },
    LastName: { type: String },
    HireDate: { type: Date },
    Base: { type: String },
});
// Export the model
exports.Crew = (0, mongoose_1.model)('Crews', CrewSchema, 'Crews');
