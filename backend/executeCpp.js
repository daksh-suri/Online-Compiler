const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createExecutionError } = require('./utils/errors.js');

const outputDirectory = path.join(__dirname, 'outputs');
const TIMEOUT_MS = 15000;
const COMPILE_FLAGS = ['-std=c++17', '-Wall', '-Wextra', '-O0', '-g', '-D_GLIBCXX_DEBUG'];

if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
}

const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) return reject({ error, stdout, stderr });
            resolve({ stdout, stderr });
        });
    });
};

const executeCpp = async (filePath) => {
    const jobId = path.basename(filePath, path.extname(filePath));
    const executable = process.platform === 'win32' ? `${jobId}.exe` : `${jobId}.out`;
    const outPath = path.join(outputDirectory, executable);

    try {
        await runCommand(`g++ ${COMPILE_FLAGS.join(' ')} ${quote(filePath)} -o ${quote(outPath)}`);
    } catch ({ error, stdout, stderr }) {
        throw createExecutionError({ error, stdout, stderr, timeoutMs: TIMEOUT_MS, stage: 'compilation' });
    }

    try {
        return await runCommand(quote(outPath));
    } catch ({ error, stdout, stderr }) {
        throw createExecutionError({ error, stdout, stderr, timeoutMs: TIMEOUT_MS, stage: 'execution' });
    }
};

module.exports = executeCpp;
