"use client";
import React, { useRef, useState, useEffect } from "react";

// Types
type Tool = "pencil" | "eraser" | "select" | "shape";
type ShapeType = "rectangle" | "circle";
type Point = { x: number; y: number };
type DrawPath = {
  type: "path";
  points: Point[];
  color: string;
  size: number;
  isEraser: boolean;
};
type ShapeObj = {
  type: "shape";
  shape: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  size: number;
};
type DrawObj = DrawPath | ShapeObj;

const COLORS = ["#000000", "#e74c3c", "#27ae60", "#f1c40f", "#3498db", "#fff"];

function InstructionsForm({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.7)", color: "#fff", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#23232a", padding: 32, borderRadius: 12, maxWidth: 400, boxShadow: "0 8px 32px #0008"
      }}>
        <h2>Welcome to the Drawing App!</h2>
        <ol style={{ marginBottom: 16 }}>
          <li><b>Pencil:</b> Draw freehand lines.</li>
          <li><b>Eraser:</b> Erase parts of your drawing.</li>
          <li><b>Select:</b> Click shapes to select and move them.</li>
          <li><b>Shapes:</b> Insert rectangles or circles.</li>
          <li><b>Color/Size:</b> Change color and size for drawing or shapes.</li>
        </ol>
        <p>Try the tools above the canvas. Have fun!</p>
        <button onClick={onClose} style={{
          background: "#0d6efd", color: "#fff", border: "none", padding: "8px 18px",
          borderRadius: 6, fontSize: 16, cursor: "pointer"
        }}>Start Drawing</button>
      </div>
    </div>
  );
}

