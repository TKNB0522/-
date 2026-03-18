const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageDisplay = document.getElementById('message');
const restartBtn = document.getElementById('restartBtn');

const WORLD_WIDTH = 3200; 
let cameraX = 0; 
let frameCount = 0;
let deathCount = 0; 

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
let fragileFloors = []; 
let trampolines = [];
let spikes = [];
let fallingTraps = [];
let movingSpikes = [];
let portals = [];

function initLevel() {
    // 1. 足場（トランポリン後の足場を x:1250 から x:1180 に寄せて確実に届くように修正）
    platforms = [
        { x: 0, y: 370, width: 200, height: 30, color: '#444' },     
        { x: 420, y: 370, width: 380, height: 30, color: '#444' },   
        { x: 950, y: 370, width: 100, height: 30, color: '#444' },   
        { x: 1180, y: 370, width: 220, height: 30, color: '#444' },  // ←修正箇所
        { x: 1600, y: 370, width: 120, height: 30, color: '#444' },  
        { x: 2000, y: 370, width: 100, height: 30, color: '#444' }   
    ];

    // 2. 崩れる床
    fragileFloors = [
        { x: 1400, y: 370, width: 200, height: 30, color: '#444', falling: false }
    ];

    // 3. 見えないブロック（2段構え）
    hiddenBlocks = [
        { x: 220, y: 280, width: 30, height: 20, visible: false },
        { x: 330, y: 190, width: 30, height: 20, visible: false }, 
    ];

    // 4. 透明な床（真のゴール用）
    invisibleFloors = [
        { x: 1680, y: 500, width: 80, height: 20 }
    ];

    // 5. トランポリン
    trampolines = [
        { x: 1050, y: 370, width: 40, height: 30, color: '#00FF00' }
    ];

    // 6. トゲ（トランポリン右側の天井トゲを大幅に短縮し、確実に越えられるように修正）
    spikes = [
        { x: 450, y: 340, width: 30, height: 30, type: 'up' }, 
        { x: 650, y: 340, width: 30, height: 30, type: 'up' }, 
        { x: 920, y: 120, width: 130, height: 30, type: 'fall' }, 
        // --- x: 1050 ~ 1090 の 40px がトランポリンの抜け穴 ---
        { x: 1090, y: 120, width: 40, height: 30, type: 'fall' }, // ←修正箇所
        // 崖っぷちの牽制
        { x: 1720, y: 340, width: 20, height: 30, type: 'up' }
    ];

    // 7. 圧殺ブロック（2連撃）
    fallingTraps = [
        { x: 500, y: -400, startY: -400, width: 60, height: 400, triggerX: 420, active: false, returning: false, speed: 20, returnSpeed: 1.5 },
        { x: 700, y: -400, startY: -400, width: 100, height: 400, triggerX: 580, active: false, returning: false, speed: 28, returnSpeed: 0.8 } 
    ];

    // 8. 高速突進トゲ
    movingSpikes = [
        { x: 2100, y: 340, width: 30, height: 30, dx: 0, dy: 0, triggerX: 1450, type: 'dash', speed: -12 },
        { x: 1250, y: 340, width: 30, height: 30, dx: 0, dy: 0, triggerX: 1600, type: 'dash', speed: 14 } 
    ];

    // 9. ポータル
    portals = [
        { x: 2050, y: 320, radius: 40, isFake: true }, 
        { x: 1720, y: 460, radius: 20, isFake: false }
    ];
}

