let video = document.querySelector("video");
let currentStream = null;

// Start camera
export async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;

    await video.play();

  } catch (err) {
    console.error("Camera error:", err);
    alert("Please allow camera access to continue.");
  }
}

// Stop camera (optional)
export function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
}
export async function autoStartCamera() {
  try {
    const permission = await navigator.permissions.query({ name: "camera" });

    if (permission.state === "granted") {
      startCamera();
    }
  } catch (e) {
    console.log("Permission check not supported");
  }
}
