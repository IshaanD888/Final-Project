"use client";
import React, { useRef, useEffect, useState } from "react";

// Types
type Point = { x: number; y: number };
type PathObj = {
  type: "path";
  points: Point[];
  size: number;
  color: string;
  opacity: number;
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
};
type DrawObj = PathObj | LineObj | ShapeObj | TextObj;

const FONTS = [
  "Bebas Neue, sans-serif",
  "Pacifico, cursive",
  "system-ui, sans-serif",
  "monospace",
];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [tool, setTool] = useState<"pencil" | "line" | "select" | "text">("pencil");
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#2563eb");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [shape, setShape] = useState("");
  const [shapeW, setShapeW] = useState(100);
  const [shapeH, setShapeH] = useState(60);
  const [font, setFont] = useState(FONTS[0]);
  const [night, setNight] = useState(false);

  // Drawing logic state
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<DrawObj | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [confirmMove, setConfirmMove] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [dragged, setDragged] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  // Text tool state
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState<Point | null>(null);

  // Resize canvas on window resize
  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      const toolbar = toolbarRef.current;
      if (canvas && toolbar) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - toolbar.offsetHeight;
      }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Redraw on objects/selected/confirmMove/night change
  useEffect(() => {
    redraw();
    // eslint-disable-next-line
  }, [objects, selected, confirmMove, night]);

  // Drawing helpers
  function saveHistory(newObjs?: DrawObj[]) {
    setHistory((h) => [...h, JSON.stringify(objects)]);
    if (newObjs) setRedoStack([]); // clear redo stack on new action
  }
  function undo() {
    setHistory((h) => {
      if (h.length) {
        setRedoStack((r) => [JSON.stringify(objects), ...r]);
        setObjects(JSON.parse(h[h.length - 1]));
        setSelected(null);
        setConfirmMove(false);
        return h.slice(0, -1);
      }
      return h;
    });
  }
  function redo() {
    setRedoStack((r) => {
      if (r.length) {
        setHistory((h) => [...h, JSON.stringify(objects)]);
        setObjects(JSON.parse(r[0]));
        setSelected(null);
        setConfirmMove(false);
        return r.slice(1);
      }
      return r;
    });
  }
  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach((obj) => drawObject(ctx, obj));
    if (selected) {
      const x = getX(selected),
        y = getY(selected),
        w = getW(selected),
        h = getH(selected);
      ctx.globalAlpha = 1;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = confirmMove ? "#22c55e" : "#f59e42";
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }
  function drawObject(ctx: CanvasRenderingContext2D, obj: DrawObj) {
    if (obj.type === "path") {
      ctx.globalAlpha = obj.opacity;
      ctx.lineWidth = obj.size;
      ctx.strokeStyle = obj.color;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      obj.points.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (obj.type === "line") {
      ctx.globalAlpha = obj.opacity;
      ctx.lineWidth = obj.size;
      ctx.strokeStyle = obj.color;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      ctx.lineTo(obj.points[1].x, obj.points[1].y);
      ctx.stroke();
    } else if (obj.type === "shape") {
      ctx.globalAlpha = obj.opacity;
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = obj.color + "33";
      ctx.lineWidth = obj.size || 2;
      ctx.beginPath();
      if (obj.shape === "rectangle") {
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      } else if (obj.shape === "circle") {
        ctx.arc(
          obj.x + obj.w / 2,
          obj.y + obj.h / 2,
          Math.min(obj.w, obj.h) / 2,
          0,
          2 * Math.PI
        );
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
      ctx.globalAlpha = 1;
      ctx.font = `${obj.size * 4 + 12}px ${obj.font}`;
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, obj.x, obj.y);
    }
  }
  function isHit(o: DrawObj, x: number, y: number) {
    const ox = getX(o),
      oy = getY(o),
      w = getW(o),
      h = getH(o);
    return x >= ox && x <= ox + w && y >= oy && y <= oy + h;
  }
  function getX(o: DrawObj) {
    if (o.type === "path") return Math.min(...o.points.map((p) => p.x));
    if (o.type === "line") return Math.min(o.points[0].x, o.points[1].x);
    if (o.type === "text") return o.x;
    return o.x;
  }
  function getY(o: DrawObj) {
    if (o.type === "path") return Math.min(...o.points.map((p) => p.y));
    if (o.type === "line") return Math.min(o.points[0].y, o.points[1].y);
    if (o.type === "text") return o.y;
    return o.y;
  }
  function getW(o: DrawObj) {
    if (o.type === "path")
      return Math.max(...o.points.map((p) => p.x)) - getX(o);
    if (o.type === "line") return Math.abs(o.points[1].x - o.points[0].x);
    if (o.type === "text") return o.text.length * (o.size * 2 + 8);
    return o.w;
  }
  function getH(o: DrawObj) {
    if (o.type === "path")
      return Math.max(...o.points.map((p) => p.y)) - getY(o);
    if (o.type === "line") return Math.abs(o.points[1].y - o.points[0].y);
    if (o.type === "text") return o.size * 4 + 12;
    return o.h;
  }
  function shift(o: DrawObj, dx: number, dy: number) {
    if (o.type === "path" || o.type === "line") {
      o.points = o.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (o.type === "text") {
      o.x += dx;
      o.y += dy;
    } else {
      o.x += dx;
      o.y += dy;
    }
  }

  // Mouse events
  function handleMouseDown(e: React.MouseEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStart({ x, y });
    setDragged(false);
    setConfirmMove(false);

    if (tool === "select") {
      for (let i = objects.length - 1; i >= 0; i--) {
        if (isHit(objects[i], x, y)) {
          setSelected(objects[i]);
          setOffset({ x: x - getX(objects[i]), y: y - getY(objects[i]) });
          setConfirmMove(false);
          return;
        }
      }
    } else if (tool === "text") {
      setTextPos({ x, y });
      setShowTextInput(true);
    } else {
      saveHistory();
      setDrawing(true);
      setSelected(null);
      if (tool === "pencil") {
        setObjects((objs) => [
          ...objs,
          {
            type: "path",
            points: [{ x, y }],
            size: brushSize,
            color: brushColor,
            opacity: brushOpacity,
          },
        ]);
      } else if (tool === "line") {
        setObjects((objs) => [
          ...objs,
          {
            type: "line",
            points: [
              { x, y },
              { x, y },
            ],
            size: brushSize,
            color: brushColor,
            opacity: brushOpacity,
          },
        ]);
      }
    }
  }
  function handleMouseMove(e: React.MouseEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "select" && selected && !confirmMove) {
      setDragged(true);
      const dx = x - offset.x - getX(selected);
      const dy = y - offset.y - getY(selected);
      setObjects((objs) =>
        objs.map((obj) =>
          obj === selected
            ? (() => {
                const copy = JSON.parse(JSON.stringify(obj));
                shift(copy, dx, dy);
                return copy;
              })()
            : obj
        )
      );
    } else if (drawing) {
      setObjects((objs) => {
        const newObjs = [...objs];
        const obj = newObjs[newObjs.length - 1];
        if (!obj) return newObjs;
        if (obj.type === "path") {
          obj.points = [...obj.points, { x, y }];
        } else if (obj.type === "line") {
          obj.points = [obj.points[0], { x, y }];
        }
        newObjs[newObjs.length - 1] = obj;
        return newObjs;
      });
    }
  }
  function handleMouseUp() {
    setDrawing(false);
    if (tool !== "select") setSelected(null);
  }
  function handleContextMenu(e: React.MouseEvent) {
    if (tool === "select" && dragged && selected) {
      e.preventDefault();
      setConfirmMove(true);
    }
  }

  // Toolbar actions
  function handleShapeInsert(e: React.ChangeEvent<HTMLSelectElement>) {
    const shapeVal = e.target.value as "rectangle" | "circle" | "triangle";
    if (!shapeVal) return;
    saveHistory();
    setObjects((objs) => [
      ...objs,
      {
        type: "shape",
        shape: shapeVal,
        x: (canvasRef.current?.width ?? 0) / 2 - shapeW / 2,
        y: (canvasRef.current?.height ?? 0) / 2 - shapeH / 2,
        w: shapeW,
        h: shapeH,
        size: 0,
        color: brushColor,
        opacity: brushOpacity,
      },
    ]);
    setSelected(null);
    setShape("");
  }
  function handleDelete() {
    if (selected) {
      setObjects(objects.filter((o) => o !== selected));
      setSelected(null);
    }
  }
  function handleBack() {
    if (selected) {
      const idx = objects.indexOf(selected);
      if (idx > 0) {
        const newObjs = [...objects];
        newObjs.splice(idx, 1);
        newObjs.splice(idx - 1, 0, selected);
        setObjects(newObjs);
      }
    }
  }
  function handleFront() {
    if (selected) {
      const idx = objects.indexOf(selected);
      if (idx < objects.length - 1) {
        const newObjs = [...objects];
        newObjs.splice(idx, 1);
        newObjs.splice(idx + 1, 0, selected);
        setObjects(newObjs);
      }
    }
  }
  function handleClear() {
    saveHistory();
    setObjects([]);
    setSelected(null);
  }
  function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "drawing.png";
    a.href = canvas.toDataURL();
    a.click();
  }

  // Text tool submit
  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (textInput.trim() && textPos) {
      saveHistory();
      setObjects((objs) => [
        ...objs,
        {
          type: "text",
          x: textPos.x,
          y: textPos.y,
          text: textInput,
          color: brushColor,
          size: brushSize,
          font,
        },
      ]);
    }
    setTextInput("");
    setShowTextInput(false);
    setTextPos(null);
  }

  // Toolbar button active state
  function btnClass(name: string) {
    return tool === name ? "active" : "";
  }

  return (
    <div className={night ? "night" : ""} style={{ height: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Pacifico&display=swap" rel="stylesheet" />
      <div
        id="toolbar"
        ref={toolbarRef}
        style={{
          background: "var(--toolbar-bg)",
          padding: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          fontFamily: "var(--font-main)",
        }}
      >
        <span className="title">DrawIt!</span>
        <button className={btnClass("pencil")} onClick={() => setTool("pencil")}>
          Pencil 🖊️
        </button>
        <button className={btnClass("line")} onClick={() => setTool("line")}>
          Line 📏
        </button>
        <button className={btnClass("select")} onClick={() => setTool("select")}>
          Select 🖱️
        </button>
        <button className={btnClass("text")} onClick={() => setTool("text")}>
          Text 🅰️
        </button>
        <label>
          <span className="labelText">Size:</span>
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="labelText">Opacity:</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={brushOpacity}
            onChange={(e) => setBrushOpacity(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="labelText">Color:</span>
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
          />
        </label>
        <label>
          <span className="labelText">Font:</span>
          <select value={font} onChange={e => setFont(e.target.value)}>
            {FONTS.map(f => <option key={f} value={f}>{f.split(",")[0]}</option>)}
          </select>
        </label>
        <label>
          <span className="labelText">Shape:</span>
          <select
            value={shape}
            onChange={(e) => {
              setShape(e.target.value);
              handleShapeInsert(e);
            }}
          >
            <option value="">Insert Shape</option>
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="triangle">Triangle</option>
          </select>
        </label>
        <label>
          <span className="labelText">Width:</span>
          <input
            type="number"
            min={10}
            value={shapeW}
            style={{ width: 60 }}
            onChange={(e) => setShapeW(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="labelText">Height:</span>
          <input
            type="number"
            min={10}
            value={shapeH}
            style={{ width: 60 }}
            onChange={(e) => setShapeH(Number(e.target.value))}
          />
        </label>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={handleBack}>Send Backward</button>
        <button onClick={handleFront}>Bring Forward</button>
        <button onClick={handleClear}>Clear</button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <button onClick={handleExport}>Export PNG</button>
        <button onClick={() => setNight(n => !n)}>
          {night ? "☀️ Day" : "🌙 Night"}
        </button>
        <style jsx>{`
          .title {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.7rem;
            color: var(--accent);
            margin-right: 18px;
            letter-spacing: 2px;
          }
          .labelText {
            font-family: 'Pacifico', cursive;
            color: var(--accent);
            margin-right: 4px;
          }
          button,
          select,
          input[type="color"],
          input[type="range"],
          input[type="number"] {
            background: var(--btn-bg);
            color: var(--fg);
            border: none;
            padding: 5px;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.1s ease, background 0.2s;
          }
          button:active {
            transform: scale(0.95);
          }
          button.active {
            background: var(--accent);
            color: #fff;
          }
        `}</style>
      </div>
      <div style={{ position: "relative", flex: 1 }}>
        <canvas
          ref={canvasRef}
          style={{
            flex: 1,
            display: "block",
            background: "var(--canvas-bg)",
            cursor: tool === "select" ? "pointer" : "crosshair",
            width: "100vw",
            height: `calc(100vh - 60px)`,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
        {showTextInput && textPos && (
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
              boxShadow: "0 2px 8px #0002",
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
                outline: "none",
              }}
              placeholder="Enter text"
            />
            <button type="submit" style={{ marginLeft: 8 }}>OK</button>
          </form>
        )}
      </div>
      <style jsx global>{`
        :root {
          --bg: #f7f7fa;
          --fg: #18181b;
          --toolbar-bg: #f1f5f9;
          --canvas-bg: #fff;
          --btn-bg: #e0e7ef;
          --accent: #2563eb;
        }
        .night {
          --bg: #18181b;
          --fg: #f7f7fa;
          --toolbar-bg: #23232a;
          --canvas-bg: #23232a;
          --btn-bg: #333;
          --accent: #60a5fa;
        }
        body {
          background: var(--bg);
          color: var(--fg);
          font-family: system-ui, sans-serif;
        }
      `}</style>
    </div>
  );
}