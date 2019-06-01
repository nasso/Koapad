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

const DEFAULT_COLOR = [189, 195, 199];
const PRESSED_COLOR = [80, 255, 125];

const SEQUENCER_TRACK_COUNT = 8;
const SEQUENCER_BEAT_COUNT = 16;

let audioContext;

function preventDefault(e) {
    e.preventDefault();
    return false;
}

class PadKey {
    constructor(i, audioContext, destNode) {
        const that = this;

        this.callbacks = [];
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

        this.element.addEventListener("contextmenu", preventDefault);
        this.element.addEventListener("touchmove", preventDefault);

        this.element.addEventListener("mousedown", (e) => {
            e.preventDefault();

            that.pressFor(100);
        });

        this.element.addEventListener("touchstart", (e) => {
            e.preventDefault();

            that.press();
        });

        this.element.addEventListener("touchend", (e) => {
            e.preventDefault();

            that.unpress();
        });

        this.element.appendChild(keyNumber);

        this.resetColor();
    }

    addPressCallback(callback) {
        this.callbacks.push(callback);
    }

    removePressCallback(callback) {
        let index = this.callbacks.indexOf(callback);

        if(index >= 0) {
            this.callbacks.splice(index, 1);
        }
    }

    press() {
        this.playSound(0);

        this.setColor(PRESSED_COLOR[0], PRESSED_COLOR[1], PRESSED_COLOR[2]);

        const that = this;
        for(let i = this.callbacks.length - 1; i >= 0; i--) {
            this.callbacks[i](that, true);
        }
    }

    unpress() {
        this.resetColor();

        const that = this;
        for(let i = this.callbacks.length - 1; i >= 0; i--) {
            this.callbacks[i](that, false);
        }
    }

    pressFor(duration) {
        this.press();

        const that = this;
        setTimeout(() => {
            that.unpress();
        }, duration);
    }

    playSound(time) {
        if(this.soundBuffer && this.destNode) {
            let bufferSource = this.audioContext.createBufferSource();
            bufferSource.buffer = this.soundBuffer;
            bufferSource.connect(this.destNode);
            bufferSource.start(time);

            const that = this;
            bufferSource.addEventListener("ended", () => {
                bufferSource.disconnect(that.destNode);
            });
        }
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
    constructor(tempo, beatCount) {
        this.tempo = tempo;
        this.beatCount = beatCount;
        this.onbeat = [];

        this.barStartTime = 0;
        this.beat = 0;

        this.trackRecords = [];

        this.recordingScheduled = false;
        this.scheduledRecordTarget = 0;

        this.recording = false;
        this.recordTarget = 0;

        this.playing = false;
    }

    addOnBeatCallback(callback) {
        this.onbeat.push(callback);
    }

    removeOnBeatCallback(callback) {
        let index = this.onbeat.indexOf(callback);

        if(index >= 0) {
            this.onbeat.splice(index, 1);
        }
    }

    main() {
        this.beat = this.beat % this.beatCount + 1;

        // New bar if we reach 1
        if(this.beat == 1) {
            this.barStartTime = Date.now();

            // Stop recording if we were!
            if(this.recording) {
                this.recording = false;
            }

            // Start scheduled recording
            if(this.recordingScheduled) {
                this.recording = true;

                // Remove the scheduled record
                this.recordingScheduled = false;
                this.recordTarget = this.scheduledRecordTarget;

                this.trackRecords[this.recordTarget] = [];
            }
        }

        // Beat event function
        for(let i = this.onbeat.length - 1; i >= 0; i--) {
            this.onbeat[i](this);
        }

        // Play records
        for(let i = this.trackRecords.length - 1; i >= 0; i--) {
            // Don't play the one we're currently recording!!
            if(this.recording && this.recordTarget == i) {
                continue;
            }

            // Play everything else though
            let record = this.trackRecords[i];

            for(let i = record.length - 1; i >= 0; i--) {
                let event = record[i];

                if(event.beat == this.beat) {
                    setTimeout(event.action, event.time * (60000 / this.tempo));
                }
            }
        }

        let nextBeatTime = this.beat * 60000 / this.tempo;
        let elapsed = Date.now() - this.barStartTime;

        // Small delay
        const that = this;
        setTimeout(() => that.main(), nextBeatTime - elapsed);
    }

    scheduleRecording(trackId) {
        this.recordingScheduled = true;
        this.scheduledRecordTarget = trackId;
    }

    registerAction(action) {
        if(this.recording) {
            let record = this.trackRecords[this.recordTarget];

            let beatStartTime = this.barStartTime + (this.beat - 1) * 60000 / this.tempo;

            record.push({
                beat: this.beat,
                time: (Date.now() - beatStartTime) * (this.tempo / 60000),
                action: action
            });
        }
    }
}

class TrackButton {
    constructor(sequencer, trackId) {
        this.sequencer = sequencer;
        this.trackId = trackId;

        this.ticTacLightPhase = false;

        this.element = document.createElement("div");

        const that = this;
        let trigger = (e) => {
            e.preventDefault();

            that.press();
        };

        this.element.addEventListener("contextmenu", preventDefault);
        this.element.addEventListener("touchmove", preventDefault);
        this.element.addEventListener("touchend", preventDefault);

        this.element.addEventListener("touchstart", trigger);
        this.element.addEventListener("mousedown", trigger);
    }

