export class SoundManager {
    constructor() {
        this.sounds = {};
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        
        // Default volume
        this.setVolume(0.5);
    }
    
    loadSound(name, url, callback) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.sounds[name] = audioBuffer;
                if (callback) callback();
            })
            .catch(error => console.error('Error loading sound:', error));
    }
    
    play(name, options = {}) {
        if (!this.sounds[name]) {
            console.warn(`Sound "${name}" not loaded`);
            return null;
        }
        
        // Create source
        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds[name];
        
        // Create gain node for this sound
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = options.volume !== undefined ? options.volume : 1;
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // Set options
        if (options.loop !== undefined) source.loop = options.loop;
        
        // Play sound
        source.start(0);
        
        return {
            source: source,
            gain: gainNode,
            stop: () => source.stop()
        };
    }
    
    setVolume(volume) {
        this.masterGain.gain.value = volume;
    }
}

