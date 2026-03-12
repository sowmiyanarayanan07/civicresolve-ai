import React, { useState } from 'react';
import { speakText } from '../services/geminiService';
import { Language } from '../types';

interface VoiceWidgetProps {
  textToSpeak: string;
  language: Language;
}

const VoiceWidget: React.FC<VoiceWidgetProps> = ({ textToSpeak, language }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = async () => {
    if (!textToSpeak) return;
    setIsPlaying(true);
    
    const base64Audio = await speakText(textToSpeak, language);
    
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(
        Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer
      );
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } else {
      setIsPlaying(false);
    }
  };

  return (
    <button 
      onClick={handleSpeak} 
      disabled={isPlaying}
      className={`p-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-blue-600'} text-white shadow-lg transition-all`}
    >
      <i className={`fas ${isPlaying ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
    </button>
  );
};

export default VoiceWidget;
