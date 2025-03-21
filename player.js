import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Player {
    constructor(scene, world, position, camera, loadingManager) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.position = position;
        this.loadingManager = loadingManager;
        
        // Player state
        this.health = 100;
        this.stamina = 100;
        this.isRunning = false;
        this.isCrouching = false;
        this.isJumping = false;
        this.isClimbing = false;
        this.canJump = true;
        this.isThirdPerson = false;
        this.velocity = new THREE.Vector3();
        
        // Movement states
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        
        // Create player
        this.createPhysicsBody();
        this.loadPlayerModel();
        this.setupCamera();
        this.setupInputHandlers();
    }
    
    createPhysicsBody() {
        // Create player body
        const shape = new CANNON.Sphere(CONFIG.PLAYER_RADIUS);
        this.body = new CANNON.Body({
            mass: CONFIG.PLAYER_MASS,
            shape: shape,
            position: new CANNON.Vec3(
                this.position.x,
                this.position.y,
                this.position.z
            ),
            linearDamping: 0.9,
            fixedRotation: true
        });
        
        // Add to physics world
        this.world.addBody(this.body);
        
        // Add contact event listener for jumping
        this.body.addEventListener('collide', (e) => {
            const contactNormal = new CANNON.Vec3();
            const contact = e.contact;
            
            // Check if the contact normal is pointing up (ground contact)
            if (contact.ni.dot(new CANNON.Vec3(0, 1, 0)) > 0.5) {
                this.canJump = true;
                this.isJumping = false;
            }
        });
    }
    
    loadPlayerModel() {
        // Create a temporary visual for the player (will be replaced by loaded model)
        this.playerGroup = new THREE.Group();
        this.scene.add(this.playerGroup);
        
        // Temporary visual
        const geometry = new THREE.CylinderGeometry(CONFIG.PLAYER_RADIUS, CONFIG.PLAYER_RADIUS, CONFIG.PLAYER_HEIGHT, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x0000ff });
        this.tempMesh = new THREE.Mesh(geometry, material);
        this.tempMesh.position.y = CONFIG.PLAYER_HEIGHT / 2;
        this.tempMesh.castShadow = true;
        this.playerGroup.add(this.tempMesh);
        
        // Load actual player model with animations
        const fbxLoader = new FBXLoader(this.loadingManager);
        fbxLoader.load('https://threejs.org/examples/models/fbx/Soldier.fbx', (model) => {
            // Remove temporary mesh
            this.playerGroup.remove(this.tempMesh);
            
            // Configure model
            model.scale.setScalar(0.1);
            model.position.y = -CONFIG.PLAYER_HEIGHT / 2;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            this.playerModel = model;
            this.playerGroup.add(model);
            
            // Load animations
            this.loadAnimations();
        });
    }
    
    loadAnimations() {
        this.mixer = new THREE.AnimationMixer(this.playerModel);
        this.animations = {};
        
        const animationPaths = [
            { name: 'idle', url: 'https://threejs.org/examples/models/fbx/Idle.fbx' },
            { name: 'walk', url: 'https://threejs.org/examples/models/fbx/Walking.fbx' },
            { name: 'run', url: 'https://threejs.org/examples/models/fbx/Running.fbx' },
            { name: 'jump', url: 'https://threejs.org/examples/models/fbx/Jump.fbx' },
            { name: 'crouch', url: 'https://threejs.org/examples/models/fbx/Crouching_Idle.fbx' },
            { name: 'crouchWalk', url: 'https://threejs.org/examples/models/fbx/Crouching_Walk.fbx' }
        ];
        
        let loadedCount = 0;
        const animLoader = new FBXLoader(this.loadingManager);
        
        animationPaths.forEach(anim => {
            animLoader.load(anim.url, (animFBX) => {
                const animation = new THREE.AnimationClip(
                    anim.name,
                    animFBX.animations[0].duration,
                    animFBX.animations[0].tracks
                );
                this.animations[anim.name] = this.mixer.clipAction(animation);
                
                // Set default animation states
                this.animations[anim.name].setEffectiveWeight(1);
                this.animations[anim.name].enabled = true;
                
                if (anim.name === 'idle') {
                    this.animations[anim.name].play();
                    this.currentAnimation = 'idle';
                } else {
                    this.animations[anim.name].stop();
                }
                
                loadedCount++;
                if (loadedCount === animationPaths.length) {
                    this.animationsLoaded = true;
                }
            });
        });
    }
    
    setupCamera() {
        // Set initial camera position
        this.cameraOffset = new THREE.Vector3(0, CONFIG.CAMERA_FIRST_PERSON.HEIGHT, 0);
        this.updateCamera();
    }
    
    setupInputHandlers() {
        // Keyboard handlers
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveForward = true;
                    break;
                    
                case 'KeyS':
                case 'ArrowDown':
                    this.moveBackward = true;
                    break;
                    
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveLeft = true;
                    break;
                    
                case 'KeyD':
                case 'ArrowRight':
                    this.moveRight = true;
                    break;
                    
                case 'Space':
                    this.jump();
                    break;
                    
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isRunning = true;
                    break;
                    
                case 'KeyC':
                    this.toggleCrouch();
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveForward = false;
                    break;
                    
                case 'KeyS':
                case 'ArrowDown':
                    this.moveBackward = false;
                    break;
                    
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveLeft = false;
                    break;
                    
                case 'KeyD':
                case 'ArrowRight':
                    this.moveRight = false;
                    break;
                    
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isRunning = false;
                    break;
            }
        });
        
        // Mouse movement for camera
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                // Update camera rotation based on mouse movement
                const sensitivity = 0.002;
                this.camera.rotation.y -= event.movementX * sensitivity;
                
                // Limit vertical rotation
                this.camera.rotation.x -= event.movementY * sensitivity;
                this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
                
                // Update player rotation to match camera
                this.updatePlayerRotation();
            }
        });
        
        // Pointer lock
        this.renderer = this.scene.renderer;
        document.getElementById('game-container').addEventListener('click', () => {
            document.body.requestPointerLock();
        });
    }
    
    updatePlayerRotation() {
        // Update player group rotation to match camera direction
        if (this.playerGroup) {
            this.playerGroup.rotation.y = this.camera.rotation.y;
        }
    }
    
    jump() {
        if (this.canJump && !this.isJumping && !this.isCrouching) {
            this.isJumping = true;
            this.canJump = false;
            
            // Apply jump force
            this.body.velocity.y = CONFIG.PLAYER_JUMP_FORCE;
            
            // Play jump animation
            if (this.animationsLoaded) {
                this.playAnimation('jump');
            }
        }
    }
    
    toggleCrouch() {
        if (!this.isJumping) {
            this.isCrouching = !this.isCrouching;
            
            if (this.isCrouching) {
                // Adjust player height and camera for crouching
                if (this.animationsLoaded) {
                    this.playAnimation('crouch');
                }
            } else {
                // Reset player height and camera
                if (this.animationsLoaded) {
                    this.playAnimation('idle');
                }
            }
        }
    }
    
    setViewMode(thirdPerson) {
        this.isThirdPerson = thirdPerson;
        
        if (this.isThirdPerson) {
            // Set third-person camera
            this.cameraOffset.set(
                0,
                CONFIG.CAMERA_THIRD_PERSON.HEIGHT,
                CONFIG.CAMERA_THIRD_PERSON.DISTANCE
            );
        } else {
            // Set first-person camera
            this.cameraOffset.set(
                0,
                CONFIG.CAMERA_FIRST_PERSON.HEIGHT,
                CONFIG.CAMERA_FIRST_PERSON.DISTANCE
            );
        }
    }
    
    playAnimation(name) {
        if (!this.animations || !this.animations[name]) return;
        
        // Fade out current animation
        if (this.currentAnimation && this.animations[this.currentAnimation]) {
            this.animations[this.currentAnimation].fadeOut(0.2);
        }
        
        // Fade in new animation
        this.animations[name].reset();
        this.animations[name].fadeIn(0.2);
        this.animations[name].play();
        this.currentAnimation = name;
    }
    
    updateAnimation() {
        if (!this.animationsLoaded) return;
        
        // Determine which animation to play based on movement state
        let nextAnimation = 'idle';
        
        if (this.isJumping) {
            nextAnimation = 'jump';
        } else if (this.isCrouching) {
            nextAnimation = this.isMoving() ? 'crouchWalk' : 'crouch';
        } else if (this.isMoving()) {
            nextAnimation = this.isRunning ? 'run' : 'walk';
        }
        
        // Change animation if needed
        if (nextAnimation !== this.currentAnimation) {
            this.playAnimation(nextAnimation);
        }
    }
    
    isMoving() {
        return this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    }
    
    updateStamina(deltaTime) {
        // Drain stamina while running, regenerate while not running
        if (this.isRunning && this.isMoving()) {
            this.stamina = Math.max(0, this.stamina - CONFIG.PLAYER_STAMINA.DRAIN_RATE * deltaTime);
            
            // If stamina is depleted, stop running
            if (this.stamina <= 0) {
                this.isRunning = false;
            }
        } else {
            this.stamina = Math.min(CONFIG.PLAYER_STAMINA.MAX, this.stamina + CONFIG.PLAYER_STAMINA.REGEN_RATE * deltaTime);
        }
    }
    
    updateMovement(deltaTime) {
        // Get movement input
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (this.moveForward) moveDirection.z = -1;
        if (this.moveBackward) moveDirection.z = 1;
        if (this.moveLeft) moveDirection.x = -1;
        if (this.moveRight) moveDirection.x = 1;
        
        // Normalize movement vector
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }
        
        // Apply camera rotation to movement
        moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.rotation.y);
        
        // Determine speed based on movement state
        let speed;
        if (this.isCrouching) {
            speed = CONFIG.PLAYER_SPEED.CROUCH;
        } else if (this.isRunning && this.stamina > 0) {
            speed = CONFIG.PLAYER_SPEED.RUN;
        } else {
            speed = CONFIG.PLAYER_SPEED.WALK;
        }
        
        // Apply movement force
        this.body.velocity.x = moveDirection.x * speed;
        this.body.velocity.z = moveDirection.z * speed;
    }
    
    updateCamera() {
        // Position offset based on view mode
        const rotatedOffset = this.cameraOffset.clone();
        
        if (this.isThirdPerson) {
            // Rotate offset for third-person view
            rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.rotation.y);
        }
        
        // Update camera position
        this.camera.position.copy(new THREE.Vector3(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        ));
        
        // Apply offset
        this.camera.position.add(rotatedOffset);
    }
    
    updatePlayerPosition() {
        // Update player group position to match physics body
        if (this.playerGroup) {
            this.playerGroup.position.set(
                this.body.position.x,
                this.body.position.y - CONFIG.PLAYER_RADIUS,
                this.body.position.z
            );
        }
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        
        // Check if player died
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        // Handle player death
        console.log("Player died!");
        
        // Respawn after delay
        setTimeout(() => this.respawn(), 3000);
    }
    
    respawn() {
        // Reset player state
        this.health = 100;
        this.stamina = 100;
        
        // Reset position (example: respawn at a random position)
        const respawnPosition = new CANNON.Vec3(0, 50, 0);
        this.body.position.copy(respawnPosition);
        this.body.velocity.set(0, 0, 0);
    }
    
    update(deltaTime) {
        // Update movement
        this.updateMovement(deltaTime);
        
        // Update stamina
        this.updateStamina(deltaTime);
        
        // Update camera position
        this.updateCamera();
        
        // Update player position
        this.updatePlayerPosition();
        
        // Update animations
        this.updateAnimation();
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }
}

