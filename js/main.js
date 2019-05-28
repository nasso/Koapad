window.addEventListener("load", () => {
    const chars = ("1234567890AZERTYUIOPQSDFGHJKLMWXCVBN,;:!").split("");
    const KEYMAP = {
        AZERTY: [
            49, 50, 51, 52, 53, 54,  55, 56, 57,  48,
            65, 90, 69, 82, 84, 89,  85, 73, 79,  80,
            81, 83, 68, 70, 71, 72,  74, 75, 76,  77,
            87, 88, 67, 86, 66, 78, 188, 59, 58, 161
        ]
    };

    const COLOR_SELECTED = [46, 204, 113];
    const COLOR_HOVER = [26, 188, 156];

    let audioContext;

    let settings = [];
    let bindings = [];
    let keyState = [];
    let padkeys = [];

    let selectedPadKey = null;

    class PadKey {
        constructor(i) {
            let keyNumber = document.createElement("span");
            keyNumber.setAttribute("class", "keyNumber");
            keyNumber.innerHTML = chars[i];

            this.element = document.createElement("td");

            this.element.addEventListener("dragover", function(e) {
                e.stopPropagation();
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }, false);

            const that = this;
            this.element.addEventListener("drop", function(e) {
                e.stopPropagation();
                e.preventDefault();

                let soundFile = e.dataTransfer.files[0];

                let reader = new FileReader();

                reader.addEventListener("loadend", function(e) {
                    if(e.target.result && !e.target.error) {
                        audioContext.decodeAudioData(e.target.result, function(buffer) {
                            that.soundBuffer = buffer;
                        });
                    }
                });

                reader.readAsArrayBuffer(soundFile);
            }, false);

            this.element.appendChild(keyNumber);

            this.resetColor();
        }

        playSound(time) {
            let gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);

            let normVolume = settings["volume"].getNormalizedValue();

            gainNode.gain.value = normVolume * normVolume;

            let bufferSource = audioContext.createBufferSource();
            bufferSource.buffer = this.soundBuffer;
            bufferSource.connect(gainNode);
            bufferSource.start(time);

            bufferSource.addEventListener("ended", function() {
                bufferSource.disconnect(gainNode);
                gainNode.disconnect(audioContext.destination);
            });
        }

        setColor(r, g, b) {
            let color = `rgb(${r}, ${g}, ${b})`;
            let grayscale = (r + g + b) / 3.0;
            let lighting = -(grayscale / 255.0 - 1.0) * settings["lightPower"].currentValue;

            this.color = [r, g, b];
            this.element.style.backgroundColor = color;
            this.element.style.boxShadow = `0px 0px ${lighting}px ${color}`;
        }

        setColorv(color) {
            this.setColor(color[0], color[1], color[2]);
        }

        resetColor() {
            this.setColor(189.0, 195.0, 199.0);
        }

        onmouseenter() {
            if(!this.selected()) {
                this.setColorv(COLOR_HOVER);
            } else {
                this.setColorv(COLOR_SELECTED);
            }
        }

        onmouseout() {
            if(!this.selected()) {
                this.resetColor();
            } else {
                this.setColorv(COLOR_SELECTED);
            }
        }

        selected() {
            return this == selectedPadKey;
        }

        unselect() {
            this.resetColor();
            selectedPadKey = null;
        }

        selectPadKey() {
            if(selectedPadKey != null || this.selected()) {
                selectedPadKey.unselect();
            }

            selectedPadKey = this;
            this.setColorv(COLOR_SELECTED);
        }

        toggleSelect() {
            if(this.selected()) {
                this.unselect();
            } else {
                this.selectPadKey();
            }
        }

        onmousedown() {
            this.toggleSelect();
        }

        refresh() {
            this.setColorv(this.color);
        }
    }

    class CircleSlider {
        constructor(value) {
            const that = this;

            this.currentValue = value;

            this.element = document.createElement("div");

            this.valueDiv = document.createElement("div");
            this.valueDiv.setAttribute("class", "value");
            this.valueDiv.innerHTML = this.currentValue;
            this.element.appendChild(this.valueDiv);

            this.controllersDiv = document.createElement("div");
            this.controllersDiv.setAttribute("class", "controllers");

            this.plus = document.createElement("div");
            this.plus.setAttribute("class", "plus");
            this.plus.innerHTML = "+";

            this.minus = document.createElement("div");
            this.minus.setAttribute("class", "minus");
            this.minus.innerHTML = "-";

            this.controllersDiv.appendChild(this.plus);
            this.controllersDiv.appendChild(this.minus);

            this.element.appendChild(this.controllersDiv);

            this.min = null;
            this.max = null;

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

            this.element.addEventListener("onmousewheel", wheelListener);
            this.element.addEventListener("DOMMouseScroll", wheelListener);

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

        getNormalizedValue() {
            if(this.max == null || this.max == 0) {
                return 0;
            }

            return this.currentValue / this.max;
        }
    }

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

        currentPadKey.unselect(); // Unselected the padkey if it is selected
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

    // Init UI
    {
        let circleSliders = $(".circleSlider");

        for(let i = 0; i < circleSliders.length; i++) {
            let sliderEl = circleSliders[i];
            let value = parseInt(sliderEl.innerHTML);
            sliderEl.innerHTML = "";

            let slider = new CircleSlider(value);
            sliderEl.appendChild(slider.element);

            settings[sliderEl.id] = slider
        }

        settings["lightPower"].onvaluechanged = function() {
            for(let i = 0; i < padkeys.length; i++) {
                padkeys[i].refresh();
            }
        };

        settings["lightPower"].setRange(0, 100);
        settings["volume"].setRange(0, 100);
    }

    // Init Keys
    {
        let keypad = document.getElementById("keypad");

        for(let j = 0; j < 4; j++) {
            let tr = document.createElement("tr");

            for(let i = 0; i < 10; i++) {
                let padkey = new PadKey(j * 10 + i);
                padkeys.push(padkey);
                tr.appendChild(padkey.element);
            }

            keypad.appendChild(tr);
        }

        for(let i = 0; i < KEYMAP.AZERTY.length; i++) {
            bindings[KEYMAP.AZERTY[i]] = i;
        }
    }
});
