// Language: typescript
// Path: react-next\utils\predict.ts
import { getImageTensorFromPath } from "./imageHelper";
import { runSqueezenetModel } from "./modelHelper";
import { runPaddle } from "./paddle";

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
    const numsOnly = o.filter((x) => Number.isInteger(parseInt(x)) || x == "/");
    const slashIdx = numsOnly.indexOf("/");

    if (
      slashIdx != -1 &&
      slashIdx == 2 &&
      numsOnly.length - slashIdx - 1 == 2
    ) {
      if (!expiry || expiry < o.join("")) {
        expiry = o.join("");
      }
    } else if (numsOnly.length > 10) {
      cardNumber = numsOnly.filter((x) => x != "/").join("");
    }
  }

  return { expiry, cardNumber };
}
