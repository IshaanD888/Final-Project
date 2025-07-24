'use client';

import React, { useRef, useState, useEffect } from 'react';

// Drawing tool types
type Tool = 'pencil' | 'eraser' | 'text' | 'select' | 'shape';

// Shape types
type ShapeType = 'rectangle' | 'circle' | 'triangle';

// Drawing object types
type Point = { x: number; y: number };
type DrawObj =
  | { type: 'path'; points: Point[]; color: string; size: number; isEraser: boolean }
  | { type: 'shape'; shape: ShapeType; x: number; y: number; w: number; h: number; color: string; size: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };

// Main Drawing App Component
const DrawingApp: React.FC = () => {
  // Canvas and audio refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // State for tools and drawing
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [shapeDims, setShapeDims] = useState({ w: 100, h: 60 });
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [activeBtn, setActiveBtn] = useState<Tool>('pencil');
  const [history, setHistory] = useState<DrawObj[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawObj[][]>([]);

  // Responsive canvas sizing
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const img = canvas.toDataURL();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 56;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const image = new window.Image();
          image.onload = () => ctx.drawImage(image, 0, 0);
          image.src = img;
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Redraw on objects change
  useEffect(() => {
    redraw();
  }, [objects]);

  // Play audio feedback
  const playClick = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  // Redraw all objects
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(obj => {
      if (obj.type === 'path') {
        ctx.save();
        ctx.strokeStyle = obj.isEraser ? '#fff' : obj.color;
        ctx.lineWidth = obj.size;
        ctx.globalCompositeOperation = obj.isEraser ? 'destination-out' : 'source-over';
        ctx.beginPath();
        obj.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      } else if (obj.type === 'shape') {
        ctx.save();
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
        ctx.restore();
      } else if (obj.type === 'text') {
        ctx.save();
        ctx.font = `${obj.size * 4 + 12}px Arial, sans-serif`;
        ctx.fillStyle = obj.color;
        ctx.fillText(obj.text, obj.x, obj.y);
        ctx.restore();
      }
    });
  };

  // Save history for undo/redo
  const saveHistory = () => {
    setHistory(h => [...h, objects]);
    setRedoStack([]);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && tool !== 'shape') return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if ((tool === 'pencil' || tool === 'eraser') && isDrawing) {
      setCurrentPath(path => [...path, { x, y }]);
      const ctx = canvasRef.current!.getContext('2d')!;
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
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'pencil' || tool === 'eraser') {
      if (isDrawing && currentPath.length > 1) {
        setObjects(objs => [
          ...objs,
          {
            type: 'path',
            points: currentPath,
            color,
            size,
            isEraser: tool === 'eraser'
          }
        ]);
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
  };

  // Text tool submit
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && textPos) {
      setObjects(objs => [
        ...objs,
        {
          type: 'text',
          x: textPos.x,
          y: textPos.y,
          text: textInput,
          color,
          size
        }
      ]);
    }
    setTextInput('');
    setTextPos(null);
  };

  // Undo/Redo
  const undo = () => {
    if (history.length === 0) return;
    setRedoStack(r => [objects, ...r]);
    setObjects(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    playClick();
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    setHistory(h => [...h, objects]);
    setObjects(redoStack[0]);
    setRedoStack(r => r.slice(1));
    playClick();
  };

  // Toolbar button highlight
  const btnClass = (btn: Tool) => (tool === btn ? 'active' : '');

  return (
    <div className="drawing-app">
      {/* Audio feedback */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YYQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=" preload="auto" />
      {/* Toolbar */}
      <div className="toolbar">
        <button className={btnClass('pencil')} onClick={() => { setTool('pencil'); setActiveBtn('pencil'); playClick(); }}>Pencil</button>
        <button className={btnClass('eraser')} onClick={() => { setTool('eraser'); setActiveBtn('eraser'); playClick(); }}>Eraser</button>
        <button className={btnClass('text')} onClick={() => { setTool('text'); setActiveBtn('text'); playClick(); }}>Text</button>
        <button className={btnClass('select')} onClick={() => { setTool('select'); setActiveBtn('select'); playClick(); }}>Select</button>
        <button className={btnClass('shape')} onClick={() => { setTool('shape'); setActiveBtn('shape'); playClick(); }}>Shape</button>
        <select value={shapeType} onChange={e => setShapeType(e.target.value as ShapeType)} className="shape-select">
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="triangle">Triangle</option>
        </select>
        <label>
          <span>Colour:</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </label>
        <label>
          <span>Size:</span>
          <input type="range" min={1} max={20} value={size} onChange={e => setSize(Number(e.target.value))} />
        </label>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
      {/* Canvas */}
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {/* Text input overlay */}
        {tool === 'text' && textPos && (
          <form
            onSubmit={handleTextSubmit}
            style={{
              position: 'absolute',
              left: textPos.x,
              top: textPos.y,
              zIndex: 10,
              background: '#fff',
              padding: 6,
              borderRadius: 6,
              boxShadow: '0 2px 8px #0002'
            }}
          >
            <input
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              style={{
                fontSize: size * 4 + 12,
                fontFamily: 'Arial, sans-serif',
                color,
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: '2px 8px',
                outline: 'none'
              }}
              placeholder="Enter text"
            />
            <button type="submit" style={{ marginLeft: 8 }}>OK</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DrawingApp;