    press() {
        this.sequencer.scheduleRecording(this.trackId);
        this.ticTac();
    }

    ticTac() {
        const that = this;

        let callback = (s) => {
            if(s.recordingScheduled && s.scheduledRecordTarget == that.trackId) {
                // Flashing!
                that.element.classList.toggle("on", s.beat % 2 == 1);
            } else {
                // Turn off if we aren't recording on this track
                that.element.classList.toggle("on", s.recording && s.recordTarget == that.trackId);

                // Remove the callback so that we don't get further beat events
                s.removeOnBeatCallback(callback);
            }
        };

        this.sequencer.addOnBeatCallback(callback);
    }
}

window.addEventListener("load", () => {
    let settings = [];
    let bindings = [];
    let keyState = [];
    let padkeys = [];

    let sequencerBars = [];
    let sequencer = new Sequencer(140, SEQUENCER_BEAT_COUNT);

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

        currentPadKey.press();
    });

    window.addEventListener("keyup", (event) => {
        let currentPadKey = padkeys[bindings[event.keyCode]];

        if(!currentPadKey) {
            return;
        }

        keyState[event.keyCode] = false;

        currentPadKey.unpress();
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
            for(let i = padkeys.length - 1; i >= 0; i--) {
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
            let trackButton = new TrackButton(sequencer, i);

            sequencerTracks.appendChild(trackButton.element);
        }

        // Beats
        let sequencerBeatsEl = document.getElementById("sequencerBeats");

        for(let i = 0; i < SEQUENCER_BEAT_COUNT; i++) {
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

                padkey.addPressCallback((pk, pressed) => {
                    if(sequencer.recording) {
                        if(pressed) {
                            sequencer.registerAction(() => pk.press());
                        } else {
                            sequencer.registerAction(() => pk.unpress());
                        }
                    }
                });
            }

            keypad.appendChild(row);
        }

        for(let i = 0; i < ACTIVE_LAYOUT.keymap.length; i++) {
            bindings[ACTIVE_LAYOUT.keymap[i]] = i;
        }
    }

    // Sequencer beat callback
    sequencer.addOnBeatCallback((s) => {
        // Light up the bars to show the current beat to the user
        for(let i = sequencerBars.length - 1; i >= 0; i--) {
            let el = sequencerBars[i]
            el.classList.toggle("on", i == (s.beat - 1));
        }
    });

    sequencer.main();
});