export default function DrawingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);
  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");

  const [drawing, setDrawing] = useState(false);
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);

  // Drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all objects
    objects.forEach((obj, idx) => {
      if (obj.type === "path") {
        ctx.strokeStyle = obj.isEraser ? "#fff" : obj.color;
        ctx.lineWidth = obj.size;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        obj.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      } else if (obj.type === "shape") {
        ctx.save();
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.fillStyle = obj.color + "33";
        if (obj.shape === "rectangle") {
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.shape === "circle") {
          ctx.beginPath();
          ctx.ellipse(obj.x + obj.w / 2, obj.y + obj.h / 2, Math.abs(obj.w / 2), Math.abs(obj.h / 2), 0, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
        // Draw selection
        if (selectedIdx === idx) {
          ctx.save();
          ctx.strokeStyle = "#0d6efd";
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
          ctx.restore();
        }
      }
    });
    // Draw current path
    if (drawing && tool === "pencil" && currentPath.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      currentPath.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }
  }, [objects, drawing, currentPath, color, size, tool, selectedIdx]);

  // Mouse events
  function getPos(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleDown(e: React.MouseEvent) {
    if (tool === "pencil" || tool === "eraser") {
      setDrawing(true);
      setCurrentPath([getPos(e)]);
    } else if (tool === "select") {
      const pos = getPos(e);
      let found = null;
      objects.forEach((obj, idx) => {
        if (obj.type === "shape") {
          if (
            obj.shape === "rectangle" &&
            pos.x >= obj.x && pos.x <= obj.x + obj.w &&
            pos.y >= obj.y && pos.y <= obj.y + obj.h
          ) found = idx;
          if (
            obj.shape === "circle" &&
            Math.pow(pos.x - (obj.x + obj.w / 2), 2) / Math.pow(obj.w / 2, 2) +
            Math.pow(pos.y - (obj.y + obj.h / 2), 2) / Math.pow(obj.h / 2, 2) <= 1
          ) found = idx;
        }
      });
      setSelectedIdx(found);
      if (found !== null && objects[found].type === "shape") {
        const obj = objects[found] as ShapeObj;
        setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
      } else {
        setDragOffset(null);
      }
    }
  }

  function handleMove(e: React.MouseEvent) {
    if (tool === "pencil" && drawing) {
      setCurrentPath((path) => [...path, getPos(e)]);
    } else if (tool === "eraser" && drawing) {
      setCurrentPath((path) => [...path, getPos(e)]);
    } else if (tool === "select" && selectedIdx !== null && dragOffset) {
      const pos = getPos(e);
      setObjects((objs) =>
        objs.map((obj, idx) =>
          idx === selectedIdx && obj.type === "shape"
            ? { ...obj, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
            : obj
        )
      );
    }
  }

  function handleUp() {
    if (tool === "pencil" && drawing && currentPath.length > 1) {
      setObjects((objs) => [
        ...objs,
        { type: "path", points: currentPath, color, size, isEraser: false },
      ]);
    } else if (tool === "eraser" && drawing && currentPath.length > 1) {
      setObjects((objs) => [
        ...objs,
        { type: "path", points: currentPath, color: "#fff", size: size + 6, isEraser: true },
      ]);
    }
    setDrawing(false);
    setCurrentPath([]);
    setDragOffset(null);
  }

  // Insert shape
  function insertShape() {
    setObjects((objs) => [
      ...objs,
      {
        type: "shape",
        shape: shapeType,
        x: 80 + Math.random() * 100,
        y: 80 + Math.random() * 100,
        w: 100,
        h: 80,
        color,
        size,
      },
    ]);
  }

  // UI
  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fa" }}>
      {showInstructions && <InstructionsForm onClose={() => setShowInstructions(false)} />}
      <div style={{
        background: "#fff", padding: 16, borderRadius: 12, margin: "24px auto 12px auto",
        boxShadow: "0 4px 24px #0001", maxWidth: 900, display: "flex", alignItems: "center", gap: 12
      }}>
        <button
          style={{ background: tool === "pencil" ? "#0d6efd" : "#eee", color: tool === "pencil" ? "#fff" : "#222" }}
          onClick={() => { setTool("pencil"); setSelectedIdx(null); }}
        >✏️ Pencil</button>
        <button
          style={{ background: tool === "eraser" ? "#0d6efd" : "#eee", color: tool === "eraser" ? "#fff" : "#222" }}
          onClick={() => { setTool("eraser"); setSelectedIdx(null); }}
        >🧽 Eraser</button>
        <button
          style={{ background: tool === "select" ? "#0d6efd" : "#eee", color: tool === "select" ? "#fff" : "#222" }}
          onClick={() => setTool("select")}
        >🖱️ Select</button>
        <span style={{ marginLeft: 12, fontWeight: 500 }}>Color:</span>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        {COLORS.map(c => (
          <button
            key={c}
            style={{
              background: c, width: 24, height: 24, borderRadius: 4, border: c === "#fff" ? "1px solid #ccc" : "none",
              marginLeft: 4, outline: color === c ? "2px solid #0d6efd" : "none"
            }}
            onClick={() => setColor(c)}
          />
        ))}
        <span style={{ marginLeft: 12, fontWeight: 500 }}>Size:</span>
        <input type="range" min={2} max={24} value={size} onChange={e => setSize(Number(e.target.value))} />
        <span style={{ marginLeft: 12, fontWeight: 500 }}>Shape:</span>
        <select value={shapeType} onChange={e => setShapeType(e.target.value as ShapeType)}>
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button onClick={insertShape}>Insert Shape</button>
      </div>
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px #0001",
        maxWidth: 900, margin: "0 auto", padding: 12
      }}>
        <canvas
          ref={canvasRef}
          width={860}
          height={520}
          style={{ width: "100%", height: 520, borderRadius: 12, border: "2px solid #e5e7eb", cursor: tool === "select" ? "pointer" : "crosshair", background: "#fff" }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
        />
      </div>
      <style jsx global>{`
        body {
          background: #f7f7fa;
          font-family: system-ui, sans-serif;
        }
      `}</style>
    </div>
  );
}