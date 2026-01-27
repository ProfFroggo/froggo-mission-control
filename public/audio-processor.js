// AudioWorklet processor for voice capture
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0];
      
      // Accumulate samples
      for (let i = 0; i < inputData.length; i++) {
        this.buffer[this.bufferIndex++] = inputData[i];
        
        if (this.bufferIndex >= this.bufferSize) {
          // Send buffer to main thread
          this.port.postMessage({
            type: 'audio',
            data: this.buffer.slice()
          });
          this.bufferIndex = 0;
        }
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('voice-processor', VoiceProcessor);
