// AudioWorklet processor for audio capture
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      // Copy the data since it's transferred
      const channelData = new Float32Array(input[0]);
      this.port.postMessage({ audio: channelData }, [channelData.buffer]);
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
