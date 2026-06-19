import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import moment from 'moment';
import Stubs from './Stubs.jsx';
import CodeEditor from './CodeEditor.jsx';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4444';

const getDefaultLanguage = () => localStorage.getItem('default-language') || 'cpp';

const STATUS_LABELS = {
    pending: 'Queued',
    running: 'Running',
    processing: 'Running',
    success: 'Success',
    failure: 'Failed',
    failed: 'Failed',
    error: 'Error',
};

const App = () => {
    const defaultLanguage = getDefaultLanguage();
    const [code, setCode] = useState(() => Stubs[defaultLanguage]);
    const [output, setOutput] = useState('');
    const [language, setLanguage] = useState(defaultLanguage);
    const [status, setStatus] = useState('');
    const [submission, setSubmission] = useState(null);

    const [outputVisible, setOutputVisible] = useState(() => {
        const stored = localStorage.getItem('output-visible');
        return stored === null ? true : stored === 'true';
    });

    const [splitPercent, setSplitPercent] = useState(() => {
        const stored = localStorage.getItem('split-percent');
        const parsed = stored === null ? NaN : parseFloat(stored);
        if (Number.isNaN(parsed)) return 58;
        return Math.min(80, Math.max(20, parsed));
    });

    const workspaceRef = useRef(null);
    const draggingRef = useRef(false);

    useEffect(() => {
        localStorage.setItem('output-visible', String(outputVisible));
    }, [outputVisible]);

    useEffect(() => {
        localStorage.setItem('split-percent', String(splitPercent));
    }, [splitPercent]);

    const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
        const apiError = error?.response?.data?.error || error?.error || error;
        if (typeof apiError === 'string') return apiError;
        if (apiError?.message) return apiError.message;
        if (error?.message) return error.message;
        return fallback;
    };

    const handleDividerMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;

        const handleMouseMove = (ev) => {
            if (!draggingRef.current) return;
            const rect = workspaceRef.current?.getBoundingClientRect();
            if (!rect) return;
            const next = ((ev.clientX - rect.left) / rect.width) * 100;
            setSplitPercent(Math.min(80, Math.max(20, next)));
        };

        const handleMouseUp = () => {
            draggingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const submitHandler = async () => {
        setOutputVisible(true);
        let intervalId;
        setOutput('');
        setSubmission(null);
        setStatus('pending');

        try {
            const { data: { jobId } } = await axios.post(`${API_URL}/run`, { language, code });

            intervalId = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_URL}/status?id=${jobId}`);
                    const { success, job, error } = res.data;

                    if (success) {
                        setStatus(job.status);
                        if (job.status === 'pending') return;

                        setOutput(job.output || '');
                        setSubmission({
                            submittedAt: job.submittedAt,
                            startedAt: job.startedAt,
                            completedAt: job.completedAt,
                        });
                        clearInterval(intervalId);
                    } else {
                        setOutput(getApiErrorMessage(error));
                        setStatus('failure');
                        clearInterval(intervalId);
                    }
                } catch (error) {
                    setOutput(getApiErrorMessage(error, 'Failed to fetch job status.'));
                    setStatus('failure');
                    clearInterval(intervalId);
                }
            }, 1000);
        } catch (error) {
            setOutput(getApiErrorMessage(error));
            setStatus('failure');
        }
    };

    const handleLanguageChange = (e) => {
        const nextLanguage = e.target.value;
        if (nextLanguage === language) return;

        const shouldSwitch = window.confirm('Switching language will replace the current code.');
        if (!shouldSwitch) return;

        setLanguage(nextLanguage);
        setCode(Stubs[nextLanguage]);
    };

    const setDefaultLanguage = () => {
        localStorage.setItem('default-language', language);
    };

    const executionTimeMs = (() => {
        if (!submission || !submission.startedAt || !submission.completedAt) return null;
        const start = new Date(submission.startedAt).getTime();
        const end = new Date(submission.completedAt).getTime();
        if (Number.isNaN(start) || Number.isNaN(end)) return null;
        return Math.max(0, end - start);
    })();

    const statusLabel = status ? STATUS_LABELS[status] || status : 'Ready';
    const isBusy = status === 'pending' || status === 'running' || status === 'processing';
    const lineCount = code.split('\n').length;

    return (
        <div className="App">
            <header className="app-header">
                <div className="app-brand">
                    <div className="app-brand-text">
                        <span className="app-title">Online Compiler</span>
                    </div>
                </div>
                <div className="header-meta">
                    <span className="metric">{language === 'cpp' ? 'C++17' : 'Python'}</span>
                    <span className="metric">{lineCount} lines</span>
                    <span className="app-status" data-status={status || 'idle'} aria-live="polite">
                        <span className="dot" />
                        <span>{statusLabel}</span>
                    </span>
                </div>
            </header>

            <div className="toolbar" aria-label="Compiler controls">
                <div className="toolbar-group">
                    <label htmlFor="language-select">Language</label>
                    <select id="language-select" value={language} onChange={handleLanguageChange}>
                        <option value="cpp">C++</option>
                        <option value="py">Python</option>
                    </select>
                    <button type="button" onClick={setDefaultLanguage}>Default</button>
                </div>

                <div className="toolbar-group actions">
                    <button type="button" onClick={() => setOutputVisible(v => !v)}>
                        {outputVisible ? 'Hide output' : 'Show output'}
                    </button>
                    <button type="button" className="primary" onClick={submitHandler} disabled={isBusy}>
                        {isBusy ? 'Running...' : 'Run'}
                    </button>
                </div>
            </div>

            <main className="workspace" ref={workspaceRef}>
                <section className="editor-pane" style={{ flexBasis: outputVisible ? `${splitPercent}%` : '100%' }}>
                    <div className="pane-header">
                        <span>Editor</span>
                        <span className="pane-meta">{language === 'cpp' ? 'main.cpp' : 'main.py'}</span>
                    </div>
                    <CodeEditor value={code} onChange={setCode} language={language} />
                </section>

                {outputVisible && (
                    <>
                        <div
                            className="divider"
                            onMouseDown={handleDividerMouseDown}
                            role="separator"
                            aria-orientation="vertical"
                            tabIndex={0}
                        />
                        <section className="output-pane" style={{ flexBasis: `${100 - splitPercent}%` }}>
                            <div className="pane-header">
                                <span>Output</span>
                                <span className="pane-meta">{statusLabel}</span>
                            </div>

                            {(!submission && !output) ? (
                                <div className="output-empty">No output yet</div>
                            ) : (
                                <>
                                    {submission && (
                                        <div className="submission-card">
                                            <span>{moment(submission.submittedAt).format('MMM D, h:mm A')}</span>
                                            <span>Runtime <strong>{executionTimeMs !== null ? `${executionTimeMs} ms` : 'n/a'}</strong></span>
                                            <span>Status <strong>{status || 'pending'}</strong></span>
                                        </div>
                                    )}
                                    <pre className="output-body">{output}</pre>
                                </>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};

export default App;
