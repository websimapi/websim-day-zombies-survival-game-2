import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CONFIG } from './config.js';

export class Zombie {
    constructor(scene, world, position, player, loadingManager) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.player = player;
        this.loadingManager = loadingManager;
        
        // Zombie state
        this.health = 100;
        this.isAlive = true;
        this.isAttacking = false;
        this.lastAttackTime = 0;
        this.attackCooldown = 1.5; // seconds
        this.distanceToPlayer = Infinity;
        this.detectionState = 'idle'; // 'idle', 'alert', 'chase'
        
        // Create zombie
        this.createPhysicsBody();
        this.loadZombieModel();
    }
    
    createPhysicsBody() {
        // Create zombie body
        const shape = new CANNON.Sphere(0.3);
        this.body = new CANNON.Body({
            mass: 70,
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
    }
    
    loadZombieModel() {
        // Create a temporary visual for the zombie
        this.zombieGroup = new THREE.Group();
        this.scene.add(this.zombieGroup);
        
        // Temporary visual
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        this.tempMesh = new THREE.Mesh(geometry, material);
        this.tempMesh.position.y = 0.9;
        this.tempMesh.castShadow = true;
        this.zombieGroup.add(this.tempMesh);
        
        // Load actual zombie model with animations
        const fbxLoader = new FBXLoader(this.loadingManager);
        fbxLoader.load('https://threejs.org/examples/models/fbx/Soldier.fbx', (model) => {
            // Remove temporary mesh
            this.zombieGroup.remove(this.tempMesh);
            
            // Configure model
            model.scale.setScalar(0.1);
            model.position.y = -0.9;
            
            // Apply zombie-like material adjustments
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Apply zombie textures/colors
                    if (child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x558855,
                            roughness: 0.8,
                            metalness: 0.2
                        });
                    }
                }
            });
            
            this.zombieModel = model;
            this.zombieGroup.add(model);
            
            // Load animations
            this.loadAnimations();
        });
    }
    
    loadAnimations() {
        this.mixer = new THREE.AnimationMixer(this.zombieModel);
        this.animations = {};
        
        const animationPaths = [
            { name: 'idle', url: 'https://threejs.org/examples/models/fbx/Idle.fbx' },
            { name: 'walk', url: 'https://threejs.org/examples/models/fbx/Walking.fbx' },
            { name: 'run', url: 'https://threejs.org/examples/models/fbx/Running.fbx' },
            { name: 'attack', url: 'https://threejs.org/examples/models/fbx/Punching.fbx' },
            { name: 'death', url: 'https://threejs.org/examples/models/fbx/Dying.fbx' }
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
                
                // For zombie animation, we'll distort the timing to make it more "zombie-like"
                if (anim.name === 'walk' || anim.name === 'run') {
                    this.animations[anim.name].timeScale = 0.7;
                }
                
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
        
        // Determine which animation to play based on zombie state
        let nextAnimation = 'idle';
        
        if (!this.isAlive) {
            nextAnimation = 'death';
        } else if (this.isAttacking) {
            nextAnimation = 'attack';
        } else if (this.detectionState === 'chase') {
            nextAnimation = 'run';
        } else if (this.detectionState === 'alert') {
            nextAnimation = 'walk';
        }
        
        // Change animation if needed
        if (nextAnimation !== this.currentAnimation) {
            this.playAnimation(nextAnimation);
        }
    }
    
    updateDetectionState() {
        if (!this.player) return;
        
        // Calculate distance to player
        const playerPos = this.player.body.position;
        const zombiePos = this.body.position;
        
        this.distanceToPlayer = Math.sqrt(
            Math.pow(playerPos.x - zombiePos.x, 2) +
            Math.pow(playerPos.z - zombiePos.z, 2)
        );
        
        // Update detection state based on distance
        if (this.distanceToPlayer < CONFIG.ZOMBIE_DETECTION_RANGE / 2) {
            this.detectionState = 'chase';
        } else if (this.distanceToPlayer < CONFIG.ZOMBIE_DETECTION_RANGE) {
            this.detectionState = 'alert';
        } else {
            this.detectionState = 'idle';
        }
    }
    
    moveTowardsPlayer(deltaTime) {
        if (!this.player || !this.isAlive) return;
        
        // Get direction to player
        const directionToPlayer = new THREE.Vector3(
            this.player.body.position.x - this.body.position.x,
            0,
            this.player.body.position.z - this.body.position.z
        );
        
        if (directionToPlayer.length() > 0.1) {
            directionToPlayer.normalize();
            
            // Update rotation to face player
            this.zombieGroup.lookAt(
                this.player.body.position.x,
                this.zombieGroup.position.y,
                this.player.body.position.z
            );
            
            // Move towards player based on detection state
            let speed = 0;
            
            if (this.detectionState === 'chase') {
                speed = CONFIG.ZOMBIE_SPEED;
            } else if (this.detectionState === 'alert') {
                speed = CONFIG.ZOMBIE_SPEED * 0.5;
            }
            
            // Apply movement
            this.body.velocity.x = directionToPlayer.x * speed;
            this.body.velocity.z = directionToPlayer.z * speed;
        }
    }
    
    attackPlayer(deltaTime) {
        if (!this.player || !this.isAlive) return;
        
        // Check if close enough to attack
        if (this.distanceToPlayer < 1.5) {
            const currentTime = performance.now() / 1000;
            
            // Check attack cooldown
            if (currentTime - this.lastAttackTime > this.attackCooldown) {
                this.isAttacking = true;
                this.lastAttackTime = currentTime;
                
                // Deal damage to player
                this.player.takeDamage(CONFIG.ZOMBIE_DAMAGE);
                
                // Reset attack state after animation
                setTimeout(() => {
                    this.isAttacking = false;
                }, 1000);
            }
        } else {
            this.isAttacking = false;
        }
    }
    
    takeDamage(amount) {
        if (!this.isAlive) return;
        
        this.health -= amount;
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isAlive = false;
        this.body.mass = 0; // Make the body static
        
        // Play death animation
        if (this.animationsLoaded) {
            this.playAnimation('death');
            
            // Remove zombie after animation completes
            setTimeout(() => {
                this.scene.remove(this.zombieGroup);
                this.world.removeBody(this.body);
            }, 3000);
        } else {
            // If animations not loaded, just remove zombie
            this.scene.remove(this.zombieGroup);
            this.world.removeBody(this.body);
        }
    }
    
    updateZombiePosition() {
        // Update zombie group position to match physics body
        if (this.zombieGroup) {
            this.zombieGroup.position.set(
                this.body.position.x,
                this.body.position.y - 0.3,
                this.body.position.z
            );
        }
    }
    
    update(deltaTime) {
        if (!this.isAlive) {
            // Only update animation for dead zombies
            if (this.mixer) {
                this.mixer.update(deltaTime);
            }
            return;
        }
        
        // Update detection state
        this.updateDetectionState();
        
        // Move towards player if detected
        if (this.detectionState !== 'idle') {
            this.moveTowardsPlayer(deltaTime);
        }
        
        // Attack player if close enough
        this.attackPlayer(deltaTime);
        
        // Update zombie position
        this.updateZombiePosition();
        
        // Update animations
        this.updateAnimation();
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }
}

