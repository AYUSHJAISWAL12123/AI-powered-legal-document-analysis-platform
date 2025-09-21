import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir =multer({ storage: multer.memoryStorage() });
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed!'));
        }
    }
});

async function analyzeLegalDocument(filePath, originalName) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const fileExtension = path.extname(originalName).toLowerCase();
        const fileBuffer = fs.readFileSync(filePath);
        
        const prompt = `
        Analyze this legal document and provide a detailed assessment in the following format:

        KEY IMPORTANT POINTS:
        - Identify and highlight critical clauses, terms, deadlines, and obligations
        - Payment terms, amounts, and due dates
        - Liability and indemnification clauses
        - Termination conditions and notice requirements
        - Intellectual property rights and restrictions
        - Governing law and jurisdiction

        SUSPICIOUS ELEMENTS:
        - Unusual or non-standard terms that may be problematic
        - Missing standard clauses that should be present
        - Ambiguous language that could lead to disputes
        - Terms heavily favoring one party
        - Potential red flags or concerning provisions

        RISK ASSESSMENT:
        - Overall risk level (Low/Medium/High) with explanation
        - Financial risks and exposure
        - Legal compliance risks
        - Operational risks
        - Relationship risks

        RECOMMENDATIONS:
        - Specific items that require careful review or negotiation
        - Suggested modifications or additions
        - Areas where legal counsel should be consulted
        - Due diligence items to verify

        Please be thorough and practical in your analysis.
        `;
        
        let result;
        
        if (fileExtension === '.pdf') {
            const pdfPart = {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: 'application/pdf'
                }
            };
            
            result = await model.generateContent([
                { text: prompt },
                pdfPart
            ]);
        } 
        else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
            // For image files
            const imagePart = {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: getImageMimeType(fileExtension)
                }
            };
            
            result = await model.generateContent([
                { text: prompt },
                imagePart
            ]);
        }
        else {
            throw new Error('Unsupported file type');
        }
        
        const response = await result.response;
        const analysis = response.text();
        
        return {
            analysis: analysis,
            fileName: originalName,
            fileType: fileExtension,
            timestamp: new Date().toISOString(),
            success: true
        };
        
    } catch (error) {
        console.error('Error in analyzeLegalDocument:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

// Alternative PDF handling - treat PDFs as images for OCR
async function extractTextFromPDF(buffer) {
    return "PDF_BINARY_DATA"; 
}

// Get image MIME type
function getImageMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    };
    return mimeTypes[extension] || 'image/jpeg';
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        geminiConfigured: !!process.env.GEMINI_API_KEY
    });
});

app.post('/api/analyze', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Gemini API key not configured' 
            });
        }

        console.log(`Analyzing file: ${req.file.originalname}`);
        
        const analysis = await analyzeLegalDocument(req.file.path, req.file.originalname);
        
        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
        
        res.json(analysis);
        
    } catch (error) {
        console.error('Analysis error:', error);
        
        // Clean up uploaded file in case of error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                error: 'File too large. Maximum size is 10MB.' 
            });
        }
    }
    
    res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Legal Document Analyzer server running on port ${PORT}`);
    console.log(`📂 Upload directory: uploads/`);
    console.log(`🔑 Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});


export default app;
