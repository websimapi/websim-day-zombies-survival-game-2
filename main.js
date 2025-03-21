import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { Zombie } from './zombie.js';
import { City } from './city.js';
import { InputManager } from './input.js';
import { SoundManager } from './sound.js';

// Main game class
class Game {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.setupLoadingManager();
        
        // Main three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        // Physics world
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        
        // Game state
        this.isLoaded = false;
        this.isPaused = false;
        this.gameTime = 0;
        this.currentDay = 1;
        this.zombiesKilled = 0;
        this.thirdPersonView = false;
        
        // Game objects
        this.player = null;
        this.terrain = null;
        this.zombies = [];
        this.cities = [];
        
        // Managers
        this.inputManager = new InputManager();
        this.soundManager = new SoundManager();
        
        // Initialize game
        this.init();
    }
    
    setupLoadingManager() {
        this.loadingManager.onProgress = (url, loaded, total) => {
            const progressBar = document.getElementById('progress-bar');
            const loadingText = document.getElementById('loading-text');
            const progress = (loaded / total) * 100;
            progressBar.style.width = progress + '%';
            loadingText.textContent = `Loading: ${Math.round(progress)}%`;
        };
        
        this.loadingManager.onLoad = () => {
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('game-ui').style.display = 'block';
                this.isLoaded = true;
            }, 1000);
        };
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Setup camera
        this.camera.position.set(0, 50, 0);
        
        // Setup lighting
        this.setupLighting();
        
        // Create sky and environment
        this.createEnvironment();
        
        // Generate terrain
        this.terrain = new Terrain(this.scene, this.world, CONFIG.WORLD_SIZE, CONFIG.TERRAIN_DETAIL, CONFIG.TERRAIN_HEIGHT);
        
        // Create player after terrain is generated
        this.terrain.onReady(() => {
            // Create player
            const spawnPosition = this.terrain.getRandomSpawnPosition();
            this.player = new Player(this.scene, this.world, spawnPosition, this.camera, this.loadingManager);
            
            // Generate cities
            this.generateCities();
            
            // Spawn zombies
            this.spawnZombies();
            
            // Initialize input handlers
            this.setupInputHandlers();
            
            // Start game loop
            this.animate();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.position.set(0, 100, 0);
        this.sunLight.castShadow = true;
        
        // Configure shadow properties
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(this.sunLight);
    }
    
    createEnvironment() {
        // Create sky
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);
        
        // Sun parameters
        const sun = new THREE.Vector3();
        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 2;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;
        
        // Create water
        const waterGeometry = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE * 2, CONFIG.WORLD_SIZE * 2);
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function(texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: new THREE.Vector3(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -5;
        this.scene.add(this.water);
        
        // Initial sun position
        this.updateSun(0);
    }
    
    updateSun(time) {
        const theta = Math.PI * (time % CONFIG.DAY_NIGHT_CYCLE) / CONFIG.DAY_NIGHT_CYCLE;
        const phi = 2 * Math.PI * ((time % CONFIG.DAY_NIGHT_CYCLE) / CONFIG.DAY_NIGHT_CYCLE - 0.5);
        
        const sunPosition = new THREE.Vector3();
        sunPosition.x = Math.cos(phi);
        sunPosition.y = Math.sin(phi) * Math.sin(theta);
        sunPosition.z = Math.sin(phi) * Math.cos(theta);
        
        this.sky.material.uniforms['sunPosition'].value.copy(sunPosition);
        this.water.material.uniforms['sunDirection'].value.copy(sunPosition).normalize();
        
        this.sunLight.position.set(
            sunPosition.x * 100,
            sunPosition.y * 100,
            sunPosition.z * 100
        );
        
        // Adjust light intensity based on sun position (day/night cycle)
        const dayIntensity = Math.max(0, Math.sin(phi));
        this.sunLight.intensity = 1 * dayIntensity;
    }
    
    generateCities() {
        for (let i = 0; i < CONFIG.CITIES.COUNT; i++) {
            const position = this.terrain.getRandomCityPosition();
            const size = THREE.MathUtils.randFloat(CONFIG.CITIES.MIN_SIZE, CONFIG.CITIES.MAX_SIZE);
            const city = new City(this.scene, this.world, position, size, this.loadingManager);
            this.cities.push(city);
        }
    }
    
    spawnZombies() {
        for (let i = 0; i < CONFIG.ZOMBIE_COUNT; i++) {
            // Distribute zombies between cities and wilderness
            let position;
            if (Math.random() < 0.7) {
                // 70% chance to spawn in a city
                const cityIndex = Math.floor(Math.random() * this.cities.length);
                position = this.cities[cityIndex].getRandomPosition();
            } else {
                // 30% chance to spawn in wilderness
                position = this.terrain.getRandomSpawnPosition();
            }
            
            const zombie = new Zombie(this.scene, this.world, position, this.player, this.loadingManager);
            this.zombies.push(zombie);
        }
    }
    
    setupInputHandlers() {
        // Toggle camera view
        this.inputManager.registerKeyPress('v', () => {
            this.thirdPersonView = !this.thirdPersonView;
            this.player.setViewMode(this.thirdPersonView);
        });
        
        // Other input handlers are in the Player class
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updateGameState(deltaTime) {
        // Update day/night cycle
        this.gameTime += deltaTime;
        const daysPassed = Math.floor(this.gameTime / CONFIG.DAY_NIGHT_CYCLE);
        if (daysPassed > this.currentDay - 1) {
            this.currentDay = daysPassed + 1;
            document.getElementById('day-counter').textContent = `Day ${this.currentDay}`;
        }
        
        // Update sun position for day/night cycle
        this.updateSun(this.gameTime);
        
        // Update water
        this.water.material.uniforms['time'].value += deltaTime * 0.5;
    }
    
    updateUI() {
        // Update health and stamina bars
        if (this.player) {
            document.getElementById('health-fill').style.width = `${this.player.health}%`;
            document.getElementById('stamina-fill').style.width = `${this.player.stamina}%`;
            
            // Update zombie counter (nearby zombies)
            const nearbyZombies = this.zombies.filter(zombie => 
                zombie.isAlive && zombie.distanceToPlayer < CONFIG.ZOMBIE_DETECTION_RANGE * 2
            ).length;
            document.getElementById('zombie-counter').textContent = `Zombies: ${nearbyZombies}`;
        }
    }
    
    update(deltaTime) {
        if (!this.isLoaded || this.isPaused) return;
        
        // Update physics world
        this.world.step(1/60, deltaTime, 3);
        
        // Update player
        if (this.player) {
            this.player.update(deltaTime);
        }
        
        // Update zombies
        for (let zombie of this.zombies) {
            if (zombie.isAlive) {
                zombie.update(deltaTime);
            }
        }
        
        // Update game state
        this.updateGameState(deltaTime);
        
        // Update UI
        this.updateUI();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = Math.min(0.1, this.clock ? (this.clock.getDelta()) : 0.016);
        if (!this.clock) this.clock = new THREE.Clock();
        
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when page is loaded
window.addEventListener('load', () => {
    const game = new Game();
});

