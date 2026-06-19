class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

const getErrorMessage = (error, fallback = 'Something went wrong') => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
    if (typeof error.stderr === 'string' && error.stderr.trim()) return error.stderr;
    if (error.error) return getErrorMessage(error.error, fallback);
    return fallback;
};

const isTimeLimitError = (error) => {
    return Boolean(
        error && (
            error.killed ||
            error.signal === 'SIGTERM' ||
            error.code === 'ETIMEDOUT'
        )
    );
};

const normalizeWhitespace = (value) => {
    return value.replace(/\r\n/g, '\n').trim();
};

const stripShellNoise = (value) => {
    return value
        .split('\n')
        .filter((line) => !line.trim().toLowerCase().startsWith('command failed:'))
        .join('\n')
        .trim();
};

const formatExecutionDetails = (details) => {
    return details ? `\n\nDetails:\n${details}` : '';
};

const normalizeExecutionMessage = (message) => {
    const normalized = stripShellNoise(normalizeWhitespace(message));
    const lowered = normalized.toLowerCase();

    if (!normalized) {
        return 'Execution failed.';
    }

    if (lowered.includes('signed integer overflow')) {
        return `Signed Integer Overflow detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('stack-overflow') || lowered.includes('stack overflow')) {
        return `Stack Overflow detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('division by zero') || lowered.includes('divide by zero')) {
        return `Division by Zero detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('out_of_range')
        || lowered.includes('out of range')
        || lowered.includes('heap-buffer-overflow')
        || lowered.includes('buffer overflow')
        || lowered.includes('index out of bounds')
        || lowered.includes('subscript out of range')) {
        return `Out of Bounds access detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('null pointer')
        || lowered.includes('segmentation fault')
        || lowered.includes('access violation')) {
        return `Invalid Memory Access detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('floating point exception')) {
        return `Floating Point Exception detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('memoryerror')) {
        return `Memory Limit issue detected.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('recursionerror')) {
        return `Maximum Recursion Depth exceeded.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('traceback (most recent call last):')) {
        return `Runtime Error.${formatExecutionDetails(normalized)}`;
    }

    if (lowered.includes('runtime error:')) {
        return `Runtime Error.${formatExecutionDetails(normalized)}`;
    }


    return normalized;
};

const createExecutionError = ({ error, stderr, stdout, timeoutMs = 15000, stage = 'execution' }) => {
    const timedOut = stage === 'execution' && isTimeLimitError(error);
    const cleanedStderr = typeof stderr === 'string' ? stripShellNoise(stderr.trim()) : '';
    const cleanedStdout = typeof stdout === 'string' ? stdout.trim() : '';
    const fallbackMessage = stage === 'compilation' ? 'Compilation failed.' : 'Execution failed.';

    const rawMessage = timedOut
        ? `Time Limit Exceeded. Your code ran for more than ${timeoutMs / 1000} seconds.`
        : cleanedStderr
            ? cleanedStderr
            : cleanedStdout
                ? cleanedStdout
                : stripShellNoise(getErrorMessage(error, fallbackMessage));

    const message = stage === 'compilation'
        ? (rawMessage || fallbackMessage)
        : (timedOut ? rawMessage : normalizeExecutionMessage(rawMessage));

    const executionError = new Error(message || fallbackMessage);
    executionError.code = timedOut
        ? 'TIME_LIMIT_EXCEEDED'
        : stage === 'compilation'
            ? 'COMPILATION_ERROR'
            : 'EXECUTION_ERROR';
    executionError.stderr = stderr || '';
    executionError.stdout = stdout || '';
    executionError.stage = stage;
    return executionError;
};

const sendSuccess = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        ...data,
    });
};

const sendError = (res, error) => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
    const payload = {
        success: false,
        error: {
            code,
            message: getErrorMessage(error),
        },
    };

    if (error instanceof AppError && error.details !== undefined) {
        payload.error.details = error.details;
    }

    return res.status(statusCode).json(payload);
};

module.exports = {
    AppError,
    createExecutionError,
    getErrorMessage,
    normalizeExecutionMessage,
    sendError,
    sendSuccess,
};


