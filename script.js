const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageDisplay = document.getElementById('message');
const restartBtn = document.getElementById('restartBtn');

const WORLD_WIDTH = 3200; 
let cameraX = 0; 
let frameCount = 0;
let deathCount = 0; // デスカウンター（リスタートしてもリセットされません）

let player = {
    x: 30, y: 340, width: 24, height: 24, 
    dx: 0, dy: 0, speed: 4.5, jumpStrength: 9.5, isJumping: false, onGround: false, state: 'normal'
};

const gravity = 0.4;
let gameOver = false;
let gameClear = false;
let gameStarted = false;

let keys = { right: false, left: false, space: false, up: false };

let platforms = [];
let hiddenBlocks = [];
let invisibleFloors = [];
let trampolines = [];
let spikes = [];
let fallingTraps = [];
let movingSpikes = [];
let portals = [];

function initLevel() {
    // 1. 足場（絶対に届く距離に計算し直しました）
    platforms = [
        { x: 0, y: 370, width: 250, height: 30, color: '#444' },     // スタート地点
        { x: 400, y: 370, width: 450, height: 30, color: '#444' },   // 第1の隙間の先
        { x: 950, y: 370, width: 400, height: 30, color: '#444' },   // トランポリンエリア
        { x: 1450, y: 370, width: 350, height: 30, color: '#444' },  // 飛び降りるための崖
        { x: 2000, y: 370, width: 100, height: 30, color: '#444' }   // 偽ゴール用の浮島
    ];

    // 2. 見えないブロック（第1の隙間を確実に越えるための足場）
    hiddenBlocks = [
        { x: 200, y: 280, width: 50, height: 20, visible: false },
    ];

    // 3. 透明な床（崖の下。幅を400pxに拡大し、絶対に飛び乗れるようにしました）
    invisibleFloors = [
        { x: 1750, y: 480, width: 400, height: 20 }
    ];

    // 4. トランポリン
    trampolines = [
        { x: 1100, y: 370, width: 40, height: 30, color: '#00FF00' }
    ];

    // 5. トゲ（トランポリン上の隙間を、プレイヤー幅24pxに対して80px確保）
    spikes = [
        { x: 500, y: 340, width: 30, height: 30, type: 'up' }, // 罠前の牽制
        { x: 1000, y: 120, width: 40, height: 30, type: 'fall' }, 
        { x: 1040, y: 120, width: 40, height: 30, type: 'fall' },
        // --- x: 1080 ~ 1160 は安全地帯（広めに確保！） ---
        { x: 1160, y: 120, width: 40, height: 30, type: 'fall' },
        { x: 1200, y: 120, width: 40, height: 30, type: 'fall' },
    ];

    // 6. 圧殺ブロック（ゆっくり上がり、確実に下を通れるように修正）
    fallingTraps = [
        { x: 700, y: -400, startY: -400, width: 80, height: 400, triggerX: 600, active: false, returning: false, speed: 15, returnSpeed: 2 }
    ];

    // 7. 高速突進トゲ（崖に近づくと偽ゴールの方から飛んでくる）
    movingSpikes = [
        { x: 2100, y: 340, width: 30, height: 30, dx: 0, dy: 0, triggerX: 1700, type: 'dash', speed: -10 }
    ];

    // 8. ポータル
    portals = [
        { x: 2050, y: 320, radius: 40, isFake: true }, // 浮島の偽ゴール
        { x: 1950, y: 440, radius: 40, isFake: false } // 奈落の真のゴール
    ];
}

function initGame() {
    player = { x: 30, y: 340, width: 24, height: 24, dx: 0, dy: 0, speed: 4.5, jumpStrength: 9.5, isJumping: false, onGround: false, state: 'normal' };
    cameraX = 0; frameCount = 0;
    gameOver = false; gameClear = false; gameStarted = false;
    initLevel();
    messageDisplay.style.display = 'block';
    messageDisplay.innerText = "己の指と記憶を信じよ";
    messageDisplay.style.color = '#FF0044';
    restartBtn.style.display = 'none';
}

