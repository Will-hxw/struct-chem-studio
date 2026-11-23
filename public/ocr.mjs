export async function recognize(image, onProgress) {
  const { default: Tesseract } = await import(
    "/vendor/ocr/tesseract.esm.min.js"
  );
  const root = location.origin + "/vendor/ocr/";
  const worker = await Tesseract.createWorker("chi_sim+eng", 1, {
    workerPath: root + "worker.min.js",
    langPath: root,
    corePath: root + "tesseract-core-lstm.wasm.js",
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text")
        onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text
      .trim()
      .replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, "$1");
  } finally {
    await worker.terminate();
  }
}
