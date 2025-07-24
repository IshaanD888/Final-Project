'use client';

import Head from 'next/head';
import Script from 'next/script';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

// Lazy-load toolbar for code splitting
const Toolbar = lazy(() => import('../components/Toolbar'));

// Drawing tool types
type Tool = 'pencil' | 'eraser' | 'text' | 'select' | 'shape';
type ShapeType = 'rectangle' | 'circle' | 'triangle';
type Point = { x: number; y: number };
type DrawObj =
  | { type: 'path'; points: Point[]; color: string; size: number; isEraser: boolean }
  | { type: 'shape'; shape: ShapeType; x: number; y: number; w: number; h: number; color: string; size: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };

// Debounce utility
const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const DrawingApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [shapeDims] = useState({ w: 100, h: 60 });
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [history, setHistory] = useState<DrawObj[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawObj[][]>([]);

  // Cache canvas context
  const getContext = useCallback(() => canvasRef.current?.getContext('2d'), []);

  // Resize canvas with debounce
  useEffect(() => {
    const resize = debounce(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const bitmap = createImageBitmap(canvas);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 56;
        bitmap.then(img => ctx.drawImage(img, 0, 0)).catch(e => console.error('Bitmap draw failed:', e));
      } catch (e) {
        console.error('Canvas resize failed:', e);
      }
    }, 100);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [getContext]);

  // Redraw with requestAnimationFrame
  const redraw = useCallback(() => {
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getContext();
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      objects.forEach(obj => {
        ctx.save();
        if (obj.type === 'path') {
          ctx.strokeStyle = obj.isEraser ? '#fff' : obj.color;
          ctx.lineWidth = obj.size;
          ctx.globalCompositeOperation = obj.isEraser ? 'destination-out' : 'source-over';
          ctx.beginPath();
          obj.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.stroke();
        } else if (obj.type === 'shape') {
          ctx.strokeStyle = obj.color;
          ctx.lineWidth = obj.size;
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          if (obj.shape === 'rectangle') {
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          } else if (obj.shape === 'circle') {
            ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, Math.min(obj.w, obj.h) / 2, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (obj.shape === 'triangle') {
            ctx.moveTo(obj.x + obj.w / 2, obj.y);
            ctx.lineTo(obj.x, obj.y + obj.h);
            ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
            ctx.closePath();
            ctx.stroke();
          }
        } else if (obj.type === 'text') {
          ctx.font = `${obj.size * 4 + 12}px Arial, sans-serif`;
          ctx.fillStyle = obj.color;
          ctx.fillText(obj.text, obj.x, obj.y);
        }
        ctx.restore();
      });
    });
  }, [objects, getContext]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const playClick = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error('Audio playback failed:', e));
    }
  }, []);

  const saveHistory = useCallback(() => {
    setHistory(h => [...h, objects]);
    setRedoStack([]);
  }, [objects]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      playClick();
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (tool === 'pencil' || tool === 'eraser') {
        setIsDrawing(true);
        setCurrentPath([{ x, y }]);
        saveHistory();
      } else if (tool === 'shape') {
        setStartPoint({ x, y });
        saveHistory();
      } else if (tool === 'text') {
        setTextPos({ x, y });
        setTextInput('');
      }
    },
    [tool, playClick, saveHistory]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing && tool !== 'shape') return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if ((tool === 'pencil' || tool === 'eraser') && isDrawing) {
        setCurrentPath(path => [...path, { x, y }]);
        const ctx = getContext();
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = tool === 'eraser' ? '#fff' : color;
        ctx.lineWidth = size;
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        const last = currentPath[currentPath.length - 1];
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      } else if (tool === 'shape' && startPoint) {
        redraw();
        const ctx = getContext();
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        if (shapeType === 'rectangle') {
          ctx.strokeRect(startPoint.x, startPoint.y, x - startPoint.x, y - startPoint.y);
        } else if (shapeType === 'circle') {
          ctx.arc(startPoint.x + (x - startPoint.x) / 2, startPoint.y + (y - startPoint.y) / 2, Math.abs(x - startPoint.x) / 2, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (shapeType === 'triangle') {
          ctx.moveTo(startPoint.x + (x - startPoint.x) / 2, startPoint.y);
          ctx.lineTo(startPoint.x, y);
          ctx.lineTo(x, y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    [tool, isDrawing, startPoint, shapeType, color, size, currentPath, redraw, getContext]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool === 'pencil' || tool === 'eraser') {
        if (isDrawing && currentPath.length > 1) {
          setObjects(objs => [...objs, { type: 'path', points: currentPath, color, size, isEraser: tool === 'eraser' }]);
        }
        setIsDrawing(false);
        setCurrentPath([]);
      } else if (tool === 'shape' && startPoint) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setObjects(objs => [
          ...objs,
          {
            type: 'shape',
            shape: shapeType,
            x: startPoint.x,
            y: startPoint.y,
            w: x - startPoint.x || shapeDims.w,
            h: y - startPoint.y || shapeDims.h,
            color,
            size
          }
        ]);
        setStartPoint(null);
      }
    },
    [tool, isDrawing, currentPath, startPoint, shapeType, color, size, shapeDims]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Example: Move cursor for drawing (customize as needed)
      e.preventDefault();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && textPos) {
      setObjects(objs => [...objs, { type: 'text', x: textPos.x, y: textPos.y, text: textInput, color, size }]);
    }
    setTextInput('');
    setTextPos(null);
  };

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setRedoStack(r => [objects, ...r]);
    setObjects(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    playClick();
  }, [history, objects, playClick]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setHistory(h => [...h, objects]);
    setObjects(redoStack[0]);
    setRedoStack(r => r.slice(1));
    playClick();
  }, [redoStack, objects, playClick]);

  return (
    <>
      <Head>
        <title>Drawing App</title>
        <meta name="description" content="A responsive drawing app with pencil, eraser, shapes, and text tools." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; media-src https://cdn.example.com; style-src 'self' https://cdn.jsdelivr.net; script-src 'self' https://cdn.jsdelivr.net" />
      </Head>
      <Script src="https://cdn.example.com/click.mp3" strategy="lazyOnload" />
      <main className="drawing-app">
        <audio ref={audioRef} src="https://cdn.example.com/click.mp3" preload="auto" />
        <Suspense fallback={<div>Loading toolbar...</div>}>
          <Toolbar
            tool={tool}
            setTool={setTool}
            shapeType={shapeType}
            setShapeType={setShapeType}
            color={color}
            setColor={setColor}
            size={size}
            setSize={setSize}
            undo={undo}
            redo={redo}
          />
        </Suspense>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Drawing canvas for creating sketches with pencil, eraser, shapes, or text"
          >
            Your browser does not support the canvas element. Please use a modern browser to access the drawing app.
          </canvas>
          {tool === 'text' && textPos && (
            <form
              onSubmit={handleTextSubmit}
              style={{ position: 'absolute', left: textPos.x, top: textPos.y, zIndex: 10, background: '#fff', padding: 6, borderRadius: 6, boxShadow: '0 2px 8px #0002' }}
              aria-label="Text input form"
            >
              <label htmlFor="text-input" className="sr-only">Enter text to add to canvas</label>
              <input
                id="text-input"
                autoFocus
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                style={{ fontSize: size * 4 + 12, fontFamily: 'Arial, sans-serif', color, border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', outline: 'none' }}
                placeholder="Enter text"
              />
              <button type="submit" style={{ marginLeft: 8 }} aria-label="Submit text">OK</button>
            </form>
          )}
        </div>
      </main>
    </>
  );
};

export default function Home() {
  return <DrawingApp />;
}