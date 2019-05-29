const LAYOUTS = {
    "AZERTY": {
        chars: ("1234567890AZERTYUIOPQSDFGHJKLMWXCVBN,;:!").split(""),
        keymap: [
            49, 50, 51, 52, 53, 54,  55, 56, 57,  48,
            65, 90, 69, 82, 84, 89,  85, 73, 79,  80,
            81, 83, 68, 70, 71, 72,  74, 75, 76,  77,
            87, 88, 67, 86, 66, 78, 188, 59, 58, 161
        ]
    }
};

// Yeah that's the only available one for now
const ACTIVE_LAYOUT = LAYOUTS["AZERTY"];

const DEFAULT_COLOR = [189.0, 195.0, 199.0];

const SEQUENCER_TRACK_COUNT = 8;
const SEQUENCER_BEAT_COUNT = 16;
const SEQUENCER_RESOLUTION = 16;

let audioContext;

class PadKey {
    constructor(i, audioContext, destNode) {
        const that = this;

        this.audioContext = audioContext;
        this.destNode = destNode;

        let keyNumber = document.createElement("span");
        keyNumber.setAttribute("class", "keyNumber");
        keyNumber.innerHTML = ACTIVE_LAYOUT.chars[i];

        this.element = document.createElement("div");
        this.element.classList.add("key");

        this.element.addEventListener("dragover", (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }, false);

        this.element.addEventListener("drop", (e) => {
            e.stopPropagation();
            e.preventDefault();

            let soundFile = e.dataTransfer.files[0];

            let reader = new FileReader();

            reader.addEventListener("loadend", (e) => {
                if(e.target.result && !e.target.error) {
                    that.audioContext.decodeAudioData(e.target.result, function(buffer) {
                        that.soundBuffer = buffer;
                    });
                }
            });

            reader.readAsArrayBuffer(soundFile);
        }, false);

        this.element.addEventListener("mousedown", (e) => {
            e.preventDefault();

            that.playSound(0);

            let r = Math.random() * 255.0;
            let g = Math.random() * 255.0;
            let b = Math.random() * 255.0;

            r = Math.floor(r);
            g = Math.floor(g);
            b = Math.floor(b);

            that.setColor(r, g, b);
            setTimeout(() => {
                that.resetColor();
            }, 100);
        });

        this.element.appendChild(keyNumber);

        this.resetColor();
    }

    playSound(time) {
        const that = this;

        let bufferSource = this.audioContext.createBufferSource();
        bufferSource.buffer = this.soundBuffer;
        bufferSource.connect(this.destNode);
        bufferSource.start(time);

        bufferSource.addEventListener("ended", () => {
            bufferSource.disconnect(that.destNode);
        });
    }

    setColor(r, g, b) {
        this.color = [r, g, b];

        this.refresh();
    }

    resetColor() {
        this.setColor(DEFAULT_COLOR[0], DEFAULT_COLOR[1], DEFAULT_COLOR[2]);
    }

    refresh() {
        let r = this.color[0];
        let g = this.color[1];
        let b = this.color[2];
        let color = `rgb(${r}, ${g}, ${b})`;

        let grayscale = (r + g + b) / 3.0;
        let lighting = -(grayscale / 255.0 - 1.0) * this.lightPower;

        this.element.style.backgroundColor = color;
        this.element.style.boxShadow = `0px 0px ${lighting}px ${color}`;
    }
}

class CircleSlider {
    constructor(id, label, min, max, v, onvaluechanged) {
        const that = this;

        this.id = id;
        this.label = label;
        this.min = min;
        this.max = max;
        this.currentValue = v;
        this.onvaluechanged = onvaluechanged;

        this.element = document.createElement("div");
        this.element.classList.add("setting");

        this.controlDiv = document.createElement("div");
        this.controlDiv.classList.add("circleSlider");
        this.controlDiv.setAttribute("id", this.id);
        this.element.appendChild(this.controlDiv);

        this.labelEl = document.createElement("label");
        this.labelEl.setAttribute("for", this.id);
        this.labelEl.innerHTML = this.label;
        this.element.appendChild(this.labelEl);

        this.valueDiv = document.createElement("div");
        this.valueDiv.classList.add("value");
        this.valueDiv.innerHTML = this.currentValue;
        this.controlDiv.appendChild(this.valueDiv);

        this.controllersDiv = document.createElement("div");
        this.controllersDiv.classList.add("controllers");

        this.plus = document.createElement("div");
        this.plus.classList.add("plus");
        this.plus.innerHTML = "+";

        this.minus = document.createElement("div");
        this.minus.classList.add("minus");
        this.minus.innerHTML = "-";

        this.controllersDiv.appendChild(this.plus);
        this.controllersDiv.appendChild(this.minus);

        this.controlDiv.appendChild(this.controllersDiv);

        let wheelListener = (e) => {
            e.preventDefault();

            let side = 0;

            if('wheelDelta' in e) {
                // No firefox
                if(e.wheelDelta < 0) {
                    side = 1;
                } else if(e.wheelDelta > 0) {
                    side = -1;
                }
            } else {
                // Firefox
                if(e.detail < 0) {
                    side = 1;
                } else if(e.detail > 0) {
                    side = -1;
                }
            }

            that.moveValue(side);
        };

        this.controlDiv.addEventListener("onmousewheel", wheelListener);
        this.controlDiv.addEventListener("DOMMouseScroll", wheelListener);

        this.plus.addEventListener("mousedown", (e) => {
            e.preventDefault();

            that.moveValue(+1);
        });

        this.minus.addEventListener("mousedown", (e) => {
            e.preventDefault();

            that.moveValue(-1);
        });
    }

