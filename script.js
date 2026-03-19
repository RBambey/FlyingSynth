var camX = 0.0;
var camY = 3.0;
var camZ = 0.0;
var camRoll = 0.0;
var camPitch = 0.0;
var rollIdleTime = 0.0;   // how long roll input has been near zero
var pitchIdleTime = 0.0;  // how long pitch input has been near zero
var autoRollActive   = false;
var autoRollProgress = 0.0;  // 0 to 1 through the roll
var autoRollDir      = 1.0;  // +1 or -1
var autoRollDuration = 0.85; // seconds for a full rotation
var prevBang         = 0.0;

function canyonPath(z) {
    return Math.sin(z * 0.06) * 8.0 + Math.sin(z * 0.11 + 1.2) * 4.0 + Math.sin(z * 0.17 - 0.5) * 2.0;
}

function terrain(x, z) {
    // Mountains (0)
    if (terrain_type < 0.5) {
        var h = 0.0;
        h += Math.sin(x * 0.15 + Math.sin(z * 0.12) * 2.0) * 8.0;
        h += Math.sin(x * 0.31 - z * 0.27) * 5.0;
        h += Math.sin(x * 0.53 + z * 0.41) * 2.5;
        h += Math.sin(x * 1.10 - z * 0.87) * 1.0;
        return h;
    }
    // Flat (1)
    if (terrain_type < 1.5) return 0.0;
    // Canyon (2)
    if (terrain_type < 2.5) {
        var px   = canyonPath(z);
        var dist = Math.abs(x - px);
        return 2.0 + smoothstep(8.0, 24.0, dist) * 26.0;
    }
    // Trench Run (3) — straight trench centered on x=0, Death Star surface outside
    var trenchDist = Math.abs(x);

    // Wall protrusions — blocky sections that narrow the trench every ~8 units along z
    var wCell    = Math.floor(z / 8.0);
    var wHash    = fract(Math.sin(wCell * 311.7) * 43758.5453);
    var wallProtr = Math.floor(wHash * 3.0) * 1.2;
    var effWidth  = 7.0 - wallProtr;
    var inTrench  = 1.0 - smoothstep(effWidth, effWidth + 1.5, trenchDist);

    // Raised floor blocks — varied heights, kept away from trench center
    var fCellX   = Math.floor(x / 4.0);
    var fCellZ   = Math.floor(z / 4.0);
    var fHash    = fract(Math.sin(fCellX * 127.1 + fCellZ * 311.7) * 43758.5453);
    var fHash2   = fract(Math.sin(fCellX * 269.5 + fCellZ * 183.3) * 43758.5453);
    var blockH   = (Math.floor(fHash2 * 5.0) + 1.0) * 0.55;
    var centerFade = smoothstep(2.0, 4.5, trenchDist);
    var floorBlock = (fHash > 0.65 ? blockH : 0.0) * centerFade * inTrench;

    // Outer surface stepped panels
    var pCellX   = Math.floor(x / 6.0);
    var pCellZ   = Math.floor(z / 6.0);
    var pHash    = fract(Math.sin(pCellX * 127.1 + pCellZ * 311.7) * 43758.5453);
    var panel    = Math.floor(pHash * 4.0) * 0.6;

    return inTrench * floorBlock + (1.0 - inTrench) * (14.0 + panel);
}

function fract(x) { return x - Math.floor(x); }

function smoothstep(edge0, edge1, x) {
    var t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
}

function setup() {
    setUniform("cam_x", camX);
    setUniform("cam_y", camY);
    setUniform("cam_z", camZ);
    setUniform("cam_roll_angle", camRoll);
    setUniform("cam_pitch_angle", camPitch);
}

function update(dt) {
    var pitchRate = -pitch_roll.y * Math.PI * 1.5;
    var rollRate  =  pitch_roll.x * Math.PI * 1.5;

    // Track how long pitch input has been idle
    if (Math.abs(pitch_roll.y) < 0.05) {
        pitchIdleTime += dt;
    } else {
        pitchIdleTime = 0.0;
    }

    camPitch += pitchRate * dt;
    camPitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, camPitch));

    // After 1.5 seconds of no pitch input, pull back to level
    if (pitchIdleTime > 1.5) {
        var returnStrength = 0.5;  // radians per second pull strength
        camPitch += (0.0 - camPitch) * returnStrength * dt;
    }

    var yaw      =  0.0;
    var speed    =  fly_speed;

    // Track how long roll input has been idle
    if (Math.abs(pitch_roll.x) < 0.05) {
        rollIdleTime += dt;
    } else {
        rollIdleTime = 0.0;
    }

    // Triggered barrel roll — fires on bang rising edge
    if (barrel_roll > 0.5 && prevBang < 0.5 && !autoRollActive) {
        autoRollActive   = true;
        autoRollProgress = 0.0;
        autoRollDir      = Math.random() > 0.5 ? 1.0 : -1.0;
    }
    prevBang = barrel_roll;

    if (autoRollActive) {
        // Sine easing: slow at start and end, fast in the middle
        // Integrates to exactly 2*PI over the duration
        var angVel = (Math.PI * Math.PI / autoRollDuration) * Math.sin(autoRollProgress * Math.PI);
        camRoll += angVel * autoRollDir * dt;
        autoRollProgress += dt / autoRollDuration;
        if (autoRollProgress >= 1.0) {
            autoRollActive = false;
        }
    }

    // Accumulate roll from input (suppressed during auto-roll)
    if (!autoRollActive) {
        camRoll += rollRate * dt;
    }

    // After 1.5 seconds of no roll input, start pulling back to level
    // Find the nearest level angle (multiple of 2*PI)
    if (!autoRollActive && rollIdleTime > 1.5) {
        var twoPi = Math.PI * 2.0;
        var nearest = Math.round(camRoll / twoPi) * twoPi;
        var returnStrength = .5;
        camRoll += (nearest - camRoll) * returnStrength * dt;
    }

    var cr = Math.cos(camRoll),  sr = Math.sin(camRoll);
    var cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    var cy = Math.cos(yaw),     sy = Math.sin(yaw);

    var fx =  sp * sr;
    var fy =  sp * cr;
    var fz =  cp;

    var fwdX =  fx * cy + fz * sy;
    var fwdY =  fy;
    var fwdZ = -fx * sy + fz * cy;

    camX += fwdX * speed * dt;
    camY += fwdY * speed * dt;
    camZ += fwdZ * speed * dt;

    var groundHeight = terrain(camX, camZ);
    camY = Math.max(groundHeight + 1.0, Math.min(camY, 20.0));

    setUniform("cam_x", camX);
    setUniform("cam_y", camY);
    setUniform("cam_z", camZ);
    setUniform("cam_roll_angle", camRoll);
    setUniform("cam_pitch_angle", camPitch);
}