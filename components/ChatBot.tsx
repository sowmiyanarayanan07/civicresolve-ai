import React, { useState, useRef, useEffect } from 'react';
import { chatWithMaps } from '../services/geminiService';
import { ChatMessage, Location } from '../types';

interface ChatBotProps {
  userLocation: Location;
}

const ChatBot: React.FC<ChatBotProps> = ({ userLocation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithMaps(userMsg.text, userLocation);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "Sorry, I couldn't generate a response.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      // Surface the exact SDK / network error so it's immediately visible
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ Error: ${err?.message || String(err)}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition"
        >
          <i className="fas fa-robot text-xl"></i>
        </button>
      )}

      {isOpen && (
        <div className="bg-white w-80 h-96 rounded-lg shadow-2xl flex flex-col border border-gray-200">
          <div className="bg-indigo-600 text-white p-3 rounded-t-lg flex justify-between items-center">
            <h3 className="font-semibold">Civic Assistant</h3>
            <button onClick={() => setIsOpen(false)}><i className="fas fa-times"></i></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="text-gray-400 text-center text-sm mt-10">Ask me about city services, nearby offices, or grievance status.</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-xs text-gray-400">Thinking...</div>}
          </div>

          <div className="p-2 border-t flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type..."
              className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
            <button onClick={handleSend} className="text-indigo-600 px-2"><i className="fas fa-paper-plane"></i></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
