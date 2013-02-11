/******************************************************************
*
*   File Name           :   app.js
*   Brief Description   :   JavaScript file used for server side scripting.
*   Author              :   Sunil Yadav (sunil.y4@samsung.com)
*   Project             :   Web Application Service Platform (WASP)
*   Date                :   July 03, 2012
*   Dependency          :   None
*   Copyright 2012 by Samsung Electronics, Inc.,
*
* This software is the confidential and proprietary information
* of Samsung Electronics, Inc. ("Confidential Information").  You
* shall not disclose such Confidential Information and shall use
* it only in accordance with the terms of the license agreement
* you entered into with Samsung.
*
*
*******************************************************************/
// Server File
// require('nodetime').profile({
    // accountKey: '0c56baa5413c69198a4634d8fa943eb6684c2391', 
    // appName: 'BLACK JACK APPLICATION'
  // });
var express = require('express');
// creating object for express
var app = express.createServer();
// creating to fetch the network IPs
var os = require('os');
// creating for User Tracking
var mobUser = require('./mobUser.js');
// creating for sound effect
//var snd = require('./soundmgr.js');
var queueSocket = new Array();
var queueHit = new Array();
// Configure environment for server (Common to all environments)
app.configure(function(){
    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(app.router);
});
// Configure environment for server (development environments)
app.configure('development', function(){
    app.use(express.static(__dirname + '/public'));
    // directory for html pages
    app.use(express.errorHandler({
        dumpExceptions : true, 
        showStack : true
    }));
// show error if it occurred
});

// Configure environment for server (production environments)
app.configure('production', function(){
    var oneYear = 31557600000;
    app.use(express.static(__dirname + '/public',
    {
        maxAge : oneYear
    }
    ));
    // directory for html
    app.use(express.errorHandler());
// show error if it occurred
});

// creating object

var io = require('socket.io').listen(app); 
// for socket.io & add server
var tvRooms = [];
var onTV = true;
// room array (TV)

var mobPlayer = [];

