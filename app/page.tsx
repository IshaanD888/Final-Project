"use client";
import { useRef, useState, useEffect } from "react";

export default function DrawingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvas = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pencil" | "eraser" | "select">("pencil");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null);

  // Always get the latest context
  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && selectionCanvas.current) {
        const canvas = canvasRef.current;
        const imageData = canvas.toDataURL();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 100;
        selectionCanvas.current.width = canvas.width;
        selectionCanvas.current.height = canvas.height;
        const context = getCtx();
        if (context) {
          context.lineCap = "round";
          const img = new window.Image();
          img.onload = () => context.drawImage(img, 0, 0);
          img.src = imageData;
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    const { offsetX: x, offsetY: y } = e.nativeEvent;
    if (tool === "select") {
      setSelectStart({ x, y });
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const ctx = getCtx();
    const { offsetX: x, offsetY: y } = e.nativeEvent;
    if (tool === "select" && selectStart && selectionCanvas.current) {
      const selCtx = selectionCanvas.current.getContext("2d");
      if (selCtx) {
        selCtx.clearRect(0, 0, selectionCanvas.current.width, selectionCanvas.current.height);
        selCtx.strokeStyle = "red";
        selCtx.lineWidth = 1;
        selCtx.setLineDash([6]);
        const w = x - selectStart.x;
        const h = y - selectStart.y;
        selCtx.strokeRect(selectStart.x, selectStart.y, w, h);
      }
    }
    if (!isDrawing || !ctx || tool === "select") return;
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? 20 : lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    const ctx = getCtx();
    if (!ctx) return;
    if (tool === "select") {
      setSelectStart(null);
    } else {
      ctx.closePath();
      setIsDrawing(false);
      saveHistory();
    }
  };

  const saveHistory = () => {
    if (!canvasRef.current) return;
    const snapshot = canvasRef.current.toDataURL();
    setHistory((prev) => [...prev, snapshot]);
  };

  const undo = () => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current || history.length < 2) return;
    const image = new window.Image();
    image.src = history[history.length - 2];
    image.onload = () => {
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.drawImage(image, 0, 0);
      setHistory((prev) => prev.slice(0, -1));
    };
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="toolbar p-4 flex gap-2 bg-gray-200 dark:bg-gray-800">
        <button
          onClick={() => setTool("pencil")}
          className={tool === "pencil" ? "active" : ""}
        >
          Pencil
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={tool === "eraser" ? "active" : ""}
        >
          Eraser
        </button>
        <button
          onClick={() => setTool("select")}
          className={tool === "select" ? "active" : ""}
        >
          Select
        </button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <input
          type="range"
          min={1}
          max={30}
          value={lineWidth}
          onChange={(e) => setLineWidth(parseInt(e.target.value))}
        />
        <button onClick={undo}>Undo</button>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
          Night Mode
        </label>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute left-0 top-0 w-full h-full z-0 bg-white dark:bg-black"
        ></canvas>
        <canvas
          ref={selectionCanvas}
          className="absolute left-0 top-0 w-full h-full z-10 pointer-events-none"
        ></canvas>
      </div>
    </div>
  );
}