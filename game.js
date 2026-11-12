// ==========================================================
//  GAME MENGUMPULKAN BINTANG - versi lengkap
//  Fitur: nyawa, level, power-up, bom pengejar, platform
//  bergerak, combo, efek visual, suara, pause, double jump
// ==========================================================

// ==========================================================
// KONFIGURASI ASSET
// Isi path file kamu di sini. Kalau dikosongkan (""), game
// otomatis memakai placeholder (bentuk sederhana / tanpa suara)
// ==========================================================
const ASSETS = {
  images: {
    sky: "assets/1.png",
    ground: "https://labs.phaser.io/src/games/firstgame/assets/platform.png",
    star: "https://labs.phaser.io/src/games/firstgame/assets/star.png",
    bomb: "https://labs.phaser.io/src/games/firstgame/assets/bomb.png",
    // --- Power-up (kosong = placeholder lingkaran berwarna) ---
    pu_shield: "", // contoh: "assets/shield.png"
    pu_gold: "", // contoh: "assets/gold_star.png"
    pu_heart: "assets/hearts.png", // contoh: "assets/heart.png"
    pu_slow: "", // contoh: "assets/clock.png"
  },
  spritesheets: {}, // karakter dimuat lewat CHAR_ANIMS di bawah
  audio: {
    // kosong = tidak ada suara (game tetap jalan normal)
    bgm: "", // musik latar, contoh: "assets/audio/bgm.mp3"
    jump: "",
    star: "",
    hit: "",
    powerup: "",
    levelup: "",
    gameover: "",
    click: "",
  },
};

// ==========================================================
// PENGATURAN GAMEPLAY (gampang diutak-atik)
// ==========================================================
// ==========================================================
// KARAKTER: satu file PNG = satu strip animasi (frame 32x32)
// Taruh semua file di folder assets/char/
// ==========================================================
const CHAR = { path: "assets/owlet/", frameW: 32, frameH: 32 };

const CHAR_ANIMS = {
  idle: { file: "idle.png", rate: 6, loop: true },
  walk: { file: "walk.png", rate: 10, loop: true },
  run: { file: "run.png", rate: 12, loop: true },
  jump: { file: "jump.png", rate: 12, loop: false },
  hit: { file: "hit.png", rate: 10, loop: false },
  death: { file: "death.png", rate: 8, loop: false },
};

const SETTINGS = {
  startLives: 3,
  maxLives: 5,
  invincibleMs: 2000, // kebal setelah kena bom
  comboWindowMs: 1500, // jeda maksimal antar bintang agar combo lanjut
  maxCombo: 5,
  powerUpEveryMs: 8000, // power-up baru muncul tiap sekian ms
  powerUpLifetimeMs: 7000, // power-up hilang kalau tidak diambil
  shieldMs: 5000,
  slowMs: 5000,
  slowFactor: 0.3,
  chaserFromLevel: 3, // bom pengejar muncul mulai level ini
};

// ==========================================================
// FUNGSI BANTU
// ==========================================================

// Mainkan suara hanya kalau filenya ada (aman walau asset kosong)
function playSfx(scene, key, config) {
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, config);
  }
}

// Buat texture placeholder kalau gambarnya belum ada
function ensureTexture(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function ensurePlaceholders(scene) {
  const circle = (color, letter) => (g) => {
    g.fillStyle(color, 1);
    g.fillCircle(16, 16, 15);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(16, 16, 15);
  };
  ensureTexture(scene, "pu_shield", 32, 32, circle(0x00ccff));
  ensureTexture(scene, "pu_gold", 32, 32, circle(0xffd700));
  ensureTexture(scene, "pu_heart", 32, 32, circle(0xff3366));
  ensureTexture(scene, "pu_slow", 32, 32, circle(0x9966ff));

  // Placeholder darurat kalau asset utama gagal dimuat
  ensureTexture(scene, "star", 24, 22, (g) => {
    g.fillStyle(0xffff00, 1);
    g.fillCircle(12, 11, 10);
  });
  ensureTexture(scene, "bomb", 14, 14, (g) => {
    g.fillStyle(0x333333, 1);
    g.fillCircle(7, 7, 7);
  });
  ensureTexture(scene, "ground", 400, 32, (g) => {
    g.fillStyle(0x3a8f3a, 1);
    g.fillRect(0, 0, 400, 32);
  });
  ensureTexture(scene, "sky", 800, 600, (g) => {
    g.fillStyle(0x1a1a40, 1);
    g.fillRect(0, 0, 800, 600);
  });
}

// Percikan partikel sederhana (tanpa asset, aman di semua versi Phaser 3)
function burst(scene, x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(2, 4), color);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = Phaser.Math.Between(25, 55);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 400,
      onComplete: () => p.destroy(),
    });
  }
}

