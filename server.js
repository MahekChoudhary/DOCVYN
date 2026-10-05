require("dotenv").config();

const mongoose = require("mongoose");
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");

const Document = require("./models/Document");

const app = express();
const PORT = 3000;

/* =========================
   GEMINI
========================= */

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/* =========================
   MONGODB
========================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err.message);
    });

/* =========================
   EXPRESS SETUP
========================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   VIEWS
========================= */

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* =========================
   UPLOAD FOLDER
========================= */

const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, {
        recursive: true
    });
}

/* =========================
   MULTER
========================= */

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            file.originalname.replace(/\s+/g, "-");

        cb(null, uniqueName);
    }

});

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 20 * 1024 * 1024
    }

});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.render("index");
});

/* =====================================================
   EXTRACT PDF TEXT
===================================================== */

async function extractPDFText(filePath) {

    const buffer = fs.readFileSync(filePath);

    const parser = new PDFParse({
        data: buffer
    });

    try {

        const result = await parser.getText();

        return result.text || "";

    } finally {

        await parser.destroy();

    }

}

/* =====================================================
   EXTRACT DOCX TEXT
===================================================== */

async function extractDOCXText(filePath) {

    const result = await mammoth.extractRawText({
        path: filePath
    });

    return result.value || "";

}

/* =====================================================
   EXTRACT TXT TEXT
===================================================== */

function extractTXTText(filePath) {

    return fs.readFileSync(
        filePath,
        "utf8"
    );

}
/* =====================================================
   AI CONTENT CATEGORIZATION
===================================================== */

async function categorizeDocument(text) {

    const categoryPrompt = `

You are DOCVYN, an intelligent document classification system.

Classify the document based ONLY on its CONTENT.

Choose exactly ONE category from the following:

1. Resume / CV
2. Internship / Offer Letter
3. Academic / Education
4. Certificate
5. Financial
6. Legal
7. Government / Official
8. Identity Document
9. Medical
10. Application Form
11. Research / Academic Paper
12. Other

Rules:

- Return ONLY the category name.
- Do not add explanations.
- Do not create a new category.
- Choose the category that best represents the main purpose of the document.

DOCUMENT CONTENT:

------------------------------

${text.substring(0, 20000)}

------------------------------

Category:
`;

    const response = await ai.models.generateContent({

        model: GEMINI_MODEL,

        contents: categoryPrompt

    });

    let category = response.text?.trim();

    const allowedCategories = [
        "Resume / CV",
        "Internship / Offer Letter",
        "Academic / Education",
        "Certificate",
        "Financial",
        "Legal",
        "Government / Official",
        "Identity Document",
        "Medical",
        "Application Form",
        "Research / Academic Paper",
        "Other"
    ];

    if (!allowedCategories.includes(category)) {
        category = "Other";
    }

    return category;
}

/* =====================================================
   UPLOAD DOCUMENT
===================================================== */

app.post(
    "/upload",
    upload.single("document"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "No document was uploaded."
                });

            }

            const filePath = req.file.path;

            const originalName = req.file.originalname;

            const extension =
                path.extname(originalName).toLowerCase();

            let extractedText = "";

            /* PDF */

            if (extension === ".pdf") {

                console.log("Extracting PDF text...");

                extractedText =
                    await extractPDFText(filePath);

            }
            

            /* DOCX */

            else if (extension === ".docx") {

                console.log("Extracting DOCX text...");

                extractedText =
                    await extractDOCXText(filePath);

            }

            /* TXT */

            else if (extension === ".txt") {

                console.log("Reading TXT file...");

                extractedText =
                    extractTXTText(filePath);

            }

            else {

                return res.status(400).json({
                    success: false,
                    message:
                        "Only PDF, DOCX and TXT files are supported."
                });

            }
            

            /* Clean text */

            extractedText =
                extractedText
                    .replace(/\r/g, "")
                    .replace(/[ \t]+/g, " ")
                    .replace(/\n\s*\n\s*\n+/g, "\n\n")
                    .trim();

            console.log(
                `Extracted ${extractedText.length} characters`
            );

            if (!extractedText) {

                return res.status(400).json({
                    success: false,
                    message:
                        "The document contains no extractable text. If it is a scanned/image-only PDF, OCR will be needed."
                });

            }
            /* =================================================
   AI CONTENT CATEGORY
================================================= */

console.log("🤖 Detecting document category...");

const category =
    await categorizeDocument(extractedText);

console.log(
    "📂 Document category:",
    category
);

            /* =================================================
               SAVE DOCUMENT TO MONGODB
            ================================================= */

          const newDocument = new Document({

    fileName: originalName,

    fileType: extension,

    fileSize: req.file.size,

    extractedText: extractedText,

    summary: "",

    category: category

});

            await newDocument.save();

            console.log(
                "✅ Document saved to MongoDB:",
                newDocument._id
            );

            res.json({

                success: true,

                message:
                    "Document uploaded, extracted and saved successfully.",

                documentId:
                    newDocument._id,

                text:
                    extractedText,

                characters:
                    extractedText.length,

                file: {

                    originalName:
                        originalName,

                    size:
                        req.file.size,

                    type:
                        extension

                }

            });

        }

        catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Document extraction failed: " +
                    error.message

            });

        }

    }
);

/* =====================================================
   GET ALL DOCUMENTS
===================================================== */

app.get("/documents", async (req, res) => {

    try {

        const documents =
            await Document.find()
                .sort({ uploadedAt: -1 });

        res.json({

            success: true,

            documents: documents

        });

    }

    catch (error) {

        console.error(
            "GET DOCUMENTS ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Could not load documents."

        });

    }

});

/* =====================================================
   GET ONE DOCUMENT
===================================================== */

