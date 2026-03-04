let tempEmail = "";
let resetEmailStorage = "";
let tempCode = "";

loginForm.addEventListener("submit", async e => {
    e.preventDefault();

    const identifier = e.target.identifier.value;
    const password = e.target.password.value;

    const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();

    if (data.success) {
        window.location.href = "/dashboard.html";
    } else {
        alert(data.message);
    }
});

registerForm.addEventListener("submit", async e => {

    e.preventDefault();

    const emailInput = document.getElementById("regEmail").value;
    const btn = registerForm.querySelector('button[type="submit"]');

    btn.textContent = "Sending...";
    btn.disabled = true;

    try {

        const res = await fetch("/auth/send-reg-code",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ email: emailInput })
        });

        const data = await res.json();

        if(data.success){

            tempEmail = emailInput;

            document.getElementById("codeSection").style.display = "block";
            btn.style.display = "none";

        }else{

            alert(data.message);

        }

    }catch(err){

        alert("Server connection failed");

    }

});

document.getElementById("verifyCodeBtn").onclick = async () => {

    const codeInput = document.getElementById("regVerifyCode").value;

    if(!codeInput) return alert("Enter verification code");

    const res = await fetch("/auth/verify-code",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            email: tempEmail,
            code: codeInput
        })
    });

    const data = await res.json();

    if(data.success){

        tempCode = codeInput;

        document.getElementById("loginModal").style.display = "none";
        document.getElementById("verifyModal").style.display = "flex";
        document.getElementById("verifyStep2").style.display = "block";

    }else{

        alert("Invalid code");

    }

};

document.getElementById("finishRegisterBtn").onclick = async () => {

    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;

    if(password !== confirm) return alert("Passwords do not match");

    const res = await fetch("/auth/complete-registration",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            email: tempEmail,
            code: tempCode,
            password: password,
            username: tempEmail.split("@")[0]
        })
    });

    const data = await res.json();

    if(data.success){

        alert("Account created!");
        location.reload();

    }else{

        alert(data.message);

    }

};

async function sendResetCode(){

const email = document.getElementById("resetEmail").value;

const res = await fetch("/auth/forgot-password",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({ email })
});

const data = await res.json();

if(data.success){

resetEmailStorage = email;

document.getElementById("resetStep1").style.display="none";
document.getElementById("resetStep2").style.display="block";

}else{

alert(data.message);

}

}

async function verifyResetCode(){

const code = document.getElementById("resetVerifyCode").value;

if(!code) return alert("Enter verification code");

const res = await fetch("/auth/verify-code",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
email: resetEmailStorage,
code: code
})
});

const data = await res.json();

if(data.success){

document.getElementById("resetCodeSection").style.display="none";
document.getElementById("resetPasswordSection").style.display="block";

}else{

alert("Invalid code");

}

}

async function verifyAndReset(){

const password = document.getElementById("newPassword").value;
const confirm = document.getElementById("ConfirmPassword").value;
const code = document.getElementById("resetVerifyCode").value;

if(password !== confirm) return alert("Passwords do not match");

const res = await fetch("/auth/reset-password",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
email: resetEmailStorage,
code: code,
newPassword: password
})
});

const data = await res.json();

if(data.success){

alert("Password updated!");
location.reload();

}else{

alert(data.message);

}

}