const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Image } = require('image-js');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/resultado', express.static(path.join(__dirname, 'public/resultado')));

const upload = multer({ dest: 'uploads/' });

let moldePath = '';
let disenoPath = '';

app.post('/subir-molde', upload.single('molde'), (req, res) => {
  moldePath = req.file.path;
  res.json({ success: true });
});

app.post('/subir-diseno', upload.single('diseno'), (req, res) => {
  disenoPath = req.file.path;
  res.json({ success: true });
});

app.get('/procesar', async (req, res) => {
  try {
    if (!moldePath || !disenoPath) throw new Error('Archivos no seleccionados');

    const image = await Image.load(moldePath);
    const grey = image.grey();
    const threshold = grey.getThreshold();
    const mask = grey.mask({ threshold });

    const roiManager = mask.getRoiManager();
    roiManager.fromMask(mask);
    const whiteRois = roiManager.getRois({ kind: 'white' });
    if (whiteRois.length === 0) throw new Error('No se encontraron ROIs blancos');

    const sortedRois = whiteRois.sort((a, b) => b.surface - a.surface);
    const targetRoi = sortedRois[0];
    const roiMask = targetRoi.mask;

    let paisaje = await Image.load(disenoPath);
    paisaje = paisaje.resize({ width: targetRoi.width, height: targetRoi.height });

    const paisajeRecortado = paisaje.extract(roiMask, { position: [targetRoi.minX, targetRoi.minY] });
    const base = image.rgba8();
    const newImage = base.insert(paisajeRecortado, {
      x: targetRoi.minX,
      y: targetRoi.minY,
    });

    const resultadoDir = path.join(__dirname, 'public/resultado');
    fs.mkdirSync(resultadoDir, { recursive: true });
    
    const resultadoPath = path.join(__dirname, 'public/resultado/resultado.png');
    await newImage.save(resultadoPath);
    res.json({ success: true, path: '/resultado/resultado.png' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
