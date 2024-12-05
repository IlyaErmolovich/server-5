const ws = new WebSocket(window.location.origin);
let screen = document.getElementById("screen");

let frameCount = 0;

let pressedKeys = {
    "KeyW": false,
    "KeyS": false,
    "KeyA": false,
    "KeyD": false
};

document.addEventListener("keydown", async (event) => {
    if(pressedKeys[event.code]){
        return;
    }
    if(ws){ 
        pressedKeys[event.code] = true;
        await ws.send(`keydown:${event.code}`);
    }
});
document.addEventListener("keyup", async (event) => { 
    if(ws){ 
        pressedKeys[event.code] = false;
        await ws.send(`keyup:${event.code}`);
    }
});

ws.onmessage = (event) => {
    screen.src = event.data;
    frameCount++;
}

ws.onclose = () => {
    setTimeout(() => {
        document.getElementById("background-screen").style.display = "none";
        let txt = document.createElement("label");
        txt.textContent = "The server has closed the connection";
        document.body.appendChild(txt);
    }, 1000);
}
    
document.addEventListener('contextmenu', event => event.preventDefault());

window.addEventListener("beforeunload", () => { ws.close(); });

window.onblur = resetKeys;

async function resetKeys(){
    await ws.send("keyup:KeyW");
    await ws.send("keyup:KeyS");
    await ws.send("keyup:KeyA");
    await ws.send("keyup:KeyD");
    pressedKeys.KeyW = false;
    pressedKeys.KeyS = false;
    pressedKeys.KeyA = false;
    pressedKeys.KeyD = false;
}

setInterval(() => {
    console.log(frameCount);
    frameCount = 0;
}, 1000);