var stage = {join:true,deal:false,stand:false}; 
var bustedCount = 0;
// add port listener
app.listen(3000);
// listener to all sockets
io.sockets.on('connection', function (socket){
    showRequest(" @@@  connection")
    // on new room created.
    socket.on("new room", function(){
        showRequest("new room")
        tvRooms.push({socket:socket});
        socket.emit('setIpAddress',getIpAddress());
        mobUser.resetMoney();
        onTV = true;
    });
    
    // on new mobile connected.
    socket.on("connect mobile", function(data){
        showRequest("connect mobile")
        var msg = "",status = "404",userBalance=0;
        try{
            if(onTV){
                
                if(mobPlayer.length<=5){
                    for(cp in mobPlayer){
                        if((mobPlayer[cp].name).toUpperCase() == (data.name).toUpperCase()){
                            //MOB : User already exist.
                            msg = "User already exist.";
                            socket.emit('mobileConnectStatus',{
                                msg:msg,
                                status:status
                            });
                            return 0;
                        }
                    }
                }
                showRequest("stage.join "+stage.join +" :: mobPlayer.length "+mobPlayer.length);
                showRequest("stage.deal "+stage.deal +" :: stage.stand "+stage.stand);
                if(stage.join && mobPlayer.length<5 && !stage.deal && !stage.stand){
                    mobPlayer.push({
                        socket:socket,
                        roomId:data.room,
                        name:data.name,
                        join:true,
                        coin:false,
                        deal:false,
                        stand:false
                    });
                    msg = "User join successfully.";
                    status = "200";
                    userBalance = mobUser.setMoney(data.name,500);
                    console.log("@@@@@@@@@@ userBalance: "+userBalance)
                    tvRooms[0].socket.emit('add user',socket.id,{
                        userMatched:data.name,
                        userBalance:userBalance
                    });
                
                }else if((stage.deal || stage.stand) && mobPlayer.length<5){
                    mobPlayer.push({
                        socket:socket,
                        roomId:data.room,
                        name:data.name,
                        join:false,
                        coin:false,
                        deal:false,
                        stand:false
                    });
                    userBalance = mobUser.setMoney(data.name,500);
                    tvRooms[0].socket.emit('add user',socket.id,{
                        userMatched:data.name,
                        userBalance:userBalance
                    });
                    //wait for some time.
                    status = "201";
                    msg = "You are on table. Please wait for on going Deal to complete.";
                }else if(mobPlayer.length==5){
                    msg = "Table is full, Try again later.";
                //table is full now.
                }else{
                    console.log(" mobPlayer.length "+mobPlayer.length)
                    msg = "Unable to join the game.";
                //Unable to join the game
                }
            }else{
                msg = "Please trun on the TV";
                showRequest("Please trun on the TV");  
            }
        }catch(e){
            status = "500";
            msg = "Internal Server Error";
            console.log(" Error " +e);
            try{
                for(cp in mobPlayer){
                    if(mobPlayer[cp].socket.id==socket.id){
                        mobPlayer[cp].socket.emit('removeUser');
                    }
                }
                mobPlayer = [];
                return 0;
            }catch(e){
                console.log("@@@@@@@ Error  " +e);
                return 0 ;
            }
        }
        socket.emit('mobileConnectStatus',{
            msg:msg,
            status:status,
            userBalance:userBalance
        });
    });

    
    // When a user disconnects
    socket.on("disconnect", function(){
        try{
            showRequest("disconnect")
           
            if(tvRooms[0].socket.id==socket.id){ //TV
                showRequest("tv disconnected")
                onTV = false;
                tvRooms = [];
                for(cp in mobPlayer){
                    mobPlayer[cp].socket.emit('removeUser');
                     showRequest(" player is disconnected and removed from table")
                    stage.join = true;
                }
                mobPlayer = [];
            }else{
                console.log(" No player Found ")
            }
            if(onTV){
                if(mobPlayer.length>0){
                    for(cp in mobPlayer){
                        if(mobPlayer[cp].socket.id==socket.id){
                            showRequest("stage.stand "+stage.stand +" :: mobPlayer[cp].deal "+mobPlayer[cp].deal);
                            if(stage.stand && !mobPlayer[cp].deal){
                                tvRooms[0].socket.emit('showResultOnTable', socket.id,false);
                            }
                            showRequest(" player is disconnect and remove from table");
                            tvRooms[0].socket.emit('removeUserForTV',socket.id);
                            mobUser.resetMoney();
                            // send to indexPage to remove player details
                            mobPlayer.splice(cp,1);  						
                        }
                    }
                }
            }
            if(mobPlayer.length>0){
                var c=0,d=0;
                for(cp in mobPlayer){
                   if(mobPlayer[cp].join && !mobPlayer[cp].coin){
                        c++;
                    }
                    if(mobPlayer[cp].deal){
                        d++;
                    }     
                }
                if(c==d){
                    for(cp in mobPlayer){
                        if(mobPlayer[cp].join && mobPlayer[cp].deal){
                            mobPlayer[cp].deal = false;
                            mobPlayer[cp].socket.emit('enabledStand',{playerBalance:mobUser.getMoney(mobPlayer[cp].name)});
                            showRequest(" ********  enabledStand   ********")
                        }
                    }   
                }
            }
            if(mobPlayer.length==0){
                stage.join = true;
                stage.deal = false;
                stage.stand = false;
            }
        }catch(e){
            console.log(" Error " +e);
        }
    });
	
	socket.on("queueDeal", function(data){
		if(data.type==9) {			
			console.log("@@@@@@@@@@===================================================socket.id = " +socket.id)
			var arrayLenth = queueSocket.length;			
			console.log("Array Length=================== = " +arrayLenth)
			queueSocket[arrayLenth] = socket;					
			if(queueSocket.length==1){	
				console.log("First @@@@@@@@@@socket.id = " +socket.id)
				onDeal(queueSocket[0]);
			}
		}else{
			queueSocket.shift();
			console.log("queueSocket=================================================");	
			if(queueSocket.length!=0){					
				console.log("Second @@@@@@@@@@socket.id============================ = " +socket.id)
				onDeal(queueSocket[0]);
			}	
		}
   });
   
   	socket.on("queueHit", function(data){
		if(data.type==9) {			
			console.log("@@@@@@@@@@=========================queueHit==========================socket.id = " +socket.id)
			var arrayLenth = queueHit.length;			
			console.log("Array Length============queueHit======= = " +arrayLenth)
			queueHit[arrayLenth] = socket;					
			if(queueHit.length==1){	
				console.log("First @@@@@@@@@@socket.id = " +socket.id)
				onHit(queueHit[0]);
			}
		}else{
			queueHit.shift();
			console.log("queueSocket============queueHit=====================================");	
			if(queueHit.length!=0){					
				console.log("Second @@@@@@@@@@socket.id============queueHit================ = " +socket.id)
				onHit(queueHit[0]);
			}	
		}
   });
    
    
    socket.on("show Coin", function(data){
        try{
            showRequest("show Coin")
            bustedCount = 0;
            for(cp in mobPlayer){
                if(mobPlayer[cp].socket.id==socket.id && mobPlayer[cp].join){
                    mobPlayer[cp].coin = true;
                    break;
                }
            }
            tvRooms[0].socket.emit('showCoin', socket.id, data);
        }catch(e){
            console.log(" Error " +e);
        }
    });
	
	
	var onDeal = function(socket){
        try{			
            var j=0,d=0,sec=800, position=0;
            for(cp in mobPlayer){            			
                if(mobPlayer[cp].socket.id==socket.id && mobPlayer[cp].join && mobPlayer[cp].coin){								
                    mobPlayer[cp].deal = true;
                    mobPlayer[cp].coin = false;                    
                    position=cp;
					console.log(" UP TO HERE ")					
                    tvRooms[0].socket.emit('showCardOnTable',socket.id);                       
                    /*setTimeout(function(){
						console.log("onDeal=====================================4");
                        tvRooms[0].socket.emit('showCardOnTable',socket.id);
                        console.log(" ################## sec*position = " +sec*position)
                    },sec*position);*/   
                    stage.deal = true;
					
                }
                if(mobPlayer[cp].join){				
                    j++;
                }
                if(mobPlayer[cp].deal){				
                    d++;
                }
            }						
            showRequest("j ="+j+" ::: d ="+d);						
            if(j==d && j>0){			
                for(cp in mobPlayer){			
                    if(mobPlayer[cp].join && mobPlayer[cp].deal){
                        mobPlayer[cp].deal = false;
                        mobPlayer[cp].socket.emit('enabledStand',{playerBalance:mobUser.getMoney(mobPlayer[cp].name)});
                        showRequest(" ********  enabledStand   ********")
                    }
                }   
            }
        }catch(e){
            console.log("ERROR :: "+e);
        }
    }
	

	/*
    socket.on("on Deal", function(){
        try{
			console.log(" UP TO HERE===============1");	
            var j=0,d=0,sec=800, position=0;
            for(cp in mobPlayer){
            console.log(" UP TO HERE===============2");    
                if(mobPlayer[cp].socket.id==socket.id && mobPlayer[cp].join && mobPlayer[cp].coin){
				console.log(" UP TO HERE===============3");
                    mobPlayer[cp].deal = true;
                    mobPlayer[cp].coin = false;                    
                    position=cp;
					console.log(" UP TO HERE ")
                    setTimeout(function(){
                        tvRooms[0].socket.emit('showCardOnTable',socket.id);
                        console.log(" ################## sec*position = " +sec*position)
                    },sec*position);   
                    stage.deal = true;
					
                }
                if(mobPlayer[cp].join){
                    j++;
                }
                if(mobPlayer[cp].deal){
                    d++;
                }
            }
			console.log(" UP TO HERE===============5");
            showRequest("j ="+j+" ::: d ="+d)
			console.log(" UP TO HERE===============6");
            if(j==d && j>0){
			console.log(" UP TO HERE===============7");	
                for(cp in mobPlayer){
				console.log(" UP TO HERE===============8");
                    if(mobPlayer[cp].join && mobPlayer[cp].deal){
                        mobPlayer[cp].deal = false;
                        mobPlayer[cp].socket.emit('enabledStand',{playerBalance:mobUser.getMoney(mobPlayer[cp].name)});
                        showRequest(" ********  enabledStand   ********")
                    }
                }   
            }
        }catch(e){
            console.log("ERROR :: "+e);
        }
    });
	*/
    
    socket.on("Raise Bet", function(data){
        tvRooms[0].socket.emit('raiseBet', socket.id, data);
    });
	
	
	var onHit = function(socket){
       var sec=800,position=0;
        for(cp in mobPlayer){
           if (mobPlayer[cp].socket.id==socket.id){
                //position=cp;
				tvRooms[0].socket.emit('fetchExtraCard', socket.id);	
				/*
                setTimeout(function(){
                    tvRooms[0].socket.emit('fetchExtraCard', socket.id);
                },sec*position); */
           
           }            
        }
    }
    
    /*
	socket.on("fetch Card", function(){
       var sec=800,position=0;
        for(cp in mobPlayer){
           if (mobPlayer[cp].socket.id==socket.id){
                position=cp;
                setTimeout(function(){
                    tvRooms[0].socket.emit('fetchExtraCard', socket.id);
                },sec*position); 
           
           }            
        }
    }); */
    
    socket.on("player Busted", function(data){
        for(cp in mobPlayer){
            if(mobPlayer[cp].socket.id==data.socketId){
                mobPlayer[cp].coin = false;
                mobPlayer[cp].deal = false;
                mobPlayer[cp].stand = false;
                mobPlayer[cp].join = false;//
                mobPlayer[cp].socket.emit('PlayerBusted');
                var name = data.playerName, money = data.playerBalance;
                if(name && name!="undefined" && money && money!="undefined"){
                    mobUser.setMoney(name,money);
                }
                break;
            }
        }
    
    });
    socket.on("show Result", function(){
        
        tvRooms[0].socket.emit('showResultOnTable', socket.id,false);
        stage.stand = true;
    });
    
    
    socket.on("Result", function(data){
        
        });
                  
    socket.on("lowAmount", function(data){
        for (var i=0;i<mobPlayer.length;
            i++){
            
            mobPlayer[i].socket.emit('lowAmountMobile',data.mobsocket);
        }
    });
  
    socket.on("saveUserState", function(data){
        try{
            
            var j=0,s=0;
            for(cp in mobPlayer){             
                if(mobPlayer[cp].socket.id==data.socketId){
                    mobPlayer[cp].stand = true;					
                    if(data.busted){
                        bustedCount++;
                        mobPlayer[cp].socket.emit('playerBusted');
                    }
                    if (data.playerBalance>=5000){
                        data.playerBalance=500;
                        console.log(" @@@@@@ mobUser.updateMoney(data.playerName,data.playerBalance);")
                        mobUser.updateMoney(data.playerName,data.playerBalance);
                    }                     
                }
                
                if(mobPlayer[cp].join){
                    j++;
                }				
                if(mobPlayer[cp].stand){				
                    s++;				
                }
            }
           
            if(j==s && s>0){                
                tvRooms[0].socket.emit('showResultOnTable',data.socketId,true);
                console.log("@@@@@@@@@@@@ Test Busted case ");
                
            }
        }catch(e){
            console.log(""+e);
        }
        
        
    });
    socket.on("gameIsOver", function(data){
        try{
                        
            for(d in data.socketId){
                if(data.socketId[d] && data.socketId[d]!=""){
                    name = data.playerName[d], money = data.playerBalance[d];
                    if(name && name!="undefined" && money!="undefined"){
                        mobUser.updateMoney(name,money);
                        console.log("userName : " + name  + " & userBalance = "+money);                        
                    }
                }
            }
            for(cp in mobPlayer){
                mobPlayer[cp].join = true;
                mobPlayer[cp].coin = false;
                mobPlayer[cp].deal = false;
                mobPlayer[cp].stand = false;
                mobPlayer[cp].socket.emit('restartGame',mobUser.getMoney(mobPlayer[cp].name));                 
                                   
                showRequest(" ********  enabledStand   ******** data.socketId ******* ")

            }
            stage.join = true;
            stage.deal = false;
            stage.stand = false;
            showRequest(" @@@@@@@@@@@@  All Restart Game    @@@@@@@@@@@@")
        }catch(e){
            console.log(" :: "+e);
        }
    });	
});
                  
                  
function showRequest(data){
    console.log("")
    console.log(" @@@@@@@@@@  "+data)
    console.log("")
}

function getIpAddress(){
    
	var interfaces = os.networkInterfaces();
    var addresses = [];
    for (k in interfaces) {
        for (k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family == 'IPv4' && !address.internal) {
                addresses.push(address.address)
            }
        }
    }

    showRequest("  addresses  "+JSON.stringify(interfaces));
    showRequest("  addresses  "+addresses);
    if(addresses.length>0){
        return addresses[0];
    }
}
