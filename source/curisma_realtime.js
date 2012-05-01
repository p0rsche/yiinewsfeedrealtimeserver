/**
 * Curisma Realtime server
 * Based on node.js
 *
 * @author Vladimir Gerasimov <freelancervip@gmail.com>
 */
var debug = true; //turn off in production

var io = require('socket.io').listen(2206),
    redis = require('redis'), 
    util = require('util');

if(debug){
  var v8 = require("v8-profiler");
} 

var rclient = redis.createClient();

rclient.on('error', function(err){
  if(debug) console.log(err);
});

rclient.on("connect", function(){
  if(debug) console.log('Connection to redis established');
});

io.sockets.on('connection', function(socket) {
  var suid, channelslist,
      subscriber = redis.createClient();

  subscriber.on('error', function(err){
    if(debug) console.log(err);
  });
  if(debug) console.log('New connection at '+ curTimeMs());
  socket.on('disconnect', function(){
    if(debug) console.log('Client disconnected at ' + curTimeMs());
    if(subscriber && subscriber.connected){
      if(debug) console.log('Closing redis connection');
      subscriber.end();
    }
  });

  socket.on('auth', function(data, fn){
    if(!data.uid){
      fn('Unknown user id');
      socket.disconnect();
      return;
    }
    if(!rclient || !rclient.connected){
      if(debug) console.log('No db connection');
      fn('no connection to database');
      return;
    }
    //@TODO write auth phase according to Yii
    suid = data.uid;
    fn('ok');
    //getting last activity history; 
    //@TODO 0-4 should be server setting
    rclient.lrange('uid:'+suid+':lastactivity', 0, 4, function(err, replies){
      /**
       * We are using server time both DB and redis so we don't need to use client JS time because it differs from server-time
       */
      if(!err)
        socket.emit('lastactivity', {message:replies, server_time: curTimeMs()});
    });
  });

  socket.on('subscribe', function(data, fn){
    if(!data.channels || (!(data.channels instanceof Array))){
      fn('Cannot determine channels from request');
      socket.disconnect();
      return;
    }
    //subsribes on all requested channels
    var channels = data.channels;
    for(var i=0; i< channels.length; i++){
      subscriber.subscribe('uid:'+suid+':channels:'+channels[i]);
    }
    //also listen for debug messages in debug mode
    if(debug) subscriber.subscribe('server:channels:debug');
    
    fn('ok');
  });

  //-
  subscriber.on('subscribe', function(channel, count){
    if(debug) console.log('User '+suid+' Subscribed at '+channel+' ('+count+' subscription(s) now)');
  });
  subscriber.on('psubscribe', function(pattern, count){
    if(debug) console.log('User '+suid+' Subscribed at '+pattern+' pattern ('+count+' subscription(s) now)');
  });
  //--
  subscriber.on('unsubscribe', function(channel, count){
    if(debug) console.log('User '+suid+' Unsubscribed from '+channel+' ('+count+' subscription(s) remains)');
  });
  subscriber.on('punsubscribe', function(pattern, count){
    if(debug) console.log('User '+suid+' Punsubscribed from '+pattern+' pattern ('+count+' subscription(s) remains)');
  });
  //---
  subscriber.on('message', function(channel, message){
    if(debug) console.log('Got '+message+' from '+channel);
    socket.emit('msg', {type: 'subscription', channel: channel, message: message, server_time: curTimeMs()});
  });
  subscriber.on('pmessage', function(pattern, channel, message){
    if(debug) console.log('Got '+message+' from '+channel+' (pattern: '+pattern+')');
    socket.emit('msg', {type: 'subscription', channel: channel, message: message, server_time: curTimeMs()});
  });
  //----
});

/**
 * Gets current time in milliseconds
 */
function curTimeMs(){
  //in seconds
  return Math.round((new Date()).getTime() / 1000);
}
