import cv2
import numpy as np
from fastapi.testclient import TestClient

import app


def main() -> None:
    client = TestClient(app.app)

    image = np.zeros((120, 120, 3), dtype=np.uint8)
    cv2.putText(image, "8", (20, 95), cv2.FONT_HERSHEY_SIMPLEX, 3.0, (255, 255, 255), 8, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError("Failed to encode test image")

    response = client.post(
        "/predict",
        files={"file": ("digit.png", encoded.tobytes(), "image/png")},
    )
    print("status:", response.status_code)
    print("body:", response.text)


if __name__ == "__main__":
    main()
