const Bull = require('bull');
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const videoQueue = new Bull('videoQueue', 'redis://127.0.0.1:6379');
const fs = require('fs');

// Define the path to the property file
const propertiesFilePath = '/etc/properties/videogen.properties';

// Function to read and parse the properties file
function loadProperties(filePath) {
    const properties = {};
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');

        lines.forEach(line => {
            // Skip empty lines and lines starting with # (comments)
            if (line.trim() === '' || line.trim().startsWith('#')) return;

            const [key, value] = line.split('=');
            if (key && value) {
                properties[key.trim()] = value.trim();
            }
        });
    } catch (err) {
        console.error(`Error reading properties file: ${err}`);
    }
    return properties;
}

// Load properties
const properties = loadProperties(propertiesFilePath);

// Access the pythonScriptPath property
const pythonScriptPath = properties['pythonScriptPath'] ? properties['pythonScriptPath'] : path.join(__dirname, '../Text-To-Video-AI/app.py');

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
                logger.error("Error ocurred inserting in db for job id %s", jobId)
                reject(err);
            } else {
                logger.info("Inserting in db for job id %s", jobId)
                resolve();
            }
        });
    });
};

videoQueue.process(async (job) => {
    const text = job.data.text;
    const jobId = job.id;
    const language = job.data.language;
    const youtubeUrl = job.data.youtubeLink;
    const audioVolume = job.data.volume;
    logger.info(`Processing job with ID: ${job.id}, Text: ${text}, Language: ${language}, scriptUsed ${pythonScriptPath}, 
        youtubeUrl ${youtubeUrl}, audioVolume ${audioVolume}`);

    await updateJobStatus(jobId, 'processing');

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [pythonScriptPath, text, job.id, language, youtubeUrl, audioVolume]);

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