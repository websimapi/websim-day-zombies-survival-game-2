export class InputManager {
    constructor() {
        this.keys = {};
        this.callbackMap = {};
        
        // Setup event listeners
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
    }
    
    onKeyDown(event) {
        this.keys[event.code] = true;
        
        // Check for key press callbacks
        if (this.callbackMap[event.key]) {
            this.callbackMap[event.key]();
        }
    }
    
    onKeyUp(event) {
        this.keys[event.code] = false;
    }
    
    isKeyDown(code) {
        return this.keys[code] === true;
    }
    
    registerKeyPress(key, callback) {
        this.callbackMap[key] = callback;
    }
}

