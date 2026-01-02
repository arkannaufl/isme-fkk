export interface WatermarkConfig {
  text: string;
  font: string;
  fontSize: number;
  color: string;
  rotation: number;
  size: number;
}

export const defaultWatermarkConfig: WatermarkConfig = {
  text: "FKK UMJ",
  font: "Times New Roman",
  fontSize: 60,
  color: "rgba(200, 200, 200, 0.3)",
  rotation: -45,
  size: 250
};

export const createWatermark = (config: WatermarkConfig = defaultWatermarkConfig): string => {
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const scale = 3;

  ctx.font = `bold ${config.fontSize}px ${config.font}`;
  const textMetrics = ctx.measureText(config.text);
  const textWidth = textMetrics.width;
  const textHeight = config.fontSize;
  const padding = 40;
  const diagonal = Math.sqrt(textWidth * textWidth + textHeight * textHeight);
  const baseCanvasSize = Math.ceil(diagonal) + padding * 2;

  canvas.width = baseCanvasSize * scale;
  canvas.height = baseCanvasSize * scale;
  ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.scale(scale, scale);

  ctx.fillStyle = config.color;
  ctx.font = `bold ${config.fontSize}px ${config.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.translate(baseCanvasSize / 2, baseCanvasSize / 2);
  ctx.rotate((config.rotation * Math.PI) / 180);

  ctx.fillText(config.text, 0, 0);

  ctx.restore();

  return canvas.toDataURL("image/png");
};

export const addWatermarkToAllPages = (
  doc: any,
  config: WatermarkConfig = defaultWatermarkConfig
): void => {
  const watermarkDataUrl = createWatermark(config);
  
  if (!watermarkDataUrl) return;

  const totalPages = (doc as any).internal.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;

    doc.addImage(
      watermarkDataUrl,
      "PNG",
      centerX - config.size / 2,
      centerY - config.size / 2,
      config.size,
      config.size,
      undefined,
      "SLOW"
    );
  }
};
