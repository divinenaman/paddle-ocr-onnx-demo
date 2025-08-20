import { useRef, useState } from "react";
import { IMAGE_URLS } from "../data/sample-image-urls";
import { inferenceSqueezenet, inferencePaddle } from "../utils/predict";
import styles from "../styles/Home.module.css";

interface Props {
  height: number;
  width: number;
}

const ImageCanvas = (props: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  var image: HTMLImageElement;
  const [topResultLabel, setLabel] = useState("");
  const [topResultConfidence, setConfidence] = useState("");
  const [inferenceTime, setInferenceTime] = useState("");

  // Load the image from the IMAGE_URLS array
  const getImage = () => {
    var sampleImageUrls: Array<{ text: string; value: string }> = IMAGE_URLS;
    var random = Math.floor(Math.random() * (9 - 0 + 1) + 0);
    return sampleImageUrls[random];
  };

  // Draw image and other  UI elements then run inference
  const displayImageAndRunInference = () => {
    if (document.getElementById("uploaded-image").src == "about:blank") {
      setLabel(`Please Upload Image!`);
      return;
    }
    // Get the image
    image = new Image();
    var sampleImage = document.getElementById("uploaded-image").src; //getImage();
    image.src = sampleImage;

    // Clear out previous values.
    setLabel(`Inferencing...`);
    setConfidence("");
    setInferenceTime("");

    // Draw the image on the canvas
    const canvas = canvasRef.current;
    const ctx = canvas!.getContext("2d");
    image.onload = () => {
      ctx!.drawImage(image, 0, 0, props.width, props.height);
    };

    // Run the inference
    submitInference();
  };

  const submitInference = async () => {
    // Get the image data from the canvas and submit inference.
    // var [inferenceResult,inferenceTime] = await inferenceSqueezenet(image.src);

    var resp = await inferencePaddle(image.src);

    // Get the highest confidence.
    // var topResult = inferenceResult[0];

    // Update the label and confidence
    setLabel(`Expiry -> ${resp?.expiry} & Card Number - ${resp.cardNumber}`);
    // setConfidence(topResult.probability);
    // setInferenceTime(`Inference speed: ${inferenceTime} seconds`);
  };

  function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      // No file selected, exit the function.
      return;
    }

    // Create a new FileReader instance.
    const reader = new FileReader();

    // Define what happens when the file has been read.
    reader.onload = function (e) {
      // The result is the data URI (base64 string).
      const imageDataUri = e.target.result;

      // Log the data URI to the console.
      console.log(imageDataUri);

      // Optionally, display the image in the img tag.
      const uploadedImage = document.getElementById("uploaded-image");
      uploadedImage.src = imageDataUri;
      uploadedImage.style.display = "block";
    };

    // Read the file as a data URL.
    reader.readAsDataURL(file);
  }

  return (
    <>
      <label htmlFor="image-upload">Upload an image</label>
      <input
        type="file"
        id="image-upload"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <img
        id="uploaded-image"
        src="about:blank"
        width={500}
        alt="Uploaded Image Preview"
      ></img>
      <button className={styles.grid} onClick={displayImageAndRunInference}>
        Run Paddle OCR
      </button>
      <br />
      <canvas ref={canvasRef} width={props.width} height={props.height} />
      <span>
        {topResultLabel} {topResultConfidence}
      </span>
      <span>{inferenceTime}</span>
    </>
  );
};

export default ImageCanvas;
