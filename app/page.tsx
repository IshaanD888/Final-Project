"use client";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,

} from "react";
import { ButtonSoundContext } from "./useButtonSound";

type Point = { x: number; y: number };
type DrawType = "pencil" | "eraser" | "select" | "shape";
type ShapeType = "rectangle" | "circle" | "triangle";
type PathObj = {
  type: "path";
  points: Point[];
  size: number;
  color: string;
  opacity: number;
  isEraser?: boolean;
};
type ShapeObj = {
  type: "shape";
  shape: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
};
type DrawObj = PathObj | ShapeObj;

// --- Sound Context (moved from layout.tsx) ---

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // UI state
  const [tool, setTool] = useState<DrawType>("pencil");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [opacity, setOpacity] = useState(1);
  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");
  const [shapeW, setShapeW] = useState(100);
  const [shapeH, setShapeH] = useState(60);
  const [theme, setTheme] = useState("light");

  // Drawing state
  const [objects, setObjects] = useState<DrawObj[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<Point>({ x: 0, y: 0 });

  const [history, setHistory] = useState<DrawObj[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawObj[][]>([]);
  const [resizeHandle, setResizeHandle] = useState<number | null>(null); // 0:tl, 1:tr, 2:bl, 3:br

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Redraw on objects/selected/tool change
  useEffect(() => {
    redraw();
    // eslint-disable-next-line
  }, [objects, selected, tool]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach((obj, idx) => {
      if (obj.type === "path") {
        ctx.globalAlpha = obj.opacity;
        ctx.lineWidth = obj.size;
        ctx.lineCap = "round";
        // FIX: Use destination-out for eraser
        if (obj.isEraser) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = obj.color;
        }
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        obj.points.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over"; // reset after stroke
      } else if (obj.type === "shape") {
        ctx.globalAlpha = obj.opacity;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = obj.color;
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
      // Draw selection and resize handles
      if (selected === idx) {
        ctx.globalAlpha = 1;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0d6efd";
        let x = 0,
          y = 0,
          w = 0,
          h = 0;
        if (obj.type === "shape") {
          x = obj.x;
          y = obj.y;
          w = obj.w;
          h = obj.h;
        } else if (obj.type === "path") {
          const xs = obj.points.map((p) => p.x);
          const ys = obj.points.map((p) => p.y);
          x = Math.min(...xs);
          y = Math.min(...ys);
          w = Math.max(...xs) - x;
          h = Math.max(...ys) - y;
        }
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Draw resize handles for shapes
        if (obj.type === "shape") {
          const handleSize = 10;
          const corners = [
            [obj.x, obj.y],
            [obj.x + obj.w, obj.y],
            [obj.x, obj.y + obj.h],
            [obj.x + obj.w, obj.y + obj.h],
          ];
          ctx.fillStyle = "#0d6efd";
          corners.forEach(([hx, hy]) => {
            ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
          });
        }
      }
    });
  }, [objects, selected, tool]);

  // Resize canvas on window resize/orientation change
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
    window.addEventListener("orientationchange", resizeCanvas);
    resizeCanvas();
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("orientationchange", resizeCanvas);
    };
  }, [redraw]);

  // Unified pointer event handler
  function getPointerFromEvent(e: React.MouseEvent | React.TouchEvent): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ("clientX" in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  }

  // Save history for undo
  function pushHistory(newObjs: DrawObj[]) {
    setHistory((h) => [...h, objects]);
    setRedoStack([]); // clear redo stack on new action
    setObjects(newObjs);
  }

  // Mouse/touch events
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pt = getPointerFromEvent(e);
      setStart(pt);
      setDrawing(true);

      // Check for resize handle if select tool and shape selected
      if (tool === "select" && selected !== null && objects[selected]?.type === "shape") {
        const obj = objects[selected] as ShapeObj;
        const handleSize = 10;
        const corners = [
          [obj.x, obj.y],
          [obj.x + obj.w, obj.y],
          [obj.x, obj.y + obj.h],
          [obj.x + obj.w, obj.y + obj.h],
        ];
        for (let i = 0; i < corners.length; i++) {
          const [x, y] = corners[i];
          if (Math.abs(pt.x - x) < handleSize && Math.abs(pt.y - y) < handleSize) {
            setResizeHandle(i);
            setDrawing(true);
            return;
          }
        }
      }

      if (tool === "pencil" || tool === "eraser") {
        pushHistory([
          ...objects,
          {
            type: "path",
            points: [pt],
            size,
            color,
            opacity,
            isEraser: tool === "eraser",
          },
        ]);
        setSelected(null);
      } else if (tool === "select") {
        // Select topmost object under pointer
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          let hit = false;
          if (obj.type === "shape") {
            hit =
              pt.x >= obj.x &&
              pt.x <= obj.x + obj.w &&
              pt.y >= obj.y &&
              pt.y <= obj.y + obj.h;
          } else if (obj.type === "path") {
            const xs = obj.points.map((p) => p.x);
            const ys = obj.points.map((p) => p.y);
            hit =
              pt.x >= Math.min(...xs) &&
              pt.x <= Math.max(...xs) &&
              pt.y >= Math.min(...ys) &&
              pt.y <= Math.max(...ys);
          }
          if (hit) {
            setSelected(i);
            return;
          }
        }
        setSelected(null);
      } else if (tool === "shape") {
        pushHistory([
          ...objects,
          {
            type: "shape",
            shape: shapeType,
            x: pt.x - shapeW / 2,
            y: pt.y - shapeH / 2,
            w: shapeW,
            h: shapeH,
            color,
            opacity,
          },
        ]);
        setSelected(objects.length); // select the new shape
      }
      // eslint-disable-next-line
    },
    [tool, color, size, opacity, shapeType, shapeW, shapeH, objects, selected]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing) return;
      const pt = getPointerFromEvent(e);

      // Resize shape if dragging a handle
      if (resizeHandle !== null && selected !== null && objects[selected]?.type === "shape") {
        setObjects((objs) => {
          const newObjs = [...objs];
          const obj = { ...newObjs[selected] } as ShapeObj;
          switch (resizeHandle) {
            case 0: // top-left
              obj.w += obj.x - pt.x;
              obj.h += obj.y - pt.y;
              obj.x = pt.x;
              obj.y = pt.y;
              break;
            case 1: // top-right
              obj.w = pt.x - obj.x;
              obj.h += obj.y - pt.y;
              obj.y = pt.y;
              break;
            case 2: // bottom-left
              obj.w += obj.x - pt.x;
              obj.x = pt.x;
              obj.h = pt.y - obj.y;
              break;
            case 3: // bottom-right
              obj.w = pt.x - obj.x;
              obj.h = pt.y - obj.y;
              break;
          }
          obj.w = Math.max(10, obj.w);
          obj.h = Math.max(10, obj.h);
          newObjs[selected] = obj;
          return newObjs;
        });
        return;
      }

      if (tool === "pencil" || tool === "eraser") {
        setObjects((objs) => {
          const newObjs = [...objs];
          const obj = { ...newObjs[newObjs.length - 1] } as PathObj;
          if (obj && obj.type === "path") {
            obj.points = [...obj.points, pt];
            newObjs[newObjs.length - 1] = obj;
          }
          return newObjs;
        });
        // Live preview on canvas (optional)
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.lineWidth = size;
            ctx.lineCap = "round";
            if (tool === "eraser") {
              ctx.globalCompositeOperation = "destination-out";
              ctx.strokeStyle = "rgba(0,0,0,1)";
            } else {
              ctx.globalCompositeOperation = "source-over";
              ctx.strokeStyle = color;
            }
            ctx.beginPath();
            const newObjs = [...objects];
            const obj = newObjs[newObjs.length - 1] as PathObj;
            if (obj && obj.points && obj.points.length > 0) {
              const prev = obj.points[obj.points.length - 1];
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      } else if (tool === "select" && selected !== null) {
        setObjects((objs) => {
          const newObjs = [...objs];
          const obj = { ...newObjs[selected] };
          if (obj.type === "shape") {
            obj.x += pt.x - start.x;
            obj.y += pt.y - start.y;
          } else if (obj.type === "path") {
            obj.points = obj.points.map((p) => ({
              x: p.x + (pt.x - start.x),
              y: p.y + (pt.y - start.y),
            }));
          }
          newObjs[selected] = obj;
          return newObjs;
        });
        setStart(pt);
      }
      // eslint-disable-next-line
    },
    [drawing, tool, selected, start, color, opacity, size, objects, resizeHandle]
  );

  const handlePointerUp = useCallback(() => {
    setDrawing(false);
    setResizeHandle(null);
  }, []);

  // Undo/Redo/Clear/Export/Delete/Layer
  function handleUndo() {
    if (history.length === 0) return;
    setRedoStack((r) => [objects, ...r]);
    setObjects(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
  }
  function handleRedo() {
    if (redoStack.length === 0) return;
    setHistory((h) => [...h, objects]);
    setObjects(redoStack[0]);
    setRedoStack((r) => r.slice(1));
    setSelected(null);
  }
  function handleClear() {
    pushHistory([]);
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
  function handleDelete() {
    if (selected === null) return;
    const newObjs = objects.filter((_, i) => i !== selected);
    pushHistory(newObjs);
    setSelected(null);
  }
  function handleBringForward() {
    if (selected === null || selected === objects.length - 1) return;
    const newObjs = [...objects];
    const [item] = newObjs.splice(selected, 1);
    newObjs.splice(selected + 1, 0, item);
    pushHistory(newObjs);
    setSelected(selected + 1);
  }
  function handleSendBackward() {
    if (selected === null || selected === 0) return;
    const newObjs = [...objects];
    const [item] = newObjs.splice(selected, 1);
    newObjs.splice(selected - 1, 0, item);
    pushHistory(newObjs);
    setSelected(selected - 1);
  }

  // You can use your own sound file here (public/click.mp3)
  const playSound = () => {
    const audio = new Audio("/click.mp3");
    audio.volume = 0.2;
    audio.play();
  };

  // Toolbar
  return (
    <ButtonSoundContext.Provider value={playSound}>
      <div
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "BUTTON") playSound();
        }}
      >
        <div className="drawing-app-root">
          <div ref={toolbarRef} className="toolbar">
            <button
              style={{ background: tool === "pencil" ? "#0d6efd" : undefined, display: "flex", alignItems: "center", gap: 4 }}
              onClick={() => setTool("pencil")}
            >
              {/* Pencil emoji icon */}
              <span style={{ fontSize: 18, marginRight: 4 }}>✏️</span>
              Pencil
            </button>
            <button
              style={{ background: tool === "eraser" ? "#0d6efd" : undefined, display: "flex", alignItems: "center", gap: 4 }}
              onClick={() => setTool("eraser")}
            >
              {/* Eraser emoji icon */}
              <span style={{ fontSize: 18, marginRight: 4 }}>🧽</span>
              Eraser
            </button>
            <button
              style={{ background: tool === "select" ? "#0d6efd" : undefined }}
              onClick={() => setTool("select")}
            >
              Select
            </button>
            <button
              style={{ background: tool === "shape" ? "#0d6efd" : undefined }}
              onClick={() => setTool("shape")}
            >
              Shape
            </button>
            <label>
              Color:{" "}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={tool === "eraser"}
              />
            </label>
            <label>
              Size:{" "}
              <input
                type="range"
                min={1}
                max={30}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
            <label>
              Opacity:{" "}
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </label>
            {tool === "shape" && (
              <>
                <select
                  value={shapeType}
                  onChange={(e) => setShapeType(e.target.value as ShapeType)}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                  <option value="triangle">Triangle</option>
                </select>
                <label>
                  W:{" "}
                  <input
                    type="number"
                    min={10}
                    value={shapeW}
                    onChange={(e) => setShapeW(Number(e.target.value))}
                    style={{ width: 50 }}
                  />
                </label>
                <label>
                  H:{" "}
                  <input
                    type="number"
                    min={10}
                    value={shapeH}
                    onChange={(e) => setShapeH(Number(e.target.value))}
                    style={{ width: 50 }}
                  />
                </label>
              </>
            )}
            <button onClick={handleUndo} disabled={history.length === 0}>
              Undo
            </button>
            <button onClick={handleRedo} disabled={redoStack.length === 0}>
              Redo
            </button>
            <button onClick={handleClear}>Clear</button>
            <button onClick={handleExport}>Export PNG</button>
            <button onClick={handleDelete} disabled={selected === null}>
              Delete
            </button>
            <button
              onClick={handleBringForward}
              disabled={selected === null || selected === objects.length - 1}
            >
              Bring Forward
            </button>
            <button
              onClick={handleSendBackward}
              disabled={selected === null || selected === 0}
            >
              Send Backward
            </button>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? "🌙 Night" : "☀️ Day"}
            </button>
          </div>
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              width={typeof window !== "undefined" ? window.innerWidth : 800}
              height={
                typeof window !== "undefined"
                  ? window.innerHeight - (toolbarRef.current?.offsetHeight || 60)
                  : 600
              }
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>
          <style jsx global>{`
            .drawing-app-root {
              height: 100vh;
              background: #222;
              color: #fff;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              grid-template-rows: auto 1fr;
              gap: 0;
            }
            .toolbar {
              grid-column: 1 / span 3;
              background: #333;
              padding: 10px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              align-items: center;
            }
            .canvas-container {
              grid-column: 1 / span 3;
              width: 100%;
              height: 100%;
              background: #111;
            }
            .drawing-canvas {
              display: block;
              background: #fff;
              cursor: crosshair;
              width: 100vw;
              height: 100%;
              touch-action: none;
            }
            @media (max-width: 1099px) {
              .drawing-app-root {
                grid-template-columns: repeat(2, 1fr);
              }
              .toolbar, .canvas-container {
                grid-column: 1 / span 2;
              }
            }
            @media (max-width: 699px) {
              .drawing-app-root {
                grid-template-columns: 1fr;
              }
              .toolbar, .canvas-container {
                grid-column: 1 / span 1;
              }
            }
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
            button[disabled] {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `}</style>
        </div>
      </div>
    </ButtonSoundContext.Provider>
  );
}