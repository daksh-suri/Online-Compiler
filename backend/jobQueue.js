const Queue = require('bull');
const fs = require('fs');
const path = require('path');
const Job = require('./models/Job.js');
const executeCpp = require('./executeCpp.js');
const executePy = require('./executePy.js');
const { AppError, getErrorMessage } = require('./utils/errors.js');

const NUM_WORKERS = Number(process.env.NUM_WORKERS) || 5;
const codeDirectory = path.join(__dirname, 'srcCodes');
const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};

const jobQueue = new Queue('jobQueue', { redis: redisConfig });
const getRedisAddress = () => `${redisConfig.host}:${redisConfig.port}`;

const markJobFailed = async (job, message) => {
    job.completedAt = new Date();
    job.output = message;
    job.status = 'failure';
    await job.save();
};

jobQueue.process(NUM_WORKERS, async ({ data }) => {
    const job = await Job.findById(data.jobId);
    if (!job) throw new Error('Job not found');

    if (!job.filename) {
        const message = 'Job has no filename recorded; cannot execute.';
        await markJobFailed(job, message);
        throw new AppError(message, 500, 'MISSING_FILENAME');
    }

    const filePath = path.join(codeDirectory, job.filename);
    if (!fs.existsSync(filePath)) {
        const message = `Source file no longer available on disk: ${job.filename}.`;
        await markJobFailed(job, message);
        throw new AppError(message, 500, 'SOURCE_FILE_MISSING');
    }

    try {
        job.startedAt = new Date();
        const output = job.language === 'cpp'
            ? await executeCpp(filePath)
            : await executePy(filePath);

        job.completedAt = new Date();
        job.status = 'success';
        job.output = output.stdout;
        await job.save();
        return true;
    } catch (error) {
        const message = getErrorMessage(error, 'Execution failed');
        await markJobFailed(job, message);
        throw new Error(message);
    }
});

jobQueue.on('failed', (job, error) => {
    console.error(`Job ${job?.data?.jobId || 'unknown'} failed:`, getErrorMessage(error));
});

jobQueue.on('error', (error) => {
    console.error(`Redis queue error at ${getRedisAddress()}:`, getErrorMessage(error));
});

const addJobToQueue = async (jobId) => {
    try {
        await jobQueue.add({ jobId });
    } catch (error) {
        throw new AppError(
            `Queue service is unavailable. Make sure Redis is running at ${getRedisAddress()}.`,
            503,
            'QUEUE_UNAVAILABLE',
            getErrorMessage(error),
        );
    }
};

module.exports = addJobToQueue;
