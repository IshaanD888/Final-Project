'use client';

import React, { useRef, useState, useEffect } from 'react';

// Example object type for demonstration
type Point = { x: number; y: number };
type DrawObj = {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

const initialObjects: DrawObj[] = [
  { id: 1, type: 'rect', x: 100, y: 100, w: 120, h: 80, color: '#2563eb' },
  { id: 2, type: 'circle', x: 300, y: 200, w: 80, h: 80, color: '#f59e42' },
];

const DrawingApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State for objects, selection, and dragging
  const [objects, setObjects] = useState<DrawObj[]>(initialObjects);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tool, setTool] = useState<'select' | 'pencil' | 'eraser'>('select');

  // Redraw all objects and highlight selected
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    objects.forEach(obj => {
      ctx.save();
      ctx.fillStyle = obj.color;
      if (obj.type === 'rect') {
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      } else if (obj.type === 'circle') {
        ctx.beginPath();
        ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Highlight if selected
      if (obj.id === selectedId) {
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        if (obj.type === 'rect') {
          ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
        } else if (obj.type === 'circle') {
          ctx.beginPath();
          ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2 + 3, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
  }, [objects, selectedId]);

  // Helper: check if point is inside object
  const isInside = (obj: DrawObj, x: number, y: number) => {
    if (obj.type === 'rect') {
      return x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h;
    }
    if (obj.type === 'circle') {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      const r = obj.w / 2;
      return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
    }
    return false;
  };

  // Mouse/touch down: select and prepare drag
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool !== 'select') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.offsetX + rect.left;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.offsetY + rect.top;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Find topmost object under pointer
    for (let i = objects.length - 1; i >= 0; i--) {
      if (isInside(objects[i], x, y)) {
        setSelectedId(objects[i].id);
        setDragOffset({ x: x - objects[i].x, y: y - objects[i].y });
        setIsDragging(true);
        return;
      }
    }
    setSelectedId(null);
  };

  // Mouse/touch move: drag selected object
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || selectedId === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.offsetX + rect.left;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.offsetY + rect.top;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setObjects(objs =>
      objs.map(obj =>
        obj.id === selectedId && dragOffset
          ? { ...obj, x: x - dragOffset.x, y: y - dragOffset.y }
          : obj
      )
    );
  };

  // Mouse/touch up: end drag
  const handlePointerUp = () => {
    setIsDragging(false);
    setDragOffset(null);
  };

  // Touch compatibility: map touch events to handlers
  const pointerEvents = tool === 'select'
    ? {
        onMouseDown: handlePointerDown,
        onMouseMove: isDragging ? handlePointerMove : undefined,
        onMouseUp: handlePointerUp,
        onMouseLeave: handlePointerUp,
        onTouchStart: handlePointerDown,
        onTouchMove: isDragging ? handlePointerMove : undefined,
        onTouchEnd: handlePointerUp,
      }
    : {};

  return (
    <div className="drawing-app">
      {/* Toolbar for switching tools */}
      <div className="toolbar">
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
        >
          Select
        </button>
        <button
          className={tool === 'pencil' ? 'active' : ''}
          onClick={() => setTool('pencil')}
        >
          Pencil
        </button>
        <button
          className={tool === 'eraser' ? 'active' : ''}
          onClick={() => setTool('eraser')}
        >
          Eraser
        </button>
      </div>
      {/* Canvas */}
      <div className="canvas-container" style={{ position: 'relative', flex: 1 }}>
        <canvas
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight - 56}
          style={{ width: '100vw', height: 'calc(100vh - 56px)', background: '#fff', display: 'block', touchAction: 'none' }}
          {...pointerEvents}
        />
      </div>
    </div>
  );
};

export default DrawingApp;