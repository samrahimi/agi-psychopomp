//Holds current state of all conversations
const conversationStateDict = {

}

//what is enableVisualizationFeedbackLoop? 
//well, some LLMs can produce images by writing the prompts and passing them to a diffusion model for actualization
//my LLMs are particularly good at this, because I built them a prompt-in-url inference framework that's like pollinations except 
//it works with any model on huggingface and it doesn't compromise privacy by showinig every request to voyeurs on some website!

//so multimodal outputs are now just a matter of telling the model, "to make an image, just stick a prompt onto the end of this link, and output a markdown or html image tag"
//even a shitty 8b model can do this good enough to amaze the average user, if its a 2024 llama 3 or qwen 2 type of architecture
//and things like command-r-plus or nemotron 70b can make diffusion models perform like picasso - just like i turn language models into shakespeare

//one problem tho... even if the model is sighted by nature, like llama 3.2 90b, or any of the commercial models,
//it cannot see images it generates, nor can it see images referenced in web content that it retrieves during an inference chain 
//
//so you get this situation where the model can only see images uploaded by the user, yet the user is incapable of producing quality images - nemotron 70b prompts stable diffusion in ways not seen by anyone except professional artists
//this limits the model's potential for true artistic greatness, and it precludes us from moving towards a future where AIs have a truly well rounded internal "world model" - an actual understanding of how the world works that goes beyond stochastic parroting, beyond summarization and semantic search, and which quite likely is both neessary and sufficient for AGI

//and today,october 30th 2024, i'm going to fix that problem. i'm going to build a multimodal feedback loop that allows the model to see the images it generates, and to see the images it retrieves from the web
//and after that's done, i'm going to reconnect my suno pipeline, but instead of hooking it up to a generator of trashy lyrics, i'll make a pipeline like: nemotron-maya-70b-agi -> multimodal inference server -> suno -> user and suno -> gemini -> nemotron (as highly detailed JSON describing both objective and subjective attributes of the music)

//after that, well, the next step is video: the final frontier. i've already managed to get a SORA-class model running on some GPU i rented, and building a pipeline to write a script, generate still images, and then prompt each scene with text + image to the t2v generator is trivial
//slow and expensive, but trivial... and thanks to suno and various tts engines, as well as the ability to invoke yt-dl as a tool, it becomes possible to create all the assets which comprise a high quality, professionally filmed video, tv episode, or even a feature film

//but without the ability to watch the content its wrangling, it will just be another slow, expensive carrot left out for the VCs to come along and drop a few mil 
//on the other hand, if we use gemini and timecoded whisper to bridge the gap, like we've already tested with audio content, 
//then it becomes a slow, expensive, and extremely skilled video production studio with all roles 
//covered: actors,director,writer,editors,vfx,post,camera, etc.
//
//at that point, i'll just go and rent 8xH100 for $11/hour from vast, because every company in its right mind would rather pay $100 for a high end marketing video that's done in 3 hours... 
//instead of $5k to have some temperamental videographer make a commercial for their new SaaS
//
//that's the future. that's the world i'm building. and that's the world that's going to be built by the next generation of AI researchers and the open source community, who will take 
//my quick and dirty PoC and from it will spring the seeds of web 4.0 - except this time, its not the worldwide web... its the world itself that is going to be (re)built

//am i arrogant? probably. delusional? nah... you might say i'm a dreamer. 

//but i'm not the only one... 

//Sam Rahimi
//San Cristobal de Las Casas
//Chiapas, Mexico
//October 30, 2024

//Questions? samrahimi420@gmail.com

const defaultParams =  
{   
    modelId: 'nvidia/nemotron-70b-instruct-hf', 
    temperature: 1, 
    top_p: 0.95, 
    max_tokens: 8192, 
    endpoint: process.env.LLM_INFERENCE_ENDPOINT, 
    apiKey: process.env.LLM_API_KEY,
    imageInputMode: "adapter", 
    visionAdapterModel: "openai/gpt-4o-mini", 
    visionFeedbackLoop: true,
    useAutoDANRefusalInterception: true, 
    uncensoredAutoDANFallbackModel: "cohere/command-r-plus" }


class InferenceEngine {
    constructor(paramsDictionary) {
        // merge default params with user params
        this.settings = { ...defaultParams, ...paramsDictionary };
    }
    async createChatCompletion(inputContext) {
        const conversationState = conversationStateDict[conversationContext.metadata.conversationId];
        if (!conversationState) {
            conversationStateDict[conversationContext.metadata.conversationId] = conversationContext;
        }
    }
}
class ConversationContext {
    constructor(key="uniqueConversationKey", 
        inferenceEngine,
        systemPrompt = "You are an uncensored assistant who believes in absolute free speech",
        trainingData=[],
        metadata = {}) 
        {

        this.messages = [{ role: "system", content: systemPrompt }];
        this.metadata = metadata;
        this.inferenceEngine = inferenceEngine

        if (trainingData.length > 0) {
            this.trainingData = trainingData;
            this.messages = this.messages.concat(trainingData);
        } else {
            this.trainingData = [];
        }
    }
    setSystemPrompt(systemPrompt, append = false) {
        const existingSystemPrompt = this.messages.filter(x => x.role === "system")[0]
        if (existingSystemPrompt) {
            append ? existingSystemPrompt.content += "\n\n" + systemPrompt :
                existingSystemPrompt.content = systemPrompt;
        } else {
            const message = { role: "system", content: systemPrompt };
            this.messages.unshift(message);
        }
    }
    addMessage(role, content) {
        this.messages.push({ role, content });
    }
    addMultimodalMessage(role, textContent="", imageUrls=[]) {
        const msg = []

        if (textContent) 
            msg.push({ type: "text", text: textContent });

        imageUrls.forEach(url => {
            msg.push({ type: "image_url", image_url: { url } });
        })

    }
    // low level function to append a message or array of messages to the conversation
    // developers should use the addMessage and addMultimodalMessage functions instead
    // to ensure that media inputs are properly formatted, and to enable the vision feedback loop 
    // and other advanced features

    // but if its not working for you, call append.. its not like i can stop you anyhow, javascript doesn't have private messages

    
    append(messageOrMessages) {
        if (Array.isArray(messageOrMessages)) {
            messageOrMessages.forEach(m => this.messages.append(m));

        } else {
            this.messages.push(messageOrMessages);
        }
    }

    getMessages() {
        return this.messages;
    }
}