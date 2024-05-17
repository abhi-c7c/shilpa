let video, canvas;
let detector;
let pose;
let skeleton = [];
let poseLabel = "pose";
let poseScore = "0";
let synth = window.speechSynthesis;
let asanas = [];
let selectedWriteMode;
let selectedSpeakMode;
let lastPoseLabel;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// CHECKING USER-DEFINED MODE THROUGH RADIO BUTTONS SET IN HTML
document.querySelectorAll('input[name="write-mode"]').forEach((elem) => {
  elem.addEventListener("change", function (event) {
    selectedWriteMode = event.target.value;
    document.getElementById("selected-write-mode").innerHTML = "You have selected: " + selectedWriteMode;
  });
});

document.querySelectorAll('input[name="speak-mode"]').forEach((elem) => {
  elem.addEventListener("change", function (event) {
    selectedSpeakMode = event.target.value;
    document.getElementById("selected-speak-mode").innerHTML = "You have selected: " + selectedSpeakMode;
  });
});

async function startMoveNet() {
  const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
  posenetLoaded();
  return setInterval(async () => {
    var pos = await detector.estimatePoses(video.elt);
    gotPoses(pos);
  }, 100);
}

function setup() {
  canvas = createCanvas(640, 480);
  canvas.parent("webcam");
  video = createCapture(VIDEO);

  startMoveNet();

  fetch("asanas.json")
    .then((response) => response.json())
    .then((data) => {
      asanas = data;
    })
    .catch((error) => {
      console.error('Error loading asanas.json:', error);
    });
}

function posenetLoaded() {
  document.getElementById("status-posenet").innerHTML = "✅ MoveNet Loaded";
}

window.onmessage = function (e) {
  let d;
  try {
    d = JSON.parse(e.data);
  } catch (err) {
    return null;
  }

  if (d.action == "loaded") {
    nnLoaded();
  } else if (d.action == "result") {
    _results[d.action_id] = d;
  }
};

function send(obj) {
  document.getElementsByTagName("iframe")[0].contentWindow.postMessage(JSON.stringify(obj), '*');
}

function nnLoaded() {
  document.getElementById("status-nn").innerHTML = "✅ Asana Neural Network Loaded";
  classifyPose();
}

function gotPoses(poses) {
  if (poses.length > 0) {
    pose = poses[0];
  }
}

async function classifyPose() {
  if (pose) {
    var id = Date.now();
    send({
      action: "classify",
      action_id: id,
      data: pose
    });

    var res = await awaitResult(id);
    gotResult(undefined, res.data);
  }

  await sleep(200);
  requestAnimationFrame(classifyPose);
}

var _results = {};
async function awaitResult(id) {
  var done = false;
  while (!done) {
    await sleep(200);
    if (_results[id]) {
      done = true;
      return _results[id];
    }
  }
}

function gotResult(error, results) {
  if (results && results[0].confidence > 0.85) {
    poseLabel = results[0].label;
    poseScore = results[0].confidence.toFixed(2);

    if (lastPoseLabel !== poseLabel) {
      setTimeout(speakInfo, 500);
    }
    lastPoseLabel = results[0].label;
    writePose();
    writeInfo();
  }
}

function getFilteredAsana() {
  return asanas.find((obj) => obj.label === poseLabel);
}

function writePose() {
  const filteredAsana = getFilteredAsana();
  if (!filteredAsana) return;

  if (selectedWriteMode === "write-english-pose") {
    text = filteredAsana["english"];
  } else {
    text = filteredAsana["sanskrit"];
  }
  document.getElementById("pose").innerHTML = text;
  document.getElementById("confidence").innerHTML = poseScore * 100 + " %";
  document.getElementById("emoji").innerHTML = filteredAsana["emoji"];
}

function writeInfo() {
  const filteredAsana = getFilteredAsana();
  if (!filteredAsana) return;

  document.getElementById("benefits-body").innerHTML = filteredAsana["body"];
  document.getElementById("benefits-mind").innerHTML = filteredAsana["mind"];
  document.getElementById("benefits-organs").innerHTML = filteredAsana["organs"];
  document.getElementById("cues").innerHTML = filteredAsana["cues"];
  document.getElementById("followUp").innerHTML = filteredAsana["followUp"];
}

function speakInfo() {
  const filteredAsana = getFilteredAsana();
  if (!filteredAsana) return;

  let utter = new SpeechSynthesisUtterance();
  utter.lang = "en-US";
  utter.rate = 1.0;
  utter.volume = 0.5;

  if (selectedSpeakMode === "speak-sanskrit-pose") {
    utter.text = filteredAsana["sanskrit"];
    utter.rate = 0.8;
    utter.lang = "hi-IN";
  } else if (selectedSpeakMode === "speak-benefits-body") {
    utter.text = filteredAsana["body"];
  } else if (selectedSpeakMode === "speak-benefits-mind") {
    utter.text = filteredAsana["mind"];
  } else if (selectedSpeakMode === "speak-benefits-organs") {
    utter.text = filteredAsana["organs"];
  } else if (selectedSpeakMode === "speak-cues") {
    utter.text = filteredAsana["cues"];
  }

  window.speechSynthesis.speak(utter);
}

function draw() {
  push();
  translate(video.width, 0);
  scale(-1, 1);
  image(video, 0, 0, video.width, video.height);

  if (pose) {
    for (let i = 0; i < skeleton.length; i++) {
      let a = skeleton[i][0];
      let b = skeleton[i][1];
      strokeWeight(2);
      stroke(128, 255, 204);
      line(a.x, a.y, b.x, b.y);
    }

    if (pose.keypoints) {
      for (let i = 0; i < pose.keypoints.length; i++) {
        let x = pose.keypoints[i].x;
        let y = pose.keypoints[i].y;
        fill(128, 255, 204);
        noStroke();
        ellipse(x, y, 16, 16);
      }
    }
  }
}
