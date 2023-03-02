const express=require("express");
const app=new express();
const {open}=require("sqlite");
const sqlite3=require("sqlite3");
const jwt=require("jsonwebtoken");
const bcrypt=require("bcrypt");
const path=require("path");
app.use(express.json());
let dpPath=path.join(__dirname,"twitterClone.db");
const InitialiseDbandServer=async()=>{
    try 
    {
        db=await open({
            filename:dpPath,
            driver:sqlite3.Database
        });
        console.log("DB Connected Successfully");
        app.listen(3000,()=>{
            console.log("Server is running at http://localhost:3000/");
        });
    }
    catch (error) 
    {
        console.log(error);
    }
}

app.post("/register/",async(request,response)=>{
    const {username,password,name,gender}=request.body;
    // check username already exists or not

    const checkquery=`
    select *
    from user
    where username="${username}";`;

    const res1=await db.get(checkquery);
    if(res1!==undefined)
    {
        response.status(400);
        response.send("User already exists");
    }
    else
    {
        if(password.length<6)
        {
            response.status(400);
            response.send("Password is too short");
        }
        else{
            const haspassword=await bcrypt.hash(password,10);
            const insertQuery=`
            insert into user(name,username,password,gender)
            values('${name}','${username}','${haspassword}','${gender}');`;
            await db.run(insertQuery);
            response.send("User created successfully");
        }
    }
});

app.post("/login/",async(request,response)=>{
    const {username,password}=request.body;
    const checkuserquery=`
    select *
    from user
    where username='${username}';`;
    const userdetails=await db.get(checkuserquery);
    if(userdetails===undefined)
    {
        response.status(400);
        response.send("Invalid user");
    }
    else
    {
        const chkpassword=await bcrypt.compare(password,userdetails.password);
        if(chkpassword===true)
        {
            const jwtToken=await jwt.sign({username:username},"secretToken");
            response.send({jwtToken});
        }
        else
        {
            response.status(400);
            response.send("Invalid password");            
        }
    }
});

InitialiseDbandServer();

const middlewareAuthenticationfn=async(request,response,next)=>{
    const AuthHeaders=request.headers["authorization"];
    let jwtToken;
    if(AuthHeaders!==undefined)
    {
        jwtToken=AuthHeaders.split(" ")[1];
    }
    if(jwtToken===undefined)
    {
        response.status(401);
        response.send("Invalid JWT Token");
    }
    else
    {
        await jwt.verify(jwtToken,"secretToken",(error,payload)=>
        {
            if(error)
            {
                response.status(401);
                response.send("Invalid JWT Token");
            }
            else
            {
                request.username=payload.username;
                next();
            }
        });
    }
}

app.get("/user/tweets/feed/",middlewareAuthenticationfn,async(request,response)=>
{
    const username=request.username;
    const getUserIdQuery=`
    select user_id
    from user 
    where username='${username}';`;
    const userIdvalobj=await db.get(getUserIdQuery);
    const userId=userIdvalobj.user_id;
    const getTweetsQuery=`
    select username,tweet,date_time as dateTime
    from tweet join follower join user
    where follower.follower_user_id=${userId} 
    and tweet.user_id=follower.following_user_id 
    and follower.following_user_id=user.user_id
    order by tweet.date_time DESC
    limit 4;
    `;
    const result=await db.all(getTweetsQuery);
    response.send(result);
});

app.get("/user/following/",middlewareAuthenticationfn,async(request,response)=>{
    const username=request.username;
    const getFollowersQuery=`
    select name 
    from user
    where user_id in
    (select following_user_id
    from follower join user
    where follower.follower_user_id=user.user_id and user.username="${username}");
    `;
    const result=await db.all(getFollowersQuery);
    response.send(result);
});

app.get("/user/followers/",middlewareAuthenticationfn,async(request,response)=>{
    const username=request.username;
    const getFollowersQuery=`
    select name 
    from user
    where user_id in
    (select follower_user_id
    from follower join user
    where follower.following_user_id=user.user_id and user.username="${username}");
    `;
    const result=await db.all(getFollowersQuery);
    response.send(result);
});

app.post("/user/tweets/",middlewareAuthenticationfn,async(request,response)=>{
    const {tweet}=request.body;
    const username=request.username;
    const getUserIdQuery=`
    select user_id
    from user
    where username="${username}";`;
    const result=await db.get(getUserIdQuery);
    const userId=result.user_id;
    const insertQ=`
    insert into tweet(tweet,user_id,date_time)
    values("${tweet}",${userId},"${new Date()}");`;
    await db.run(insertQ);
    response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/",middlewareAuthenticationfn,async(request,response)=>{
    const username=request.username;
    const getUserIdQuery=`
    select user_id
    from user
    where username="${username}";`;
    const result=await db.get(getUserIdQuery);
    const userId=result.user_id;
    const {tweetId}=request.params;
    const findTweetQ=`
    select user_id
    from tweet
    where tweet_id=${tweetId};`;
    const res=await db.get(findTweetQ);
    if(res===undefined)
    {
        response.send("Tweet Removed");
    }
    else
    {
        if(res.user_id===userId)
        {
            const deltQ=`
            delete from tweet
            where tweet_id=${tweetId};`;
            await db.run(deltQ);
            response.send("Tweet Removed");
        }
        else
        {
            response.status(401);
            response.send("Invalid Request");
        }
    }
});

app.get("/user/tweets/",middlewareAuthenticationfn,async(request,response)=>{
    const username=request.username;
    const getUserIdQuery=`
    select user_id
    from user
    where username="${username}";`;
    const result=await db.get(getUserIdQuery);
    const userId=result.user_id;
    const tweetsQuery=`
    select tweet
    from tweet
    where user_id=${userId};`;
    const result1=await db.all(tweetsQuery);
    response.send(result1);
});

app.get("/tweets/:tweetId/",middlewareAuthenticationfn,async(request,response)=>{
    const username=request.username;
    const getUserIdQuery=`
    select user_id
    from user
    where username="${username}";`;
    const {tweetId}=request.params;
    const result=await db.get(getUserIdQuery);
    const userId=result.user_id;
    // trying to get user_id for the posted tweet
    const tweet_user_id=`
    select *
    from tweet
    where tweet_id=${tweetId};`;
    const user_of_tweet=await db.get(tweet_user_id);
    const checkfollowingQ=`
    select *
    from follower
    where follower_user_id=${userId} and following_user_id=${user_of_tweet.user_id};`;
    const res1=await db.get(checkfollowingQ);
    if(res1===undefined)
    {
        response.status(401);
        response.send("Invalid Request");
    }
    else
    {
        const cntreplies=`
        select count(reply) as replies
        from reply join tweet
        where reply.tweet_id=tweet.tweet_id and tweet.tweet_id=${user_of_tweet.tweet_id};`;
        const cntrepliesR=await db.get(cntreplies);

        const cntlikes=`
        select count(like_id) as likes
        from like join tweet
        where like.tweet_id=tweet.tweet_id and tweet.tweet_id=${user_of_tweet.tweet_id};`;
        const cntlikesR=await db.get(cntlikes);
        let resp={
            "tweet":user_of_tweet.tweet,
            "likes":cntlikesR.likes,
            "replies":cntrepliesR.replies,
            "dateTime":user_of_tweet.date_time
        };

        response.send(resp);
    }
});

module.exports=app;