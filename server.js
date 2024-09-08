const express = require('express');
const cors = require('cors');
const videoQueue = require('./queue');
const path = require('path');
const app = express();
const port = 3000;
const fs = require('fs').promises;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // To serve videos after generation

app.post('/generate-video', async (req, res) => {
    const text  = req.body;
    console.log(text)
    // Add the job to the queue
    const job = await videoQueue.add(text);

    // Respond with the job ID
    res.json({ jobId: job.id });
});
const VIDEO_DIR = '/home/dani/workspaces/video-generator'; // Define the directory path

app.get('/video-status/:id', async (req, res) => {
    const jobId = req.params.id;
    const filePath = path.join(VIDEO_DIR, `rendered_video${jobId}.mp4`); // Use template literals

    try {
        await fs.access(filePath);
        res.json({ state: 'ready', message: 'Video is ready' });
    } catch {
        res.json({ state: 'processing', message: 'Video is still being processed' });
    }
});

app.get('/video/:id', (req, res) => {
    const jobId = req.params.id;
    const fileName = `rendered_video${jobId}.mp4`;
    const filePath = path.join(__dirname, fileName);
    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Video generation API listening at http://localhost:${port}`);
});
