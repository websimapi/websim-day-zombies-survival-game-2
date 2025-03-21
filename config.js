// Game configuration settings that can be adjusted

export const CONFIG = {
    // World settings
    WORLD_SIZE: 9000, // Size of the world in meters
    TERRAIN_DETAIL: 256, // Resolution of the terrain
    TERRAIN_HEIGHT: 800, // Maximum height of the terrain
    
    // Player settings
    PLAYER_HEIGHT: 1.8, // Player height in meters
    PLAYER_RADIUS: 0.3, // Player collision radius
    PLAYER_MASS: 70, // Player mass in kg
    PLAYER_SPEED: {
        WALK: 5, // Walking speed
        RUN: 10, // Running speed
        CROUCH: 2 // Crouching speed
    },
    PLAYER_JUMP_FORCE: 9, // Jump force
    PLAYER_STAMINA: {
        MAX: 100,
        DRAIN_RATE: 10, // Stamina drain per second when running
        REGEN_RATE: 5   // Stamina regeneration per second when not running
    },
    
    // Camera settings
    CAMERA_FIRST_PERSON: {
        HEIGHT: 1.7, // Camera height in first person
        DISTANCE: 0 // Camera distance in first person
    },
    CAMERA_THIRD_PERSON: {
        HEIGHT: 2, // Camera height in third person
        DISTANCE: 5 // Camera distance in third person
    },
    
    // Zombie settings
    ZOMBIE_COUNT: 500, // Total zombies in the world
    ZOMBIE_SPEED: 3.5, // Zombie movement speed
    ZOMBIE_DETECTION_RANGE: 40, // Range at which zombies detect player
    ZOMBIE_DAMAGE: 10, // Damage per zombie hit
    
    // Game settings
    DAY_NIGHT_CYCLE: 1200, // Duration of a full day-night cycle in seconds
    CITIES: {
        COUNT: 15, // Number of cities to generate
        MIN_SIZE: 200, // Minimum city size
        MAX_SIZE: 800  // Maximum city size
    }
};

