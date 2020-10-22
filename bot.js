require('dotenv').config();
const Discord = require('discord.js');
const bot = new Discord.Client();
const request = require('request');
const fs = require('fs')
const auth = require('./auth.json');
const TOKEN = auth.token;

const API_call_timeout = 3600000;

bot.login(TOKEN);

channels = [];

channel_data = require('./channels.json');

var secret_num = require('./progress.json').secret_num;
var secrets = [];

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
    console.log("Started initialisation.");
    for(c in channel_data){
        bot.channels.fetch(channel_data[c].id).then(channel => {
            channels.push(channel);
            console.log("Got channel:"+channel.name);
        }).catch(console.error);
    }
});

bot.on('message', msg => {
    switch(msg.content){
        case '!_Add':
            if(channels.includes(msg.channel)){
                console.warn("Already in channel: " + msg.channel.name);
            }else{
                channels.push(msg.channel);
                console.log("Added new channel: " + msg.channel.name);
            }
            break;
        case '!_Remove':
            let found = false;
            for(i = 0; i < channels.length; i++){
                if(found && i != channels.length){
                    channels[i] = channels[i+1]
                }else if(channels[i] == msg.channel){
                    found = true;
                    if(i != channels.length){
                        channels[i] = channels[i+1]
                    }
                }
            }
            if(found){
                channels.pop();
            }
            console.log("Removed channel: " + msg.channel.name)
            break;
    }
});

function postSecret(){
    if(secrets.length == 0){
        return;
    }
    let s = secrets[secrets.length - 1];
    secret_num = s.imperialSecretNumber;
    console.log("Posting Secret:" + s.imperialSecretNumber);
    let embed = new Discord.MessageEmbed().setTitle("Imperial Secret #" + s.imperialSecretNumber);
    let hdr = '';
    if(s.hasOwnProperty('year')){
        hdr += s.year;
    }
    if(s.hasOwnProperty("course")){
        if(hdr != ''){
            hdr += ' ';
        }
        hdr += s.course;
    }
    if(hdr != ''){
        hdr = '[' + hdr + ']';
    }
    embed.setAuthor(hdr);
    if(s.hasOwnProperty('responseToSecret')){
        embed.addField('Responding to', 'Secret #' + s.responseToSecret, true);
    }
    embed.addField('Secret:', s.mainSecret);
    if(s.hasOwnProperty('image')){
        let imageBuffer = new Buffer.from(s.image,'base64');
        let attachment = new Discord.MessageAttachment(imageBuffer);
        embed.attachFiles([attachment]);
    }
    for(c in channels){
        channels[c].send(embed);
    }
    secrets.pop();
}

// Grab secrets using API
function grabPosts(){
    let user = auth.db_user;
    let pass = auth.db_pass;
    let authorization = "Basic " + new Buffer.from(user + ":" + pass).toString("base64");
    console.log("Started API call");
    request({ 'url' : auth.url, 'headers' : {
        "Authorization" : authorization
    }}, (err, resp, body) => {
        secrets = JSON.parse(body);
        while(true){
            if(secrets.length == 0){
                break;
            }
            if(secrets[secrets.length - 1].imperialSecretNumber <= secret_num){
                secrets.pop();
            }else{
                break;
            }
        }
        let interval = API_call_timeout/(secrets.length + 1);
        console.log("Got  " + secrets,length + ' new secrets');
        //postSecret();
        setInterval(postSecret,interval);
    });
}
grabPosts();
setInterval(grabPosts,API_call_timeout);

// Save active channels
setInterval(() => {
    fs.writeFileSync('./channels.json', JSON.stringify(channels, null, 4), 'utf-8');
    fs.writeFileSync('./progress.json', JSON.stringify({"secret_num" : secret_num}, null, 4), 'utf-8');
},10000);
