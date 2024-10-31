const REALTIME_DEBUG = process.env.REALTIME_DEBUG || false;

class OutputBuffer{
  constructor(){
    this.outputBuffer = {};
  }

  log(key, data){
    if (REALTIME_DEBUG)
      console.log(`[${key}]`, data);
    if (!this.outputBuffer[key]) {
      this.outputBuffer[key] = data;
    } else 
    {
      this.outputBuffer[key] += "\n"+data.toString(); //coerce to string in case of non-string data
    }
  }

  flush(){
    console.log("flushing output buffer");
    return JSON.stringify(this.outputBuffer)

    this.outputBuffer = {};
  }

  replaceInBuffer(key, data){
    console.log(`replacing ${key} in buffer`);
    this.outputBuffer[key] = data;
  }

  getFromBuffer(key){
    console.log(`getting ${key} from buffer`);
    return this.outputBuffer[key] || null;
  }
}

export default OutputBuffer