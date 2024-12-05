const HTTP_CODE_INTERNAL_ERR = 500;
const HTTP_CODE_BAD_REQUEST = 400;
const HTTP_CODE_UNAUTHORIZED = 401;

const fs = require("fs");
const http = require("http");
const express = require("express");
const canvas = require("canvas");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server( {server} );

const port = process.env.PORT || 4444;
const max_player = process.env.MAX_PLAYER || 3;

app.use(express.static(__dirname + "/game"));
app.use(express.static(__dirname + "/joinPage"));
// Отключение кэширования для всех страниц
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');  
    res.setHeader('Pragma', 'no-cache');         
    res.setHeader('Expires', '0');               
    next();
});

class Player{
    #size = [15, 15]; get size() { return this.#size };
    #username = undefined; get username() { return this.#username; }
    #ip = undefined; get ip() {return this.#ip; }
    #img = undefined; get img() { return this.#img; }

    constructor(_username, _ip){
        this.#username = _username;
        this.#ip = _ip;
        this.ws = "";
        
        this.x = 0;
        this.y = 0;
        this.mirror = 1;
        this.speed = 1.5;
        this.score = 0;
        this.up = false;
        this.down = false;
        this.right = false;
        this.left = false;
    }

    async loadImage(){
        this.#img = await canvas.loadImage("./game/ded.png");
    }

