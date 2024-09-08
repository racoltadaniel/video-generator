const express = require('express');
const cors = require('cors');
const videoQueue = require('./queue');
const path = require('path');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // To serve videos after generation

app.post('/generate-video', async (req, res) => {
    const { text } = req.body;
    console.log('Hello, Node.js!');

    
    // Add the job to the queue
    const job = await videoQueue.add({ text });

    // Respond with the job ID
    res.json({ jobId: job.id });
});

app.get('/video-status/:id', async (req, res) => {
    const jobId = req.params.id;
    const job = await videoQueue.getJob(jobId);

    if (job) {
        const state = await job.getState();
        const result = await job.finished().catch(() => null);

        res.json({ state, result });
    } else {
        res.status(404).json({ message: 'Job not found' });
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
