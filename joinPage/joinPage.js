const HTTP_CODE_BAD_REQUEST = 400;

async function connectToServer(){
    const username = document.getElementById("input-username").value;
    const res = await fetch(window.location.origin + `/join?username=${encodeURIComponent(username)}`);
    let infoLabel = document.getElementById("info");
    
    if(res.ok){
        window.location.href = res.url;

        infoLabel.style.color = "rgb(29, 117, 58)";
        infoLabel.textContent = "Подключение..";
    } else if(res.status == HTTP_CODE_BAD_REQUEST){
        const errMessage = await res.json();
        infoLabel.style.color = "red";
        infoLabel.textContent = errMessage.errMsg;

        console.log(errMessage);
    }
}