    draw(ctx){
        if(!this.#img) return;

        ctx.save();
        ctx.scale(this.mirror, 1);
        let x = this.x - this.size[0] / 2;
        if(this.mirror == -1) {
            x = -x - this.size[0];
        }
        ctx.drawImage(this.#img, x, this.y - this.size[1] / 2, this.size[0], this.size[1]);
        ctx.restore();

        const usernameWidth = ctx.measureText(this.username).width;

        const fontHeight = 10;
        ctx.fillStyle = "black";
        ctx.font = `${fontHeight}px consolas`;

        let scoreTxt = "Счет: " + this.score;
        ctx.fillText(scoreTxt, this.x - ctx.measureText(scoreTxt).width / 2, this.y - fontHeight - this.size[1] / 4);
        ctx.fillText(this.username, this.x - usernameWidth / 2, this.y - fontHeight * 2 - this.size[1] / 4);
        
    }
}

let xa = 75,
    ya = 75;
function generateApple() {
    xa = Math.round(Math.random() * game.windowWidth);
    ya = Math.round(Math.random() * game.windowHeight);
}
function drawApple(ctx){
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "orange";
    ctx.fillStyle = "red";
    ctx.arc(xa, ya, 3, 0, 2 * 3.14, false);
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth = 3 * 0.7;
    ctx.strokeStyle = "green";
    ctx.moveTo(xa + 1, ya - 3);
    ctx.lineTo(xa + 3, ya - 3 * 2);
    ctx.stroke();
}

class Game{
    #players = [];
    #cvs = undefined;
    #ctx = undefined;

    constructor(_width, _height){
        this.windowWidth = _width;
        this.windowHeight = _height;
        this.#cvs = canvas.createCanvas(this.windowWidth, this.windowHeight);
        this.#ctx = this.#cvs.getContext("2d");
        this.pause = false;
        setInterval(this.updateFrame, 15);
        console.log("Game started.");
    }

    addPlayer(player){
        player.x = this.windowWidth / 2;
        player.y = this.windowHeight / 2;
        this.#players.push(player);
    }

    removePlayer(player){
        this.#players.splice(this.#players.indexOf(player), 1);
    }

    findPlayer(predicate){
        return this.#players.find(predicate);
    }

    get playersCount(){
        return this.#players.length;
    }

    updateFrame = async () => {
        if(this.pause){
            return;
        }

        this.#ctx.clearRect(0, 0, this.windowWidth, this.windowHeight);

        for(let p of this.#players){
            if (p.up && p.y > 0) {
                p.y -= (p.right || p.left) ? 0.7 * p.speed : p.speed;
            }
            if (p.down && p.y < game.windowHeight) {
                p.y += (p.right || p.left) ? 0.7 * p.speed : p.speed;
            }
            if (p.right && p.x < game.windowWidth) {
                p.mirror = 1;
                p.x += (p.up || p.down) ? 0.7 * p.speed : p.speed;
            }
            if (p.left && p.x > 0) {
                p.mirror = -1;
                p.x -= (p.up || p.down) ? 0.7 * p.speed : p.speed;
            }

            if (Math.abs(p.x - xa) < p.size[0] / 2 && Math.abs(p.y - ya) < p.size[1] / 2) {
                generateApple();
                p.score++;
            }
    
            p.draw(this.#ctx);
            drawApple(this.#ctx);
        }

        this.sendFrame();
    }

    sendFrame(){
        for(const player of this.#players){
            if(player.ws){
                player.ws.send(this.#cvs.toDataURL());
            }
        }
    }
}


let game = new Game(128, 128);

function sendHtmlPage(filepath, res){
    fs.readFile(filepath, (err, data) => {
        if(err){
            console.log(`Error ${err.message}`);
            res.sendStatus(HTTP_CODE_INTERNAL_ERR);
            return;
        }
        res.setHeader("Content-Type", "text/html");
        res.send(data);
    });
}

//отправка страницы для подключения к серверу
app.get("/", (req, res) => {                            
    sendHtmlPage("joinPage/joinPage.html", res);
});

//обработка запроса подключения к серверу
app.get("/join", (req, res) => {                        
    const username = req.query.username.trim();
    if(!username){
        res.status(HTTP_CODE_BAD_REQUEST).json({errMsg: "Имя не должно быть пустым!"});
        return;
    } else if (username.length < 4 || username > 12){
        res.status(HTTP_CODE_BAD_REQUEST).json({errMsg: "Длина должна быть от 4 до 12 символов!"});
        return;
    } else if((game.findPlayer((player) => player.username == username))){
        res.status(HTTP_CODE_BAD_REQUEST).json({errMsg: "Имя уже занято!"});
        return;
    } else if(game.playersCount >= max_player){
        res.status(HTTP_CODE_BAD_REQUEST).json({errMsg: `На сервере максимальное число игроков (${max_player})!`});
        return;
    }

    let newPlayer = new Player(username, req.ip);
    newPlayer.loadImage();
    game.addPlayer(newPlayer);  
    res.redirect("/game");
});

//подключение к странице с игрой
app.get("/game", (req, res) => {
    if(!game.findPlayer((player) => player.ip == req.ip && !player.ws)){
        res.status(HTTP_CODE_UNAUTHORIZED);
        sendHtmlPage("game/unauthorized.html", res);
        return;
    }

    sendHtmlPage("game/game.html", res);
});

//установление соединения с игроком
wss.on("connection", (ws, req) => {
    let player = game.findPlayer((element) => element.ip == req.socket.remoteAddress && !element.ws);
    if(!player){
        ws.close();
        return;
    }
    player.ws = ws;

    console.log(`${player.username} connected.`);
    
    player.ws.onclose = () => {
        player.ws = undefined;
        setTimeout(() => {
            if(!player.ws){
                game.removePlayer(player);
                
                console.log(`${player.username} disconnected.`);
            }
        }, 500);
    };
    
    player.ws.onmessage = (event) => {
        const [action, code] = event.data.split(":");

        switch(code){
            case "KeyW":
                player.up = action == "keydown";
            break;
            case "KeyS":
                player.down = action == "keydown";
            break;
            case "KeyA":
                player.left = action == "keydown";
            break;
            case "KeyD":
                player.right = action == "keydown";
            break;
            case "KeyT":
                if(action == "keydown") { game.pause = !game.pause};
            break;
        }
    };
});

server.listen(port, () => { console.log(`Server started. Port: ${port}`); });