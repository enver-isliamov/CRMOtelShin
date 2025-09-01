
import React, { useRef, useEffect, useState } from 'react';

interface VisualEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholders?: string[];
}

const ToolbarButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title: string;
  isActive?: boolean;
}> = ({ onClick, children, title, isActive }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    onMouseDown={e => e.preventDefault()} // Prevent editor from losing focus
    className={`p-2 rounded-md transition-colors duration-150 ${
        isActive 
        ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-white' 
        : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
    }`}
  >
    {children}
  </button>
);

export const VisualEditor: React.FC<VisualEditorProps> = ({ value, onChange, placeholders = [] }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [selectionState, setSelectionState] = useState<{[key: string]: boolean}>({});
    const lastSelection = useRef<Range | null>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);
    
    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        onChange(e.currentTarget.innerHTML);
    };

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            lastSelection.current = selection.getRangeAt(0);
        }
    };

    const restoreSelection = () => {
        const selection = window.getSelection();
        if (selection && lastSelection.current) {
            selection.removeAllRanges();
            selection.addRange(lastSelection.current);
        } else {
             editorRef.current?.focus();
        }
    };
    
    const execCmd = (command: string, arg?: string) => {
        restoreSelection();
        document.execCommand(command, false, arg);
        editorRef.current?.focus();
        updateSelectionState();
        onChange(editorRef.current?.innerHTML || '');
    };
    
    const insertPlaceholder = (placeholder: string) => {
        restoreSelection();
        // Use insertHTML to wrap with a tag, making it a single entity for deletion
        execCmd('insertHTML', `<span style="color: #4f46e5; font-weight: bold; background-color: #eef2ff; padding: 2px 4px; border-radius: 4px;">${placeholder}</span>&nbsp;`);
    };

    const formatBlock = (tag: string) => {
        restoreSelection();
        execCmd('formatBlock', `<${tag}>`);
    }
    
    const updateSelectionState = () => {
        saveSelection();
        const newSelectionState: {[key: string]: boolean} = {};
        ['bold', 'italic', 'underline', 'strikethrough', 'insertUnorderedList', 'insertOrderedList'].forEach(cmd => {
            newSelectionState[cmd] = document.queryCommandState(cmd);
        });
        setSelectionState(newSelectionState);
    };

    return (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center gap-1">
                <ToolbarButton title="Жирный" onClick={() => execCmd('bold')} isActive={selectionState['bold']}>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.25 4.25a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v2a.75.75 0 01-1.5 0V5.75h-3v2.5h3.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V9.5h-3.25a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-1.25h3a.75.75 0 01.75.75v2a.75.75 0 01-1.5 0v-1.25h-3.75a.75.75 0 01-.75-.75V4.25z" clipRule="evenodd" /></svg>
                </ToolbarButton>
                <ToolbarButton title="Курсив" onClick={() => execCmd('italic')} isActive={selectionState['italic']}>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 4.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zM7.25 4.25a.75.75 0 00-.75.75v.5a.75.75 0 001.5 0v-.5a.75.75 0 00-.75-.75zM6 6.25a.75.75 0 01.75-.75h5.5a.75.75 0 010 1.5h-5.5a.75.75 0 01-.75-.75zM7.25 14.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm-1.5.75a.75.75 0 00.75.75h.5a.75.75 0 000-1.5h-.5a.75.75 0 00-.75.75zm1.5.75a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                </ToolbarButton>
                <ToolbarButton title="Подчеркнутый" onClick={() => execCmd('underline')} isActive={selectionState['underline']}>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 4.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-2.5v6.5a1.25 1.25 0 002.5 0V6h.75a.75.75 0 010 1.5H13v5.25a2.75 2.75 0 01-5.5 0V6H6.75A.75.75 0 016 5.25v-1zM4.5 15.25a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                </ToolbarButton>
                <ToolbarButton title="Зачеркнутый" onClick={() => execCmd('strikethrough')} isActive={selectionState['strikethrough']}>
                   <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" /></svg>
                </ToolbarButton>
                
                 <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1"></div>

                 <ToolbarButton title="Маркированный список" onClick={() => execCmd('insertUnorderedList')} isActive={selectionState['insertUnorderedList']}>
                     <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5.75A.75.75 0 012.75 5h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 5.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 4.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                 </ToolbarButton>
                 <ToolbarButton title="Нумерованный список" onClick={() => execCmd('insertOrderedList')} isActive={selectionState['insertOrderedList']}>
                     <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a1 1 0 011-1h1.5a.75.75 0 000-1.5H3a2.5 2.5 0 00-2.5 2.5v.75a.75.75 0 001.5 0v-.354a.25.25 0 01.25-.25H3a1 1 0 011 1v1.5a1 1 0 11-2 0v-.354a.25.25 0 01.25-.25H2a.75.75 0 000 1.5h.5a1 1 0 011-1v-2.5a.25.25 0 01.25-.25h.25a.75.75 0 000-1.5h-.25A1.75 1.75 0 002 4.25v.75z" /><path d="M7 6.25a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5A.75.75 0 017 6.25zM7 10a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5A.75.75 0 017 10zm0 3.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" /><path d="M2.5 13.5a1 1 0 11-2 0 1 1 0 012 0zm-1.25.75a.75.75 0 000-1.5H.75a.75.75 0 000 1.5h.5zM2.5 17a1 1 0 100-2 1 1 0 000 2z" /></svg>
                 </ToolbarButton>
                
                 <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1"></div>

                 <ToolbarButton title="Код (inline)" onClick={() => formatBlock('code')}>
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 5.25a.75.75 0 01.625.375l3.5 6.5a.75.75 0 01-1.25.65L11.25 12h-2.5L8.375 12.775a.75.75 0 01-1.25-.65l3.5-6.5A.75.75 0 018.75 5.25z" clipRule="evenodd" /></svg>
                 </ToolbarButton>
                 <ToolbarButton title="Блок кода" onClick={() => formatBlock('pre')}>
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H5a3 3 0 01-3-3V5zm4.5 2.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5zM9.25 6a.75.75 0 01.75.75v7.5a.75.75 0 01-1.5 0V6.75A.75.75 0 019.25 6zm3.5 1.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5z" clipRule="evenodd" /></svg>
                 </ToolbarButton>
                
                 <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1"></div>
                
                 <div className="relative">
                     <select onChange={(e) => { insertPlaceholder(e.target.value); e.target.value = ''; }} className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 pr-8" defaultValue="">
                         <option value="" disabled>Вставить поле...</option>
                         {placeholders.map(p => <option key={p} value={p}>{p}</option>)}
                     </select>
                 </div>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onSelect={updateSelectionState}
                onKeyDown={updateSelectionState}
                onClick={updateSelectionState}
                onBlur={saveSelection}
                className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[150px] focus:outline-none"
            />
        </div>
    );
};