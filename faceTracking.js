function processFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
            // Mirror video for better looks
            outputCtx.save();
            outputCtx.scale(-1, 1);
            outputCtx.drawImage(
                video,
                -outputCanvas.width,
                0,
                outputCanvas.width,
                outputCanvas.height
            );
            outputCtx.restore();

            let src = cv.imread(outputCanvas);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            if (classifier && !classifier.empty()) {
                const faces = new cv.RectVector();
                classifier.detectMultiScale(
                    gray,
                    faces,
                    1.1,
                    5,
                    0,
                    new cv.Size(100, 100),
                    new cv.Size(0, 0)
                );

                if (faces.size() > 0) {
                    // Find largest face
                    let largestFace = faces.get(0);
                    let largestArea = largestFace.width * largestFace.height;

                    for (let i = 1; i < faces.size(); i++) {
                        const face = faces.get(i);
                        const area = face.width * face.height;
                        if (area > largestArea) {
                            largestFace = face;
                            largestArea = area;
                        }
                    }

                    // Face center → normalized coordinates (-1 to 1)
                    const centerX = largestFace.x + largestFace.width / 2;
                    const centerY = largestFace.y + largestFace.height / 2;

                    const normalizedX = (centerX / outputCanvas.width) * 2 - 1;
                    const normalizedY = (centerY / outputCanvas.height) * 2 - 1;

                    updateCamera(normalizedX, normalizedY);
                }

                faces.delete();
            }

            cv.imshow(outputCanvas, src);
            src.delete();
            gray.delete();
        } catch (err) {
            console.error('Error in processFrame:', err);
        }

        requestAnimationFrame(processFrame);
    }
}

function updateCamera(normalizedX, normalizedY) {
    if (window.splineApp && window.splineCamera) {
        try {
            const baseRotX = window.cameraBaseRotation?.x ?? window.splineCamera.rotation.x;
            const baseRotY = window.cameraBaseRotation?.y ?? window.splineCamera.rotation.y;

            // Save base rotation once
            if (!window.cameraBaseRotation) {
                window.cameraBaseRotation = {
                    x: window.splineCamera.rotation.x,
                    y: window.splineCamera.rotation.y
                };
            }

            const rotationStrengthX = 0.1 * params.xSensitivity;
            const rotationStrengthY = 0.07 * params.ySensitivity;

            const targetRotY = baseRotY + (-normalizedX * rotationStrengthX); // yaw
            const targetRotX = baseRotX + (-normalizedY * rotationStrengthY); // pitch

            const lerp = params.confidenceThreshold;

            window.splineCamera.rotation.y +=
                (targetRotY - window.splineCamera.rotation.y) * lerp;

            window.splineCamera.rotation.x +=
                (targetRotX - window.splineCamera.rotation.x) * lerp;

            window.splineApp.render();
        } catch (err) {
            console.error('Error updating camera rotation:', err);
        }
    }
}
