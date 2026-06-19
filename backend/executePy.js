const { exec } = require('child_process');
const { createExecutionError } = require('./utils/errors.js');

const TIMEOUT_MS = 15000;
const PYTHON_COMMAND = process.env.PYTHON_COMMAND || 'python';
const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const executePy = (filePath) => {
    return new Promise((resolve, reject) => {
        exec(`${PYTHON_COMMAND} ${quote(filePath)}`, { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                return reject(createExecutionError({
                    error,
                    stderr,
                    stdout,
                    timeoutMs: TIMEOUT_MS,
                    stage: 'execution',
                }));
            }

            resolve({ stdout, stderr });
        });
    });
};

module.exports = executePy;