function initGame() {
    player = { x: 30, y: 340, width: 24, height: 24, dx: 0, dy: 0, speed: 4.5, jumpStrength: 9.5, isJumping: false, onGround: false, state: 'normal' };
    cameraX = 0; frameCount = 0;
    gameOver = false; gameClear = false; gameStarted = false;
    initLevel();
    messageDisplay.style.display = 'block';
    messageDisplay.innerText = "【完全修正版】\n今度こそ道は開かれている";
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
    
    // 足場判定
    let activePlatforms = platforms
        .concat(hiddenBlocks.filter(b => b.visible))
        .concat(invisibleFloors);
        
    activePlatforms.forEach(p => handlePlatformCollision(player, p));

    // 崩れる床判定
    fragileFloors.forEach(f => {
        handlePlatformCollision(player, f);
        if (!f.falling && player.y + player.height <= f.y + 2 && player.y + player.height >= f.y - 2 && player.x + player.width > f.x && player.x < f.x + f.width) {
            f.falling = true;
        }
        if (f.falling) f.y += 8; 
    });

    // トランポリン判定
    trampolines.forEach(t => {
        if (handlePlatformCollision(player, t) && player.dy === 0) {
            player.dy = -15; 
            player.isJumping = true;
            player.onGround = false;
        }
    });

    if (gameStarted) {
        hiddenBlocks.forEach(b => {
            if (!b.visible && checkCollision(player, b) && player.dy < 0) {
                b.visible = true;
                player.y = b.y + b.height;
                player.dy = 0;
            }
        });

        fallingTraps.forEach(t => {
            if (player.x > t.triggerX && !t.active && !t.returning) t.active = true;
            if (t.active) {
                t.y += t.speed;
                if (t.y >= 370 - t.height) { 
                    t.y = 370 - t.height; t.active = false; t.returning = true; 
                }
            } else if (t.returning) {
                t.y -= t.returnSpeed; 
                if (t.y <= t.startY) { t.y = t.startY; t.returning = false; }
            }
            if (checkCollision(player, t)) endGame("GAMEOVER! ぺしゃんこ！");
        });

        movingSpikes.forEach(s => {
            if (player.x > s.triggerX) s.dx = s.speed;
            s.x += s.dx;
            if (checkCollision(player, s)) endGame("GAMEOVER! 挟み撃ち！");
        });

        spikes.forEach(s => { if (checkCollision(player, s)) endGame("GAMEOVER! 串刺し！"); });

        portals.forEach(p => {
            let portalBox = { x: p.x - p.radius + 5, y: p.y - p.radius + 5, width: p.radius*2 - 10, height: p.radius*2 - 10 };
            if (checkCollision(player, portalBox)) {
                if (p.isFake) {
                    endGame("GAMEOVER! 騙されたな！");
                } else {
                    gameClear = true;
                    messageDisplay.innerText = `YOU ARE A GOD!\n神々の領域へようこそ！\n犠牲になった回数: ${deathCount}回`;
                    messageDisplay.style.display = 'block';
                    messageDisplay.style.color = '#00FF00';
                    restartBtn.style.display = 'block';
                }
            }
        });
    }

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
    fragileFloors.forEach(f => { ctx.fillStyle = f.color; ctx.fillRect(f.x - cameraX, f.y, f.width, f.height); });

    hiddenBlocks.forEach(b => { 
        if (b.visible) { ctx.fillStyle = '#666'; ctx.fillRect(b.x - cameraX, b.y, b.width, b.height); } 
    });

    trampolines.forEach(t => { ctx.fillStyle = t.color; ctx.fillRect(t.x - cameraX, t.y, t.width, t.height); });

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
        let pulse = Math.sin(frameCount * 0.1) * (p.isFake ? 5 : 2);
        ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.isFake ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 255, 0.4)'; 
        ctx.fill();
        ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = p.isFake ? '#FF0000' : '#00FFFF'; 
        ctx.fill();
    });

    ctx.fillStyle = gameOver ? '#555' : '#00FFFF';
    ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);
    ctx.fillStyle = 'black';
    ctx.font = "bold 12px monospace";
    let face = gameOver ? "x_x" : (player.state === 'jumping' ? ">_<" : (player.state === 'falling' ? "^_^" : "o_o"));
    ctx.fillText(face, player.x - cameraX + 1, player.y + 16);

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
    deathCount++; 
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
