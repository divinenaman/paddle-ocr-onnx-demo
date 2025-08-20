// @ts-nocheck

import jimp from "jimp";
import * as ort from "onnxruntime-web";
// import "./opencv.js";

function imageDataToTensor(data, dims) {
  // 1a. Extract the R, G, and B channels from the data to form a 3D int array
  const [R, G, B] = new Array([], [], []);
  for (let i = 0; i < data.length; i += 4) {
    R.push(data[i]);
    G.push(data[i + 1]);
    B.push(data[i + 2]);
    // 2. skip data[i + 3] thus filtering out the alpha channel
  }

  const transposedData = R.concat(G).concat(B);

  // 3. convert to float32
  let i,
    l = transposedData.length; // length, we need this for the loop
  const float32Data = new Float32Array(3 * 640 * 640); // create the Float32Array for output
  for (i = 0; i < l; i++) {
    float32Data[i] = transposedData[i] / 255.0; // convert to float
  }

  const inputTensor = new ort.Tensor("float32", float32Data, dims);
  return inputTensor;
}

async function runModel(model, preprocessedData) {
  const start = new Date();
  try {
    const feeds = {};
    feeds[model.inputNames[0]] = preprocessedData;
    const outputData = await model.run(feeds);
    const end = new Date();
    const inferenceTime = end.getTime() - start.getTime();
    const output = outputData[model.outputNames[0]];
    return [output, inferenceTime];
  } catch (e) {
    console.error(e);
    throw new Error();
  }
}

function getMiniBoxes(contour) {
  const boundingRect = cv.minAreaRect(contour);
  const points = cv.RotatedRect.points(boundingRect).map((p) => [p.x, p.y]);
  // console.log("before", points)
  points.sort((a, b) => a[0] - b[0]);
  // console.log("after", points)

  let [index_1, index_2, index_3, index_4] = [0, 1, 2, 3];

  if (points[1][1] > points[0][1]) {
    index_1 = 0;
    index_4 = 1;
  } else {
    index_1 = 1;
    index_4 = 0;
  }

  if (points[3][1] > points[2][1]) {
    index_2 = 2;
    index_3 = 3;
  } else {
    index_2 = 3;
    index_3 = 2;
  }

  const box = [
    points[index_1],
    points[index_2],
    points[index_3],
    points[index_4],
  ];

  return [
    box,
    [boundingRect.center.x, boundingRect.center.y],
    boundingRect.size,
  ];
}

function expandRect(center, size, points, expandRatio) {
  const newPoints = [];
  const area = size.width * size.height;
  const peri = (size.width + size.height) * 2;
  for (const p of points) {
    const vec_x = p[0] - center[0];
    const vec_y = p[1] - center[1];
    const mag = Math.sqrt(vec_x * vec_x + vec_y * vec_y);

    const x = p[0] + expandRatio * (area / peri) * (vec_x > 0 ? 1 : -1);
    const y = p[1] + expandRatio * (area / peri) * (vec_y > 0 ? 1 : -1);
    newPoints.push([x, y]);
  }
  return newPoints;
}