// Teks melayang (misal "+20", "LEVEL 2")
function floatText(scene, x, y, msg, color = "#FFF", size = "20px") {
  const t = scene.add
    .text(x, y, msg, { fontSize: size, fill: color, fontStyle: "bold" })
    .setOrigin(0.5);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 900,
    onComplete: () => t.destroy(),
  });
}

function getHighScore() {
  try {
    return parseInt(localStorage.getItem("highscore")) || 0;
  } catch (e) {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    localStorage.setItem("highscore", score);
  } catch (e) {}
}

// ==========================================================
// 1. TITLE SCENE
// ==========================================================
const TitleScene = {
  key: "TitleScene",
  preload: function () {
    // Memuat semua asset dari konfigurasi (yang kosong dilewati)
    for (const [key, path] of Object.entries(ASSETS.images)) {
      if (path) this.load.image(key, path);
    }
    for (const [name, a] of Object.entries(CHAR_ANIMS)) {
      this.load.spritesheet("char_" + name, CHAR.path + a.file, {
        frameWidth: CHAR.frameW,
        frameHeight: CHAR.frameH,
      });
    }
    for (const [key, path] of Object.entries(ASSETS.audio)) {
      if (path) this.load.audio(key, path);
    }
  },
  create: function () {
    ensurePlaceholders(this);

    this.add.image(400, 300, "sky").setDisplaySize(800, 600);

    this.add
      .text(400, 160, "GAME MENGUMPULKAN BINTANG", {
        fontSize: "32px",
        fill: "#FFF",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(400, 230, "High Score: " + getHighScore(), {
        fontSize: "24px",
        fill: "#FFD700",
      })
      .setOrigin(0.5);

    this.add
      .text(
        400,
        320,
        "Panah / Spasi : gerak & lompat (bisa double jump)\nP / ESC : pause\nHindari bom, ambil power-up!",
        { fontSize: "16px", fill: "#CCC", align: "center" },
      )
      .setOrigin(0.5);

    const playBtn = this.add
      .text(400, 430, "[ KLIK UNTUK MAIN ]", {
        fontSize: "28px",
        fill: "#00FF00",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setScale(1.1));
    playBtn.on("pointerout", () => playBtn.setScale(1));
    playBtn.on("pointerdown", () => {
      playSfx(this, "click");
      this.scene.start("GameScene");
    });
  },
};

// ==========================================================
// 2. GAME SCENE
// ==========================================================
const GameScene = {
  key: "GameScene",

  create: function () {
    ensurePlaceholders(this);

    // ---------- STATE (di-reset tiap game baru) ----------
    this.score = 0;
    this.lives = SETTINGS.startLives;
    this.level = 1;
    this.combo = 0;
    this.lastStarTime = 0;
    this.gameOver = false;
    this.paused = false;
    this.invincible = false;
    this.shieldActive = false;
    this.slowFactor = 1;
    this.jumpsLeft = 2;
    this.highScore = getHighScore();

    // ---------- LATAR & PLATFORM ----------
    this.add.image(400, 300, "sky").setDisplaySize(800, 600);

    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(400, 568, "ground").setScale(2).refreshBody();
    this.platforms.create(600, 400, "ground");
    this.platforms.create(50, 250, "ground");
    this.platforms.create(750, 220, "ground");

    // Platform bergerak naik-turun
    this.movers = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    [
      { x: 300, y: 330, minY: 200, maxY: 440 },
      { x: 420, y: 200, minY: 120, maxY: 300 },
    ].forEach((cfg) => {
      const m = this.movers.create(cfg.x, cfg.y, "ground");
      m.setScale(0.35, 1);
      m.setImmovable(true);
      m.body.allowGravity = false;
      m.minY = cfg.minY;
      m.maxY = cfg.maxY;
      m.setVelocityY(60);
    });

    // ---------- PEMAIN ----------
    this.player = this.physics.add.sprite(100, 450, "char_idle");
    this.player.setScale(2); // karakter 32x32 -> tampil 64x64
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    // Kotak tabrakan lebih kecil dari gambar (ukuran sebelum di-scale).
    // Kalau terasa kurang pas, nyalakan debug: true di config lalu atur angkanya.
    this.player.body.setSize(14, 20).setOffset(9, 11);
    this.hurtUntil = 0;

    for (const [name, a] of Object.entries(CHAR_ANIMS)) {
      if (!this.anims.exists(name) && this.textures.exists("char_" + name)) {
        this.anims.create({
          key: name,
          frames: this.anims.generateFrameNumbers("char_" + name),
          frameRate: a.rate,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
    this.player.play("idle");

    // ---------- KONTROL ----------
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keySpace = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.input.keyboard.on("keydown-P", () => this.togglePause());
    this.input.keyboard.on("keydown-ESC", () => this.togglePause());

    // ---------- BINTANG, BOM, POWER-UP ----------
    this.stars = this.physics.add.group({
      key: "star",
      repeat: 11,
      setXY: { x: 12, y: 0, stepX: 70 },
    });
    this.stars.children.iterate((child) => {
      child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    });

    this.bombs = this.physics.add.group();
    this.powerUps = this.physics.add.group();

    // ---------- TABRAKAN ----------
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.movers);
    this.physics.add.collider(this.stars, this.platforms);
    this.physics.add.collider(this.stars, this.movers);
    this.physics.add.collider(this.powerUps, this.platforms);
    this.physics.add.collider(this.powerUps, this.movers);
    this.physics.add.collider(this.bombs, this.platforms);

    this.physics.add.overlap(
      this.player,
      this.stars,
      this.collectStar,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.powerUps,
      this.collectPowerUp,
      null,
      this,
    );
    this.physics.add.collider(
      this.player,
      this.bombs,
      this.hitBomb,
      null,
      this,
    );

    // ---------- HUD ----------
    const style = { fontSize: "24px", fill: "#FFF" };
    this.scoreText = this.add.text(16, 12, "", style).setDepth(10);
    this.highText = this.add
      .text(16, 42, "", { fontSize: "16px", fill: "#FFD700" })
      .setDepth(10);
    this.levelText = this.add
      .text(400, 12, "", style)
      .setOrigin(0.5, 0)
      .setDepth(10);
    this.livesText = this.add
      .text(784, 12, "", { fontSize: "28px", fill: "#FF4466" })
      .setOrigin(1, 0)
      .setDepth(10);
    this.comboText = this.add
      .text(16, 66, "", {
        fontSize: "18px",
        fill: "#00FFAA",
        fontStyle: "bold",
      })
      .setDepth(10);
    this.statusText = this.add
      .text(784, 48, "", { fontSize: "16px", fill: "#00CCFF", align: "right" })
      .setOrigin(1, 0)
      .setDepth(10);
    this.pauseText = this.add
      .text(400, 300, "PAUSE\n(tekan P / ESC untuk lanjut)", {
        fontSize: "36px",
        fill: "#FFF",
        align: "center",
        backgroundColor: "#000000AA",
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.updateHud();

    // ---------- TIMER ----------
    // Power-up muncul berkala
    this.powerUpTimer = this.time.addEvent({
      delay: SETTINGS.powerUpEveryMs,
      loop: true,
      callback: this.spawnPowerUp,
      callbackScope: this,
    });

    // ---------- MUSIK LATAR ----------
    if (this.cache.audio.exists("bgm")) {
      this.bgm = this.sound.add("bgm", { loop: true, volume: 0.4 });
      this.bgm.play();
    }
    this.events.once("shutdown", () => {
      if (this.bgm) this.bgm.stop();
    });

    floatText(this, 400, 300, "LEVEL 1", "#FFFFFF", "40px");
  },

  // ---------------------------------------------------------
  update: function (time) {
    if (this.gameOver || this.paused) return;

    // Gerak kiri-kanan
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Pilih animasi (kecuali saat animasi hit sedang jalan)
    if (time > this.hurtUntil) {
      const onGround = this.player.body.touching.down;
      if (!onGround) this.player.anims.play("jump", true);
      else if (this.player.body.velocity.x !== 0)
        this.player.anims.play("walk", true);
      else this.player.anims.play("idle", true);
    }

    // Lompat + double jump (panah atas atau spasi)
    if (this.player.body.touching.down) this.jumpsLeft = 2;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);
    if (jumpPressed && this.jumpsLeft > 0) {
      const isDouble = this.jumpsLeft === 1;
      this.player.setVelocityY(isDouble ? -300 : -330);
      this.jumpsLeft--;
      playSfx(this, "jump");
      if (isDouble) burst(this, this.player.x, this.player.y + 20, 0xffffff, 5);
    }

    // Platform bergerak: balik arah di batas atas/bawah
    this.movers.children.iterate((m) => {
      if (m.y <= m.minY) m.setVelocityY(60);
      else if (m.y >= m.maxY) m.setVelocityY(-60);
    });

    // Bom pengejar mengikuti pemain pelan-pelan
    this.bombs.children.iterate((b) => {
      if (b && b.active && b.isChaser) {
        this.physics.moveToObject(
          b,
          this.player,
          (50 + this.level * 8) * this.slowFactor,
        );
      }
    });

    // Combo habis kalau terlalu lama tidak ambil bintang
    if (this.combo > 0 && time - this.lastStarTime > SETTINGS.comboWindowMs) {
      this.combo = 0;
      this.updateHud();
    }
  },

  // ---------------------------------------------------------
  // HUD
  // ---------------------------------------------------------
  updateHud: function () {
    this.scoreText.setText("Score: " + this.score);
    this.highText.setText("Best: " + Math.max(this.highScore, this.score));
    this.levelText.setText("Level " + this.level);
    // Ganti dengan ikon gambar kalau sudah punya asset hati
    this.livesText.setText("\u2665".repeat(this.lives));
    this.comboText.setText(
      this.combo >= 2
        ? "COMBO x" + Math.min(this.combo, SETTINGS.maxCombo)
        : "",
    );

    const status = [];
    if (this.shieldActive) status.push("PERISAI");
    if (this.slowFactor < 1) status.push("SLOW-MO");
    this.statusText.setText(status.join("\n"));
  },

  // ---------------------------------------------------------
  // PAUSE
  // ---------------------------------------------------------
  togglePause: function () {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      if (this.bgm) this.bgm.pause();
    } else {
      this.physics.resume();
      this.tweens.resumeAll();
      this.time.paused = false;
      if (this.bgm) this.bgm.resume();
    }
    this.pauseText.setVisible(this.paused);
  },

  // ---------------------------------------------------------
  // BINTANG, COMBO, LEVEL
  // ---------------------------------------------------------
  collectStar: function (player, star) {
    star.disableBody(true, true);

    // Combo
    const now = this.time.now;
    this.combo =
      now - this.lastStarTime <= SETTINGS.comboWindowMs ? this.combo + 1 : 1;
    this.lastStarTime = now;
    const multiplier = Math.min(this.combo, SETTINGS.maxCombo);
    const points = 10 * multiplier;
    this.score += points;

    playSfx(this, "star", { rate: 1 + multiplier * 0.05 });
    burst(this, star.x, star.y, 0xffee55);
    floatText(this, star.x, star.y, "+" + points, "#FFEE55");
    this.updateHud();

    // Semua bintang habis -> naik level
    if (this.stars.countActive(true) === 0) this.nextLevel();
  },

  nextLevel: function () {
    this.level++;
    playSfx(this, "levelup");
    floatText(this, 400, 300, "LEVEL " + this.level, "#FFFFFF", "48px");

    this.stars.children.iterate((child) => {
      child.enableBody(true, child.x, 0, true, true);
    });

    // Bom baru; mulai level tertentu, selang-seling bom pengejar
    const chaser =
      this.level >= SETTINGS.chaserFromLevel && this.level % 2 === 1;
    this.spawnBomb(chaser);
    this.updateHud();
  },

  spawnBomb: function (chaser) {
    const x =
      this.player.x < 400
        ? Phaser.Math.Between(400, 800)
        : Phaser.Math.Between(0, 400);
    const bomb = this.bombs.create(x, 16, "bomb");
    bomb.setBounce(1);
    bomb.setCollideWorldBounds(true);
    bomb.body.allowGravity = false; // perbaikan: harus lewat body
    const speed = 150 + this.level * 15; // makin tinggi level makin cepat
    bomb.setVelocity(Phaser.Math.Between(-speed, speed) * this.slowFactor, 20);
    bomb.isChaser = chaser;
    if (chaser) bomb.setTint(0xaa00ff);
  },

  // ---------------------------------------------------------
  // POWER-UP
  // ---------------------------------------------------------
  spawnPowerUp: function () {
    if (this.gameOver) return;

    const types = ["shield", "gold", "slow"];
    if (this.lives < SETTINGS.maxLives) types.push("heart", "heart"); // lebih sering kalau nyawa kurang
    const type = Phaser.Utils.Array.GetRandom(types);

    const p = this.powerUps.create(
      Phaser.Math.Between(40, 760),
      0,
      "pu_" + type,
    );
    p.powerType = type;
    p.setBounce(0.5);
    p.setCollideWorldBounds(true);

    // Berkedip lalu hilang kalau tidak diambil
    this.time.delayedCall(SETTINGS.powerUpLifetimeMs - 1500, () => {
      if (p.active) {
        this.tweens.add({
          targets: p,
          alpha: 0.2,
          duration: 150,
          yoyo: true,
          repeat: 4,
        });
      }
    });
    this.time.delayedCall(SETTINGS.powerUpLifetimeMs, () => {
      if (p.active) p.destroy();
    });
  },

  collectPowerUp: function (player, p) {
    const type = p.powerType;
    burst(this, p.x, p.y, 0xffffff);
    p.destroy();
    playSfx(this, "powerup");

    if (type === "gold") {
      this.score += 50;
      floatText(this, player.x, player.y - 20, "+50", "#FFD700");
    } else if (type === "heart") {
      if (this.lives < SETTINGS.maxLives) this.lives++;
      floatText(this, player.x, player.y - 20, "+1 NYAWA", "#FF4466");
    } else if (type === "shield") {
      this.activateShield();
    } else if (type === "slow") {
      this.activateSlow();
    }
    this.updateHud();
  },

  activateShield: function () {
    this.shieldActive = true;
    this.player.setTint(0x66ddff);
    floatText(this, this.player.x, this.player.y - 20, "PERISAI!", "#66DDFF");
    if (this.shieldTimer) this.shieldTimer.remove();
    this.shieldTimer = this.time.delayedCall(SETTINGS.shieldMs, () => {
      this.shieldActive = false;
      if (!this.gameOver) this.player.clearTint();
      this.updateHud();
    });
  },

  activateSlow: function () {
    floatText(this, this.player.x, this.player.y - 20, "SLOW-MO!", "#BB99FF");
    if (this.slowFactor === 1) {
      this.slowFactor = SETTINGS.slowFactor;
      this.bombs.children.iterate((b) => {
        if (b && b.body) b.body.velocity.scale(SETTINGS.slowFactor);
      });
    }
    if (this.slowTimer) this.slowTimer.remove();
    this.slowTimer = this.time.delayedCall(SETTINGS.slowMs, () => {
      this.bombs.children.iterate((b) => {
        if (b && b.body) b.body.velocity.scale(1 / SETTINGS.slowFactor);
      });
      this.slowFactor = 1;
      this.updateHud();
    });
  },

  // ---------------------------------------------------------
  // KENA BOM
  // ---------------------------------------------------------
  hitBomb: function (player, bomb) {
    if (this.gameOver) return;

    // Kebal (perisai / baru kena): bom tetap ada, tidak ada efek
    if (this.shieldActive || this.invincible) return;

    bomb.destroy();
    this.lives--;
    this.combo = 0;
    this.player.anims.play("hit", true);
    this.hurtUntil = this.time.now + 400;
    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(150, 255, 0, 0);
    playSfx(this, "hit");
    burst(this, player.x, player.y, 0xff3333, 12);
    this.updateHud();

    if (this.lives <= 0) {
      this.endGame();
      return;
    }

    // Kebal sebentar + berkedip
    this.invincible = true;
    this.tweens.add({
      targets: player,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(SETTINGS.invincibleMs / 200) - 1,
      onComplete: () => {
        player.setAlpha(1);
        this.invincible = false;
      },
    });
  },

  endGame: function () {
    this.gameOver = true;
    this.physics.pause();
    this.player.clearTint();
    this.player.anims.play("death");
    if (this.bgm) this.bgm.stop();
    playSfx(this, "gameover");

    const isNewHigh = this.score > getHighScore();
    if (isNewHigh) saveHighScore(this.score);

    this.time.delayedCall(1500, () => {
      this.scene.start("GameOverScene", {
        score: this.score,
        level: this.level,
        isNewHigh: isNewHigh,
      });
    });
  },
};

// ==========================================================
// 3. GAME OVER SCENE
// ==========================================================
const GameOverScene = {
  key: "GameOverScene",

  init: function (data) {
    this.finalScore = data.score || 0;
    this.finalLevel = data.level || 1;
    this.isNewHigh = !!data.isNewHigh;
  },

  create: function () {
    this.add.image(400, 300, "sky").setDisplaySize(800, 600).setTint(0x555555);

    this.add
      .text(400, 140, "GAME OVER", {
        fontSize: "64px",
        fill: "#FF0000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(400, 225, "Skor Kamu: " + this.finalScore, {
        fontSize: "32px",
        fill: "#FFF",
      })
      .setOrigin(0.5);
    this.add
      .text(400, 270, "Level tercapai: " + this.finalLevel, {
        fontSize: "20px",
        fill: "#CCC",
      })
      .setOrigin(0.5);

    if (this.isNewHigh) {
      const t = this.add
        .text(400, 315, "REKOR BARU!", {
          fontSize: "28px",
          fill: "#FFD700",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: t,
        scale: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.add
        .text(400, 315, "High Score: " + getHighScore(), {
          fontSize: "20px",
          fill: "#FFD700",
        })
        .setOrigin(0.5);
    }

    const restartBtn = this.add
      .text(400, 400, "[ MAIN LAGI ]", { fontSize: "26px", fill: "#00FF00" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on("pointerdown", () => {
      playSfx(this, "click");
      this.scene.start("GameScene");
    });

    const menuBtn = this.add
      .text(400, 460, "[ KEMBALI KE MENU ]", {
        fontSize: "20px",
        fill: "#AAAAAA",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menuBtn.on("pointerdown", () => {
      playSfx(this, "click");
      this.scene.start("TitleScene");
    });
  },
};

// ==========================================================
// KONFIGURASI UTAMA
// ==========================================================
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  render: { pixelArt: true }, // supaya pixel art tetap tajam
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 300 },
      debug: false,
    },
  },
  scene: [TitleScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
