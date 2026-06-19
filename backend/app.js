const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const PORT = process.env.PORT || 4444;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/compilerApp';
const app = express();

const generateFile = require('./generateFile.js');
const addJobToQueue = require('./jobQueue.js');
const Job = require('./models/Job.js');
const { AppError, sendError, sendSuccess } = require('./utils/errors.js');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const runLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // max 10 code runs per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many code execution requests. Please try again later.',
            code: 'RATE_LIMITED',
        },
    },
});

const statusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/run', runLimiter, async (req, res) => {
    const { language, code } = req.body;

    try {
        if (!['cpp', 'py'].includes(language)) {
            throw new AppError('Unsupported language. Use "cpp" or "py".', 400, 'INVALID_LANGUAGE');
        }

        if (typeof code !== 'string' || code.trim() === '') {
            throw new AppError('Code body cannot be empty.', 400, 'EMPTY_CODE');
        }

        const { fileName } = await generateFile(language, code);
        const job = await new Job({ language, filename: fileName }).save();
        const jobId = job._id;
        await addJobToQueue(jobId);
        return sendSuccess(res, { jobId }, 201);
    } catch (error) {
        console.error(error);
        return sendError(res, error);
    }
})

app.get('/status', statusLimiter, async (req, res) => {
    const jobId = req.query.id;

    try {
        if (typeof jobId !== 'string' || jobId.trim() === '') {
            throw new AppError('Missing id query param.', 400, 'MISSING_JOB_ID');
        }

        const job = await Job.findById(jobId);
        if (!job) {
            throw new AppError("Couldn't find job.", 404, 'JOB_NOT_FOUND');
        }
        return sendSuccess(res, { job });
    } catch (error) {
        console.log(error);
        if (error.name === 'CastError') {
            return sendError(res, new AppError('Invalid job id.', 400, 'INVALID_JOB_ID'));
        }

        return sendError(res, error);
    }
})

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('Connected to MongoDB database');

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