function getRotateCropImage(img, points) {
  // Helper function to calculate Euclidean distance between two points
  function norm(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Calculate crop dimensions based on the quadrilateral points
  const width1 = norm(points[0], points[1]); // top edge
  const width2 = norm(points[2], points[3]); // bottom edge
  const height1 = norm(points[0], points[3]); // left edge
  const height2 = norm(points[1], points[2]); // right edge

  const imgCropWidth = Math.max(width1, width2);
  const imgCropHeight = Math.max(height1, height2);

  console.log({ imgCropWidth, imgCropHeight, points });

  // Create standard rectangle points (destination)
  const ptsStd = [
    [0, 0],
    [imgCropWidth, 0],
    [imgCropWidth, imgCropHeight],
    [0, imgCropHeight],
  ];

  // Convert points arrays to OpenCV Mat format
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, points.flat());
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, ptsStd.flat());

  // Get perspective transformation matrix
  const M = cv.getPerspectiveTransform(srcPoints, dstPoints);

  // Create output image
  const dstImg = new cv.Mat();
  const dsize = new cv.Size(imgCropWidth, imgCropHeight);

  // Apply perspective transformation
  cv.warpPerspective(
    img,
    dstImg,
    M,
    dsize,
    cv.INTER_CUBIC, // interpolation method
    cv.BORDER_REPLICATE, // border mode
    new cv.Scalar() // border value
  );

  // Check if image needs rotation (height/width ratio >= 1.5)
  const dstImgHeight = dstImg.rows;
  const dstImgWidth = dstImg.cols;

  let finalImg;
  if ((dstImgHeight * 1.0) / dstImgWidth >= 1.5) {
    // Rotate 90 degrees counterclockwise (equivalent to np.rot90)
    finalImg = new cv.Mat();
    cv.rotate(dstImg, finalImg, cv.ROTATE_90_COUNTERCLOCKWISE);

    dstImg.delete();
  } else {
    finalImg = dstImg;
  }

  // Clean up
  srcPoints.delete();
  dstPoints.delete();
  M.delete();

  console.log(img.channels(), finalImg.channels());

  return finalImg;
}

function mkInput(
  inputOffset,
  inputData,
  imgData,
  actualDims,
  inputRatio,
  inputDims
) {
  const [imgC, imgH, imgW] = inputDims;

  let resized_w = actualDims[0];
  if (Math.ceil(imgH * inputRatio) > imgW) resized_w = imgW;
  else resized_w = parseInt(Math.ceil(imgH * inputRatio));

  const dst = new cv.Mat();
  const dsize = new cv.Size(resized_w, imgH);

  cv.resize(imgData, dst, dsize, 0, 0, cv.INTER_LINEAR);

  for (let i = 0; i < imgH; i++) {
    for (let j = 0; j < imgW; j++) {
      if (j < resized_w) {
        const ptr = dst.ucharPtr(i, j);

        inputData[inputOffset + i * resized_w + j] =
          (ptr[0] / 255.0 - 0.5) / 0.5; // R
        inputData[inputOffset + imgH * resized_w + i * resized_w + j] =
          (ptr[1] / 255.0 - 0.5) / 0.5; // G
        inputData[inputOffset + 2 * imgH * resized_w + i * resized_w + j] =
          (ptr[2] / 255.0 - 0.5) / 0.5; // B
      } else {
        inputData[inputOffset + i * resized_w + j] = -1; // R
        inputData[inputOffset + imgH * resized_w + i * resized_w + j] = -1; // G
        inputData[inputOffset + 2 * imgH * resized_w + i * resized_w + j] = -1; // B
      }
    }
  }

  return null;
}

