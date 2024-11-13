import { get } from 'lodash';
import {getChatCompletion} from './llm.mjs'


const normalize = async(input) => {
    if (typeof input === 'string') {
        const prompt = `The text below contains a 2d array, formatted as text of some kind. Please extract this data from the text, flatten the array, and return as a simple, comma separated list of integers. 
        
        For example, if the input is:
        1 2 3
        4 5 6
        7 8 9
        
        The output should be:
        1,2,3,4,5,6,7,8,9
        
        Return ONLY the list of integers, separated by commas, with no additional text or formatting of any kind.
        
        If there is no 2d array in the source material, say "no array found"`;

        const answer = await getChatCompletion("openai/gpt-4o-mini",[{role:"user", content:prompt}]);
        return answer
        
    }
    else if (Array.isArray(input)) {
        //[[0,4,0,4,0,4,0,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,3,2,3,3,3,2,3],[0,0,0,0,0,0,0,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,1,1,1,2,1,1,1],[4,4,0,4,0,4,4,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[4,4,0,4,0,4,4,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,4,0,4,0,4,0,5,5,5,5,5,5,5,5]],"output":[[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[3,2,3,3,3,2,3],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[1,1,1,2,1,1,1],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0]]
        if (process.env.REALTIME_DEBUG)
            console.log("normalize", input);

        return input.map(row => row.join(" ")).join("\n");
    }
}

export {normalize}