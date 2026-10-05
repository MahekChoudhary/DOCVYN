const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
    {
        fileName: {
            type: String,
            required: true
        },

        fileType: {
            type: String,
            required: true
        },

        fileSize: {
            type: Number,
            default: 0
        },

        extractedText: {
            type: String,
            default: ""
        },

        summary: {
            type: String,
            default: ""
        },

        category: {
            type: String,
            default: "Other"
        },

        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Document", documentSchema);