export async function runPaddle(path) {
  try {
    ort.env.wasm.numThreads = 2;
    ort.env.wasm.wasmPaths = "/";

    console.log({ imgPath: path, onnxPath: ort.env });
    var imageData = await jimp
      .read(path)
      .then((image) => {
        return image.resize(640, 640); // resize
        //console.log(imageData.bitmap)
        //.quality(60) // set JPEG quality
        //.greyscale() // set greyscale
        //.write('./data/bird-small-bw.jpg'); // save
      })
      .catch((err) => {
        console.error(err);
      });

    var data = imageDataToTensor(imageData.bitmap.data, [1, 3, 640, 640]);
    let session = await ort.InferenceSession.create(
      "./_next/static/chunks/pages/det_onnx/model.onnx",
      { executionProviders: ["wasm"] }
    );

    let [res, time] = await runModel(session, data);
    var output = res.data;

    let outputVec = cv.matFromArray(640, 640, cv.CV_32FC1, res.data);
    console.log("pred shape:", outputVec.rows, outputVec.cols);

    const thres = 0.3;
    // Binarization
    const segmentation = new cv.Mat();
    cv.threshold(outputVec, segmentation, thres, 1.0, cv.THRESH_BINARY);
    console.log("segmentation shape:", segmentation.rows, segmentation.cols);

    const mask = segmentation.clone();
    const maskUint8 = new cv.Mat();
    mask.convertTo(maskUint8, cv.CV_8U, 255);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      maskUint8,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    console.log("Found", contours.size(), "contours");

    const boxesVec = new cv.MatVector();
    const boxes = [];

    for (let idx = 0; idx < contours.size(); idx++) {
      const contour = contours.get(idx);
      const [points, centre, size] = getMiniBoxes(contour);
      const box = expandRect(centre, size, points, 2.0);
      // const box = points
      console.log({ box, points, contour });

      const boxMat = cv.matFromArray(box.length, 1, cv.CV_32SC2, box.flat());

      boxesVec.push_back(boxMat);
      boxes.push(box);
    }

    let crops = [];
    const rawImage = cv.matFromArray(
      imageData.bitmap.height,
      imageData.bitmap.width,
      cv.CV_8UC4,
      imageData.bitmap.data
    );

    // imshow(`raw_img_0.png`, rawImage)

    for (let count = 0; count < boxes.length; count++) {
      // const rawImage = cv.matFromArray(imageData.bitmap.height, imageData.bitmap.width, cv.CV_8UC4, imageData.bitmap.data);
      let img_crop = getRotateCropImage(rawImage, boxes[count]);

      // const boxesVec1 = new cv.MatVector();
      // const boxMat = cv.matFromArray(boxes[count].length, 1, cv.CV_32SC2, boxes[count].flat());
      // boxesVec1.push_back(boxMat)
      // cv.drawContours(rawImage, boxesVec1, -1, new cv.Scalar(255, 0, 0, 255), 2);

      // imshow(`rec_crop_raw_${count}.png`, rawImage)
      // imshow(`rec_crop_${count}.png`, img_crop)

      crops.push(img_crop);
    }

    const rec_shape_required = [3, 48, 320];
    const max_wh_ratio = 320 / 48;

    const norm_crops = [];
    const singleInputLen = 3 * 48 * 320;
    const inputsData = new Float32Array(boxes.length * singleInputLen);

    for (let idx = 0; idx < crops.length; idx++) {
      const crop = crops[idx];
      mkInput(
        idx * singleInputLen,
        inputsData,
        crops[idx],
        [crop.cols, crop.rows],
        max_wh_ratio,
        rec_shape_required
      );
    }

    const inputTensor = new ort.Tensor("float32", inputsData, [
      boxes.length,
      3,
      48,
      320,
    ]);

    console.log(inputTensor);

    session = await ort.InferenceSession.create(
      "./_next/static/chunks/pages/rec_onnx/model.onnx",
      { executionProviders: ["wasm"] }
    );
    [res, time] = await runModel(session, inputTensor);

    let recOutput = res.data;

    const outputDim = [40, 97];

    // reduce
    const pred = Array.from(recOutput);
    console.log(pred.length);

    const predProbs = [];
    for (let i = 0; i < pred.length; i += outputDim[1]) {
      let mx = -1,
        idx = -1;

      for (let j = 0; j < outputDim[1]; j++) {
        if (pred[j + i] > mx) {
          mx = pred[j + i];
          idx = j;
        }
      }
      predProbs.push([idx, mx]);
    }

    // Method 1: Synchronous reading
    const characterFile = "en_dict.txt";
    let characters = ["blank"];

    try {
      const apiRes = await fetch("/en_dict.txt");
      const data = await apiRes.text();
      
      const lines = data.split("\n");
      for (const line of lines) {
        const cleanLine = line.replace(/\r?\n/g, "").trim();
        // console.log({line, cleanLine})
        characters.push(cleanLine);
      }
    } catch (error) {
      console.error("Error reading file:", error);
    }

    characters.push(" ");

    console.log(characters.length);
    // console.log(predProbs);

    const outputArr = [];
    for (let idx = 0; idx < crops.length; idx++) {
      const arrSlice = predProbs.slice(
        idx * outputDim[0],
        idx * outputDim[0] + outputDim[0]
      );
      const res = arrSlice
        .filter((x) => x[0] != 0)
        .map((x) => characters[x[0]]);

      if (res.length > 0) outputArr.push(res);
      console.log(res);
    }

    return outputArr;
  } catch (e) {
    console.error(e);
  }

  return [];
}
