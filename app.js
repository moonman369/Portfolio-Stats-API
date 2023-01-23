const express = require('express');
const fetch = require("cross-fetch");
const cors = require('cors')
const app = express();

const port = process.env.PORT || 5000;

app.use(cors({
    origin: '*'
}))

app.get('/',(req,resp)=>{
    resp.status(404).json({"status":"error","message":"please enter your username (eg: https://leetcodeapi-production.up.railway.app/dojeto)"})
})

app.get('/:username',async (req,resp)=>{

        try{
            const LEETCODE_API_ENDPOINT = 'https://leetcode.com/graphql'
            const DAILY_CODING_CHALLENGE_QUERY = `
                {    
                    allQuestionsCount { difficulty count }
                        matchedUser(username: "${req.params.username}") {
                                    username
                                    contributions { points }
                                    profile { reputation ranking }
                                    submitStats  {
                                    acSubmissionNum { difficulty count submissions } 
                        }
                    }
                }
                `
        
                const init = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: DAILY_CODING_CHALLENGE_QUERY }),
                }
            
                const response = await fetch(LEETCODE_API_ENDPOINT, init)
                const data = await response.json()

            const obj = 
            {
                "status": "success",
                "totalSolved": data['data']['matchedUser']['submitStats']['acSubmissionNum'][0]['count'],
                "totalQuestions": data['data']['allQuestionsCount'][0]['count'],
                "easySolved": data['data']['matchedUser']['submitStats']['acSubmissionNum'][1]['count'],
                "totalEasy": data['data']['allQuestionsCount'][1]['count'],
                "mediumSolved": data['data']['matchedUser']['submitStats']['acSubmissionNum'][2]['count'],
                "totalMedium": data['data']['allQuestionsCount'][2]['count'],
                "hardSolved": data['data']['matchedUser']['submitStats']['acSubmissionNum'][3]['count'],
                "totalHard": data['data']['allQuestionsCount'][3]['count'],
                "ranking": data['data']['matchedUser']['profile']['ranking'],
                "contributionPoints": data['data']['matchedUser']['contributions']['points'],
                "reputation": data['data']['matchedUser']['profile']['reputation'],
            }
            resp.status(200).json(obj)
        }
        
        catch(e){
            resp.status(404).json({"status":"error","message":"Username Not Found"})
        }
})

app.listen(port,()=>{
    console.log(`Server running on port: ${port}`);
})



