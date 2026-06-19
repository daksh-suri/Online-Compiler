import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import './CodeEditor.css';

const languageExtension = (language) => (language === 'py' ? python() : cpp());

const CodeEditor = ({ value, onChange, language }) => {
    return (
        <div className="code-editor-wrapper">
            <CodeMirror
                value={value}
                onChange={onChange}
                extensions={[languageExtension(language), oneDark]}
                minHeight="480px"
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    indentOnInput: true,
                }}
            />
        </div>
    );
};

export default CodeEditor;