    refreshDisplay() {
        this.valueDiv.innerHTML = this.currentValue;
    }

    setValue(x) {
        if(this.min != null && x < this.min) {
            return;
        }

        if(this.max != null && x > this.max) {
            return;
        }

        this.currentValue = x;

        if(this.onvaluechanged != null) {
            this.onvaluechanged(this.currentValue);
        }

        this.refreshDisplay();
    }

    moveValue(x) {
        this.setValue(this.currentValue + x);
    }

    setRange(min, max) {
        this.min = min;
        this.max = max;
    }
}

class Sequencer {
    constructor(tempo, resolution, beatCount, onbeat) {
        this.tempo = tempo;
        this.resolution = resolution;
        this.beatCount = beatCount;
        this.onbeat = onbeat;

        this.currentTick = 0;

        this.beat = -1;
    }

    main() {
        this.currentTick = (this.currentTick + 1) % (this.resolution * this.beatCount);

        let beat = Math.floor(this.currentTick / (this.resolution));

        if(this.beat != beat) {
            this.beat = beat;
            this.onbeat(beat);
        }

        const that = this;
        setTimeout(() => that.main(), 60000 / (this.tempo * this.resolution));
    }
}

class TrackButton {
    constructor() {
        this.element = document.createElement("div");

        // this.element.addEventListener("mousedown", (e) => {

        // });
    }
}

window.addEventListener("load", () => {
    let settings = [];
    let bindings = [];
    let keyState = [];
    let padkeys = [];

    let sequencerBars = [];
    let sequencer = new Sequencer(140, SEQUENCER_RESOLUTION, SEQUENCER_BEAT_COUNT, beat => {
        for (var i = sequencerBars.length - 1; i >= 0; i--) {
            let el = sequencerBars[i]
            el.classList.toggle("on", i == beat);
        }
    });
    let currentTick = 0;

    let masterGain;

    window.addEventListener("keydown", (event) => {
        if(keyState[event.keyCode]) {
            return;
        }

        keyState[event.keyCode] = true;

        let currentPadKey = padkeys[bindings[event.keyCode]];

        if(!currentPadKey) {
            return;
        }

        event.preventDefault();

        let r = Math.random() * 255.0;
        let g = Math.random() * 255.0;
        let b = Math.random() * 255.0;

        r = Math.floor(r);
        g = Math.floor(g);
        b = Math.floor(b);

        currentPadKey.setColor(r, g, b); // Set a random color

        currentPadKey.playSound(0);
    });

    window.addEventListener("keyup", (event) => {
        let currentPadKey = padkeys[bindings[event.keyCode]];

        if(!currentPadKey) {
            return;
        }

        keyState[event.keyCode] = false;

        currentPadKey.resetColor();
    });

    // -- MAIN --

    // Init audio context
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
        alert("Your browser doesn't seems to support the Audio API needed by Koapad!\nTry updating it, or use a different web browser.");
        return;
    }

    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);

    // Init settings UI
    {
        let settingsDiv = document.getElementById("settings");

        settings["lightPower"] = new CircleSlider("lightPower", "Light Power", 0, 100, 8, v => {
            for (let i = padkeys.length - 1; i >= 0; i--) {
                padkeys[i].lightPower = v
                padkeys[i].refresh();
            }
        });

        settings["volume"] = new CircleSlider("volume", "Volume", 0, 100, 80, v => {
            masterGain.gain.value = v * v / 10000;
        });

        settings["tempo"] = new CircleSlider("tempo", "Tempo", 10, 512, sequencer.tempo, v => {
            sequencer.tempo = v;
        });

        for(let x in settings) {
            settingsDiv.appendChild(settings[x].element)
        }
    }

    // Init sequencer UI
    {
        // Tracks
        let sequencerTracks = document.getElementById("sequencerTracks");

        for(let i = 0; i < SEQUENCER_TRACK_COUNT; i++) {
            let trackButton = new TrackButton();

            sequencerTracks.appendChild(trackButton.element);
        }

        // Beats
        let sequencerBeatsEl = document.getElementById("sequencerBeats");

        for (var i = 0; i < SEQUENCER_BEAT_COUNT; i++) {
            let beat = document.createElement("li");
            sequencerBeatsEl.appendChild(beat);

            sequencerBars.push(beat);
        }
    }

    // Init Keys
    {
        let keypad = document.getElementById("keypad");

        for(let j = 0; j < 4; j++) {
            let row = document.createElement("div");
            row.classList.add("row");

            for(let i = 0; i < 10; i++) {
                let padkey = new PadKey(j * 10 + i, audioContext, masterGain);
                padkeys.push(padkey);
                row.appendChild(padkey.element);
            }

            keypad.appendChild(row);
        }

        for(let i = 0; i < ACTIVE_LAYOUT.keymap.length; i++) {
            bindings[ACTIVE_LAYOUT.keymap[i]] = i;
        }
    }

    sequencer.main();
});
