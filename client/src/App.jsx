import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import moment from 'moment'
import Stubs from './Stubs.jsx';
import CodeEditor from './CodeEditor.jsx';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4444';

const getDefaultLanguage = () => localStorage.getItem('default-language') || 'cpp';

const App = () => {
    const defaultLanguage = getDefaultLanguage();
    const [code, setCode] = useState(() => Stubs[defaultLanguage]);
    const [output, setOutput] = useState('');
    const [language, setLanguage] = useState(defaultLanguage);
    const [status, setStatus] = useState('');
    const [submission, setSubmission] = useState(null);  // { submittedAt, startedAt, completedAt } | null

    const [outputVisible, setOutputVisible] = useState(() => {
        const stored = localStorage.getItem('output-visible');
        return stored === 'true';
    });

    const [splitPercent, setSplitPercent] = useState(() => {
        const stored = localStorage.getItem('split-percent');
        const parsed = stored === null ? NaN : parseFloat(stored);
        if (Number.isNaN(parsed)) return 50;
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
    }

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
            const { data: { jobId } } = await axios.post(`${API_URL}/run`, {
                language,
                code,
            })
            intervalId = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_URL}/status?id=${jobId}`)
                    const { success, job, error } = res.data;
                    console.log(res.data);
                    if (success) {
                        setStatus(job.status);
                        if (job.status === 'pending') return;
                        setOutput(job.output);
                        setSubmission({
                            submittedAt: job.submittedAt,
                            startedAt: job.startedAt,
                            completedAt: job.completedAt,
                        });
                        clearInterval(intervalId);
                    }
                    else {
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
    }
    const setDefaultLanguage = () => {
        localStorage.setItem('default-language', language);
    }

    const executionTimeMs = (() => {
        if (!submission || !submission.startedAt || !submission.completedAt) return null;
        const start = new Date(submission.startedAt).getTime();
        const end = new Date(submission.completedAt).getTime();
        if (Number.isNaN(start) || Number.isNaN(end)) return null;
        return Math.max(0, end - start);
    })();

    return (
        <div className='App'>
            <h1>Online code compiler</h1>

            <div className="toolbar">
                <div className="toolbar-group">
                    <label>Langauge</label>
                    <select
                        value={language}
                        onChange={
                            (e) => {
                                const res = window.confirm("Switching the language will remvove all existing code");
                                if (res) {
                                    const nextLanguage = e.target.value;
                                    setLanguage(nextLanguage);
                                    setCode(Stubs[nextLanguage]);
                                }
                            }}>
                        <option value='cpp'>C++</option>
                        <option value='py'>Python</option>
                    </select>
                    <button onClick={setDefaultLanguage}>Set Default Language</button>
                </div>

                <div className="toolbar-group">
                    <button onClick={() => setOutputVisible(v => !v)}>
                        {outputVisible ? 'Hide Output' : 'Show Output'}
                    </button>
                    <button onClick={submitHandler}>Run</button>
                </div>
            </div>

            <div className="workspace" ref={workspaceRef}>
                <div className="editor-pane" style={{ flexBasis: `${splitPercent}%` }}>
                    <CodeEditor value={code} onChange={setCode} language={language} />
                </div>

                {outputVisible && (
                    <>
                        <div
                            className="divider"
                            onMouseDown={handleDividerMouseDown}
                            role="separator"
                            aria-orientation="vertical"
                        />
                        <div
                            className="output-pane"
                            style={{ flexBasis: `${100 - splitPercent}%` }}
                        >
                            {(!submission && !output) ? (
                                <div className="output-empty">
                                    Submit your code to see output
                                </div>
                            ) : (
                                <>
                                    {submission && (
                                        <p className="submission-card">
                                            Submitted: {moment(submission.submittedAt).format('MMM D, YYYY h:mm A')}
                                            {' | '}
                                            Execution time: {executionTimeMs !== null ? `${executionTimeMs} ms` : '—'}
                                            {' | '}
                                            Status: {status || 'pending'}
                                        </p>
                                    )}
                                    <pre className="output-body">{output}</pre>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default App
