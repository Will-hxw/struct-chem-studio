// Downsample large screenshots locally before sending them to the tutor.
export async function prepareScreenshot(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("请选择 PNG、JPEG 或 WebP 图片。");
  if (file.size > 20 * 1024 * 1024)
    throw Error("图片超过 20 MB，请先裁剪题目区域。");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw Error("图片读取失败，请重新截图。");
    });
    const scale = Math.min(
      1,
      2400 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (!data.startsWith("data:image/jpeg;base64,") || data.length > 4194327)
      throw Error("图片较大，请裁剪题目区域后再试。");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
