"use client";
import React, { useRef, useState, useEffect } from "react";
import Head from "next/head";

const COLORS = [
  "#000000", "#e74c3c", "#27ae60", "#f1c40f", "#3498db"
];
const FONTS = [
  "sans-serif", "serif", "monospace", "cursive"
];

type Point = { x: number; y: number };
type PathObj = {
  type: "path";
  points: Point[];
  size: number;
  color: string;
  opacity: number;
  isEraser?: boolean;
};
type LineObj = {
  type: "line";
  points: [Point, Point];
  size: number;
  color: string;
  opacity: number;
};
type ShapeObj = {
  type: "shape";
  shape: "rectangle" | "circle" | "triangle";
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  opacity: number;
};
type TextObj = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  font: string;
  opacity: number;
};
type DrawObj = PathObj | LineObj | ShapeObj | TextObj;

export default function DrawingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pencil" | "line" | "select" | "eraser" | "text">("pencil");
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [font, setFont] = useState(FONTS[0]);
  const [shape, setShape] = useState("");
  const [shapeW, setShapeW] = useState(100);
  const [shapeH, setShapeH] = useState(60);
  const [night, setNight] = useState(false);

  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [history, setHistory] = useState<DrawObj[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawObj[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [lineStart, setLineStart] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<Point | null>(null);

  // Sound
  const clickSoundRef = useRef<HTMLAudioElement>(null);

  // Resize canvas on mount and window resize
  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      if (canvas) {
        const prev = canvas.toDataURL();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 100;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const img = new window.Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = prev;
        }
      }
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Redraw on objects or night mode change
  useEffect(() => {
    redraw();
  }, [objects, selected, night]);

  // Play click sound on button/select
  const playClick = () => {
    if (clickSoundRef.current) {
      clickSoundRef.current.currentTime = 0;
      clickSoundRef.current.play();
    }
  };

  // Drawing logic
  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach((obj, idx) => drawObject(ctx, obj, idx === selected));
  }

  function drawObject(ctx: CanvasRenderingContext2D, obj: DrawObj, highlight: boolean) {
    ctx.save();
    ctx.globalAlpha = obj.opacity ?? 1;
    if (obj.type === "path") {
      ctx.lineWidth = obj.size;
      ctx.strokeStyle = obj.isEraser ? "#fff" : obj.color;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      obj.points.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (obj.type === "line") {
      ctx.lineWidth = obj.size;
      ctx.strokeStyle = obj.color;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      ctx.lineTo(obj.points[1].x, obj.points[1].y);
      ctx.stroke();
    } else if (obj.type === "shape") {
      ctx.lineWidth = obj.size || 2;
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = obj.color + "33";
      ctx.beginPath();
      if (obj.shape === "rectangle") {
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      } else if (obj.shape === "circle") {
        ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, Math.min(obj.w, obj.h) / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (obj.shape === "triangle") {
        ctx.moveTo(obj.x + obj.w / 2, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.h);
        ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (obj.type === "text") {
      ctx.font = `${obj.size * 4 + 12}px ${obj.font}`;
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, obj.x, obj.y);
    }
    if (highlight) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0d6efd";
      const { x, y, w, h } = getBoundingBox(obj);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function getBoundingBox(obj: DrawObj) {
    if (obj.type === "path") {
      const xs = obj.points.map(p => p.x);
      const ys = obj.points.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (obj.type === "line") {
      const xs = [obj.points[0].x, obj.points[1].x];
      const ys = [obj.points[0].y, obj.points[1].y];
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.abs(xs[1] - xs[0]), h: Math.abs(ys[1] - ys[0]) };
    }
    if (obj.type === "shape") {
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    }
    if (obj.type === "text") {
      return { x: obj.x, y: obj.y - obj.size * 4, w: obj.text.length * (obj.size * 2 + 8), h: obj.size * 4 + 12 };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // Mouse events
  function handleMouseDown(e: React.MouseEvent) {
    playClick();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "select") {
      // Select object
      for (let i = objects.length - 1; i >= 0; i--) {
        const box = getBoundingBox(objects[i]);
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          setSelected(i);
          setDragStart({ x, y });
          return;
        }
      }
      setSelected(null);
    } else if (tool === "pencil" || tool === "eraser") {
      setDrawing(true);
      setCurrentPath([{ x, y }]);
    } else if (tool === "line") {
      setDrawing(true);
      setLineStart({ x, y });
    } else if (tool === "text") {
      setTextPos({ x, y });
      setTextInput("");
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "pencil" || tool === "eraser") {
      if (drawing) {
        setCurrentPath(path => [...path, { x, y }]);
      }
    } else if (tool === "line") {
      if (drawing && lineStart) {
        // Preview line
        redraw();
        const ctx = canvasRef.current!.getContext("2d")!;
        ctx.save();
        ctx.globalAlpha = brushOpacity;
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = brushColor;
        ctx.beginPath();
        ctx.moveTo(lineStart.x, lineStart.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
    } else if (tool === "select" && selected !== null && dragStart) {
      // Move selected object
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      setObjects(objs =>
        objs.map((obj, idx) =>
          idx === selected
            ? moveObject(obj, dx, dy)
            : obj
        )
      );
      setDragStart({ x, y });
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (tool === "pencil" || tool === "eraser") {
      if (drawing && currentPath.length > 1) {
        saveHistory();
        setObjects(objs => [
          ...objs,
          {
            type: "path",
            points: currentPath,
            size: brushSize,
            color: brushColor,
            opacity: brushOpacity,
            isEraser: tool === "eraser"
          }
        ]);
      }
      setDrawing(false);
      setCurrentPath([]);
    } else if (tool === "line") {
      if (drawing && lineStart) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        saveHistory();
        setObjects(objs => [
          ...objs,
          {
            type: "line",
            points: [lineStart, { x, y }],
            size: brushSize,
            color: brushColor,
            opacity: brushOpacity
          }
        ]);
      }
      setDrawing(false);
      setLineStart(null);
    } else if (tool === "select" && selected !== null) {
      saveHistory();
      setDragStart(null);
    }
  }

  function moveObject(obj: DrawObj, dx: number, dy: number): DrawObj {
    if (obj.type === "path") {
      return { ...obj, points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    }
    if (obj.type === "line") {
      return { ...obj, points: [ { x: obj.points[0].x + dx, y: obj.points[0].y + dy }, { x: obj.points[1].x + dx, y: obj.points[1].y + dy } ] };
    }
    if (obj.type === "shape") {
      return { ...obj, x: obj.x + dx, y: obj.y + dy };
    }
    if (obj.type === "text") {
      return { ...obj, x: obj.x + dx, y: obj.y + dy };
    }
    return obj;
  }

  // Toolbar actions
  function saveHistory() {
    setHistory(h => [...h, objects]);
    setRedoStack([]);
  }
  function undo() {
    if (history.length === 0) return;
    setRedoStack(r => [objects, ...r]);
    setObjects(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  }
  function redo() {
    if (redoStack.length === 0) return;
    setHistory(h => [...h, objects]);
    setObjects(redoStack[0]);
    setRedoStack(r => r.slice(1));
  }
  function handleShapeInsert(e: React.ChangeEvent<HTMLSelectElement>) {
    const shapeVal = e.target.value as "rectangle" | "circle" | "triangle";
    if (!shapeVal) return;
    saveHistory();
    setObjects(objs => [
      ...objs,
      {
        type: "shape",
        shape: shapeVal,
        x: (canvasRef.current?.width ?? 0) / 2 - shapeW / 2,
        y: (canvasRef.current?.height ?? 0) / 2 - shapeH / 2,
        w: shapeW,
        h: shapeH,
        size: brushSize,
        color: brushColor,
        opacity: brushOpacity
      }
    ]);
    setShape("");
  }
  function handleDelete() {
    if (selected !== null) {
      saveHistory();
      setObjects(objs => objs.filter((_, idx) => idx !== selected));
      setSelected(null);
    }
  }
  function handleBack() {
    if (selected !== null && selected > 0) {
      saveHistory();
      setObjects(objs => {
        const newObjs = [...objs];
        const [obj] = newObjs.splice(selected, 1);
        newObjs.splice(selected - 1, 0, obj);
        return newObjs;
      });
      setSelected(selected - 1);
    }
  }
  function handleFront() {
    if (selected !== null && selected < objects.length - 1) {
      saveHistory();
      setObjects(objs => {
        const newObjs = [...objs];
        const [obj] = newObjs.splice(selected, 1);
        newObjs.splice(selected + 1, 0, obj);
        return newObjs;
      });
      setSelected(selected + 1);
    }
  }
  function handleNight() {
    setNight(n => !n);
  }

  // Text tool submit
  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (textInput.trim() && textPos) {
      saveHistory();
      setObjects(objs => [
        ...objs,
        {
          type: "text",
          x: textPos.x,
          y: textPos.y,
          text: textInput,
          color: brushColor,
          size: brushSize,
          font,
          opacity: brushOpacity
        }
      ]);
    }
    setTextInput("");
    setTextPos(null);
  }

  // Color palette click
  function handlePalette(color: string) {
    setBrushColor(color);
    playClick();
  }

  return (
    <>
      <Head>
        <title>Drawing App – Right-Click Select</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet"/>
      </Head>
      <audio ref={clickSoundRef} src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YYQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=" preload="auto"/>
      <div className={night ? "night" : ""} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div id="toolbar">
          <button id="pencilBtn" className={tool === "pencil" ? "active" : ""} onClick={() => { setTool("pencil"); playClick(); }}>Pencil</button>
          <button id="lineBtn" className={tool === "line" ? "active" : ""} onClick={() => { setTool("line"); playClick(); }}>Line</button>
          <button id="selectBtn" className={tool === "select" ? "active" : ""} onClick={() => { setTool("select"); playClick(); }}>Select</button>
          <button id="eraserBtn" className={tool === "eraser" ? "active" : ""} onClick={() => { setTool("eraser"); playClick(); }}>Eraser</button>
          <button id="textBtn" className={tool === "text" ? "active" : ""} onClick={() => { setTool("text"); playClick(); }}>Text</button>
          <select id="fontSelect" value={font} onChange={e => { setFont(e.target.value); playClick(); }}>
            {FONTS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>
          <div id="colorPalette" style={{ display: "inline-flex", alignItems: "center" }}>
            <span className="labelText">Color:</span>
            <input type="color" id="colorInp" value={brushColor} onChange={e => setBrushColor(e.target.value)} />
            {COLORS.slice(1).map(c => (
              <button key={c} style={{ background: c }} data-color={c} onClick={() => handlePalette(c)} />
            ))}
          </div>
          <label><span className="labelText">Size:</span>
            <input type="range" id="sizeInp" min={1} max={30} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
          </label>
          <label><span className="labelText">Opacity:</span>
            <input type="range" id="opacityInp" min={0.1} max={1} step={0.1} value={brushOpacity} onChange={e => setBrushOpacity(Number(e.target.value))} />
          </label>
          <label>Shape:
            <select id="shapeSelect" value={shape} onChange={e => { setShape(e.target.value); handleShapeInsert(e as any); }}>
              <option value="">Insert Shape</option>
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
            </select>
          </label>
          <label>W: <input type="number" id="shapeW" value={shapeW} style={{ width: 60 }} onChange={e => setShapeW(Number(e.target.value))} /></label>
          <label>H: <input type="number" id="shapeH" value={shapeH} style={{ width: 60 }} onChange={e => setShapeH(Number(e.target.value))} /></label>
          <button id="deleteBtn" onClick={handleDelete}>Delete</button>
          <button id="back" onClick={handleBack}>Send Backward</button>
          <button id="front" onClick={handleFront}>Bring Forward</button>
          <button id="undoBtn" onClick={undo}>Undo</button>
          <button id="redoBtn" onClick={redo}>Redo</button>
          <button id="nightBtn" onClick={handleNight}>{night ? "☀️ Day" : "🌙 Night Mode"}</button>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <canvas
            id="canvas"
            ref={canvasRef}
            style={{ width: "100vw", height: "calc(100vh - 100px)", display: "block", background: night ? "#222" : "#fff" }}
            width={typeof window !== "undefined" ? window.innerWidth : 800}
            height={typeof window !== "undefined" ? window.innerHeight - 100 : 600}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
          {textPos && tool === "text" && (
            <form
              onSubmit={handleTextSubmit}
              style={{
                position: "absolute",
                left: textPos.x,
                top: textPos.y,
                zIndex: 10,
                background: "#fff",
                padding: 6,
                borderRadius: 6,
                boxShadow: "0 2px 8px #0002"
              }}
            >
              <input
                autoFocus
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                style={{
                  fontSize: brushSize * 4 + 12,
                  fontFamily: font,
                  color: brushColor,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  padding: "2px 8px",
                  outline: "none"
                }}
                placeholder="Enter text"
              />
              <button type="submit" style={{ marginLeft: 8 }}>OK</button>
            </form>
          )}
        </div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
          body {
            margin: 0; font-family: sans-serif;
            display: flex; flex-direction: column; height: 100vh;
            background: var(--bg); color: var(--fg);
            --bg: #fff; --fg: #000;
            --toolbar-bg: #eee; --btn-bg: #ddd; --btn-hover: #ccc;
            transition: background .2s, color .2s;
          }
          .night {
            --bg: #222; --fg: #eee;
            --toolbar-bg: #333; --btn-bg: #444; --btn-hover: #555;
          }
          #toolbar {
            background: var(--toolbar-bg); padding: 10px;
            display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
            user-select: none;
          }
          button, select, input {
            background: var(--btn-bg); color: var(--fg);
            border: none; padding: 5px 8px; border-radius: 4px;
            cursor: pointer; transition: transform .1s, background .2s;
          }
          button:hover { background: var(--btn-hover); }
          button:active { transform: scale(.95); }
          button.active { background: #0d6efd; color: #fff; }
          #colorPalette button {
            width: 24px; height: 24px; padding: 0; border-radius: 4px;
            margin-left: 4px;
          }
          canvas { flex: 1; background: #fff; cursor: crosshair; border-top: 2px solid #aaa; }
          .labelText {
            font-family: 'Pacifico', cursive;
            margin-right: 4px;
          }
        `}</style>
      </div>
    </>
  );
}