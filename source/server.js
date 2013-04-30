/**
 * Yii Newsgeed Realtime server
 *
 * Dependencies:
 * - node.js
 * - connect
 * - redis
 * - connect-redis
 *
 * @author Vladimir Gerasimov <freelancervip@gmail.com>
 */

var config      = require('./config'),
    utils       = require('./utils'),
    redis       = require('redis'),
    socket      = require('socket.io');

//default config if external one won't be presented
var defaultConfig = {
  debug: false,
  log_level: 1,
  history_count: 5,
  host: 'http://localhost',
  port: 2206,
  salt: 'th!3!3SpARTa!'
}
//merging configs
var opts = utils.extend({}, defaultConfig, config);
opts.debug ? console.dir(opts) : '';
var rclient = redis.createClient();
var io = socket.listen(opts.port);

io.set('log level', opts.log_level);
io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  //preventing race condition BUG in IE
  // more at https://github.com/LearnBoost/socket.io/issues/438
  /*, 'xhr-polling'
  , 'jsonp-polling'*/
  ]);

rclient.on('error', function(err){
  if(opts.debug) {
    console.log(err);
  }
});

rclient.on("connect", function(){
  if(opts.debug) {
    console.log('Connection to redis established');
  }
});

io.sockets.on('connection', function(socket) {
  var suid, channelslist,
      subscriber = redis.createClient();
      
  if(opts.debug) console.log('New connection at ' + serverTime());
  socket.on('disconnect', function(){
    if(opts.debug) console.log('Client disconnected at ' + serverTime());
    if(subscriber && subscriber.connected){
      if(opts.debug) console.log('Closing redis connection');
      subscriber.end();
    }
  });

  socket.on('auth', function(data, fn){
    if(!data.uid || !data.hash){
      fn('Malformed auth data');
      socket.disconnect();
      return;
    }
    //we need to require crypto every time
    if(!(require('crypto').createHash('md5').update(data.uid + opts.salt).digest('hex')) === data.hash){
      fn('Authorization failed! Incident will be reported to administrator');
      socket.disconnect();
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
        socket.emit('lastactivity', {message:replies, server_time: serverTime() });
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
    //also listen for opts.debug messages in opts.debug mode
    if(opts.debug) subscriber.subscribe('server:channels:opts.debug');
    
    fn('ok');
  });
  subscriber.on('error', function(err){
    if(opts.debug) console.log(err);
  });
  //-
  subscriber.on('subscribe', function(channel, count){
    if(opts.debug) console.log('User '+suid+' Subscribed at '+channel+' ('+count+' subscription(s) now)');
  });
  subscriber.on('psubscribe', function(pattern, count){
    if(opts.debug) console.log('User '+suid+' Subscribed at '+pattern+' pattern ('+count+' subscription(s) now)');
  });
  //--
  subscriber.on('unsubscribe', function(channel, count){
    if(opts.debug) console.log('User '+suid+' Unsubscribed from '+channel+' ('+count+' subscription(s) remains)');
  });
  subscriber.on('punsubscribe', function(pattern, count){
    if(opts.debug) console.log('User '+suid+' Punsubscribed from '+pattern+' pattern ('+count+' subscription(s) remains)');
  });
  //---
  subscriber.on('message', function(channel, message){
    if(opts.debug) console.log('Got '+message+' from '+channel);
    socket.emit('msg', {type: 'subscription', channel: channel, message: message, server_time: serverTime() });
  });
  subscriber.on('pmessage', function(pattern, channel, message){
    if(opts.debug) console.log('Got '+message+' from '+channel+' (pattern: '+pattern+')');
    socket.emit('msg', {type: 'subscription', channel: channel, message: message, server_time: serverTime() });
  });
  //----
});

var serverTime = function(){
  return Math.round((new Date()).getTime() / 1000); //in seconds
};