// Language: typescript
// Path: react-next\utils\predict.ts
import { getImageTensorFromPath } from "./imageHelper";
import { runSqueezenetModel } from "./modelHelper";
import { runPaddle } from "./paddle.ts";

export async function inferenceSqueezenet(
  path: string
): Promise<[any, number]> {
  // 1. Convert image to tensor
  const imageTensor = await getImageTensorFromPath(path);
  // 2. Run model
  const [predictions, inferenceTime] = await runSqueezenetModel(imageTensor);
  // 3. Return predictions and the amount of time it took to inference.
  return [predictions, inferenceTime];
}

export async function inferencePaddle(path: string): Promise<any> {
  const output = await runPaddle(path);

  let expiry = null,
    cardNumber = null;

  for (const o of output) {
    if (o.indexOf("/") != -1) {
      if (!expiry || expiry < o) {
        expiry = o;
      }
    } else if (o.length > 10) {
      const nums = o.filter((x) => Number.isInteger(parseInt(x)));
      if (nums.length > 10) cardNumber = nums;
    }
  }

  return { expiry, cardNumber };
}