function update() {
    if (gameOver || gameClear) return;
    frameCount++;

    player.dx = 0;
    if (keys.right) player.dx = player.speed;
    if (keys.left) player.dx = -player.speed;

    if ((keys.space || keys.up) && player.onGround) {
        player.dy = -player.jumpStrength;
        player.isJumping = true;
        player.onGround = false;
        gameStarted = true;
        messageDisplay.style.display = 'none';
    }

    player.dy += gravity;
    player.x += player.dx;
    player.y += player.dy;

    if (player.dy < -2) player.state = 'jumping';
    else if (player.dy > 2) player.state = 'falling';
    else player.state = 'normal';

    cameraX = player.x - 200; 
    if (cameraX < 0) cameraX = 0; 
    if (cameraX > WORLD_WIDTH - canvas.width) cameraX = WORLD_WIDTH - canvas.width; 
    if (player.x < 0) player.x = 0;

    player.onGround = false;
    
    let activePlatforms = platforms
        .concat(hiddenBlocks.filter(b => b.visible))
        .concat(invisibleFloors);
        
    activePlatforms.forEach(p => handlePlatformCollision(player, p));

    trampolines.forEach(t => {
        if (handlePlatformCollision(player, t) && player.dy === 0) {
            player.dy = -15; // 大ジャンプ
            player.isJumping = true;
            player.onGround = false;
        }
    });

    if (gameStarted) {
        // 隠しブロック判定
        hiddenBlocks.forEach(b => {
            if (!b.visible && checkCollision(player, b) && player.dy < 0) {
                b.visible = true;
                player.y = b.y + b.height;
                player.dy = 0;
            }
        });

        // 圧殺ブロック判定（完璧に抜けられる仕様）
        fallingTraps.forEach(t => {
            if (player.x > t.triggerX && !t.active && !t.returning) {
                t.active = true;
            }
            if (t.active) {
                t.y += t.speed;
                if (t.y >= 370 - t.height) { // 地面に激突
                    t.y = 370 - t.height;
                    t.active = false;
                    t.returning = true; 
                }
            } else if (t.returning) {
                t.y -= t.returnSpeed; // ゆっくり上昇
                if (t.y <= t.startY) {
                    t.y = t.startY;
                    t.returning = false; // 元の位置で再セット
                }
            }
            if (checkCollision(player, t)) endGame("GAMEOVER! ぺしゃんこ！");
        });

        // 動くトゲ
        movingSpikes.forEach(s => {
            if (player.x > s.triggerX) s.dx = s.speed;
            s.x += s.dx;
            if (checkCollision(player, s)) endGame("GAMEOVER! 油断大敵！");
        });

        // 固定トゲ
        spikes.forEach(s => { if (checkCollision(player, s)) endGame("GAMEOVER! 串刺し！"); });

        // ゴール判定
        portals.forEach(p => {
            let portalBox = { x: p.x - p.radius + 10, y: p.y - p.radius + 10, width: p.radius*2 - 20, height: p.radius*2 - 20 };
            if (checkCollision(player, portalBox)) {
                if (p.isFake) {
                    endGame("GAMEOVER! そのゴールは幻だ！");
                } else {
                    gameClear = true;
                    messageDisplay.innerText = `YOU ARE A GOD!\n完全制覇！\n犠牲になった回数: ${deathCount}回`;
                    messageDisplay.style.display = 'block';
                    messageDisplay.style.color = '#00FF00';
                    restartBtn.style.display = 'block';
                }
            }
        });
    }

    // 奈落判定
    if (player.y > 550) endGame("GAMEOVER! 奈落の底へ…");
}

function handlePlatformCollision(entity, p) {
    if (checkCollision(entity, p)) {
        if (entity.dy > 0 && entity.y + entity.height - entity.dy <= p.y) {
            entity.y = p.y - entity.height; entity.dy = 0; entity.isJumping = false; entity.onGround = true;
            return true;
        } else if (entity.dy < 0 && entity.y - entity.dy >= p.y + p.height) {
            entity.y = p.y + p.height; entity.dy = 0;
        } else if (entity.dx > 0 && entity.x + entity.width - entity.dx <= p.x) {
            entity.x = p.x - entity.width;
        } else if (entity.dx < 0 && entity.x - entity.dx >= p.x + p.width) {
            entity.x = p.x + p.width;
        }
    }
    return false;
}

function draw() {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    platforms.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraX, p.y, p.width, p.height); });
    
    hiddenBlocks.forEach(b => { 
        if (b.visible) { ctx.fillStyle = '#666'; ctx.fillRect(b.x - cameraX, b.y, b.width, b.height); } 
    });

    trampolines.forEach(t => { 
        ctx.fillStyle = t.color; ctx.fillRect(t.x - cameraX, t.y, t.width, t.height); 
    });

    fallingTraps.forEach(t => { 
        ctx.fillStyle = '#333'; ctx.fillRect(t.x - cameraX, t.y, t.width, t.height); 
        ctx.strokeStyle = '#FF0044'; ctx.strokeRect(t.x - cameraX, t.y, t.width, t.height); 
    });

    ctx.fillStyle = '#FF0044';
    spikes.concat(movingSpikes).forEach(s => {
        ctx.beginPath();
        if (s.type === 'fall') { 
            ctx.moveTo(s.x - cameraX, s.y); ctx.lineTo(s.x - cameraX + s.width, s.y); ctx.lineTo(s.x - cameraX + s.width/2, s.y + s.height);
        } else { 
            ctx.moveTo(s.x - cameraX + s.width/2, s.y); ctx.lineTo(s.x - cameraX, s.y + s.height); ctx.lineTo(s.x - cameraX + s.width, s.y + s.height);
        }
        ctx.fill();
    });
    
    portals.forEach(p => {
        let pulse = Math.sin(frameCount * 0.1) * 5;
        ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.isFake ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 255, 0.4)'; 
        ctx.fill();
        ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = p.isFake ? '#FF0000' : '#00FFFF'; 
        ctx.fill();
    });

    // プレイヤー描画
    ctx.fillStyle = gameOver ? '#555' : '#00FFFF';
    ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);
    ctx.fillStyle = 'black';
    ctx.font = "bold 12px monospace";
    let face = gameOver ? "x_x" : (player.state === 'jumping' ? ">_<" : (player.state === 'falling' ? "^_^" : "o_o"));
    ctx.fillText(face, player.x - cameraX + 1, player.y + 16);

    // デスカウンター描画（画面左上）
    ctx.fillStyle = '#FFF';
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("DEATHS: " + deathCount, 20, 30);
}

function checkCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function endGame(msg) {
    if(gameOver) return;
    gameOver = true; 
    player.state = 'dead';
    deathCount++; // 死亡時にカウントアップ
    messageDisplay.innerText = msg;
    messageDisplay.style.display = 'block';
    messageDisplay.style.color = '#FF0044';
    restartBtn.style.display = 'block';
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => {
    if (gameOver) return;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === ' ' || e.key === 'ArrowUp') { keys.space = true; keys.up = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => {
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === ' ' || e.key === 'ArrowUp') { keys.space = false; keys.up = false; }
});

restartBtn.addEventListener('click', initGame);
initGame();
gameLoop();