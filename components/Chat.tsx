import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Client } from '../types';

interface ChatProps {
    clients: Client[];
}

interface ChatSession {
    chat_id: string;
    client_id: string | null;
    client_name: string;
    content: string; // last message
    created_at: string;
    direction: 'inbound' | 'outbound';
}

export function Chat({ clients }: ChatProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch chat list
    useEffect(() => {
        fetch('/api/messages?mode=chats')
            .then(res => res.json())
            .then(data => setSessions(data))
            .catch(err => console.error(err));
    }, []);

    // Fetch messages for selected chat
    useEffect(() => {
        if (!selectedChatId) return;
        
        setIsLoading(true);
        fetch(`/api/messages?chat_id=${selectedChatId}`)
            .then(res => res.json())
            .then(data => {
                setMessages(data);
                setIsLoading(false);
                scrollToBottom();
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
            
        // Poll for new messages every 5 seconds
        const interval = setInterval(() => {
             fetch(`/api/messages?chat_id=${selectedChatId}`)
                .then(res => res.json())
                .then(data => {
                    setMessages(prev => {
                        if (data.length !== prev.length) {
                            scrollToBottom();
                            return data;
                        }
                        return prev;
                    });
                });
        }, 5000);
        
        return () => clearInterval(interval);
    }, [selectedChatId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedChatId) return;

        const currentSession = sessions.find(s => s.chat_id === selectedChatId);
        const clientId = currentSession?.client_id;

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: selectedChatId,
                    text: inputText,
                    client_id: clientId
                })
            });
            
            if (res.ok) {
                setInputText('');
                // Optimistic update
                const newMsg: ChatMessage = {
                    id: Date.now(),
                    chat_id: selectedChatId,
                    client_id: clientId || '',
                    direction: 'outbound',
                    type: 'text',
                    content: inputText,
                    status: 'sent',
                    created_at: new Date().toISOString()
                };
                setMessages(prev => [...prev, newMsg]);
                scrollToBottom();
            } else {
                alert('Failed to send message');
            }
        } catch (e) {
            console.error(e);
            alert('Error sending message');
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
            {/* Sidebar List */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Сообщения</h2>
                </div>
                <ul>
                    {sessions.map(session => (
                        <li 
                            key={session.chat_id}
                            onClick={() => setSelectedChatId(session.chat_id)}
                            className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedChatId === session.chat_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{session.client_name}</span>
                                <span className="text-xs text-gray-400">{new Date(session.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {session.direction === 'outbound' && <span className="text-blue-500">Вы: </span>}
                                {session.content}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedChatId ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white">
                                    {sessions.find(s => s.chat_id === selectedChatId)?.client_name}
                                </h3>
                                <span className="text-xs text-gray-500">Chat ID: {selectedChatId}</span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-950">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${
                                        msg.direction === 'outbound' 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                    }`}>
                                        <p className="text-sm">{msg.content}</p>
                                        <div className={`text-[10px] mt-1 text-right ${msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Напишите сообщение..."
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Выберите чат для начала общения
                    </div>
                )}
            </div>
        </div>
    );
}
