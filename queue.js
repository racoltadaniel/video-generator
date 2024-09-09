const Bull = require('bull');
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const videoQueue = new Bull('videoQueue', 'redis://127.0.0.1:6379');


// Create a logger for the Bull queue processor
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.label({ label: 'Bull Queue Processor' }),  // Label to identify source
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, label, message }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'app.log' }),
    ],
});

const db = new sqlite3.Database('jobs.db');

const updateJobStatus = (jobId, status) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO job_statuses (job_id, status) VALUES (?, ?)`, [jobId, status], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

videoQueue.process(async (job) => {
    const text = job.data.text;
    const jobId = job.id;
    logger.info(`Processing job with ID: ${job.id}, Text: ${text}`);
    const pythonScriptPath = path.join(__dirname, '../Text-To-Video-AI/app.py');

    await updateJobStatus(jobId, 'processing');

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [pythonScriptPath, text, job.id]);

        pythonProcess.stdout.on('data', (data) => {
            const videoPath = data.toString().trim();
            logger.info(`Python script output (video path): ${videoPath}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            logger.error(`Python script stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            if (code === 0) {
                logger.info(`Python script finished successfully for job ID: ${job.id}`);
                await updateJobStatus(jobId, 'finished');
                resolve({ videoUrl: `http://localhost:3000/rendered_video.mp4` });
            } else {
                logger.error(`Python script exited with error code ${code} for job ID: ${job.id}`);
                await updateJobStatus(jobId, 'failed');
                reject(new Error(`Python script exited with code ${code}`));
            }
        });
    });
});

process.on('exit', () => {
    db.close();
});

module.exports = videoQueue;