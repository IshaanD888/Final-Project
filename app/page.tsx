"use client";
import React, { useRef, useEffect, useState } from "react";

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
type DrawObj = PathObj | LineObj | ShapeObj;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [tool, setTool] = useState<"pencil" | "line" | "select">("pencil");
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [shape, setShape] = useState("");
  const [shapeW, setShapeW] = useState(100);
  const [shapeH, setShapeH] = useState(60);

  // Drawing logic state
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<DrawObj | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [confirmMove, setConfirmMove] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [dragged, setDragged] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  // Resize canvas on window resize
  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      const toolbar = toolbarRef.current;
      if (canvas && toolbar) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - toolbar.offsetHeight;
        redraw();
      }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
    // eslint-disable-next-line
  }, []);

  // Redraw on objects/selected/confirmMove change
  useEffect(() => {
    redraw();
    // eslint-disable-next-line
  }, [objects, selected, confirmMove]);

  // Drawing helpers
  function saveHistory() {
    setHistory((h) => [...h, JSON.stringify(objects)]);
  }
  function undo() {
    setHistory((h) => {
      if (h.length) {
        setObjects(JSON.parse(h[h.length - 1]));
        setSelected(null);
        setConfirmMove(false);
        return h.slice(0, -1);
      }
      return h;
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
      ctx.lineWidth = 1;
      ctx.strokeStyle = confirmMove ? "lime" : "red";
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }
  function drawObject(ctx: CanvasRenderingContext2D, obj: DrawObj) {
    ctx.globalAlpha = obj.opacity;
    ctx.lineWidth = obj.size;
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    if (obj.type === "path") {
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      obj.points.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (obj.type === "line") {
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      ctx.lineTo(obj.points[1].x, obj.points[1].y);
      ctx.stroke();
    } else if (obj.type === "shape") {
      ctx.beginPath();
      if (obj.shape === "rectangle") {
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      } else if (obj.shape === "circle") {
        ctx.arc(
          obj.x + obj.w / 2,
          obj.y + obj.h / 2,
          Math.min(obj.w, obj.h) / 2,
          0,
          2 * Math.PI
        );
        ctx.fill();
      } else if (obj.shape === "triangle") {
        ctx.moveTo(obj.x + obj.w / 2, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.h);
        ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  function isHit(o: DrawObj, x: number, y: number): boolean {
    const ox = getX(o),
      oy = getY(o),
      w = getW(o),
      h = getH(o);
    return (
      typeof ox === "number" &&
      typeof oy === "number" &&
      typeof w === "number" &&
      typeof h === "number" &&
      x >= ox &&
      x <= ox + w &&
      y >= oy &&
      y <= oy + h
    );
  }
  function getX(o: DrawObj): number {
    if (o.type === "path") return Math.min(...o.points.map((p) => p.x));
    if (o.type === "line") return Math.min(o.points[0].x, o.points[1].x);
    if ("x" in o) return o.x;
    return 0;
  }
  function getY(o: DrawObj): number {
    if (o.type === "path") return Math.min(...o.points.map((p) => p.y));
    if (o.type === "line") return Math.min(o.points[0].y, o.points[1].y);
    if ("y" in o) return o.y;
    return 0;
  }
  function getW(o: DrawObj): number {
    if (o.type === "path")
      return Math.max(...o.points.map((p) => p.x)) - getX(o);
    if (o.type === "line") return Math.abs(o.points[1].x - o.points[0].x);
    if ("w" in o) return o.w;
    return 0;
  }
  function getH(o: DrawObj): number {
    if (o.type === "path")
      return Math.max(...o.points.map((p) => p.y)) - getY(o);
    if (o.type === "line") return Math.abs(o.points[1].y - o.points[0].y);
    if ("h" in o) return o.h;
    return 0;
  }
  function shift(o: DrawObj, dx: number, dy: number) {
    if (o.type === "path" || o.type === "line") {
      o.points = o.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
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

  // Toolbar button active state
  function btnClass(name: string) {
    return tool === name ? "active" : "";
  }

  return (
    <div style={{ height: "100vh", background: "#222", color: "#fff" }}>
      <div
        id="toolbar"
        ref={toolbarRef}
        style={{
          background: "#333",
          padding: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          id="pencilBtn"
          className={btnClass("pencil")}
          onClick={() => setTool("pencil")}
        >
          Pencil 🖊️
        </button>
        <button
          id="lineBtn"
          className={btnClass("line")}
          onClick={() => setTool("line")}
        >
          Line 📏
        </button>
        <button
          id="selectBtn"
          className={btnClass("select")}
          onClick={() => setTool("select")}
        >
          Select 🖱️
        </button>
        <label>
          Size:{" "}
          <input
            type="range"
            id="sizeInp"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>
        <label>
          Opacity:{" "}
          <input
            type="range"
            id="opacityInp"
            min={0.1}
            max={1}
            step={0.1}
            value={brushOpacity}
            onChange={(e) => setBrushOpacity(Number(e.target.value))}
          />
        </label>
        <label>
          Color:{" "}
          <input
            type="color"
            id="colorInp"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
          />
        </label>
        <label>
          Shape:
          <select
            id="shapeSelect"
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
          Width:{" "}
          <input
            type="number"
            id="shapeW"
            min={10}
            value={shapeW}
            style={{ width: 60 }}
            onChange={(e) => setShapeW(Number(e.target.value))}
          />
        </label>
        <label>
          Height:{" "}
          <input
            type="number"
            id="shapeH"
            min={10}
            value={shapeH}
            style={{ width: 60 }}
            onChange={(e) => setShapeH(Number(e.target.value))}
          />
        </label>
        <button id="deleteBtn" onClick={handleDelete}>
          Delete
        </button>
        <button id="back" onClick={handleBack}>
          Send Backward
        </button>
        <button id="front" onClick={handleFront}>
          Bring Forward
        </button>
        <button id="clear" onClick={handleClear}>
          Clear
        </button>
        <button id="undoBtn" onClick={undo}>
          Undo
        </button>
        <button id="exportBtn" onClick={handleExport}>
          Export PNG
        </button>
        <style jsx>{`
          button,
          select,
          input[type="color"],
          input[type="range"],
          input[type="number"] {
            background: #444;
            color: #fff;
            border: none;
            padding: 5px;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.1s ease;
          }
          button:active {
            transform: scale(0.95);
          }
          button.active {
            background: #0d6efd;
          }
        `}</style>
      </div>
      <canvas
        id="canvas"
        ref={canvasRef}
        style={{
          flex: 1,
          display: "block",
          background: "#fff",
          cursor: "crosshair",
          width: "100vw",
          height: `calc(100vh - 60px)`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
