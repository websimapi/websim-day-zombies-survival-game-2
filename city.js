import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class City {
    constructor(scene, world, position, size, loadingManager) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.size = size;
        this.loadingManager = loadingManager;
        
        // City components
        this.buildings = [];
        this.roads = [];
        this.props = [];
        
        // Generate city
        this.generate();
    }
    
    generate() {
        // Create city container
        this.cityGroup = new THREE.Group();
        this.cityGroup.position.copy(this.position);
        this.scene.add(this.cityGroup);
        
        // Generate city layout on a grid system
        this.generateLayout();
        
        // Create buildings and roads
        this.generateBuildings();
        this.generateRoads();
        this.generateProps();
    }
    
    generateLayout() {
        // Create a grid for the city layout
        const gridSize = Math.floor(this.size / 50); // Each grid cell is 50 units
        
        this.grid = [];
        for (let i = 0; i < gridSize; i++) {
            this.grid[i] = [];
            for (let j = 0; j < gridSize; j++) {
                // 0 = empty, 1 = road, 2 = building
                this.grid[i][j] = 0;
            }
        }
        
        // Create a road network
        this.generateRoadNetwork(gridSize);
        
        // Fill remaining space with buildings
        this.assignBuildingPlots(gridSize);
    }
    
    generateRoadNetwork(gridSize) {
        // Create main roads
        const mainRoadInterval = 3; // Every 3 grid cells
        
        // Horizontal main roads
        for (let i = 0; i < gridSize; i += mainRoadInterval) {
            for (let j = 0; j < gridSize; j++) {
                this.grid[i][j] = 1; // Road
            }
        }
        
        // Vertical main roads
        for (let j = 0; j < gridSize; j += mainRoadInterval) {
            for (let i = 0; i < gridSize; i++) {
                this.grid[i][j] = 1; // Road
            }
        }
        
        // Add some smaller roads
        const smallRoadChance = 0.2;
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (this.grid[i][j] === 0 && Math.random() < smallRoadChance) {
                    // Create a small road
                    const horizontal = Math.random() < 0.5;
                    
                    if (horizontal) {
                        for (let jj = 0; jj < gridSize; jj++) {
                            if (Math.random() < 0.8) { // 80% chance to continue the road
                                this.grid[i][jj] = 1;
                            }
                        }
                    } else {
                        for (let ii = 0; ii < gridSize; ii++) {
                            if (Math.random() < 0.8) { // 80% chance to continue the road
                                this.grid[ii][j] = 1;
                            }
                        }
                    }
                }
            }
        }
    }
    
    assignBuildingPlots(gridSize) {
        const buildingChance = 0.7; // 70% chance for a building in non-road cells
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (this.grid[i][j] === 0 && Math.random() < buildingChance) {
                    this.grid[i][j] = 2; // Building
                }
            }
        }
    }
    
    generateBuildings() {
        const gridSize = this.grid.length;
        const cellSize = 50;
        
        // Create buildings based on grid
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (this.grid[i][j] === 2) { // Building
                    // Calculate position
                    const x = (i - gridSize / 2) * cellSize;
                    const z = (j - gridSize / 2) * cellSize;
                    
                    // Create building
                    this.createBuilding(x, z, cellSize);
                }
            }
        }
    }
    
    createBuilding(x, z, cellSize) {
        // Building size
        const width = cellSize * 0.8;
        const depth = cellSize * 0.8;
        const height = 10 + Math.random() * 50; // Random height
        
        // Building geometry
        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // Building material
        const windowIntensity = Math.random() * 0.5 + 0.2;
        const hasLights = Math.random() < 0.3; // 30% chance for lit windows
        const buildingColor = new THREE.Color(
            0.5 + Math.random() * 0.2,
            0.5 + Math.random() * 0.2,
            0.5 + Math.random() * 0.2
        );
        
        // Create materials for different sides
        const materials = [
            new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.7 }), // Right
            new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.7 }), // Left
            new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.9 }), // Top
            new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.9 }), // Bottom
            new THREE.MeshStandardMaterial({ // Front - windows
                color: buildingColor,
                roughness: 0.7,
                emissive: hasLights ? new THREE.Color(1, 1, 0.8) : new THREE.Color(0, 0, 0),
                emissiveIntensity: hasLights ? windowIntensity : 0
            }),
            new THREE.MeshStandardMaterial({ // Back - windows
                color: buildingColor,
                roughness: 0.7,
                emissive: hasLights ? new THREE.Color(1, 1, 0.8) : new THREE.Color(0, 0, 0),
                emissiveIntensity: hasLights ? windowIntensity : 0
            })
        ];
        
        // Create mesh
        const building = new THREE.Mesh(geometry, materials);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        
        // Add to city group
        this.cityGroup.add(building);
        this.buildings.push(building);
        
        // Create physics body for the building
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: 0, // Static body
            position: new CANNON.Vec3(
                this.position.x + x,
                height / 2,
                this.position.z + z
            ),
            shape: shape
        });
        
        // Add to physics world
        this.world.addBody(body);
    }
    
    generateRoads() {
        const gridSize = this.grid.length;
        const cellSize = 50;
        
        // Create road geometry
        const roadGeometry = new THREE.PlaneGeometry(cellSize, cellSize);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9
        });
        
        // Create roads based on grid
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (this.grid[i][j] === 1) { // Road
                    // Calculate position
                    const x = (i - gridSize / 2) * cellSize;
                    const z = (j - gridSize / 2) * cellSize;
                    
                    // Create road
                    const road = new THREE.Mesh(roadGeometry, roadMaterial);
                    road.rotation.x = -Math.PI / 2;
                    road.position.set(x, 0.1, z); // Slightly above ground
                    road.receiveShadow = true;
                    
                    // Add to city group
                    this.cityGroup.add(road);
                    this.roads.push(road);
                }
            }
        }
    }
    
    generateProps() {
        const gridSize = this.grid.length;
        const cellSize = 50;
        
        // Create props (streetlights, trashcans, etc.)
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (this.grid[i][j] === 1) { // Road
                    // Calculate position
                    const x = (i - gridSize / 2) * cellSize;
                    const z = (j - gridSize / 2) * cellSize;
                    
                    // 10% chance to add a streetlight
                    if (Math.random() < 0.1) {
                        this.createStreetlight(x, z);
                    }
                }
            }
        }
    }
    
    createStreetlight(x, z) {
        // Create streetlight post
        const postGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5, 8);
        const postMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9
        });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x + 10, 2.5, z + 10); // Position at edge of road
        post.castShadow = true;
        
        // Create streetlight head
        const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 1);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 2.5, 0.5);
        post.add(head);
        
        // Create light
        const light = new THREE.PointLight(0xffffaa, 1, 20);
        light.position.set(0, 2.5, 0.5);
        post.add(light);
        
        // Add to city group
        this.cityGroup.add(post);
        this.props.push(post);
    }
    
    getRandomPosition() {
        // Return a random position within the city
        const gridSize = this.grid.length;
        const cellSize = 50;
        
        // Try to find a road cell
        let attempts = 0;
        let i, j, x, z;
        
        do {
            i = Math.floor(Math.random() * gridSize);
            j = Math.floor(Math.random() * gridSize);
            
            x = (i - gridSize / 2) * cellSize;
            z = (j - gridSize / 2) * cellSize;
            
            attempts++;
        } while (this.grid[i][j] !== 1 && attempts < 100);
        
        // If couldn't find a road, just return any position
        if (attempts >= 100) {
            x = (Math.random() - 0.5) * this.size;
            z = (Math.random() - 0.5) * this.size;
        }
        
        return new THREE.Vector3(
            this.position.x + x,
            this.position.y + 1,
            this.position.z + z
        );
    }
}