
import React, { useState, useEffect, useRef } from 'react';
import { sanitizeRaw, truncate, MAX_LENGTHS, validateChatMessage } from '../utils/validation';

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}>
        {name}
    </span>
);

interface Message {
    id: string;
    text: string;
    sender: 'ai' | 'user';
    timestamp: Date;
}

export const AssistantChat: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '¡Hola! Soy tu Asistente de Estilo y Soporte de LocalShop. ✨ ¿En qué puedo ayudarte hoy? Puedo ayudarte a encontrar el look perfecto o resolver dudas sobre tus pedidos.',
            sender: 'ai',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        const msgErr = validateChatMessage(inputValue);
        if (msgErr) return;
        const safeText = sanitizeRaw(inputValue);

        const userMsg: Message = {
            id: Date.now().toString(),
            text: safeText,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        // Placeholder for future AI response
        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Entiendo perfectamente. Mi sistema inteligente de estilo está terminando de configurarse. ¡Muy pronto podré darte consejos personalizados y gestionar tus pedidos directamente aquí! 🚀',
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col pointer-events-none">
            {/* Backdrop with fade-in */}
            <div 
                className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto animate-fade-in" 
                onClick={onClose}
            />
            
            {/* Chat Container */}
            <div className="mt-auto mb-20 mx-4 pointer-events-auto animate-slide-up flex flex-col max-h-[70vh] glass-panel rounded-[32px] shadow-2xl overflow-hidden border border-white/40">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-primary/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-tr from-primary to-mustard flex items-center justify-center shadow-lg">
                            <Icon name="auto_awesome" className="text-white text-xl" filled />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-text-light dark:text-white uppercase tracking-wider">Style Assistant</h3>
                            <div className="flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-text-subtle-light uppercase">En línea</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <Icon name="close" className="text-text-light dark:text-white" />
                    </button>
                </div>

                {/* Messages Area */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
                >
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                msg.sender === 'user' 
                                ? 'bg-primary text-white rounded-tr-none' 
                                : 'bg-white/80 dark:bg-accent-dark/80 text-text-light dark:text-text-dark rounded-tl-none border border-black/5'
                            }`}>
                                {msg.text}
                                <div className={`text-[9px] mt-1 font-bold opacity-60 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white/30 dark:bg-black/10 border-t border-black/5 dark:border-white/5">
                    <div className="relative flex items-center gap-2">
                        <input 
                            value={inputValue}
                            onChange={(e) => setInputValue(truncate(e.target.value, MAX_LENGTHS.chatMessage))}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 h-12 bg-white/80 dark:bg-background-dark/80 rounded-2xl px-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-text-light dark:text-white"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            <Icon name="send" filled />
                        </button>
                    </div>
                    <p className="text-[9px] text-center mt-3 text-text-subtle-light font-black uppercase tracking-widest opacity-60">IA de Soporte LocalShop v1.0</p>
                </div>
            </div>
        </div>
    );
};
