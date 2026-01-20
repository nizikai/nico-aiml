/// APP CONFIG
const CONFIG = {
    FACE_CASCADE_URL: 'haarcascade_frontalface_default.xml',
    SCENE_URL: 'https://prod.spline.design/yYS1xtlWqP5R7SwT/scene.splinecode',
    CAMERA_ID: '56c30b36-44df-48b7-89f1-27070018dad0'
};

/// CAMERA SETTING
const params = {
    xSensitivity: 5, // How much the camera moves left/right
    ySensitivity: 7, // How much the camera moves up/down
    confidenceThreshold: 0.2 // Smoothing (lower = smoother)
};

/// VAR (empty, later be filled when init)
let video;
let outputCanvas;
let outputCtx;
let classifier;

/// LOAD SPLINE SCENE
async function initSpline() {
    const canvas = document.getElementById('canvas3d');

    window.splineApp = new Application(canvas, {
        controls: false,
        autoRender: true,
        autoResize: true
    });

    await loadSplineScene(CONFIG.SCENE_URL);
}

/// GRAB CAMERA IN NEW SPLINE SCENE
async function loadSplineScene(sceneUrl) {
    try {
        await window.splineApp.load(sceneUrl);

        // First try: known camera ID
        let camera = window.splineApp.findObjectById(CONFIG.CAMERA_ID);

        // Fallback: find any camera in the scene
        if (!camera) {
            const objects = window.splineApp.getAllObjects();
            camera = objects.find(obj => obj.type.includes('Camera'));

            // Store the found ID so future loads are faster
            if (camera) {
                CONFIG.CAMERA_ID = camera.id;
            }
        }

        if (!camera) {
            console.error('No camera found in the Spline scene');
            return;
        }

        window.splineCamera = camera;

        // Save the starting position so camera movement is always relative
        window.cameraBasePosition = {
            x: camera.position.x,
            y: camera.position.y
        };

        // Disable built-in controls (we move the camera manually)
        if (camera.controls) {
            camera.controls.enabled = false;
        }

    } catch (err) {
        console.error('Failed to load Spline scene:', err);
    }
}

///LOAD FACE RECOG
async function loadFaceCascade() {
    classifier = new cv.CascadeClassifier();

    const response = await fetch(CONFIG.FACE_CASCADE_URL);
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Make the file available to OpenCV’s virtual filesystem
    cv.FS_createDataFile(
        '/',
        CONFIG.FACE_CASCADE_URL,
        data,
        true,
        false,
        false
    );

    classifier.load(CONFIG.FACE_CASCADE_URL);
}

async function initializeApp() {
    video = document.getElementById('videoFeed');
    outputCanvas = document.getElementById('outputCanvas');
    outputCtx = outputCanvas.getContext('2d');

    // Wait until OpenCV is fully available
    await new Promise(resolve => {
        const check = () => {
            if (window.cv && cv.CascadeClassifier) resolve();
            else setTimeout(check, 100);
        };
        check();
    });

    // Request webcam access
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
    });

    video.srcObject = stream;
    await video.play();

    // Match canvas size to the video feed
    outputCanvas.width = video.videoWidth;
    outputCanvas.height = video.videoHeight;

    // Load dependencies and start everything
    await loadFaceCascade();
    await initSpline();

    // Start the face tracking loop
    processFrame();
}

/// START APP WHEN OPENCV READY
function onOpenCvReady() {
    initializeApp();
}
