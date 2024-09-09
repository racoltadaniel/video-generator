const express = require('express');
const cors = require('cors');
const videoQueue = require('./queue');
const path = require('path');
const app = express();
const port = 3000;
const fs = require('fs').promises;
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('jobs.db');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.label({ label: 'Express API' }),  // Label to identify source
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, label, message }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'app.log' }),
    ],
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // To serve videos after generation

app.post('/generate-video', async (req, res) => {
    const text  = req.body;
    logger.info(`Received request to generate video with text: ${JSON.stringify(text)}`);

    try {
        // Add the job to the queue
        const job = await videoQueue.add(text);
        logger.info(`Video generation job added to queue with ID: ${job.id}`);

        // Respond with the job ID
        res.json({ jobId: job.id });
    } catch (error) {
        logger.error(`Error adding job to queue: ${error.message}`);
        res.status(500).json({ message: 'Error generating video' });
    }
});
const VIDEO_DIR = '../video-generator'; // Define the directory path

app.get('/video-status/:id', async (req, res) => {
    const jobId = req.params.id;
    const filePath = path.join(VIDEO_DIR, `rendered_video${jobId}.mp4`); // Use template literals

    db.get('SELECT status FROM job_statuses WHERE job_id = ?', [jobId], (err, row) => {
        if (err) {
            logger.error(`Database query error: ${err.message}`);
            res.status(500).json({ state: 'error', message: 'Internal server error' });
            return;
        }

        if (row) {
            // If status is found in the database
            logger.info(`Job ID ${jobId} status from database: ${row.status}`);
            if (row.status === 'processing') {
                res.json({ state: 'processing', message: 'Video is still being processed' });
            } else if (row.status === 'finished') {
                res.json({ state: 'ready', message: 'Video is ready' });
            } else {
                res.json({ state: 'unknown', message: 'Unknown status' });
            }
        } else {
            // If no status is found in the database
            logger.error(`Database query for not found job: ${jobId}`);
            res.json({ state: 'invalid', message: 'Video is not present' });
        }
    });
});

app.get('/video/:videoId', (req, res) => {
    const videoId = req.params.videoId;
    const videoPath = path.join(__dirname, 'rendered_videos', `${videoId}.mp4`);

    fs.stat(videoPath, (err, stats) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(404).json({ error: 'File not found' });
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stats.size);

        // Create a read stream and pipe it to the response
        const readStream = fs.createReadStream(videoPath);
        readStream.pipe(res);

        readStream.on('error', (streamErr) => {
            console.error('Error streaming file:', streamErr);
            res.status(500).json({ error: 'Error streaming file' });
        });

        // Handle case where headers might have already been sent
        res.on('finish', () => {
            console.log('Response finished');
        });
    });
});


app.listen(port, () => {
    logger.info(`Video generation API listening at http://localhost:${port}`);
});

process.on('exit', () => {
    db.close();
});