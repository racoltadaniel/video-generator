const Bull = require('bull');
const path = require('path');
const { spawn } = require('child_process');

const videoQueue = new Bull('videoQueue', 'redis://127.0.0.1:6379');

videoQueue.process(async (job) => {
    const { text } = job.data;
    console.log('Hello, Node.js!');

    // Path to your Python script
    const pythonScriptPath = path.join(__dirname, '../Text-To-Video-AI/app.py');

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [pythonScriptPath, text, job.id]);

        pythonProcess.stdout.on('data', (data) => {
            const videoPath = data.toString().trim();
            console.log(videoPath);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            reject(new Error('Video generation failed'));
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                // Resolve the promise once the process ends
                resolve({ videoUrl: `http://localhost:3000/rendered_video.mp4` });
            } else {
                // Reject the promise if the process exits with an error code
                reject(new Error(`Python script exited with code ${code}`));
            }
        });
    });
});

module.exports = videoQueue;