'use client';

import NextImage from 'next/image';
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Image as ImageIcon, 
  Type, 
  Palette,
  Trash2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---

const TEMPLATES = [
  { id: 'distracted-boyfriend', name: 'Distracted Boyfriend', url: 'https://picsum.photos/seed/distracted/800/600' },
  { id: 'drake-hotline-bling', name: 'Drake Hotline Bling', url: 'https://picsum.photos/seed/drake/800/800' },
  { id: 'two-buttons', name: 'Two Buttons', url: 'https://picsum.photos/seed/buttons/800/600' },
  { id: 'change-my-mind', name: 'Change My Mind', url: 'https://picsum.photos/seed/mind/800/600' },
  { id: 'woman-yelling-at-cat', name: 'Woman Yelling at Cat', url: 'https://picsum.photos/seed/cat/800/400' },
  { id: 'success-kid', name: 'Success Kid', url: 'https://picsum.photos/seed/success/600/600' },
];

type MemeText = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  isUppercase: boolean;
};

// --- Main Component ---

export default function MemeGenerator() {
  const [image, setImage] = useState<string | null>(null);
  const [texts, setTexts] = useState<MemeText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [suggestedCaptions, setSuggestedCaptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Image Handling ---

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setTexts([]); // Reset texts for new image
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const selectTemplate = (url: string) => {
    setImage(url);
    setTexts([]);
  };

  // --- Meme Text Logic ---

  const addText = (initialText: string = 'NEW CAPTION') => {
    const newText: MemeText = {
      id: Math.random().toString(36).substr(2, 9),
      text: initialText,
      x: 50,
      y: texts.length === 0 ? 10 : 80, // Default positions: top then bottom
      fontSize: 40,
      color: '#ffffff',
      isUppercase: true,
    };
    setTexts([...texts, newText]);
    setSelectedTextId(newText.id);
  };

  const updateText = (id: string, updates: Partial<MemeText>) => {
    setTexts(texts.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeText = (id: string) => {
    setTexts(texts.filter(t => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // --- AI Logic ---

  const generateMagicCaptions = async () => {
    if (!image) return;
    
    setIsGeneratingCaptions(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      const model = 'gemini-3.1-pro-preview';
      
      // Convert image to base64 if it's a data URL or fetch it if it's a remote URL
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (image.startsWith('data:')) {
        const parts = image.split(',');
        mimeType = parts[0].split(':')[1].split(';')[0];
        base64Data = parts[1];
      } else {
        const response = await fetch(image);
        const blob = await response.blob();
        mimeType = blob.type;
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const prompt = "Analyze this image and suggest 5 funny, witty, and relevant meme captions. Return ONLY a JSON array of strings.";
      
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.text;
      if (responseText) {
        const captions = JSON.parse(responseText);
        setSuggestedCaptions(captions);
      }
    } catch (err) {
      console.error('AI Error:', err);
      setError('Failed to generate captions. Please try again.');
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  // --- Canvas Rendering ---

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = image;
    img.onload = () => {
      // Set canvas size to match image aspect ratio but constrained
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw texts
      texts.forEach(t => {
        const fontSize = (t.fontSize / 100) * canvas.height;
        ctx.font = `bold ${fontSize}px Impact, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize / 15;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const x = (t.x / 100) * canvas.width;
        const y = (t.y / 100) * canvas.height;
        const displayText = t.isUppercase ? t.text.toUpperCase() : t.text;

        ctx.strokeText(displayText, x, y);
        ctx.fillText(displayText, x, y);
      });
    };
  }, [image, texts]);

  const downloadMeme = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'meme-magic.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // --- UI Helpers ---

  const selectedText = texts.find(t => t.id === selectedTextId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              MemeMagic AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setImage(null)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
              title="Reset"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button 
              onClick={downloadMeme}
              disabled={!image}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!image ? (
            <div className="flex flex-col gap-8">
              {/* Upload Area */}
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 min-h-[400px] ${
                  isDragActive ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center">
                  <Upload className="w-8 h-8 text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">Drop your image here</p>
                  <p className="text-zinc-500 text-sm">or click to browse from your device</p>
                </div>
              </div>

              {/* Templates */}
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  Trending Templates
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {TEMPLATES.map((template) => (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectTemplate(template.url)}
                      className="group relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800"
                    >
                      <NextImage 
                        src={template.url} 
                        alt={template.name}
                        fill
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span className="text-xs font-medium">{template.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Canvas Container */}
              <div 
                ref={containerRef}
                className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center p-4 min-h-[400px]"
              >
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full h-auto rounded shadow-lg"
                />
                
                {/* Interactive Overlays for dragging (Visual only, state handles logic) */}
                <div className="absolute inset-0 pointer-events-none">
                  {texts.map(t => (
                    <div 
                      key={t.id}
                      style={{ 
                        left: `${t.x}%`, 
                        top: `${t.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className={`absolute pointer-events-auto cursor-move px-2 py-1 rounded border-2 transition-all ${
                        selectedTextId === t.id ? 'border-purple-500 bg-purple-500/10' : 'border-transparent hover:border-white/20'
                      }`}
                      onClick={() => setSelectedTextId(t.id)}
                    >
                      <span className="sr-only">{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => addText()}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl transition-colors"
                >
                  <Type className="w-4 h-4" />
                  Add Text
                </button>
                <button 
                  onClick={generateMagicCaptions}
                  disabled={isGeneratingCaptions}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingCaptions ? 'animate-spin' : ''}`} />
                  {isGeneratingCaptions ? 'Analyzing...' : 'Magic Caption'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* AI Suggestions */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                AI Suggestions
              </h3>
              {suggestedCaptions.length > 0 && (
                <button 
                  onClick={() => setSuggestedCaptions([])}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-4 flex flex-col gap-3 min-h-[100px]">
              {isGeneratingCaptions ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-zinc-800 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : suggestedCaptions.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {suggestedCaptions.map((caption, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => addText(caption)}
                      className="text-left p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-purple-500/50 transition-all text-sm group flex items-center justify-between"
                    >
                      <span className="line-clamp-2">{caption}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">
                    {image ? 'Click "Magic Caption" to get AI ideas!' : 'Upload an image first'}
                  </p>
                </div>
              )}
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>
          </section>

          {/* Text Controls */}
          {selectedText && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Edit Text</h3>
                <button 
                  onClick={() => removeText(selectedText.id)}
                  className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Content</label>
                  <textarea
                    value={selectedText.text}
                    onChange={(e) => updateText(selectedText.id, { text: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none h-24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Font Size</label>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={selectedText.fontSize}
                      onChange={(e) => updateText(selectedText.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={selectedText.color}
                        onChange={(e) => updateText(selectedText.id, { color: e.target.value })}
                        className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer"
                      />
                      <span className="text-xs font-mono uppercase">{selectedText.color}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Vertical Pos</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={selectedText.y}
                      onChange={(e) => updateText(selectedText.id, { y: parseInt(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Horizontal Pos</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={selectedText.x}
                      onChange={(e) => updateText(selectedText.id, { x: parseInt(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => updateText(selectedText.id, { isUppercase: !selectedText.isUppercase })}
                  className={`w-full py-2 rounded-xl border transition-all text-sm font-medium ${
                    selectedText.isUppercase 
                      ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  UPPERCASE
                </button>
              </div>
            </motion.section>
          )}

          {/* Tips */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <p className="text-xs text-zinc-500 leading-relaxed">
              <span className="text-purple-400 font-bold">Pro Tip:</span> Use the sliders to position your text. AI captions work best with clear images!
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-zinc-900 text-center">
        <p className="text-zinc-600 text-sm">
          Powered by Gemini 3.1 Pro & Next.js
        </p>
      </footer>
    </div>
  );
}
