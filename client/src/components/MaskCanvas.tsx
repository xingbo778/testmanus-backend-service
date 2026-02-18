import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Paintbrush, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface MaskCanvasProps {
  imageUrl: string;
  onMaskChange: (maskDataUrl: string | null) => void;
  width?: number;
  height?: number;
}

export default function MaskCanvas({ imageUrl, onMaskChange, width = 512, height = 320 }: MaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      drawImage();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Draw image scaled to fit
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / img.width, height / img.height);
    const x = (width - img.width * scale) / 2;
    const y = (height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  }, [width, height]);

  // Initialize mask canvas
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    maskCanvas.width = width;
    maskCanvas.height = height;
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  }, [width, height]);

  useEffect(() => {
    if (imageLoaded) drawImage();
  }, [imageLoaded, drawImage]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const draw = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = tool === "brush" ? "source-over" : "destination-out";
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    draw(x, y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    draw(x, y);
  };

  const handleEnd = () => {
    setIsDrawing(false);
    exportMask();
  };

  const exportMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!maskCanvas || !img) return;

    // Create a black/white mask at the original image resolution
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.width;
    exportCanvas.height = img.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    // Fill black (keep area)
    exportCtx.fillStyle = "black";
    exportCtx.fillRect(0, 0, img.width, img.height);

    // Read mask canvas data and map to export canvas
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;
    const maskData = maskCtx.getImageData(0, 0, width, height);

    // Scale factor from display to original
    const scale = Math.min(width / img.width, height / img.height);
    const offsetX = (width - img.width * scale) / 2;
    const offsetY = (height - img.height * scale) / 2;

    // Draw white where mask is painted (at original resolution)
    const exportData = exportCtx.getImageData(0, 0, img.width, img.height);
    for (let oy = 0; oy < img.height; oy++) {
      for (let ox = 0; ox < img.width; ox++) {
        // Map original coords to mask canvas coords
        const mx = Math.round(ox * scale + offsetX);
        const my = Math.round(oy * scale + offsetY);
        if (mx >= 0 && mx < width && my >= 0 && my < height) {
          const maskIdx = (my * width + mx) * 4;
          // Check if mask has paint (alpha > 0)
          if (maskData.data[maskIdx + 3] > 10) {
            const exportIdx = (oy * img.width + ox) * 4;
            exportData.data[exportIdx] = 255;     // R
            exportData.data[exportIdx + 1] = 255; // G
            exportData.data[exportIdx + 2] = 255; // B
            exportData.data[exportIdx + 3] = 255; // A
          }
        }
      }
    }
    exportCtx.putImageData(exportData, 0, 0);

    // Check if mask has any white pixels
    let hasWhite = false;
    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i + 3] > 10) {
        hasWhite = true;
        break;
      }
    }

    if (hasWhite) {
      onMaskChange(exportCanvas.toDataURL("image/png"));
    } else {
      onMaskChange(null);
    }
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
    onMaskChange(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tool === "brush" ? "default" : "outline"}
          size="sm"
          onClick={() => setTool("brush")}
        >
          <Paintbrush className="h-3.5 w-3.5 mr-1" />
          画笔
        </Button>
        <Button
          variant={tool === "eraser" ? "default" : "outline"}
          size="sm"
          onClick={() => setTool("eraser")}
        >
          <Eraser className="h-3.5 w-3.5 mr-1" />
          橡皮
        </Button>
        <Button variant="outline" size="sm" onClick={clearMask}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          清除
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">笔刷: {brushSize}px</span>
          <Slider
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            min={5}
            max={80}
            step={5}
            className="w-24"
          />
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-muted/30"
        style={{ width: "100%", maxWidth: width, aspectRatio: `${width}/${height}` }}
      >
        {/* Background image canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
        {/* Mask drawing canvas */}
        <canvas
          ref={maskCanvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            加载图片中...
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        用红色画笔涂抹需要修复的区域。白色区域将被修复，黑色区域保持不变。
      </p>
    </div>
  );
}
