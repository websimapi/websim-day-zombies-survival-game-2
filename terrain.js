import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import SimplexNoise from 'https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.js';

export class Terrain {
    constructor(scene, world, size, resolution, maxHeight) {
        this.scene = scene;
        this.world = world;
        this.size = size;
        this.resolution = resolution;
        this.maxHeight = maxHeight;
        this.loaded = false;
        this.readyCallbacks = [];
        
        this.simplex = new SimplexNoise();
        
        // Store terrain data
        this.heightData = [];
        this.waterData = [];
        
        // Create terrain
        this.generate();
    }
    
    generate() {
        // Create geometry
        this.geometry = new THREE.PlaneGeometry(
            this.size, 
            this.size, 
            this.resolution - 1, 
            this.resolution - 1
        );
        this.geometry.rotateX(-Math.PI / 2);
        
        // Generate heightmap
        this.generateHeightmap();
        
        // Apply heights to geometry
        this.applyHeightmap();
        
        // Create terrain mesh
        const textureLoader = new THREE.TextureLoader();
        
        // Load textures
        const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
        const sandTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/sand-big.jpg');
        const rockTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/backgrounddetailed6.jpg');
        const snowTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big-nm.jpg');
        
        // Set texture repeat
        const repeatFactor = this.size / 80;
        [grassTexture, sandTexture, rockTexture, snowTexture].forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatFactor, repeatFactor);
        });
        
        // Custom terrain shader material
        const terrainMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.8,
            metalness: 0.2,
        });
        
        // Create terrain mesh
        this.mesh = new THREE.Mesh(this.geometry, terrainMaterial);
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Create physics body for terrain
        this.createPhysicsBody();
        
        // Mark terrain as loaded
        this.loaded = true;
        this.readyCallbacks.forEach(callback => callback());
    }
    
    generateHeightmap() {
        // Get vertices
        const vertices = this.geometry.attributes.position.array;
        
        // Generate height data
        for (let i = 0; i < this.resolution; i++) {
            this.heightData[i] = [];
            this.waterData[i] = [];
            
            for (let j = 0; j < this.resolution; j++) {
                // Generate height using multiple octaves of noise
                let height = 0;
                let frequency = 1;
                let amplitude = 1;
                const octaves = 6;
                
                for (let o = 0; o < octaves; o++) {
                    const nx = i / this.resolution * frequency;
                    const ny = j / this.resolution * frequency;
                    
                    // Add noise contribution
                    height += this.simplex.noise2D(nx, ny) * amplitude;
                    
                    // Lacunarity - increase frequency with each octave
                    frequency *= 2;
                    // Persistence - decrease amplitude with each octave
                    amplitude *= 0.5;
                }
                
                // Normalize to 0-1 range
                height = (height + 1) / 2;
                
                // Apply height modifications (like making coastlines, mountains)
                const x = (i / this.resolution) * 2 - 1;
                const y = (j / this.resolution) * 2 - 1;
                const distanceFromCenter = Math.sqrt(x*x + y*y);
                
                // Make edges lower (for ocean)
                const edgeFactor = Math.max(0, 1 - distanceFromCenter * 1.1);
                height *= edgeFactor;
                
                // Make some island features
                const islandFactor = Math.pow(height, 1.5);
                height = islandFactor;
                
                // Apply maximum height
                height *= this.maxHeight;
                
                // Store height data for later use
                this.heightData[i][j] = height;
                
                // Store water data (where water should be)
                this.waterData[i][j] = height < 5; // Water level threshold
            }
        }
    }
    
    applyHeightmap() {
        const vertices = this.geometry.attributes.position.array;
        
        // Apply heights to vertices
        for (let i = 0; i < this.resolution; i++) {
            for (let j = 0; j < this.resolution; j++) {
                const index = (i * this.resolution + j) * 3 + 1; // Y component
                vertices[index] = this.heightData[i][j];
            }
        }
        
        // Update geometry
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }
    
    createPhysicsBody() {
        // Create heightfield shape for physics
        const heightfieldData = [];
        for (let i = 0; i < this.resolution; i++) {
            heightfieldData[i] = [];
            for (let j = 0; j < this.resolution; j++) {
                heightfieldData[i][j] = this.heightData[i][j];
            }
        }
        
        const heightfieldShape = new CANNON.Heightfield(heightfieldData, {
            elementSize: this.size / (this.resolution - 1)
        });
        
        // Create body
        this.body = new CANNON.Body({
            mass: 0, // Static body
            shape: heightfieldShape
        });
        
        // Position the body correctly
        this.body.position.set(
            -this.size / 2, 
            0, 
            -this.size / 2
        );
        this.body.quaternion.setFromAxisAngle(
            new CANNON.Vec3(1, 0, 0), 
            -Math.PI / 2
        );
        
        // Add to physics world
        this.world.addBody(this.body);
    }
    
    getHeightAt(x, z) {
        // Convert world coordinates to heightmap indices
        const i = Math.floor((x + this.size / 2) / this.size * (this.resolution - 1));
        const j = Math.floor((z + this.size / 2) / this.size * (this.resolution - 1));
        
        // Check bounds
        if (i < 0 || i >= this.resolution - 1 || j < 0 || j >= this.resolution - 1) {
            return 0;
        }
        
        // Calculate weights for bilinear interpolation
        const xNorm = ((x + this.size / 2) / this.size * (this.resolution - 1)) - i;
        const zNorm = ((z + this.size / 2) / this.size * (this.resolution - 1)) - j;
        
        // Get corner heights
        const h00 = this.heightData[i][j];
        const h10 = this.heightData[i + 1][j];
        const h01 = this.heightData[i][j + 1];
        const h11 = this.heightData[i + 1][j + 1];
        
        // Bilinear interpolation
        const h0 = h00 * (1 - xNorm) + h10 * xNorm;
        const h1 = h01 * (1 - xNorm) + h11 * xNorm;
        
        return h0 * (1 - zNorm) + h1 * zNorm;
    }
    
    isWaterAt(x, z) {
        // Convert world coordinates to heightmap indices
        const i = Math.floor((x + this.size / 2) / this.size * (this.resolution - 1));
        const j = Math.floor((z + this.size / 2) / this.size * (this.resolution - 1));
        
        // Check bounds
        if (i < 0 || i >= this.resolution || j < 0 || j >= this.resolution) {
            return true; // Consider out of bounds as water
        }
        
        return this.waterData[i][j];
    }
    
    getRandomSpawnPosition() {
        // Try to find a suitable spawn location (not in water, not too high)
        let x, z, height;
        let attempts = 0;
        
        do {
            x = (Math.random() - 0.5) * this.size;
            z = (Math.random() - 0.5) * this.size;
            height = this.getHeightAt(x, z);
            attempts++;
        } while ((this.isWaterAt(x, z) || height > 100) && attempts < 1000);
        
        return new THREE.Vector3(x, height + 2, z);
    }
    
    getRandomCityPosition() {
        // Try to find a suitable city location (flat area, not in water)
        let x, z;
        let suitable = false;
        let attempts = 0;
        
        do {
            x = (Math.random() - 0.5) * this.size;
            z = (Math.random() - 0.5) * this.size;
            
            // Check if the area is flat and not in water
            const centerHeight = this.getHeightAt(x, z);
            suitable = !this.isWaterAt(x, z) && centerHeight < 100;
            
            // Check surrounding heights
            if (suitable) {
                const checkRadius = 100;
                const checkPoints = 8;
                
                for (let i = 0; i < checkPoints; i++) {
                    const angle = (i / checkPoints) * Math.PI * 2;
                    const checkX = x + Math.cos(angle) * checkRadius;
                    const checkZ = z + Math.sin(angle) * checkRadius;
                    const checkHeight = this.getHeightAt(checkX, checkZ);
                    
                    // If height difference is too large or is water, location is not suitable
                    if (Math.abs(checkHeight - centerHeight) > 10 || this.isWaterAt(checkX, checkZ)) {
                        suitable = false;
                        break;
                    }
                }
            }
            
            attempts++;
        } while (!suitable && attempts < 1000);
        
        // If couldn't find a perfect spot, just return center
        if (!suitable) {
            return new THREE.Vector3(0, this.getHeightAt(0, 0), 0);
        }
        
        return new THREE.Vector3(x, this.getHeightAt(x, z), z);
    }
    
    onReady(callback) {
        if (this.loaded) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }
}