app.get("/documents/:id", async (req, res) => {

    try {

        const document =
            await Document.findById(
                req.params.id
            );

        if (!document) {

            return res.status(404).json({

                success: false,

                message:
                    "Document not found."

            });

        }

        res.json({

            success: true,

            document: document

        });

    }

    catch (error) {

        console.error(
            "GET DOCUMENT ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Could not load document."

        });

    }

});

/* =====================================================
   DELETE DOCUMENT
===================================================== */

app.delete("/documents/:id", async (req, res) => {

    try {

        const document =
            await Document.findById(
                req.params.id
            );

        if (!document) {

            return res.status(404).json({

                success: false,

                message:
                    "Document not found."

            });

        }

        /*
         * Delete physical uploaded file
         */

        const possibleFiles =
            fs.readdirSync(uploadFolder);

        const matchingFile =
            possibleFiles.find(
                file =>
                    file.endsWith(
                        "-" +
                        document.fileName.replace(
                            /\s+/g,
                            "-"
                        )
                    )
            );

        if (matchingFile) {

            const filePath =
                path.join(
                    uploadFolder,
                    matchingFile
                );

            if (fs.existsSync(filePath)) {

                fs.unlinkSync(filePath);

            }

        }

        await Document.findByIdAndDelete(
            req.params.id
        );

        res.json({

            success: true,

            message:
                "Document deleted successfully."

        });

    }

    catch (error) {

        console.error(
            "DELETE DOCUMENT ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Could not delete document."

        });

    }

});

/* =====================================================
   AI ANALYSIS
===================================================== */

app.post(
    "/analyze",
    async (req, res) => {

        try {

            const {
                text,
                documentId
            } = req.body;

            if (!text || !text.trim()) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No document text was provided."

                });

            }

            console.log(
                "AI analysis started..."
            );

            const documentText =
                text.substring(
                    0,
                    120000
                );

            const prompt = `

You are DOCVYN, an intelligent document analysis assistant.

Analyze the document below carefully.

Your job is to help the user UNDERSTAND the document, not simply repeat sentences from it.

Provide:

1. A clear summary
2. The main purpose of the document
3. Important points
4. Important names, dates, amounts or facts
5. Any important conclusions
6. Potential concerns, inconsistencies or things the reader should notice

If something requires reasonable interpretation, explain your reasoning clearly.

Do not invent facts that are not supported by the document.

DOCUMENT:

------------------------------

${documentText}

------------------------------

Give the answer in a clean, easy-to-read format.

`;

           const response =
    await ai.models.generateContent({

        model: "gemini-3.5-flash-lite",

        contents: prompt

    });

            const analysis =
                response.text ||
                "No analysis was generated.";

            console.log(
                "AI analysis completed."
            );

            /*
             * Save analysis to MongoDB
             */

            if (documentId) {

                await Document.findByIdAndUpdate(

                    documentId,

                    {
                        summary: analysis
                    }

                );

                console.log(
                    "✅ Analysis saved to document"
                );

            }

            res.json({

                success: true,

                analysis:
                    analysis

            });

        }

        catch (error) {

            console.error(
                "Gemini analysis error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "AI analysis failed: " +
                    error.message

            });

        }

    }
);

/* =====================================================
   ASK YOUR DOCUMENT
===================================================== */

app.post(
    "/ask",
    async (req, res) => {

        try {

            const {
                text,
                question,
                documentId
            } = req.body;

            if (!text || !text.trim()) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No document text was provided."

                });

            }

            if (!question || !question.trim()) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a question."

                });

            }

            console.log(
                "\n=============================="
            );

            console.log(
                "QUESTION:",
                question
            );

            console.log(
                "=============================="
            );

            const documentText =
                text.substring(
                    0,
                    120000
                );

            const prompt = `

You are DOCVYN, an intelligent AI document assistant.

The user has uploaded a document and is asking you a question about it.

Your task is to answer the user's CURRENT question intelligently using the document as your primary source.

IMPORTANT RULES:

1. Read and understand the document before answering.

2. Do NOT require the answer to appear as an exact sentence in the document.

3. You may infer, interpret, compare and reason from information contained in the document.

4. If the question asks whether something appears genuine, suspicious, important, risky, valid, reasonable, etc., analyze the available evidence in the document and explain your reasoning.

5. If the document does not contain enough information to determine something with certainty, say that clearly and explain what CAN be concluded.

6. Never invent facts.

7. Do not automatically reply "I couldn't find this information in the document."

8. Only say that information is unavailable when the document genuinely provides no useful information for answering the question.

9. Answer the CURRENT question independently.

10. Keep the answer clear and conversational.

11. If appropriate, use short bullet points.

DOCUMENT:

========================================

${documentText}

========================================

USER'S CURRENT QUESTION:

${question}

========================================

Now answer the user's current question.

`;

            const response =
                await ai.models.generateContent({

                    model:
                        GEMINI_MODEL,

                    contents:
                        prompt

                });

            let answer =
                response.text;

            if (!answer || !answer.trim()) {

                answer =
                    "I wasn't able to generate an answer for that question.";

            }

            console.log(
                "ANSWER:",
                answer
            );

            /*
             * Save latest interaction optionally
             * in future chat-history collection.
             */

            res.json({

                success: true,

                answer:
                    answer.trim()

            });

        }

        catch (error) {

            console.error(
                "\nASK ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "AI could not answer the question: " +
                    error.message

            });

        }

    }
);

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof multer.MulterError
        ) {

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }

        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Something went wrong."

        });

    }
);

/* =====================================================
   START SERVER
===================================================== */

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "       DOCVYN SERVER RUNNING"
        );

        console.log(
            "================================="
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "================================="
        );

    }
);